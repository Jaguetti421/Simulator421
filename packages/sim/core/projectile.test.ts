import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { ARROW_MM_PER_SECOND, flyUntilContact, perTickMm, sweepProjectile, TARGET_RADIUS_MM, velocityToward } from "./projectile.js";
import type { ProjectileState, TargetCandidate } from "./projectile.js";
import { PermissionService } from "./permission.js";
import type { Law } from "./permission.js";
import { resolveHarm } from "./sanctuary.js";

/** P1-21. */
const T = (n: number): Int => n as Int;
const at = (x: number, y: number): readonly [Int, Int] => [T(x), T(y)];

function arrow(fromX: number, fromY: number, toX: number, toY: number): ProjectileState {
  return {
    id: "arrow.1",
    ownerActorId: "C003",
    positionMm: at(fromX, fromY),
    velocityMmPerTick: velocityToward(at(fromX, fromY), at(toX, toY)),
    firedAtTick: T(0),
  };
}

function actor(id: string, x: number, y: number): TargetCandidate {
  return { id, kind: "Actor", positionMm: at(x, y), radiusMm: TARGET_RADIUS_MM };
}

describe("an 18 m/s arrow cannot tunnel through an actor (criterion 1)", () => {
  it("covers 1.8 m per tick — twice an actor's diameter", () => {
    expect(ARROW_MM_PER_SECOND).toBe(18_000);
    expect(perTickMm(ARROW_MM_PER_SECOND)).toBe(1_800);
    expect(perTickMm(ARROW_MM_PER_SECOND)).toBeGreaterThan((TARGET_RADIUS_MM as number) * 2);
  });

  it("hits a target standing anywhere inside a single tick's step", () => {
    // Every position within the 1,800 mm step, including the ones an endpoint
    // test would skip entirely.
    for (let offset = 100; offset <= 1_800; offset += 100) {
      const swept = sweepProjectile(arrow(400_000, 400_000, 420_000, 400_000), [actor("C009", 400_000 + offset, 400_000)], T(1));
      expect(swept.contact?.targetId, `an arrow passed through an actor ${offset} mm into its step`).toBe("C009");
    }
  });

  it("hits a target no endpoint test would find, at 900 mm into an 1,800 mm step", () => {
    const swept = sweepProjectile(arrow(400_000, 400_000, 420_000, 400_000), [actor("C009", 400_900, 400_000)], T(1));
    expect(swept.contact?.distanceMm).toBe(900);
    // Neither endpoint is within the target's radius: this is the tunnelling case.
    expect(Math.abs(400_000 - 400_900)).toBeGreaterThan(TARGET_RADIUS_MM);
    expect(Math.abs(401_800 - 400_900)).toBeGreaterThan(TARGET_RADIUS_MM);
  });

  it("cannot be outrun by a faster projectile", () => {
    for (const speed of [18_000, 60_000, 240_000]) {
      const fast: ProjectileState = { ...arrow(400_000, 400_000, 500_000, 400_000), velocityMmPerTick: velocityToward(at(400_000, 400_000), at(500_000, 400_000), T(speed)) };
      const flight = flyUntilContact(fast, [actor("C009", 410_000, 400_000)], T(0), 40);
      expect(flight.contact?.targetId, `an arrow at ${speed} mm/s tunnelled`).toBe("C009");
    }
  });

  it("misses a target the segment passes beside", () => {
    const swept = sweepProjectile(arrow(400_000, 400_000, 420_000, 400_000), [actor("C009", 400_900, 401_000)], T(1));
    expect(swept.contact).toBeUndefined();
    expect(swept.allContacts).toEqual([]);
  });

  it("never hits the actor that fired it", () => {
    const swept = sweepProjectile(arrow(400_000, 400_000, 420_000, 400_000), [actor("C003", 400_200, 400_000)], T(1));
    expect(swept.contact).toBeUndefined();
  });
});

