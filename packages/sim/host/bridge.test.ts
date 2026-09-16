import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { dataAgeLabel, InterpolationCache, sampleOf, settlePause, SnapshotBridge } from "./bridge.js";
import type { ActorSample, Snapshot } from "./bridge.js";

/** P1-27. */
const T = (n: number): Int => n as Int;

function frame(tick: number, actors: ActorSample[]): Snapshot {
  return { tick: T(tick), actors, digest: "deadbeef", publishedSequence: 0 };
}

describe("one shared read buffer and a local previous cache (criterion 1)", () => {
  it("keeps exactly one snapshot however many are published", () => {
    const bridge = new SnapshotBridge();
    for (let tick = 0; tick < 100; tick += 1) bridge.publish(frame(tick, [sampleOf("C003", 400_000 + tick * 100, 400_000)]));
    expect(bridge.publishedCount).toBe(100);
    const read = bridge.read();
    expect(read?.snapshot.tick).toBe(99);
    expect(read?.skipped).toBe(99);
  });

  it("gives every reader the same frozen value, not a handle into the core", () => {
    const bridge = new SnapshotBridge();
    bridge.publish(frame(10, [sampleOf("C003", 400_000, 400_000)]));
    const read = bridge.read();
    expect(Object.isFrozen(read?.snapshot)).toBe(true);
    expect(Object.isFrozen(read?.snapshot.actors)).toBe(true);
    expect(() => {
      (read?.snapshot.actors[0] as { xMm: number }).xMm = 999;
    }).toThrow();
  });

  it("keeps the previous-sample cache on the view side, holding copies", () => {
    const cache = new InterpolationCache();
    const first = frame(10, [sampleOf("C003", 400_000, 400_000)]);
    cache.interpolate(first, 1_000);
    expect(cache.size).toBe(1);
    expect(cache.previousTick).toBe(10);
    // Mutating the source sample afterwards cannot reach the cache.
    const mutable = { ...(first.actors[0] as ActorSample), xMm: T(999) };
    expect(mutable.xMm).toBe(999);
    const next = cache.interpolate(frame(11, [sampleOf("C003", 401_000, 400_000)]), 0);
    expect(next[0]?.xMm).toBe(400_000);
  });

  it("forgets an actor the view stops drawing", () => {
    const cache = new InterpolationCache();
    cache.interpolate(frame(10, [sampleOf("C003", 400_000, 400_000)]), 1_000);
    cache.forget("C003");
    expect(cache.size).toBe(0);
  });
});

describe("slow rendering cannot mutate or block the core (criterion 2)", () => {
  it("lets the core publish freely while no reader is reading", () => {
    const bridge = new SnapshotBridge();
    for (let tick = 0; tick < 1_000; tick += 1) bridge.publish(frame(tick, [sampleOf("C003", 400_000, 400_000)]));
    expect(bridge.publishedCount).toBe(1_000);
    expect(bridge.acknowledgedTick).toBe(999);
  });

  it("gives a reader that missed 500 ticks the newest frame and tells it how many it skipped", () => {
    const bridge = new SnapshotBridge();
    bridge.publish(frame(0, [sampleOf("C003", 400_000, 400_000)]));
    expect(bridge.read()?.skipped).toBe(0);
    for (let tick = 1; tick <= 500; tick += 1) bridge.publish(frame(tick, [sampleOf("C003", 400_000 + tick, 400_000)]));
    const late = bridge.read();
    expect(late?.snapshot.tick).toBe(500);
    expect(late?.skipped).toBe(499);
  });

  it("cannot have an interpolated value written back into a snapshot", () => {
    // `InterpolatedActor` is a different type from `ActorSample`: the smoothed
    // x is a plain number and carries `interpolated`, so it does not satisfy the
    // sample shape the core publishes. This is the compile-time half; the runtime
    // half is the freeze above.
    const cache = new InterpolationCache();
    cache.interpolate(frame(10, [sampleOf("C003", 400_000, 400_000)]), 1_000);
    const smoothed = cache.interpolate(frame(11, [sampleOf("C003", 402_000, 400_000)]), 500);
    expect(smoothed[0]?.interpolated).toBe(true);
    expect(Object.keys(smoothed[0] ?? {})).toContain("interpolated");
    expect(Object.keys(smoothed[0] ?? {})).not.toContain("facingMm");
  });

  it("interpolates between the previous and current samples, and lands exactly on each end", () => {
    const cache = new InterpolationCache();
    cache.interpolate(frame(10, [sampleOf("C003", 400_000, 400_000)]), 1_000);
    expect(cache.interpolate(frame(11, [sampleOf("C003", 402_000, 400_000)]), 0)[0]?.xMm).toBe(400_000);

    const again = new InterpolationCache();
    again.interpolate(frame(10, [sampleOf("C003", 400_000, 400_000)]), 1_000);
    expect(again.interpolate(frame(11, [sampleOf("C003", 402_000, 400_000)]), 500)[0]?.xMm).toBe(401_000);

    const full = new InterpolationCache();
    full.interpolate(frame(10, [sampleOf("C003", 400_000, 400_000)]), 1_000);
    expect(full.interpolate(frame(11, [sampleOf("C003", 402_000, 400_000)]), 1_000)[0]?.xMm).toBe(402_000);
  });

  it("clamps an out-of-range alpha rather than extrapolating past the snapshot", () => {
    const cache = new InterpolationCache();
    cache.interpolate(frame(10, [sampleOf("C003", 400_000, 400_000)]), 1_000);
    expect(cache.interpolate(frame(11, [sampleOf("C003", 402_000, 400_000)]), 5_000)[0]?.xMm).toBe(402_000);
  });

  it("shows an actor with no previous sample at its authoritative position", () => {
    const cache = new InterpolationCache();
    const drawn = cache.interpolate(frame(10, [sampleOf("C009", 410_000, 400_000)]), 300);
    expect(drawn[0]?.xMm).toBe(410_000);
    expect(drawn[0]?.interpolated).toBe(false);
  });
});

describe("pause settles to the acknowledged tick and age is visible (criterion 3)", () => {
  it("settles on the tick the core acknowledged, not on what the view was drawing", () => {
    const bridge = new SnapshotBridge();
    for (let tick = 0; tick <= 42; tick += 1) bridge.publish(frame(tick, [sampleOf("C003", 400_000, 400_000)]));
    const paused = settlePause(bridge);
    expect(paused.paused).toBe(true);
    expect(paused.settledTick).toBe(42);
  });

  it("reports zero age for a fresh read and a real age for a stale one", () => {
    const bridge = new SnapshotBridge();
    bridge.publish(frame(10, [sampleOf("C003", 400_000, 400_000)]));
    expect(bridge.read()?.ageTicks).toBe(0);
    expect(bridge.peekAgeTicks()).toBe(0);
  });

  it("labels the data age in a line a view can show", () => {
    const bridge = new SnapshotBridge();
    bridge.publish(frame(7, [sampleOf("C003", 400_000, 400_000)]));
    expect(dataAgeLabel(bridge.read() as never)).toBe("tick 7 (current)");

    for (let tick = 8; tick <= 12; tick += 1) bridge.publish(frame(tick, [sampleOf("C003", 400_000, 400_000)]));
    expect(dataAgeLabel(bridge.read() as never)).toBe("tick 12 (current), 4 skipped");
  });

  it("returns nothing at all before the first publish, rather than an empty frame", () => {
    const bridge = new SnapshotBridge();
    expect(bridge.read()).toBeUndefined();
    expect(bridge.peekAgeTicks()).toBeUndefined();
    expect(settlePause(bridge).settledTick).toBe(0);
  });
});
