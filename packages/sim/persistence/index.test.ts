import { describe, expect, it } from "vitest";
import {
  applyResult,
  CONTAINER_SCHEMA_VERSION,
  containerDigest,
  countResults,
  loadLatest,
  MemoryStorage,
  PersistenceError,
  readContainer,
  readResult,
  resultKeyFor,
  saveCheckpoint,
  SNAPSHOT_STORE,
  writeContainer,
} from "./index.js";
import type { ResultRecord } from "./index.js";

const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);

function container(): Uint8Array {
  return writeContainer([
    { name: "world", formatVersion: 1, bytes: bytes(1, 2, 3, 4) },
    { name: "random", formatVersion: 1, bytes: bytes(9, 9) },
  ]);
}

describe("the versioned section container", () => {
  it("round-trips every section with its format version", () => {
    const sections = readContainer(container());
    expect(sections.map((s) => s.name)).toEqual(["random", "world"]);
    expect(sections[1]?.bytes).toEqual(bytes(1, 2, 3, 4));
    expect(sections[1]?.formatVersion).toBe(1);
  });

  it("writes sections in name order, so the same content always produces the same bytes", () => {
    const a = writeContainer([
      { name: "world", formatVersion: 1, bytes: bytes(1) },
      { name: "random", formatVersion: 1, bytes: bytes(2) },
    ]);
    const b = writeContainer([
      { name: "random", formatVersion: 1, bytes: bytes(2) },
      { name: "world", formatVersion: 1, bytes: bytes(1) },
    ]);
    expect(a).toEqual(b);
    expect(containerDigest(a)).toBe(containerDigest(b));
  });

  it("detects a flipped byte through the per-section checksum", () => {
    const raw = container();
    raw[raw.byteLength - 1] = (raw[raw.byteLength - 1] ?? 0) ^ 0xff;
    expect(() => readContainer(raw)).toThrow(PersistenceError);
    try {
      readContainer(raw);
    } catch (e) {
      expect((e as PersistenceError).code).toBe("ChecksumMismatch");
      expect((e as PersistenceError).message).toContain("not the bytes that were written");
    }
  });

  it("detects truncation rather than decoding a partial section", () => {
    const raw = container();
    expect(() => readContainer(raw.slice(0, raw.byteLength - 3))).toThrow(/Truncated/u);
    expect(() => readContainer(raw.slice(0, 3))).toThrow(/Truncated/u);
  });

  it("refuses an unknown container version instead of guessing its layout", () => {
    const raw = container();
    raw[4] = 9; // schemaVersion is the u16 after the magic
    expect(() => readContainer(raw)).toThrow(/UnknownSchemaVersion/u);
    expect(CONTAINER_SCHEMA_VERSION).toBe(1);
  });

  it("refuses foreign bytes and duplicate section names", () => {
    expect(() => readContainer(bytes(0, 0, 0, 0, 1, 0, 0, 0))).toThrow(/BadMagic/u);
    expect(() =>
      writeContainer([
        { name: "world", formatVersion: 1, bytes: bytes(1) },
        { name: "world", formatVersion: 1, bytes: bytes(2) },
      ]),
    ).toThrow(/DuplicateSection/u);
  });
});

