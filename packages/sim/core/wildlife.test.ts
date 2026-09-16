import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { DEER_FLIGHT_MM, denPlacementValid, prototypePopulation, speciesPolicy, threatFallback, WILDLIFE, withinInterruptBound, WOLF_AGGRO_MM } from "./wildlife.js";
import type { Animal, AnimalPerception } from "./wildlife.js";
import { decide } from "./decision.js";
import { PermissionService } from "./permission.js";
import type { Law } from "./permission.js";
import { resolveHarm } from "./sanctuary.js";

/** P1-25. */
const T = (n: number): Int => n as Int;
const at = (x: number, y: number): readonly [Int, Int] => [T(x), T(y)];

const wolf: Animal = { animalId: "W001", species: "Wolf", packId: "pack.01", positionMm: at(400_000, 400_000), denMm: at(400_000, 400_000), healthMilli: T(60_000) };
const deer: Animal = { animalId: "D001", species: "Deer", positionMm: at(500_000, 400_000), denMm: at(500_000, 400_000), healthMilli: T(40_000) };

function sees(distanceMm: number, actorId = "C003"): AnimalPerception {
  return { nearestActorId: actorId, nearestActorPositionMm: at(400_000 + distanceMm, 400_000), nearestActorDistanceMm: T(distanceMm), packMatesNearby: 2 };
}

describe("an observed stronger threat interrupts within five ticks (criterion 1)", () => {
  it("interrupts when the threat outweighs the task, and reports its latency", () => {
    const result = threatFallback({ threatId: "W001", kind: "Animal", sightedAtTick: T(100), severityMilli: 800 }, 200, T(103));
    expect(result.interrupt).toBe(true);
    expect(result.latencyTicks).toBe(3);
    expect(withinInterruptBound(result)).toBe(true);
  });

  it("does not interrupt for something less dangerous than what the actor is doing", () => {
    const result = threatFallback({ threatId: "D001", kind: "Animal", sightedAtTick: T(100), severityMilli: 100 }, 600, T(101));
    expect(result.interrupt).toBe(false);
    expect(result.candidate).toBeUndefined();
    expect(result.detail).toContain("does not outweigh");
  });

  it("reports a fallback that arrived late rather than hiding it", () => {
    const late = threatFallback({ threatId: "W001", kind: "Animal", sightedAtTick: T(100), severityMilli: 900 }, 100, T(107));
    expect(late.interrupt).toBe(true);
    expect(withinInterruptBound(late)).toBe(false);
    expect(late.latencyTicks).toBe(7);
  });

  it("produces an emergency candidate, so the switching delay is bypassed", () => {
    const result = threatFallback({ threatId: "W001", kind: "Animal", sightedAtTick: T(100), severityMilli: 900 }, 100, T(101));
    expect(result.candidate?.emergency).toBe(true);

    // End to end through P1-16: mid-delay, the emergency still wins.
    const decision = decide(
      {
        actorId: "C003",
        traits: [],
        evidence: [],
        current: { candidateId: "goal.chop", chosenAtTick: T(99) },
        candidates: [{ candidateId: "goal.chop", considerations: [{ id: "opportunity", inputMilli: 900, weightMilli: 1_000 }] }, result.candidate as never],
      },
      T(101),
    );
    expect(decision.chosenCandidateId).toBe("goal.flee.animal");
    expect(decision.heldByDelay).toBe(false);
    expect(decision.trace.trigger).toBe("Emergency");
  });
});