describe("first-contact ordering is stable (criterion 2)", () => {
  it("reports the nearest contact first", () => {
    const swept = sweepProjectile(arrow(400_000, 400_000, 420_000, 400_000), [actor("C022", 401_500, 400_000), actor("C009", 400_600, 400_000)], T(1));
    expect(swept.contact?.targetId).toBe("C009");
    expect(swept.allContacts.map((c) => c.targetId)).toEqual(["C009", "C022"]);
  });

  it("gives the same answer whatever order the candidates arrive in", () => {
    const near = actor("C022", 400_600, 400_000);
    const far = actor("C009", 401_500, 400_000);
    const forward = sweepProjectile(arrow(400_000, 400_000, 420_000, 400_000), [near, far], T(1));
    const reversed = sweepProjectile(arrow(400_000, 400_000, 420_000, 400_000), [far, near], T(1));
    expect(reversed.contact?.targetId).toBe(forward.contact?.targetId);
    expect(reversed.allContacts.map((c) => c.targetId)).toEqual(forward.allContacts.map((c) => c.targetId));
  });

  it("breaks an exact tie on the target ID, so two replays agree", () => {
    const swept = sweepProjectile(arrow(400_000, 400_000, 420_000, 400_000), [actor("C022", 400_900, 400_100), actor("C009", 400_900, 399_900)], T(1));
    expect(swept.contact?.targetId).toBe("C009");
    expect(swept.allContacts.map((c) => c.targetId)).toEqual(["C009", "C022"]);
  });

  it("prefers an obstacle standing in front of an actor", () => {
    const swept = sweepProjectile(
      arrow(400_000, 400_000, 420_000, 400_000),
      [actor("C009", 401_200, 400_000), { id: "rock.1", kind: "Obstacle", positionMm: at(400_500, 400_000), radiusMm: T(500) }],
      T(1),
    );
    expect(swept.contact?.targetId).toBe("rock.1");
    expect(swept.contact?.kind).toBe("Obstacle");
  });

  it("is deterministic across repeated identical sweeps", () => {
    const run = (): string => JSON.stringify(sweepProjectile(arrow(400_000, 400_000, 420_000, 400_000), [actor("C009", 400_900, 400_000)], T(1)));
    expect(run()).toBe(run());
  });
});

describe("collision output alone applies no damage (criterion 3)", () => {
  it("reports a contact that explicitly applies nothing", () => {
    const swept = sweepProjectile(arrow(400_000, 400_000, 420_000, 400_000), [actor("C009", 400_900, 400_000)], T(1));
    expect(swept.contact?.appliesDamage).toBe(false);
    expect(Object.keys(swept.contact ?? {})).not.toContain("hpMilli");
    expect(Object.keys(swept.contact ?? {})).not.toContain("damage");
  });

  it("leaves a hit under a truce doing nothing, because permission is asked separately", () => {
    const truce: Law = {
      lawId: "law.truce",
      version: T(1),
      permission: "SentientHarm",
      activationTick: T(0),
      endTick: T(1_000),
      scope: {},
      reasonId: "WaitingForLaw",
    };
    const service = new PermissionService();
    service.install(truce);

    const swept = sweepProjectile(arrow(400_000, 400_000, 420_000, 400_000), [actor("C009", 400_900, 400_000)], T(1));
    expect(swept.contact).toBeDefined();

    // The contact is geometry; this is the question that decides an injury.
    const outcome = resolveHarm(service, {
      source: "Hostile",
      hpMilli: T(25_000),
      attackerId: "C003",
      attackerPositionMm: at(400_000, 400_000),
      targetId: "C009",
      targetPositionMm: at(400_900, 400_000),
      tick: T(1),
    });
    expect(outcome.applied).toBe(false);
    if (outcome.applied) return;
    expect(outcome.denial.ruleId).toBe("law.truce");
  });

  it("advances the projectile whether or not it met something, leaving the stop to the caller", () => {
    const hit = sweepProjectile(arrow(400_000, 400_000, 420_000, 400_000), [actor("C009", 400_900, 400_000)], T(1));
    const miss = sweepProjectile(arrow(400_000, 400_000, 420_000, 400_000), [], T(1));
    expect(hit.state.positionMm).toEqual(miss.state.positionMm);
    expect(hit.state.positionMm[0]).toBe(401_800);
  });
});
