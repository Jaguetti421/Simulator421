import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { applyRevives, BLEED_OUT_TICKS, healthTick, resolveTick, REVIVE_TICKS, REVIVED_HEALTH_MILLI, standing, tickBleedOut } from "./health.js";
import type { ActorHealth, PendingHit, Revive } from "./health.js";

/** P1-23. */
const T = (n: number): Int => n as Int;

function world(...actors: ActorHealth[]): Map<string, ActorHealth> {
  return new Map(actors.map((a) => [a.actorId, a]));
}

function hit(targetId: string, attackerId: string, hpMilli: number, extra: Partial<PendingHit> = {}): PendingHit {
  return { targetId, attackerId, damage: { source: "Hostile", hpMilli: T(hpMilli), atTick: T(0), isSentientHarm: true }, ...extra };
}

describe("iteration order does not alter results (criterion 1)", () => {
  it("gives the same health and transitions whatever order the hits arrive in", () => {
    const before = world(standing("C003", T(60_000)), standing("C009", T(40_000)));
    const hits = [hit("C003", "C009", 25_000), hit("C009", "C003", 50_000), hit("C003", "C017", 20_000)];

    const forward = resolveTick(before, hits, T(10));
    const reversed = resolveTick(before, [...hits].reverse(), T(10));
    const shuffled = resolveTick(before, [hits[1] as PendingHit, hits[2] as PendingHit, hits[0] as PendingHit], T(10));

    for (const other of [reversed, shuffled]) {
      expect([...other.health.entries()]).toEqual([...forward.health.entries()]);
      expect(other.transitions).toEqual(forward.transitions);
    }
  });

  it("resolves a mutual kill as both going down, not one surviving because it went first", () => {
    const before = world(standing("C003", T(20_000)), standing("C009", T(20_000)));
    const result = resolveTick(before, [hit("C003", "C009", 25_000), hit("C009", "C003", 25_000)], T(10));
    expect(result.health.get("C003")?.state).toBe("Downed");
    expect(result.health.get("C009")?.state).toBe("Downed");
    expect(result.transitions).toHaveLength(2);
  });

  it("applies damage against start-of-tick health, not against a partially updated world", () => {
    const before = world(standing("C003", T(30_000)));
    // Two blows of 20 each: 40 total against 30, one down — not "20 leaves 10,
    // then 20 leaves 0" via some intermediate state.
    const result = resolveTick(before, [hit("C003", "C009", 20_000), hit("C003", "C017", 20_000)], T(10));
    expect(result.health.get("C003")?.state).toBe("Downed");
    expect(result.health.get("C003")?.healthMilli).toBe(0);
  });

  it("orders transitions deterministically by target", () => {
    const before = world(standing("C022", T(10_000)), standing("C003", T(10_000)));
    const result = resolveTick(before, [hit("C022", "X", 50_000), hit("C003", "X", 50_000)], T(10));
    expect(result.transitions.map((t) => t.actorId)).toEqual(["C003", "C022"]);
  });
});

describe("same-tick hits down a standing target once (criterion 2)", () => {
  it("produces one Downed transition for three simultaneous killing blows", () => {
    const before = world(standing("C003", T(30_000)));
    const result = resolveTick(before, [hit("C003", "A", 40_000), hit("C003", "B", 40_000), hit("C003", "C", 40_000)], T(10));
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0]?.to).toBe("Downed");
    expect(result.health.get("C003")?.state).toBe("Downed");
  });

  it("does not eliminate a standing target however large the overkill", () => {
    const before = world(standing("C003", T(30_000)));
    const result = resolveTick(before, [hit("C003", "A", 900_000)], T(10));
    expect(result.health.get("C003")?.state).toBe("Downed");
    expect(result.health.get("C003")?.state).not.toBe("Eliminated");
  });

  it("starts the GDD's thirty-second bleed-out when it downs someone", () => {
    const result = resolveTick(world(standing("C003", T(10_000))), [hit("C003", "A", 20_000)], T(100));
    expect(result.health.get("C003")?.bleedOutAtTick).toBe(100 + BLEED_OUT_TICKS);
    expect(BLEED_OUT_TICKS).toBe(300);
  });

  it("eliminates a downed target only where the laws permit it", () => {
    const downed = resolveTick(world(standing("C003", T(10_000))), [hit("C003", "A", 20_000)], T(100)).health;
    const ignored = resolveTick(downed, [hit("C003", "A", 20_000)], T(101));
    expect(ignored.health.get("C003")?.state).toBe("Downed");

    const permitted = resolveTick(downed, [hit("C003", "A", 20_000, { mayEliminateDowned: true })], T(101));
    expect(permitted.health.get("C003")?.state).toBe("Eliminated");
    expect(permitted.transitions[0]?.cause).toBe("Damage");
  });

  it("lets terminal damage bypass the downed state entirely", () => {
    const result = resolveTick(world(standing("C003", T(30_000))), [hit("C003", "storm", 40_000, { terminal: true })], T(10));
    expect(result.health.get("C003")?.state).toBe("Eliminated");
    expect(result.transitions[0]?.cause).toBe("Terminal");
  });

  it("eliminates at the end of an unpaused bleed-out, and pauses it under protection", () => {
    let health = resolveTick(world(standing("C003", T(10_000))), [hit("C003", "A", 20_000)], T(100)).health;
    // Fifty ticks covered: the end tick moves with it, so nothing is lost.
    for (let tick = 101; tick <= 150; tick += 1) health = tickBleedOut(health, T(tick), { protectedActorIds: new Set(["C003"]) }).health;
    expect(health.get("C003")?.state).toBe("Downed");
    expect(health.get("C003")?.pausedTicks).toBe(50);
    expect(health.get("C003")?.bleedOutAtTick).toBe(100 + BLEED_OUT_TICKS + 50);

    const ended = tickBleedOut(health, T(100 + BLEED_OUT_TICKS + 50));
    expect(ended.health.get("C003")?.state).toBe("Eliminated");
    expect(ended.transitions[0]?.cause).toBe("BleedOut");
  });
});

