import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import {
  applyResult,
  countResults,
  loadLatest,
  MemoryStorage,
  readResult,
  resultKeyFor,
  saveCheckpoint,
  writeContainer,
} from "./index.js";
import type { ResultRecord, StorageAdapter } from "./index.js";
import { IndexedDbStorage } from "./indexeddb.js";

/**
 * One contract, every adapter (W0-08).
 *
 * `MemoryStorage` and the IndexedDB adapter are run through the *same* suite, so
 * "it works in memory" can never stand in for "it works in the browser". The
 * browser's own IndexedDB is the third implementation; it runs this behaviour
 * through `tests/playwright/persistence.spec.ts`.
 */
const adapters: readonly [string, () => Promise<StorageAdapter>][] = [
  ["MemoryStorage", async () => new MemoryStorage()],
  ["IndexedDbStorage (fake-indexeddb)", async () => IndexedDbStorage.open(new IDBFactory(), `lastclan-test-${Math.floor(Date.now() % 1e9)}-${counter()}`)],
];

let n = 0;
function counter(): number {
  n += 1;
  return n;
}

const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);
const container = (marker: number): Uint8Array => writeContainer([{ name: "world", formatVersion: 1, bytes: bytes(marker) }]);

describe.each(adapters)("storage contract: %s", (_name, create) => {
  it("returns undefined for a key it has never seen", async () => {
    const storage = await create();
    expect(await storage.get("meta", "absent")).toBeUndefined();
    expect(await storage.keys("meta")).toEqual([]);
  });

  it("round-trips bytes and lists keys in order", async () => {
    const storage = await create();
    await storage.put("snapshots", "run-a/gen2", bytes(2, 2));
    await storage.put("snapshots", "run-a/gen1", bytes(1));
    expect(await storage.get("snapshots", "run-a/gen1")).toEqual(bytes(1));
    expect(await storage.keys("snapshots")).toEqual(["run-a/gen1", "run-a/gen2"]);
  });

  it("copies on write, so a later mutation of the caller's buffer cannot change what was stored", async () => {
    const storage = await create();
    const buffer = bytes(7, 7);
    await storage.put("meta", "k", buffer);
    buffer[0] = 99;
    expect(await storage.get("meta", "k")).toEqual(bytes(7, 7));
  });

  it("refuses an add on an existing key, which is what makes finalization exactly-once", async () => {
    const storage = await create();
    await storage.add("results", "key", bytes(1));
    await expect(storage.add("results", "key", bytes(2))).rejects.toThrow(/ResultConflict/u);
    expect(await storage.get("results", "key")).toEqual(bytes(1));
  });

  it("deletes without complaining about a missing key", async () => {
    const storage = await create();
    await storage.put("meta", "k", bytes(1));
    await storage.delete("meta", "k");
    await storage.delete("meta", "k");
    expect(await storage.get("meta", "k")).toBeUndefined();
  });

  it("advances generations and falls back when the newest is corrupt", async () => {
    const storage = await create();
    await saveCheckpoint(storage, "run-a", container(1));
    await saveCheckpoint(storage, "run-a", container(2));
    expect((await loadLatest(storage, "run-a")).generation).toBe(2);

    const corrupt = (await storage.get("snapshots", "run-a/gen2")) as Uint8Array;
    corrupt[corrupt.byteLength - 1] = (corrupt[corrupt.byteLength - 1] ?? 0) ^ 0xff;
    await storage.put("snapshots", "run-a/gen2", corrupt);

    const loaded = await loadLatest(storage, "run-a");
    expect(loaded.generation).toBe(1);
    expect(loaded.sections[0]?.bytes).toEqual(bytes(1));
    expect(loaded.fellBackFrom?.code).toBe("ChecksumMismatch");
  });

  it("applies the same result twice and increments once, and rejects a conflicting payload", async () => {
    const storage = await create();
    const record: ResultRecord = {
      resultKey: resultKeyFor("run-a", 36_000, "4d0bd28a"),
      runId: "run-a",
      finalTick: 36_000,
      winnerActorId: "C017",
      authoritativeDigest: "4d0bd28a",
    };
    expect(await applyResult(storage, record)).toMatchObject({ applied: true, appliedCount: 1 });
    expect(await applyResult(storage, record)).toMatchObject({ applied: false, alreadyPresent: true, appliedCount: 1 });
    await expect(applyResult(storage, { ...record, winnerActorId: "C042" })).rejects.toThrow(/ResultConflict/u);
    expect(await countResults(storage)).toBe(1);
    expect((await readResult(storage, record.resultKey))?.winnerActorId).toBe("C017");
  });

  it("refuses a store this build did not create, instead of silently succeeding", async () => {
    const storage = await create();
    if (storage instanceof MemoryStorage) return; // memory has no fixed store list
    await expect(storage.get("not-a-store", "k")).rejects.toThrow(/unknown object store/u);
  });
});
