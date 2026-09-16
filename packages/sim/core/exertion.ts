/**
 * Fatigue, rest and exertion (P1-10; GDD §7 "Rest", GDD 30.2).
 *
 * Two separate pools, and keeping them separate is the whole packet:
 *
 *   - **Stamina** is the short one. Sprinting drains 12 a second; ordinary
 *     walking restores 6 a second when not attacking. Empty stamina means an
 *     actor **cannot sprint** — it does not mean the actor cannot walk. An
 *     exhausted contestant who can no longer cross the island is a bug that
 *     reads as a frozen AI.
 *   - **Fatigue** is the long one. Above 60 it raises rest priority; above 85 it
 *     normally interrupts nonurgent work; rest ends at 25 or when interrupted,
 *     "and the planner retains the reason and target".
 *
 * That last clause is criterion 2: an emergency that interrupts a rest must
 * leave the fatigue and stamina exactly where they were and hand back what the
 * actor was resting for, so it can decide whether to go back to it.
 */
import { add, advance, asInt, clamp, mul, rate, RATE_STATE_ZERO, sub } from "../primitives/index.js";
import type { Int, RateState, Ticks } from "../primitives/index.js";

export const TICK_HZ = 10 as Ticks;
export const TICKS_PER_SECOND = 10;
export const TICKS_PER_MINUTE = 600;

/** GDD 30.2 and §7, exactly as written. */
export const EXERTION = {
  maxStamina: 100 as Int,
  maxFatigue: 100 as Int,
  /** Sprinting drains 12 stamina per second. */
  sprintDrainPerSecond: 12 as Int,
  /** Ordinary walking restores 6 stamina per second when not attacking. */
  walkRecoverPerSecond: 6 as Int,
  /** Fatigue above this raises rest priority. */
  restPriorityThreshold: 60 as Int,
  /** Fatigue above this normally interrupts nonurgent work. */
  interruptThreshold: 85 as Int,
  /** Rest ends here. */
  restEndsAt: 25 as Int,
  /** Fatigue gained per minute awake and active. TUNE. */
  fatiguePerMinuteActive: 2 as Int,
  /** Fatigue removed per minute of rest. TUNE. */
  fatigueRecoveredPerMinuteResting: 12 as Int,
} as const;

export type Exertion = "Resting" | "Walking" | "Sprinting" | "Attacking" | "Working";

export interface ExertionState {
  /** Thousandths, so per-tick fractions survive. */
  readonly staminaMilli: Int;
  readonly fatigueMilli: Int;
  readonly stamina: RateState;
  readonly fatigue: RateState;
}

/** What the actor was resting for, kept across an interruption (GDD §7). */
export interface RestIntent {
  readonly reason: "FatigueAboveThreshold" | "NightShelter" | "Ordered";
  readonly targetSocketId: string;
  readonly startedAtTick: Int;
}

export interface RestOutcome {
  readonly state: ExertionState;
  /** Set when rest finished on its own terms. */
  readonly endedBecause?: "ReachedRestEnd" | "Interrupted";
  /** Returned on interruption so the planner can decide whether to resume. */
  readonly retainedIntent?: RestIntent;
}

export function startingExertion(): ExertionState {
  return {
    staminaMilli: mul(EXERTION.maxStamina, 1_000 as Int),
    fatigueMilli: 0 as Int,
    stamina: RATE_STATE_ZERO,
    fatigue: RATE_STATE_ZERO,
  };
}

function perSecond(points: Int): ReturnType<typeof rate> {
  return rate(mul(points, 1_000 as Int), asInt(TICKS_PER_SECOND, "ticksPerSecond") as unknown as Ticks);
}

function perMinute(points: Int): ReturnType<typeof rate> {
  return rate(mul(points, 1_000 as Int), asInt(TICKS_PER_MINUTE, "ticksPerMinute") as unknown as Ticks);
}

/** Can the actor sprint right now? Stamina gates sprinting and nothing else. */
export function canSprint(state: ExertionState): boolean {
  return state.staminaMilli > 0;
}

/**
 * Walking is **always** available.
 *
 * Exported as a function returning a constant rather than left implicit,
 * because criterion 3 is a claim about the system and a reader should be able to
 * find where it is made. No state, no threshold, no exhaustion removes it.
 */