describe("aid completion and later damage use one boundary rule (criterion 3)", () => {
  const revive: Revive = { targetId: "C003", byActorId: "C009", startedAtTick: T(100) };

  it("completes a revive after exactly the GDD's six seconds", () => {
    const downed = resolveTick(world(standing("C003", T(10_000))), [hit("C003", "A", 20_000)], T(50)).health;
    expect(applyRevives(downed, [revive], T(100 + REVIVE_TICKS - 1)).health.get("C003")?.state).toBe("Downed");
    const done = applyRevives(downed, [revive], T(100 + REVIVE_TICKS));
    expect(done.health.get("C003")?.state).toBe("Standing");
    expect(done.health.get("C003")?.healthMilli).toBe(REVIVED_HEALTH_MILLI);
    expect(REVIVE_TICKS).toBe(60);
  });

  it("applies a revive before damage on the same tick, so a rescuer in time is not robbed", () => {
    const downed = resolveTick(world(standing("C003", T(10_000))), [hit("C003", "A", 20_000)], T(50)).health;
    const both = healthTick(downed, { revives: [revive], hits: [hit("C003", "B", 10_000)] }, T(100 + REVIVE_TICKS));
    // Revived to 25, then hit for 10: standing at 15.
    expect(both.health.get("C003")?.state).toBe("Standing");
    expect(both.health.get("C003")?.healthMilli).toBe((REVIVED_HEALTH_MILLI as number) - 10_000);
    expect(both.transitions.map((t) => t.cause)).toEqual(["Revive"]);
  });

  it("downs a just-revived actor again when the same-tick damage is lethal", () => {
    const downed = resolveTick(world(standing("C003", T(10_000))), [hit("C003", "A", 20_000)], T(50)).health;
    const both = healthTick(downed, { revives: [revive], hits: [hit("C003", "B", 90_000)] }, T(100 + REVIVE_TICKS));
    expect(both.health.get("C003")?.state).toBe("Downed");
    expect(both.transitions.map((t) => t.cause)).toEqual(["Revive", "Damage"]);
  });

  it("clears the bleed-out when a revive succeeds", () => {
    const downed = resolveTick(world(standing("C003", T(10_000))), [hit("C003", "A", 20_000)], T(50)).health;
    const done = applyRevives(downed, [revive], T(100 + REVIVE_TICKS));
    expect(done.health.get("C003")?.bleedOutAtTick).toBeUndefined();
  });

  it("ignores a revive on someone who is not downed", () => {
    const upright = world(standing("C003"));
    const result = applyRevives(upright, [revive], T(100 + REVIVE_TICKS));
    expect(result.transitions).toEqual([]);
    expect(result.health.get("C003")?.healthMilli).toBe(100_000);
  });

  it("runs the whole tick in one fixed order for every caller", () => {
    const downed = resolveTick(world(standing("C003", T(10_000)), standing("C009")), [hit("C003", "A", 20_000)], T(50)).health;
    const a = healthTick(downed, { revives: [revive], hits: [hit("C009", "C003", 10_000)] }, T(160));
    const b = healthTick(downed, { hits: [hit("C009", "C003", 10_000)], revives: [revive] }, T(160));
    expect([...a.health.entries()]).toEqual([...b.health.entries()]);
    expect(a.transitions).toEqual(b.transitions);
  });
});
