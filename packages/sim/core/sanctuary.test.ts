import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { PermissionService } from "./permission.js";
import type { Law } from "./permission.js";
import { isCovered, newBleed, resolveHarm, tickBleed } from "./sanctuary.js";
import { startingNeeds, tickNeeds } from "./needs.js";
import type { NeedsState } from "./needs.js";

/** P1-13. */
const T = (n: number): Int => n as Int;
const at = (x: number, y: number): readonly [Int, Int] => [T(x), T(y)];

const sanctuary: Law = {
  lawId: "law.sanctuary",
  version: T(1),
  permission: "SentientHarm",
  activationTick: T(0),
  endTick: T(10_000),
  scope: { centreMm: at(400_000, 400_000), radiusMm: T(100_000) },
  reasonId: "WaitingForLaw",
};

function service(): PermissionService {
  const s = new PermissionService();
  s.install(sanctuary);
  return s;
}

const inside = at(420_000, 400_000);
const outside = at(700_000, 400_000);
const onBoundary = at(500_000, 400_000);

describe("sanctuary blocks sentient harm from either side (criterion 1)", () => {
  it("refuses a blow when the target is inside", () => {
    const outcome = resolveHarm(service(), {
      source: "Hostile",
      hpMilli: T(30_000),
      attackerId: "C003",
      attackerPositionMm: outside,
      targetId: "C009",
      targetPositionMm: inside,
      tick: T(100),
    });
    expect(outcome.applied).toBe(false);
    if (outcome.applied) return;
    expect(outcome.denial.ruleId).toBe("law.sanctuary");
  });

  it("refuses a blow when only the attacker is inside", () => {
    const outcome = resolveHarm(service(), {
      source: "Hostile",
      hpMilli: T(30_000),
      attackerId: "C003",
      attackerPositionMm: inside,
      targetId: "C009",
      targetPositionMm: outside,
      tick: T(100),
    });
    expect(outcome.applied).toBe(false);
  });

  it("allows a blow when both are outside", () => {
    const outcome = resolveHarm(service(), {
      source: "Hostile",
      hpMilli: T(30_000),
      attackerId: "C003",
      attackerPositionMm: outside,
      targetId: "C009",
      targetPositionMm: at(720_000, 400_000),
      tick: T(100),
    });
    expect(outcome.applied).toBe(true);
    if (!outcome.applied) return;
    expect(outcome.damage.isSentientHarm).toBe(true);
  });
});

describe("boundary points are included (criterion 2)", () => {
  it("covers a point exactly on the radius", () => {
    expect(isCovered(service(), onBoundary, T(100))).toBe(true);
  });

  it("refuses harm with either party exactly on the boundary", () => {
    for (const [attacker, target] of [
      [onBoundary, outside],
      [outside, onBoundary],
    ] as const) {
      const outcome = resolveHarm(service(), {
        source: "Hostile",
        hpMilli: T(10_000),
        attackerId: "C003",
        attackerPositionMm: attacker,
        targetId: "C009",
        targetPositionMm: target,
        tick: T(100),
      });
      expect(outcome.applied).toBe(false);
    }
  });

  it("does not cover a point one millimetre beyond the radius", () => {
    expect(isCovered(service(), at(500_001, 400_000), T(100))).toBe(false);
  });
});

describe("wildlife and needs stay active; hostile bleeds pause (criterion 3)", () => {
  it("lets an animal bite a protected actor", () => {
    const outcome = resolveHarm(service(), {
      source: "Environment",
      hpMilli: T(12_000),
      targetId: "C009",
      targetPositionMm: inside,
      tick: T(100),
    });
    expect(outcome.applied).toBe(true);
    if (!outcome.applied) return;
    expect(outcome.damage.isSentientHarm).toBe(false);
    expect(outcome.damage.hpMilli).toBe(12_000);
  });

  it("lets hunger and starvation run at full rate inside a sanctuary", () => {
    let state: NeedsState = { ...startingNeeds(), fullnessMilli: T(0) };
    let damage = 0;
    for (let tick = 0; tick < 600; tick += 1) {
      const outcome = tickNeeds(state, T(tick));
      state = outcome.state;
      damage += (outcome.damage?.hpMilli as number) ?? 0;
    }
    // A sanctuary is not a larder: the full 8 HP/minute still lands.
    expect(damage).toBe(8_000);
    expect(isCovered(service(), inside, T(100))).toBe(true);
  });

  it("pauses a hostile bleed while covered and resumes it on exactly what was left", () => {
    let bleed = newBleed("bleed.1", "Hostile", T(9_000), T(1_000));
    // Three ticks outside: three thousand paid.
    for (let tick = 0; tick < 3; tick += 1) bleed = tickBleed(bleed, T(tick), false).state;
    expect(bleed.remainingMilli).toBe(6_000);

    // Fifty ticks covered: nothing paid, nothing healed.
    for (let tick = 3; tick < 53; tick += 1) {
      const outcome = tickBleed(bleed, T(tick), true);
      expect(outcome.paused).toBe(true);
      expect(outcome.damage).toBeUndefined();
      bleed = outcome.state;
    }
    expect(bleed.remainingMilli).toBe(6_000);
    expect(bleed.pausedTicks).toBe(50);

    // Stepping out resumes on the same six thousand.
    for (let tick = 53; tick < 59; tick += 1) bleed = tickBleed(bleed, T(tick), false).state;
    expect(bleed.remainingMilli).toBe(0);
  });

  it("does not pause a bleed that did not come from another actor", () => {
    let bleed = newBleed("bleed.wolf", "Environment", T(5_000), T(1_000));
    for (let tick = 0; tick < 5; tick += 1) {
      const outcome = tickBleed(bleed, T(tick), true);
      expect(outcome.paused).toBe(false);
      expect(outcome.damage?.source).toBe("Environment");
      bleed = outcome.state;
    }
    expect(bleed.remainingMilli).toBe(0);
  });

  it("never pays more than the bleed has left", () => {
    let bleed = newBleed("bleed.small", "Hostile", T(500), T(1_000));
    const outcome = tickBleed(bleed, T(0), false);
    expect(outcome.damage?.hpMilli).toBe(500);
    bleed = outcome.state;
    expect(bleed.remainingMilli).toBe(0);
    expect(tickBleed(bleed, T(1), false).damage).toBeUndefined();
  });

  it("is shelter, not a cure: total damage paid is the same either way", () => {
    const total = (covered: readonly boolean[]): number => {
      let bleed = newBleed("bleed.1", "Hostile", T(9_000), T(1_000));
      let paid = 0;
      for (const [tick, isCoveredNow] of covered.entries()) {
        const outcome = tickBleed(bleed, T(tick), isCoveredNow);
        bleed = outcome.state;
        paid += (outcome.damage?.hpMilli as number) ?? 0;
      }
      return paid;
    };
    const straight = Array.from({ length: 30 }, () => false);
    const sheltered = Array.from({ length: 30 }, (_, i) => i >= 3 && i < 20);
    expect(total(straight)).toBe(9_000);
    expect(total(sheltered)).toBe(9_000);
  });
});
