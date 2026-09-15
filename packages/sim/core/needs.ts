/**
 * Food consumption and starvation (P1-09; GDD 30.2, AI 01).
 *
 * The rates are the GDD's, in fixed point, and the whole module exists to keep
 * them that way:
 *
 *   - fullness runs 0–100 and drains **6 per minute**;
 *   - below **25** ordinary HP recovery stops;
 *   - at **zero** an actor loses **8 HP per minute**.
 *
 * At 10 Hz that is 6/600 and 8/600 of a point per tick — neither divides evenly,
 * so both go through the W0-02 rate primitive with its saved remainder. Rounding
 * per tick would lose about 4 % of the hunger drain, and an actor would survive
 * an hour longer than the design says for no reason anyone could see.
 *
 * Starvation damage is tagged at its source. "Starvation damage remains distinct
 * from hostile injury" is not a display concern: sanctuary and truce govern
 * *sentient harm*, and if starvation arrived as generic damage a protected actor
 * would either be immortal inside a sanctuary or the law would look broken.
 */
import { add, advance, asInt, clamp, mul, rate, RATE_STATE_ZERO, sub } from "../primitives/index.js";
import type { Int, RateState, Ticks } from "../primitives/index.js";

export const TICK_HZ = 10 as Ticks;
export const TICKS_PER_MINUTE = 600;

/** GDD 30.2, exactly as written. */
export const FOOD = {
  maxFullness: 100 as Int,
  startingFullness: 85 as Int,
  drainPerMinute: 6 as Int,
  /** Below this, ordinary HP recovery stops. */
  recoveryFloor: 25 as Int,
  /** At zero fullness, this much HP per minute. */
  starvationHpPerMinute: 8 as Int,
  /** GDD 30.2: ordinary recovery is 3 HP/minute while resting with food at least 25. */
  recoveryHpPerMinute: 3 as Int,
} as const;

/** Damage carries its cause: starvation is not hostile injury (GDD 30.2; TP §10). */
export type DamageSource = "Starvation" | "Hostile" | "Exposure" | "Environment";

export interface DamageEvent {
  readonly source: DamageSource;
  readonly hpMilli: Int;
  readonly atTick: Int;
  /** True only for damage a law about sentient harm could forbid. */
  readonly isSentientHarm: boolean;
}

export interface NeedsState {
  /** Fullness in thousandths of a point, so the drain keeps its fraction. */
  readonly fullnessMilli: Int;
  readonly healthMilli: Int;
  readonly drain: RateState;
  readonly starvation: RateState;
  readonly recovery: RateState;
}

export interface ItemNutrition {
  readonly itemDefId: string;
  /** Fullness points restored, in thousandths. */
  readonly fullnessMilli: Int;
  /** Ticks of uninterrupted eating required. */
  readonly eatTicks: number;
}

/** The Prototype8 food table. Values are content; the rates above are the GDD's. */
export const PROTOTYPE8_FOOD: readonly ItemNutrition[] = [
  { itemDefId: "item.berry", fullnessMilli: 6_000 as Int, eatTicks: 10 },
  { itemDefId: "item.ration", fullnessMilli: 30_000 as Int, eatTicks: 30 },
  { itemDefId: "item.cooked.meat", fullnessMilli: 45_000 as Int, eatTicks: 40 },
];

export function startingNeeds(): NeedsState {
  return {
    fullnessMilli: mulThousandths(FOOD.startingFullness),
    healthMilli: 100_000 as Int,
    drain: RATE_STATE_ZERO,
    starvation: RATE_STATE_ZERO,
    recovery: RATE_STATE_ZERO,
  };
}

/** Fullness points per minute → thousandths per tick, as a rate that keeps its remainder. */
function perMinuteRate(pointsPerMinute: Int): ReturnType<typeof rate> {
  return rate(mulThousandths(pointsPerMinute), asInt(TICKS_PER_MINUTE, "ticksPerMinute") as unknown as Ticks);
}

function mulThousandths(points: Int): Int {
  return mul(points, 1_000 as Int);
}

export interface TickOutcome {
  readonly state: NeedsState;
  readonly damage?: DamageEvent;
  /** True while fullness is below the recovery floor (GDD 30.2). */
  readonly recoveryBlocked: boolean;
}