describe("wildlife stays dangerous during a sentient truce (criterion 2)", () => {
  const truce: Law = { lawId: "law.truce", version: T(1), permission: "SentientHarm", activationTick: T(0), endTick: T(10_000), scope: {}, reasonId: "WaitingForLaw" };

  it("lets a wolf bite while the truce forbids every contestant blow", () => {
    const service = new PermissionService();
    service.install(truce);

    const bite = resolveHarm(service, { source: "Environment", hpMilli: T(14_000), targetId: "C003", targetPositionMm: at(400_000, 400_000), tick: T(500) });
    expect(bite.applied).toBe(true);

    const blow = resolveHarm(service, {
      source: "Hostile",
      hpMilli: T(14_000),
      attackerId: "C009",
      attackerPositionMm: at(401_000, 400_000),
      targetId: "C003",
      targetPositionMm: at(400_000, 400_000),
      tick: T(500),
    });
    expect(blow.applied).toBe(false);
  });

  it("keeps hunting regardless of any law, because a policy has no permission input", () => {
    // The wolf's policy takes the animal and its perception; there is nowhere for
    // a truce to arrive, which is why a law cannot pacify wildlife by accident.
    expect(speciesPolicy(wolf, sees(10_000)).action).toBe("Hunt");
    expect(speciesPolicy.length).toBe(2);
  });

  it("ships the GDD's prototype population", () => {
    const population = prototypePopulation();
    expect(population.wolves).toBe(12);
    expect(population.deer).toBe(24);
    expect(population.packs).toHaveLength(4);
    expect(WILDLIFE.wolvesPerPack * WILDLIFE.packs).toBe(WILDLIFE.wolves);
  });

  it("keeps dens away from starts and camp sockets", () => {
    const starts = [at(400_000, 400_000), at(450_000, 400_000)];
    expect(denPlacementValid(at(400_000, 440_000), starts)).toBe(true);
    expect(denPlacementValid(at(400_000, 430_000), starts)).toBe(false);
    expect(WILDLIFE.minDenClearanceMm).toBe(35_000);
  });
});

describe("the species policy reads only the animal and what it perceives (criterion 3)", () => {
  it("takes exactly two inputs, so a selection has no way in", () => {
    expect(speciesPolicy.length).toBe(2);
    const perception = sees(10_000);
    expect(Object.keys(perception).sort()).toEqual(["nearestActorDistanceMm", "nearestActorId", "nearestActorPositionMm", "packMatesNearby"]);
  });

  it("gives the same answer whichever actor is nearest — the identity does not change the decision", () => {
    const a = speciesPolicy(wolf, sees(10_000, "C003"));
    const b = speciesPolicy(wolf, sees(10_000, "C099"));
    expect(a.action).toBe(b.action);
    expect(a.reason).toBe(b.reason);
    expect(a.targetActorId).toBe("C003");
    expect(b.targetActorId).toBe("C099");
  });

  it("goes home past its leash even with prey in front of it", () => {
    const strayed: Animal = { ...wolf, positionMm: at(450_000, 400_000) };
    const result = speciesPolicy(strayed, sees(1_000));
    expect(result.action).toBe("Return");
    expect(result.reason).toContain("leash is 45000 mm");
  });

  it("hunts inside its aggression range and returns outside it", () => {
    expect(speciesPolicy(wolf, sees((WOLF_AGGRO_MM as number) - 1_000)).action).toBe("Hunt");
    expect(speciesPolicy(wolf, sees((WOLF_AGGRO_MM as number) + 1_000)).action).toBe("Return");
  });

  it("makes a deer bolt inside its flight distance and graze outside it", () => {
    expect(speciesPolicy(deer, { ...sees((DEER_FLIGHT_MM as number) - 1_000), packMatesNearby: 0 }).action).toBe("Flee");
    expect(speciesPolicy(deer, { ...sees((DEER_FLIGHT_MM as number) + 1_000), packMatesNearby: 0 }).action).toBe("Graze");
  });

  it("is deterministic and returns the same answer twice", () => {
    const first = speciesPolicy(wolf, sees(9_000));
    const second = speciesPolicy(wolf, sees(9_000));
    expect(first).toEqual(second);
  });

  it("does nothing different when nothing is perceived", () => {
    const blind = speciesPolicy(wolf, { packMatesNearby: 0 });
    expect(blind.action).toBe("Return");
    expect(blind.targetActorId).toBeUndefined();
  });
});
