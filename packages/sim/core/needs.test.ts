import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { beginEating, continueEating, FOOD, fullnessPoints, PROTOTYPE8_FOOD, startingNeeds, TICKS_PER_MINUTE, tickNeeds } from "./needs.js";
import type { NeedsState } from "./needs.js";

/** P1-09. */
const T = (n: number): Int => n as Int;

function runMinutes(minutes: number, state: NeedsState = startingNeeds()): { state: NeedsState; damage: number; blockedTicks: number } {
  let current = state;
  let damage = 0;
  let blockedTicks = 0;
  for (let tick = 0; tick < minutes * TICKS_PER_MINUTE; tick += 1) {
    const outcome = tickNeeds(current, T(tick));
    current = outcome.state;
    damage += (outcome.damage?.hpMilli as number) ?? 0;
    if (outcome.recoveryBlocked) blockedTicks += 1;
  }
  return { state: current, damage, blockedTicks };
}

describe("rates match the GDD in fixed point (criterion 1)", () => {
  it("starts at the GDD's values", () => {
    expect(FOOD.startingFullness).toBe(85);
    expect(FOOD.maxFullness).toBe(100);
    expect(FOOD.drainPerMinute).toBe(6);
    expect(FOOD.recoveryFloor).toBe(25);
    expect(FOOD.starvationHpPerMinute).toBe(8);
    expect(fullnessPoints(startingNeeds())).toBe(85);
  });

  it("drains exactly six fullness per minute, with the fraction kept across ticks", () => {
    expect(fullnessPoints(runMinutes(1).state)).toBe(85 - 6);
    expect(fullnessPoints(runMinutes(5).state)).toBe(85 - 30);
    expect(fullnessPoints(runMinutes(10).state)).toBe(85 - 60);
    // 6 per 600 ticks is 0.01 points per tick. Truncating the drain each tick
    // would remove nothing at all, and an actor would never get hungry; the
    // remainder keeps the hundredth. The whole-point reading rounds **down**, so
    // 84.99 displays as 84 — deliberate, because every GDD threshold is "below
    // X" and a display that rounded up would cross them a tick early.
    const oneTick = tickNeeds(startingNeeds(), T(0)).state;
    expect(oneTick.fullnessMilli).toBe(84_990);
    expect(fullnessPoints(oneTick)).toBe(84);
  });

  it("stops ordinary recovery below 25 fullness, and not before", () => {
    // 85 → 25 takes ten minutes exactly.
    const tenMinutes = runMinutes(10);
    expect(fullnessPoints(tenMinutes.state)).toBe(25);
    expect(tenMinutes.blockedTicks).toBe(0);
    const justAfter = tickNeeds(tenMinutes.state, T(6_001));
    expect(justAfter.recoveryBlocked).toBe(true);
  });

  it("loses eight HP per minute at zero fullness, and nothing above it", () => {
    // 85 fullness lasts 14 minutes 10 seconds; run 20 and check the damage window.
    const before = runMinutes(14);
    expect(before.damage).toBe(0);
    expect(fullnessPoints(before.state)).toBe(1);

    const after = runMinutes(5, before.state);
    // Fullness hits zero ten seconds in, so about 4 min 50 s of starvation.
    expect(after.damage).toBeGreaterThan(8_000 * 4.5);
    expect(after.damage).toBeLessThan(8_000 * 5);
    expect(after.state.healthMilli).toBeLessThan(100_000);
  });

  it("recovers three HP per minute while resting with food at or above 25", () => {
    const hurt: NeedsState = { ...startingNeeds(), healthMilli: T(50_000) };
    let state = hurt;
    for (let tick = 0; tick < TICKS_PER_MINUTE; tick += 1) state = tickNeeds(state, T(tick), { resting: true }).state;
    expect(state.healthMilli).toBe(53_000);
  });

  it("does not recover while resting if exposure is high, because the GDD gates on it", () => {
    const hurt: NeedsState = { ...startingNeeds(), healthMilli: T(50_000) };
    let state = hurt;
    for (let tick = 0; tick < TICKS_PER_MINUTE; tick += 1) state = tickNeeds(state, T(tick), { resting: true, exposureBelow60: false }).state;
    expect(state.healthMilli).toBe(50_000);
  });

  it("carries the item nutrition table as fixed point", () => {
    for (const food of PROTOTYPE8_FOOD) {
      expect(Number.isSafeInteger(food.fullnessMilli as number)).toBe(true);
      expect(food.eatTicks).toBeGreaterThan(0);
    }
  });
});

