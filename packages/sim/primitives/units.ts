/**
 * Units (CONVENTIONS.md, TP v1.1 §4, GDD 30.1, Addendum D02).
 *
 * - Tick: integer at 10 Hz (100 ms). `Ticks` counts ticks or a duration in ticks.
 * - Mm: positions and distances in integer millimetres.
 * - Milli: normalized vitals, rates and modifiers in integer thousandths of the
 *   displayed unit (1000 milli = 1.000). Skill modifiers are Milli (900 = ×0.9).
 *
 * Each unit is a branded `Int`; constructors validate integrality and domain
 * and throw `IntegerError("INVALID_UNIT")` otherwise. Names expose the unit
 * (`durationTicks`, `speedMmPerTick`, `fullnessMilli`).
 */
import { divCeil, divFloor, mul } from "./checkedMath.js";
import { asInt, IntegerError, type Int } from "./int.js";

declare const UNIT: unique symbol;
export type Ticks = Int & { readonly [UNIT]: "ticks" };
export type Mm = Int & { readonly [UNIT]: "mm" };
export type Milli = Int & { readonly [UNIT]: "milli" };

export const TICK_HZ: Int = asInt(10, "TICK_HZ");
export const TICK_MS: Int = asInt(100, "TICK_MS");
export const TICKS_PER_SECOND: Ticks = ticks(10);
export const TICKS_PER_MINUTE: Ticks = ticks(600);
export const MM_PER_METER: Mm = mm(1000);
export const MILLI_ONE: Milli = milli(1000); // ×1.000
export const MILLI_ZERO: Milli = milli(0);

/** Standard match length: 60 minutes at 10 Hz (GDD; TP v1.1 §4 boundary examples). */
export const STANDARD_MATCH_TICKS: Ticks = ticks(36000);

function unit<T extends Int>(n: number, name: string, predicate: (v: number) => boolean, domain: string): T {
  if (!Number.isSafeInteger(n) || !predicate(n)) {
    throw new IntegerError("INVALID_UNIT", name, [n], domain);
  }
  return n as T;
}

/** A tick count or duration; must be a non-negative safe integer. */
export function ticks(n: number): Ticks {
  return unit<Ticks>(n, "ticks", (v) => v >= 0, "ticks must be a non-negative integer");
}

/** A signed millimetre coordinate or distance. */
export function mm(n: number): Mm {
  return unit<Mm>(n, "mm", () => true, "mm must be an integer");
}

/** A signed thousandths value (vitals, rates, modifiers). */
export function milli(n: number): Milli {
  return unit<Milli>(n, "milli", () => true, "milli must be an integer");
}

/** Whole seconds → ticks (10 per second). */
export function ticksFromSeconds(seconds: Int): Ticks {
  return ticks(mul(seconds, TICKS_PER_SECOND));
}

/** Tenths of a second → ticks (1 per decisecond). GDD durations such as 1.2 s are 12 deciseconds. */
export function ticksFromDeciseconds(deciseconds: Int): Ticks {
  return ticks(deciseconds);
}

/** Whole minutes → ticks (600 per minute). */
export function ticksFromMinutes(minutes: Int): Ticks {
  return ticks(mul(minutes, TICKS_PER_MINUTE));
}

/** Whole metres → millimetres. */
export function mmFromMeters(meters: Int): Mm {
  return mm(mul(meters, MM_PER_METER));
}

/**
 * Per-second speed in mm to per-tick speed in mm, exact division required
 * (3500 mm/s → 350 mm/tick). Speeds that do not divide evenly must be
 * expressed as a `Rate` with a saved remainder instead (see rate.ts).
 */
export function mmPerTickFromMmPerSecond(mmPerSecond: Mm): Mm {
  const perTick = divFloor(mmPerSecond, TICK_HZ);
  if (mul(perTick, TICK_HZ) !== mmPerSecond) {
    throw new IntegerError("INVALID_UNIT", "mmPerTickFromMmPerSecond", [mmPerSecond], "not an exact per-tick amount; use a Rate");
  }
  return mm(perTick);
}

/**
 * Addendum D02: a positive action duration is ceil(base × modifier) ticks after
 * the single applicable skill modifier. 12 ticks × 900 milli → ceil(10.8) = 11.
 * The base is already quantized to ticks (from deciseconds). A modifier ≤ 0 or
 * a zero base is rejected: durations are positive by definition.
 */
export function actionDurationTicks(baseTicks: Ticks, skillModifierMilli: Milli): Ticks {
  if (baseTicks <= 0) throw new IntegerError("INVALID_UNIT", "actionDurationTicks", [baseTicks, skillModifierMilli], "base must be positive");
  if (skillModifierMilli <= 0) {
    throw new IntegerError("INVALID_UNIT", "actionDurationTicks", [baseTicks, skillModifierMilli], "modifier must be positive");
  }
  return ticks(divCeil(mul(baseTicks, skillModifierMilli), MILLI_ONE));
}

/** Apply a thousandths modifier to a value, rounding toward −∞ (for non-duration quantities). */
export function scaleMilliFloor(value: Int, modifierMilli: Milli): Int {
  return divFloor(mul(value, modifierMilli), MILLI_ONE);
}

/** Compose two thousandths modifiers, floor-rounded (850 ∘ 900 → 765). */
export function composeMilli(a: Milli, b: Milli): Milli {
  return milli(divFloor(mul(a, b), MILLI_ONE));
}
