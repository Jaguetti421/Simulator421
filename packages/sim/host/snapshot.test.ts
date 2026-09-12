import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { loadLatest, MemoryStorage, PersistenceError, saveCheckpoint, SNAPSHOT_STORE } from "../persistence/index.js";
import { decodeWorldSnapshot, encodeWorldSnapshot } from "../persistence/snapshot.js";
import { createWorld, runTick } from "../core/index.js";
import { SimHost, toSnapshot } from "./index.js";

/**
 * Save round trip and continuation equality (W0-08, acceptance criterion 1,
 * Node adapters). The claim under test is the one that matters for replay: a
 * run that was interrupted, saved, restored and continued must be
 * indistinguishable from one that never stopped.
 */
const SEED = 4107 as Int;

function host(ticks: number): SimHost {
  const h = SimHost.create({ matchSeed: SEED, withGuest: true });
  h.runTicks(ticks);
  return h;
}

describe("snapshot round trip", () => {
  it("restores every consequential field, byte for byte", () => {
    const original = host(137);
    const bytes = original.save();
    const decoded = decodeWorldSnapshot(bytes);
    expect(encodeWorldSnapshot(decoded)).toEqual(bytes);

    const restored = SimHost.restore(bytes);
    expect(restored.tick).toBe(137);
    expect(restored.actorCount).toBe(137);
    expect(restored.authoritativeDigest()).toBe(original.authoritativeDigest());
  });

  it("continues to the same hashes as an uninterrupted run", () => {
    const uninterrupted = host(600);
    const interrupted = SimHost.restore(host(300).save());
    interrupted.runTicks(300);
    expect(interrupted.tick).toBe(600);
    expect(interrupted.authoritativeDigest()).toBe(uninterrupted.authoritativeDigest());
  });

  it("survives several save/restore cycles without drifting", () => {
    let current = SimHost.create({ matchSeed: SEED, withGuest: true });
    for (let i = 0; i < 6; i += 1) {
      current.runTicks(100);
      current = SimHost.restore(current.save());
    }
    expect(current.tick).toBe(600);
    expect(current.authoritativeDigest()).toBe(host(600).authoritativeDigest());
  });

  it("carries pending commands and the rules version across a restore", () => {
    const original = SimHost.create({ matchSeed: SEED, withGuest: true });
    original.runTicks(10);
    original.submit({ sequence: 1, atTick: 700, expectedRulesVersion: 0, lawId: "Truce", startTick: 1400, endTick: 2400 });
    const restored = SimHost.restore(original.save());
    restored.runTicks(700);
    original.runTicks(700);
    expect(restored.outcomes()[0]).toMatchObject({ sequence: 1, accepted: true });
    expect(restored.authoritativeDigest()).toBe(original.authoritativeDigest());
  });

  it("does not restore diagnostics, and says so by leaving the counters at zero", () => {
    const original = host(50);
    expect(original.report().counters.routeQueries).toBeGreaterThan(0);
    const restored = SimHost.restore(original.save());
    expect(restored.report().counters.routeQueries).toBe(0);
    expect(restored.report().counters.ticks).toBe(0);
    // ...and the hash is unaffected, because diagnostics were never in it.
    expect(restored.authoritativeDigest()).toBe(original.authoritativeDigest());
  });

  it("refuses a save whose bytes were altered", () => {
    const bytes = host(20).save();
    bytes[bytes.byteLength - 5] = (bytes[bytes.byteLength - 5] ?? 0) ^ 0xff;
    expect(() => SimHost.restore(bytes)).toThrow(PersistenceError);
  });

  it("maps the live world onto plain data only — the save format holds no kernel objects", () => {
    const world = createWorld({ matchSeed: SEED, withGuest: true });
    runTick(world);
    const snapshot = toSnapshot(world);
    // Round-tripping through JSON must lose nothing: if a RandomStream instance
    // or any other live object had leaked in, this comparison would fail.
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(snapshot.streams.motion).toEqual(world.streams.motion.snapshot());
    expect(snapshot.actors).toHaveLength(world.actors.length);
  });
});


describe("kernel saves through the generation store", () => {
  it("restores a continued run from the previous generation when the newest is corrupt", () => {
    const storage = new MemoryStorage();
    const atThree = host(300);
    saveCheckpoint(storage, "run-a", atThree.save());
    const atSix = host(600);
    saveCheckpoint(storage, "run-a", atSix.save());

    const corrupt = storage.get(SNAPSHOT_STORE, "run-a/gen2") as Uint8Array;
    corrupt[corrupt.byteLength - 9] = (corrupt[corrupt.byteLength - 9] ?? 0) ^ 0xff;
    storage.put(SNAPSHOT_STORE, "run-a/gen2", corrupt);

    const loaded = loadLatest(storage, "run-a");
    expect(loaded.generation).toBe(1);
    expect(loaded.fellBackFrom?.code).toBe("ChecksumMismatch");

    // The fallback is a usable world, not a husk: continuing from it reaches the
    // same tick-600 state the corrupt generation was supposed to hold.
    const resumed = SimHost.restore(storage.get(SNAPSHOT_STORE, "run-a/gen1") as Uint8Array);
    resumed.runTicks(300);
    expect(resumed.authoritativeDigest()).toBe(atSix.authoritativeDigest());
  });
});