describe("interrupted eating consumes no item (criterion 2)", () => {
  it("returns itemConsumed false and no new state when interrupted", () => {
    const state = startingNeeds();
    let progress = beginEating("item.ration", T(0));
    for (let i = 0; i < 10; i += 1) {
      const outcome = continueEating(state, progress, PROTOTYPE8_FOOD);
      if (outcome.status !== "Eating") throw new Error("expected to still be eating");
      progress = outcome.progress;
    }
    const interrupted = continueEating(state, progress, PROTOTYPE8_FOOD, true);
    expect(interrupted.status).toBe("Failed");
    if (interrupted.status !== "Failed") return;
    expect(interrupted.reason).toBe("Interrupted");
    expect(interrupted.itemConsumed).toBe(false);
    expect("state" in interrupted).toBe(false);
    // Fullness is exactly where it was: eating ten of thirty ticks fed nobody.
    expect(state.fullnessMilli).toBe(85_000);
  });

  it("consumes the item only on the finishing tick", () => {
    let state = startingNeeds();
    let progress = beginEating("item.berry", T(0));
    let consumed: string | undefined;
    for (let tick = 1; tick <= 10; tick += 1) {
      const outcome = continueEating(state, progress, PROTOTYPE8_FOOD);
      if (outcome.status === "Eating") {
        progress = outcome.progress;
        expect(tick).toBeLessThan(10);
      } else if (outcome.status === "Finished") {
        consumed = outcome.consumedItemDefId;
        state = outcome.state;
        expect(tick).toBe(10);
      }
    }
    expect(consumed).toBe("item.berry");
    expect(fullnessPoints(state)).toBe(91);
  });

  it("never pushes fullness above the maximum", () => {
    const nearlyFull: NeedsState = { ...startingNeeds(), fullnessMilli: T(98_000) };
    let progress = beginEating("item.cooked.meat", T(0));
    let finished: NeedsState | undefined;
    for (let i = 0; i < 40 && finished === undefined; i += 1) {
      const outcome = continueEating(nearlyFull, progress, PROTOTYPE8_FOOD);
      if (outcome.status === "Eating") progress = outcome.progress;
      else if (outcome.status === "Finished") finished = outcome.state;
    }
    expect(fullnessPoints(finished as NeedsState)).toBe(100);
  });

  it("refuses food it has no definition for, without consuming anything", () => {
    const outcome = continueEating(startingNeeds(), beginEating("item.rock", T(0)), PROTOTYPE8_FOOD);
    expect(outcome.status).toBe("Failed");
    if (outcome.status !== "Failed") return;
    expect(outcome.reason).toBe("UnknownFood");
    expect(outcome.itemConsumed).toBe(false);
  });
});

describe("starvation damage is distinct from hostile injury (criterion 3)", () => {
  it("tags starvation damage at its source and marks it not sentient harm", () => {
    let state: NeedsState = { ...startingNeeds(), fullnessMilli: T(0) };
    let damage;
    for (let tick = 0; tick < TICKS_PER_MINUTE && damage === undefined; tick += 1) {
      damage = tickNeeds(state, T(tick)).damage;
      state = tickNeeds(state, T(tick)).state;
    }
    expect(damage?.source).toBe("Starvation");
    expect(damage?.isSentientHarm).toBe(false);
  });

  it("means a law about sentient harm has nothing to say about starving", () => {
    // The flag is what a permission check reads: starvation is not something one
    // actor does to another, so sanctuary cannot make an actor immortal.
    let state: NeedsState = { ...startingNeeds(), fullnessMilli: T(0) };
    const events = [];
    for (let tick = 0; tick < TICKS_PER_MINUTE; tick += 1) {
      const outcome = tickNeeds(state, T(tick));
      state = outcome.state;
      if (outcome.damage !== undefined) events.push(outcome.damage);
    }
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.source === "Starvation" && !e.isSentientHarm)).toBe(true);
    expect(state.healthMilli).toBe(92_000);
  });

  it("stops damaging as soon as the actor eats", () => {
    let state: NeedsState = { ...startingNeeds(), fullnessMilli: T(0) };
    for (let tick = 0; tick < 300; tick += 1) state = tickNeeds(state, T(tick)).state;
    const hurt = state.healthMilli;
    expect(hurt).toBeLessThan(100_000);

    state = { ...state, fullnessMilli: T(30_000) };
    for (let tick = 300; tick < 600; tick += 1) {
      const outcome = tickNeeds(state, T(tick));
      expect(outcome.damage).toBeUndefined();
      state = outcome.state;
    }
    expect(state.healthMilli).toBe(hurt);
  });
});
