import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { BeliefStore, COARSE_THRESHOLD_MM, estimatePosition, POSITION_DRIFT_MM_PER_TICK, retell, uncertaintyAt } from "./belief.js";
import type { Belief } from "./belief.js";

/** P1-14. */
const T = (n: number): Int => n as Int;

function sighting(overrides: Partial<Belief> = {}): Belief {
  return {
    id: "belief.boar.1",
    kind: "ActorPosition",
    subjectId: "W004",
    observedAtTick: T(200),
    learnedAtTick: T(200),
    provenance: "Observed",
    uncertaintyMm: T(500),
    positionMm: [T(410_000), T(395_000)],
    ...overrides,
  };
}

function obligation(id: string, observedAtTick: number): Belief {
  return {
    id,
    kind: "Obligation",
    subjectId: "C009",
    observedAtTick: T(observedAtTick),
    learnedAtTick: T(observedAtTick),
    provenance: "Told",
    uncertaintyMm: T(0),
    obligation: { to: "C009", dueTick: T(5_000), satisfied: false },
  };
}

describe("reports keep the original observation (criterion 1)", () => {
  it("retelling does not move the observed time to the moment of telling", () => {
    const seen = sighting();
    const told = retell(seen, "C009", T(900));
    expect(told.observedAtTick).toBe(200);
    expect(told.learnedAtTick).toBe(900);
    expect(told.provenance).toBe("Reported");
  });

  it("makes a retold belief vaguer than the sighting, not fresher", () => {
    const seen = sighting();
    const told = retell(seen, "C009", T(900));
    expect(told.uncertaintyMm).toBeGreaterThan(seen.uncertaintyMm);
    // Age is measured from the observation, so the rumour is old the moment it arrives.
    expect(uncertaintyAt(told, T(900))).toBeGreaterThan(uncertaintyAt(seen, T(210)));
  });

  it("ages from the observation even through a chain of retellings", () => {
    let belief = sighting();
    for (const [teller, tick] of [["C009", 400], ["C017", 600], ["C022", 900]] as const) {
      belief = retell(belief, teller, T(tick));
    }
    expect(belief.observedAtTick).toBe(200);
    expect(belief.provenance).toBe("Reported");
    // Three retellings cost three increments of uncertainty on top of the drift.
    expect(belief.uncertaintyMm).toBe(500 + 3 * 2_000);
  });

  it("grows uncertainty with the age of the observation, not of the record", () => {
    const seen = sighting();
    expect(uncertaintyAt(seen, T(200))).toBe(500);
    expect(uncertaintyAt(seen, T(210))).toBe(500 + 10 * POSITION_DRIFT_MM_PER_TICK);
    // A tick before the observation cannot make it more certain than it was.
    expect(uncertaintyAt(seen, T(100))).toBe(500);
  });
});

describe("obligations survive ordinary eviction (criterion 2)", () => {
  it("keeps a live obligation while older ordinary beliefs are dropped", () => {
    const store = new BeliefStore(3);
    store.learn(obligation("belief.promise", 10));
    for (let i = 0; i < 6; i += 1) store.learn(sighting({ id: `belief.sighting.${i}`, observedAtTick: T(100 + i) }));

    expect(store.size).toBe(3);
    expect(store.get("belief.promise"), "the oldest record was a promise and it was evicted").toBeDefined();
    expect(store.all().filter((b) => b.kind === "ActorPosition")).toHaveLength(2);
  });

  it("keeps every live obligation even when they fill memory, and says how many", () => {
    const store = new BeliefStore(3);
    for (let i = 0; i < 5; i += 1) store.learn(obligation(`belief.promise.${i}`, 10 + i));
    const result = store.evict();
    expect(store.size).toBe(5);
    expect(result.evicted).toEqual([]);
    expect(result.protectedCount).toBe(5);
  });

  it("lets a satisfied obligation be evicted like anything else", () => {
    const store = new BeliefStore(2);
    store.learn(obligation("belief.promise", 10));
    expect(store.satisfy("belief.promise")).toBe(true);
    store.learn(sighting({ id: "belief.a", observedAtTick: T(100) }));
    store.learn(sighting({ id: "belief.b", observedAtTick: T(101) }));
    expect(store.get("belief.promise")).toBeUndefined();
  });

  it("evicts deterministically, so two runs forget the same thing", () => {
    const run = (): string[] => {
      const store = new BeliefStore(2);
      for (const id of ["belief.c", "belief.a", "belief.b"]) store.learn(sighting({ id, observedAtTick: T(100) }));
      return store.all().map((b) => b.id);
    };
    expect(run()).toEqual(run());
  });
});

describe("a stale position never becomes a fresh coordinate (criterion 3)", () => {
  it("reports an exact position while the sighting is recent", () => {
    const estimate = estimatePosition(sighting(), T(210));
    expect(estimate?.precision).toBe("Exact");
    if (estimate?.precision !== "Exact") return;
    expect(estimate.positionMm).toEqual([410_000, 395_000]);
    expect(estimate.observedAtTick).toBe(200);
  });

  it("reports an area once uncertainty passes the threshold, and withholds the point entirely", () => {
    const ticksToCoarse = Math.ceil(COARSE_THRESHOLD_MM / POSITION_DRIFT_MM_PER_TICK);
    const stale = estimatePosition(sighting(), T(200 + ticksToCoarse + 1));
    expect(stale?.precision).toBe("Area");
    if (stale?.precision !== "Area") return;
    expect(stale.radiusMm).toBeGreaterThanOrEqual(COARSE_THRESHOLD_MM);
    // The exact coordinate is not in the result at all: a caller cannot use what
    // it was never given.
    expect(Object.keys(stale)).not.toContain("positionMm");
    expect(stale.ageTicks).toBeGreaterThan(0);
  });

  it("never sharpens with age: the radius only grows", () => {
    const belief = sighting();
    let previous = 0;
    for (let tick = 200; tick < 400; tick += 10) {
      const radius = uncertaintyAt(belief, T(tick)) as number;
      expect(radius).toBeGreaterThanOrEqual(previous);
      previous = radius;
    }
  });

  it("does not let a retelling restore precision an hour after the sighting", () => {
    const seen = sighting();
    const told = retell(seen, "C009", T(3_800));
    const estimate = estimatePosition(told, T(3_800));
    expect(estimate?.precision).toBe("Area");
    if (estimate?.precision !== "Area") return;
    // An hour of drift, not the moments since the conversation.
    expect(estimate.ageTicks).toBe(3_600);
  });

  it("has nothing to estimate for a belief that carries no position", () => {
    expect(estimatePosition(obligation("belief.promise", 10), T(500))).toBeUndefined();
  });
});