/**
 * Advance one tick of hunger, and starvation damage when fullness is zero.
 *
 * `resting` enables ordinary recovery, which the GDD gates on fullness ≥ 25 and
 * exposure < 60; exposure does not exist yet, so this takes it as a parameter
 * rather than assuming it away.
 */
export function tickNeeds(state: NeedsState, tick: Int, options: { readonly resting?: boolean; readonly exposureBelow60?: boolean } = {}): TickOutcome {
  const drained = advance(perMinuteRate(FOOD.drainPerMinute), state.drain, 1 as Ticks);
  const fullnessMilli = clamp(sub(state.fullnessMilli, drained.delta), 0 as Int, mulThousandths(FOOD.maxFullness));
  const recoveryBlocked = fullnessMilli < mulThousandths(FOOD.recoveryFloor);

  let healthMilli = state.healthMilli;
  let starvation = state.starvation;
  let recovery = state.recovery;
  let damage: DamageEvent | undefined;

  if (fullnessMilli <= 0) {
    const hurt = advance(perMinuteRate(FOOD.starvationHpPerMinute), starvation, 1 as Ticks);
    starvation = hurt.state;
    if (hurt.delta > 0) {
      healthMilli = clamp(sub(healthMilli, hurt.delta), 0 as Int, 100_000 as Int);
      damage = {
        source: "Starvation",
        hpMilli: hurt.delta,
        atTick: tick,
        // Starvation is not something an actor does to another actor, so no law
        // about sentient harm speaks to it (GDD 30.2, TP v1.1 §10).
        isSentientHarm: false,
      };
    }
  } else if (options.resting === true && !recoveryBlocked && options.exposureBelow60 !== false) {
    const healed = advance(perMinuteRate(FOOD.recoveryHpPerMinute), recovery, 1 as Ticks);
    recovery = healed.state;
    healthMilli = clamp(add(healthMilli, healed.delta), 0 as Int, 100_000 as Int);
  }

  return {
    state: { fullnessMilli, healthMilli, drain: drained.state, starvation, recovery },
    recoveryBlocked,
    ...(damage === undefined ? {} : { damage }),
  };
}

export type EatFailure = "Interrupted" | "AlreadyFull" | "UnknownFood";

export interface EatProgress {
  readonly itemDefId: string;
  readonly startedAtTick: Int;
  readonly ticksEaten: number;
}

export type EatOutcome =
  | { readonly status: "Eating"; readonly progress: EatProgress }
  /** The only outcome that consumes the item. */
  | { readonly status: "Finished"; readonly state: NeedsState; readonly consumedItemDefId: string }
  | { readonly status: "Failed"; readonly reason: EatFailure; readonly itemConsumed: false };

/**
 * Eat, over several ticks.
 *
 * The item is consumed **only** by the `Finished` outcome. An interruption
 * returns `itemConsumed: false` and no new state, so there is nothing to undo —
 * the same rule as an inventory transfer that never writes on failure. Eating
 * half a berry and losing it is the bug this shape prevents.
 */
export function continueEating(state: NeedsState, progress: EatProgress, nutrition: readonly ItemNutrition[], interrupted = false): EatOutcome {
  const food = nutrition.find((n) => n.itemDefId === progress.itemDefId);
  if (food === undefined) return { status: "Failed", reason: "UnknownFood", itemConsumed: false };
  if (interrupted) return { status: "Failed", reason: "Interrupted", itemConsumed: false };

  const ticksEaten = progress.ticksEaten + 1;
  if (ticksEaten < food.eatTicks) {
    return { status: "Eating", progress: { ...progress, ticksEaten } };
  }

  return {
    status: "Finished",
    consumedItemDefId: food.itemDefId,
    state: { ...state, fullnessMilli: clamp(add(state.fullnessMilli, food.fullnessMilli), 0 as Int, mulThousandths(FOOD.maxFullness)) },
  };
}

export function beginEating(itemDefId: string, startedAtTick: Int): EatProgress {
  return { itemDefId, startedAtTick, ticksEaten: 0 };
}

/** Fullness as whole points, for display and for comparisons against GDD thresholds. */
export function fullnessPoints(state: NeedsState): number {
  return Math.trunc((state.fullnessMilli as number) / 1_000);
}
