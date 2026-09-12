/**
 * Rates with saved remainders (TP v1.1 §4, Addendum D02).
 *
 * A rate is an exact rational amount per tick: `numerator / denominator`
 * (denominator > 0, in ticks). Applying it for one tick adds `numerator` to a
 * saved integer remainder and releases floor(remainder / denominator) whole
 * units; the remainder stays in the saved state, so "0.1 HP per tick" yields
 * exactly 1 HP every 10 ticks and "8 fatigue per minute" yields exactly 8000
 * milli over 600 ticks — nothing rounds away, nothing is invented.
 *
 * State is an immutable record; `advance` returns the new state. The remainder
 * is what a codec serializes (see serialize.ts); the rate itself is content.
 */
import { add, divFloor, mul, sub } from "./checkedMath.js";
import { asInt, IntegerError, type Int, ZERO } from "./int.js";
import { TICKS_PER_MINUTE, TICKS_PER_SECOND, type Milli, type Ticks } from "./units.js";

export interface Rate {
  /** Amount per `denominator` ticks, in the caller's unit (usually Milli or Mm). May be negative. */
  readonly numerator: Int;
  /** Ticks over which `numerator` accrues; > 0. */
  readonly denominator: Ticks;
}

export interface RateState {
  /** Saved remainder in [0, denominator) for positive denominators (floor semantics). */
  readonly remainder: Int;
}

export const RATE_STATE_ZERO: RateState = { remainder: ZERO };

export function rate(numerator: Int, denominator: Ticks): Rate {
  if (denominator <= 0) throw new IntegerError("INVALID_UNIT", "rate", [numerator, denominator], "denominator must be > 0 ticks");
  return { numerator: asInt(numerator, "rate"), denominator };
}

/** GDD "x per minute" (Milli per minute → Rate over 600 ticks). */
export function ratePerMinute(amountPerMinute: Milli): Rate {
  return rate(amountPerMinute, TICKS_PER_MINUTE);
}

/** GDD "x per second" (→ Rate over 10 ticks). */
export function ratePerSecond(amountPerSecond: Int): Rate {
  return rate(amountPerSecond, TICKS_PER_SECOND);
}

/** An exact per-tick amount (denominator 1); never carries a remainder. */
export function ratePerTick(amountPerTick: Int): Rate {
  return rate(amountPerTick, 1 as Ticks);
}

export interface Advance {
  /** Whole units released this step (floor semantics; may be negative for negative rates). */
  readonly delta: Int;
  readonly state: RateState;
}

/**
 * Advance a rate by `ticks` (default 1). Exact for any tick count:
 * total released over N ticks equals floor(N·numerator/denominator) minus
 * what earlier steps released, so the sum over any partition of N is identical.
 */
export function advance(r: Rate, state: RateState, ticks: Ticks = 1 as Ticks): Advance {
  const accrued = add(state.remainder, mul(r.numerator, ticks));
  const delta = divFloor(accrued, r.denominator);
  const remainder = sub(accrued, mul(delta, r.denominator));
  return { delta, state: { remainder } };
}

/** Total whole units a rate releases over `ticks` from a zero remainder: floor(ticks·num/den). */
export function totalOver(r: Rate, ticks: Ticks): Int {
  return advance(r, RATE_STATE_ZERO, ticks).delta;
}