describe("two-generation durable saves", () => {
  it("advances the generation pointer only after the payload is written", () => {
    const storage = new MemoryStorage();
    const first = saveCheckpoint(storage, "run-a", container());
    expect(first).toMatchObject({ saved: true, generation: 1 });
    const second = saveCheckpoint(storage, "run-a", container());
    expect(second.generation).toBe(2);
    expect(loadLatest(storage, "run-a").generation).toBe(2);
  });

  it("never acknowledges a save whose write failed, and leaves the previous generation authoritative", () => {
    const storage = new MemoryStorage();
    saveCheckpoint(storage, "run-a", writeContainer([{ name: "world", formatVersion: 1, bytes: bytes(1) }]));
    storage.failNextWrite = "quota exceeded";
    expect(() => saveCheckpoint(storage, "run-a", container())).toThrow(/WriteFailed/u);

    const loaded = loadLatest(storage, "run-a");
    expect(loaded.generation).toBe(1);
    expect(loaded.sections[0]?.bytes).toEqual(bytes(1));
    expect(loaded.fellBackFrom).toBeUndefined();
  });

  it("falls back to the previous valid generation when the newest one is corrupt, and says so", () => {
    const storage = new MemoryStorage();
    saveCheckpoint(storage, "run-a", writeContainer([{ name: "world", formatVersion: 1, bytes: bytes(1) }]));
    saveCheckpoint(storage, "run-a", writeContainer([{ name: "world", formatVersion: 1, bytes: bytes(2) }]));

    const corrupt = storage.get(SNAPSHOT_STORE, "run-a/gen2") as Uint8Array;
    corrupt[corrupt.byteLength - 1] = (corrupt[corrupt.byteLength - 1] ?? 0) ^ 0xff;
    storage.put(SNAPSHOT_STORE, "run-a/gen2", corrupt);

    const loaded = loadLatest(storage, "run-a");
    expect(loaded.generation).toBe(1);
    expect(loaded.sections[0]?.bytes).toEqual(bytes(1));
    expect(loaded.fellBackFrom).toMatchObject({ generation: 2, code: "ChecksumMismatch" });
  });

  it("falls back when the newest generation is truncated mid-write", () => {
    const storage = new MemoryStorage();
    saveCheckpoint(storage, "run-a", writeContainer([{ name: "world", formatVersion: 1, bytes: bytes(1) }]));
    saveCheckpoint(storage, "run-a", container());
    const partial = (storage.get(SNAPSHOT_STORE, "run-a/gen2") as Uint8Array).slice(0, 12);
    storage.put(SNAPSHOT_STORE, "run-a/gen2", partial);

    const loaded = loadLatest(storage, "run-a");
    expect(loaded.generation).toBe(1);
    expect(loaded.fellBackFrom?.code).toBe("Truncated");
  });

  it("refuses to load a run that has no checkpoint rather than returning an empty world", () => {
    expect(() => loadLatest(new MemoryStorage(), "run-missing")).toThrow(/NoValidGeneration/u);
  });

  it("keeps two generations and drops older ones", () => {
    const storage = new MemoryStorage();
    for (let i = 0; i < 4; i += 1) saveCheckpoint(storage, "run-a", container());
    expect(storage.keys(SNAPSHOT_STORE)).toEqual(["run-a/gen3", "run-a/gen4"]);
  });
});

describe("exactly-once finalization", () => {
  const record: ResultRecord = {
    resultKey: resultKeyFor("run-a", 36_000, "4d0bd28a"),
    runId: "run-a",
    finalTick: 36_000,
    winnerActorId: "C017",
    authoritativeDigest: "4d0bd28a",
  };

  it("increments once when the same result is applied twice", () => {
    const storage = new MemoryStorage();
    const first = applyResult(storage, record);
    const second = applyResult(storage, record);
    expect(first).toMatchObject({ applied: true, alreadyPresent: false, appliedCount: 1 });
    expect(second).toMatchObject({ applied: false, alreadyPresent: true, appliedCount: 1 });
    expect(countResults(storage)).toBe(1);
    expect(readResult(storage, record.resultKey)?.winnerActorId).toBe("C017");
  });

  it("fails explicitly when a different payload claims the same key", () => {
    const storage = new MemoryStorage();
    applyResult(storage, record);
    expect(() => applyResult(storage, { ...record, winnerActorId: "C042" })).toThrow(/ResultConflict/u);
    expect(readResult(storage, record.resultKey)?.winnerActorId).toBe("C017");
    expect(countResults(storage)).toBe(1);
  });

  it("uses add semantics underneath, so a raw overwrite of an existing key is refused", () => {
    const storage = new MemoryStorage();
    applyResult(storage, record);
    expect(() => storage.add("results", record.resultKey, new Uint8Array([1]))).toThrow(/ResultConflict/u);
  });

  it("derives a result key from the run, the final tick and the authoritative digest", () => {
    expect(resultKeyFor("run-a", 36_000, "4d0bd28a")).toBe("run-a:36000:4d0bd28a");
    expect(resultKeyFor("run-a", 36_000, "4d0bd28a")).not.toBe(resultKeyFor("run-a", 36_000, "ffffffff"));
  });

  it("never acknowledges a result whose write failed", () => {
    const storage = new MemoryStorage();
    storage.failNextWrite = "transaction aborted";
    expect(() => applyResult(storage, record)).toThrow(/WriteFailed/u);
    expect(countResults(storage)).toBe(0);
  });
});