export function canWalk(): true {
  return true;
}

export interface ExertionTickOutcome {
  readonly state: ExertionState;
  /** True while fatigue is above the rest-priority threshold (GDD §7). */
  readonly restPriority: boolean;
  /** True while fatigue would normally interrupt nonurgent work. */
  readonly interruptsWork: boolean;
  /** Set when a sprint was requested and stamina refused it. */
  readonly sprintDenied?: true;
}

/**
 * Advance one tick of exertion.
 *
 * A sprint with no stamina is **downgraded to a walk**, not refused: the actor
 * keeps moving and the caller is told the sprint did not happen.
 */
export function tickExertion(state: ExertionState, exertion: Exertion): ExertionTickOutcome {
  let staminaMilli = state.staminaMilli;
  let stamina = state.stamina;
  let fatigueMilli = state.fatigueMilli;
  let fatigue = state.fatigue;
  let sprintDenied: true | undefined;

  let effective = exertion;
  if (exertion === "Sprinting" && !canSprint(state)) {
    effective = "Walking";
    sprintDenied = true;
  }

  if (effective === "Sprinting") {
    const drained = advance(perSecond(EXERTION.sprintDrainPerSecond), stamina, 1 as Ticks);
    stamina = drained.state;
    staminaMilli = clamp(sub(staminaMilli, drained.delta), 0 as Int, mul(EXERTION.maxStamina, 1_000 as Int));
  } else if (effective === "Walking" || effective === "Resting") {
    // Recovery is for walking and rest; attacking and working do not restore it.
    const recovered = advance(perSecond(EXERTION.walkRecoverPerSecond), stamina, 1 as Ticks);
    stamina = recovered.state;
    staminaMilli = clamp(add(staminaMilli, recovered.delta), 0 as Int, mul(EXERTION.maxStamina, 1_000 as Int));
  }

  if (effective === "Resting") {
    const rested = advance(perMinute(EXERTION.fatigueRecoveredPerMinuteResting), fatigue, 1 as Ticks);
    fatigue = rested.state;
    fatigueMilli = clamp(sub(fatigueMilli, rested.delta), 0 as Int, mul(EXERTION.maxFatigue, 1_000 as Int));
  } else {
    const tired = advance(perMinute(EXERTION.fatiguePerMinuteActive), fatigue, 1 as Ticks);
    fatigue = tired.state;
    fatigueMilli = clamp(add(fatigueMilli, tired.delta), 0 as Int, mul(EXERTION.maxFatigue, 1_000 as Int));
  }

  const next: ExertionState = { staminaMilli, fatigueMilli, stamina, fatigue };
  return {
    state: next,
    // Compared in thousandths, not in whole points. The GDD says "above 60",
    // and 60.003 is above 60 — truncating first would hold the threshold back
    // until 61 and quietly move every rule in this table by a whole point.
    restPriority: (next.fatigueMilli as number) > (EXERTION.restPriorityThreshold as number) * 1_000,
    interruptsWork: (next.fatigueMilli as number) > (EXERTION.interruptThreshold as number) * 1_000,
    ...(sprintDenied === undefined ? {} : { sprintDenied }),
  };
}

/**
 * Advance a rest, and report why it ended.
 *
 * An interruption returns the state **untouched by the interruption itself** and
 * hands back the intent, so the planner keeps the reason and the target exactly
 * as GDD §7 requires.
 */
export function tickRest(state: ExertionState, intent: RestIntent, interrupted = false): RestOutcome {
  if (interrupted) {
    return { state, endedBecause: "Interrupted", retainedIntent: intent };
  }
  const outcome = tickExertion(state, "Resting");
  if ((outcome.state.fatigueMilli as number) <= (EXERTION.restEndsAt as number) * 1_000) {
    return { state: outcome.state, endedBecause: "ReachedRestEnd" };
  }
  return { state: outcome.state };
}

export function staminaPoints(state: ExertionState): number {
  return Math.trunc((state.staminaMilli as number) / 1_000);
}

export function fatiguePoints(state: ExertionState): number {
  return Math.trunc((state.fatigueMilli as number) / 1_000);
}
