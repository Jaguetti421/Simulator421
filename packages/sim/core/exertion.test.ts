import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { canSprint, canWalk, EXERTION, fatiguePoints, staminaPoints, startingExertion, tickExertion, tickRest } from "./exertion.js";
import type { ExertionState, RestIntent } from "./exertion.js";

/** P1-10. */
const T = (n: number): Int => n as Int;

function run(state: ExertionState, exertion: Parameters<typeof tickExertion>[1], ticks: number): ExertionState {
  let current = state;
  for (let i = 0; i < ticks; i += 1) current = tickExertion(current, exertion).state;
  return current;
}

describe("thresholds and rest endpoint match the GDD (criterion 1)", () => {
  it("uses the GDD's numbers", () => {
    expect(EXERTION.sprintDrainPerSecond).toBe(12);
    expect(EXERTION.walkRecoverPerSecond).toBe(6);
    expect(EXERTION.restPriorityThreshold).toBe(60);
    expect(EXERTION.interruptThreshold).toBe(85);
    expect(EXERTION.restEndsAt).toBe(25);
  });

  it("drains 12 stamina a second sprinting and restores 6 a second walking", () => {
    const afterSprint = run(startingExertion(), "Sprinting", 10);
    expect(staminaPoints(afterSprint)).toBe(100 - 12);
    const afterWalk = run(afterSprint, "Walking", 10);
    expect(staminaPoints(afterWalk)).toBe(100 - 12 + 6);
  });

  it("does not restore stamina while attacking or working", () => {
    const tired = run(startingExertion(), "Sprinting", 30);
    expect(staminaPoints(run(tired, "Attacking", 20))).toBe(staminaPoints(tired));
    expect(staminaPoints(run(tired, "Working", 20))).toBe(staminaPoints(tired));
  });

  it("raises rest priority above 60 and interrupts work above 85", () => {
    // Exactly 60 is not "above 60"; one tick of work puts it over, and the
    // threshold is compared in thousandths so it notices.
    const at60: ExertionState = { ...startingExertion(), fatigueMilli: T(60_000) };
    expect(tickExertion(at60, "Working").restPriority).toBe(true);
    expect(tickExertion({ ...at60, fatigueMilli: T(59_999) }, "Resting").restPriority).toBe(false);
    const at59: ExertionState = { ...startingExertion(), fatigueMilli: T(59_000) };
    expect(tickExertion(at59, "Working").restPriority).toBe(false);
    expect(tickExertion(at59, "Working").interruptsWork).toBe(false);

    const at86: ExertionState = { ...startingExertion(), fatigueMilli: T(86_000) };
    expect(tickExertion(at86, "Working").interruptsWork).toBe(true);
  });

  it("ends a rest at fatigue 25 and not before", () => {
    const intent: RestIntent = { reason: "FatigueAboveThreshold", targetSocketId: "shelter.01", startedAtTick: T(0) };
    let state: ExertionState = { ...startingExertion(), fatigueMilli: T(70_000) };
    let ended: string | undefined;
    let ticks = 0;
    while (ended === undefined && ticks < 10_000) {
      const outcome = tickRest(state, intent);
      state = outcome.state;
      ended = outcome.endedBecause;
      ticks += 1;
      if (ended === undefined) expect(state.fatigueMilli).toBeGreaterThan(25_000);
    }
    expect(ended).toBe("ReachedRestEnd");
    expect(fatiguePoints(state)).toBe(25);
    // 45 points at 12 a minute is 3 minutes 45 seconds.
    expect(ticks).toBe(2_250);
  });

  it("keeps the fraction of a per-minute fatigue rate across ticks", () => {
    const oneTick = tickExertion(startingExertion(), "Working").state;
    // 2 per minute is 1/300 of a point per tick — truncation would gain nothing.
    expect(oneTick.fatigueMilli).toBeGreaterThan(0);
    expect(fatiguePoints(run(startingExertion(), "Working", 600))).toBe(2);
  });
});

describe("an interruption preserves fatigue and stamina (criterion 2)", () => {
  const intent: RestIntent = { reason: "FatigueAboveThreshold", targetSocketId: "shelter.01", startedAtTick: T(0) };

  it("returns the state untouched and hands back the reason and target", () => {
    let state: ExertionState = { ...startingExertion(), fatigueMilli: T(70_000), staminaMilli: T(40_000) };
    for (let i = 0; i < 100; i += 1) state = tickRest(state, intent).state;
    const before = { fatigue: state.fatigueMilli, stamina: state.staminaMilli };

    const interrupted = tickRest(state, intent, true);
    expect(interrupted.endedBecause).toBe("Interrupted");
    expect(interrupted.state.fatigueMilli).toBe(before.fatigue);
    expect(interrupted.state.staminaMilli).toBe(before.stamina);
    expect(interrupted.retainedIntent).toEqual(intent);
  });

  it("lets the actor resume from exactly where it stopped", () => {
    let state: ExertionState = { ...startingExertion(), fatigueMilli: T(70_000) };
    for (let i = 0; i < 500; i += 1) state = tickRest(state, intent).state;
    const midway = state.fatigueMilli;

    const interrupted = tickRest(state, intent, true);
    const resumed = tickRest(interrupted.state, interrupted.retainedIntent as RestIntent);
    expect(interrupted.state.fatigueMilli).toBe(midway);
    expect(resumed.state.fatigueMilli).toBeLessThan(midway);
  });

  it("does not end a rest early just because it was interrupted once", () => {
    let state: ExertionState = { ...startingExertion(), fatigueMilli: T(70_000) };
    const first = tickRest(state, intent, true);
    expect(fatiguePoints(first.state)).toBe(70);
    state = first.state;
    for (let i = 0; i < 100; i += 1) state = tickRest(state, intent).state;
    expect(fatiguePoints(state)).toBeLessThan(70);
  });
});

describe("exhausted stamina never removes walking (criterion 3)", () => {
  it("still walks with zero stamina", () => {
    const empty = run(startingExertion(), "Sprinting", 1_000);
    expect(staminaPoints(empty)).toBe(0);
    expect(canSprint(empty)).toBe(false);
    expect(canWalk()).toBe(true);
  });

  it("downgrades a sprint to a walk instead of refusing to move", () => {
    const empty = run(startingExertion(), "Sprinting", 1_000);
    const outcome = tickExertion(empty, "Sprinting");
    expect(outcome.sprintDenied).toBe(true);
    // Walking recovers, so the actor is better off than it was — it kept moving.
    expect(outcome.state.staminaMilli).toBeGreaterThanOrEqual(empty.staminaMilli);
  });

  it("recovers enough to sprint again after walking", () => {
    let state = run(startingExertion(), "Sprinting", 1_000);
    expect(canSprint(state)).toBe(false);
    state = run(state, "Walking", 10);
    expect(canSprint(state)).toBe(true);
    expect(staminaPoints(state)).toBe(6);
  });

  it("never drops stamina below zero however long the sprint", () => {
    const empty = run(startingExertion(), "Sprinting", 5_000);
    expect(empty.staminaMilli).toBe(0);
    expect(staminaPoints(empty)).toBe(0);
  });
});
