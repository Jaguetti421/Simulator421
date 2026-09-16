/**
 * Day, night and exposure (P1-11; GDD §5 "Match time", TIME 01).
 *
 * The published schedule, treated as the authority it is:
 *
 *   > One match spans five fictional days. Each day takes 12 simulation minutes:
 *   > eight daylight minutes followed by four night minutes. Day 1 begins at
 *   > 00:00; night intervals are 08:00–12:00, 20:00–24:00, 32:00–36:00,
 *   > 44:00–48:00, and 56:00–60:00. Twilight blends visually over the 30 seconds
 *   > preceding a boundary; **mechanical night starts exactly at the published
 *   > tick**.
 *
 * That last sentence is the packet. Twilight is a **visual** blend and has no
 * mechanical authority whatsoever: the exposure rate, the sight multiplier and
 * the night flag all change on the published tick and not a moment earlier.
 * Anything that reads a light level for *appearance* reads a different function
 * from anything that decides a *fact*, and the two cannot be confused because
 * the mechanical one does not take a light setting at all.
 */
import { add, advance, asInt, clamp, mul, rate, RATE_STATE_ZERO, sub } from "../primitives/index.js";
import type { Int, RateState, Ticks } from "../primitives/index.js";

export const TICKS_PER_MINUTE = 600;
export const TICKS_PER_SECOND = 10;

/** GDD §5: twelve minutes a day, eight of daylight then four of night. */
export const DAY = {
  minutesPerDay: 12,
  daylightMinutes: 8,
  nightMinutes: 4,
  days: 5,
  /** Twilight blends **visually** over the 30 seconds before a boundary. */
  twilightSeconds: 30,
} as const;

export const TICKS_PER_DAY = DAY.minutesPerDay * TICKS_PER_MINUTE;
export const NIGHT_STARTS_AT_TICK = DAY.daylightMinutes * TICKS_PER_MINUTE;

/** Exposure rates, in points per minute. TUNE except where the GDD fixes them. */
export const EXPOSURE = {
  max: 100 as Int,
  /** Exposure gained per minute outdoors at night. TUNE. */
  nightGainPerMinute: 9 as Int,
  /** Exposure gained per minute during a cold front, on top of night. TUNE. */
  coldFrontGainPerMinute: 12 as Int,
  /** Exposure lost per minute sheltered. TUNE. */
  shelterRecoveryPerMinute: 18 as Int,
  /** The GDD's recovery gate: ordinary healing stops at or above this. */
  recoveryBlockedAt: 60 as Int,
} as const;

/** Sight multiplier at night, in thousandths (GDD §22: night sight reduction). TUNE. */
export const NIGHT_SIGHT_MILLI = 450;

export interface MatchClock {
  readonly tick: Int;
  readonly day: number;
  readonly minuteOfMatch: number;
  readonly isNight: boolean;
  /** Ticks until the next day/night boundary. */
  readonly ticksToBoundary: number;
}

/** The mechanical clock. Takes a tick and nothing else — no light setting, no scene. */
export function clockAt(tick: Int): MatchClock {
  const t = tick as number;
  const dayIndex = Math.floor(t / TICKS_PER_DAY);
  const intoDay = t - dayIndex * TICKS_PER_DAY;
  const isNight = intoDay >= NIGHT_STARTS_AT_TICK;
  const boundary = isNight ? TICKS_PER_DAY : NIGHT_STARTS_AT_TICK;
  return {
    tick,
    day: dayIndex + 1,
    minuteOfMatch: Math.floor(t / TICKS_PER_MINUTE),
    isNight,
    ticksToBoundary: boundary - intoDay,
  };
}

/** The published night intervals, in minutes, for anything that wants to state them. */
export const NIGHT_INTERVALS: readonly (readonly [number, number])[] = Array.from({ length: DAY.days }, (_, day) => [
  day * DAY.minutesPerDay + DAY.daylightMinutes,
  (day + 1) * DAY.minutesPerDay,
]);

/**
 * Visual light in thousandths, **including** the twilight blend.
 *
 * Presentation only. Nothing in this module consumes it, and a test asserts
 * that: `exposureTick` and `clockAt` do not take a light value, so a lighting
 * change cannot move an exposure rate or a night boundary even by accident.
 */
export function visualLightMilli(tick: Int): number {
  const clock = clockAt(tick);
  const twilightTicks = DAY.twilightSeconds * TICKS_PER_SECOND;
  const blend = clock.ticksToBoundary <= twilightTicks ? Math.trunc(((twilightTicks - clock.ticksToBoundary) * 1_000) / twilightTicks) : 0;
  // Approaching night, daylight fades toward the night level; approaching dawn,
  // it climbs back. The blend is symmetric and purely cosmetic.
  const from = clock.isNight ? NIGHT_SIGHT_MILLI : 1_000;
  const to = clock.isNight ? 1_000 : NIGHT_SIGHT_MILLI;
  return from + Math.trunc(((to - from) * blend) / 1_000);
}

/** The mechanical sight multiplier. Steps at the boundary; no blend, ever. */
export function mechanicalSightMilli(tick: Int): number {
  return clockAt(tick).isNight ? NIGHT_SIGHT_MILLI : 1_000;
}

export interface ColdFront {
  readonly fromTick: Int;
  /** End-exclusive, like every other interval in this build. */
  readonly throughTick: Int;
}

export function coldFrontActive(fronts: readonly ColdFront[], tick: Int): boolean {
  return fronts.some((front) => tick >= front.fromTick && tick < front.throughTick);
}

export interface ExposureState {
  readonly exposureMilli: Int;
  readonly gain: RateState;
  readonly recovery: RateState;
}

export function startingExposure(): ExposureState {
  return { exposureMilli: 0 as Int, gain: RATE_STATE_ZERO, recovery: RATE_STATE_ZERO };
}

function perMinute(points: Int): ReturnType<typeof rate> {
  return rate(mul(points, 1_000 as Int), asInt(TICKS_PER_MINUTE, "ticksPerMinute") as unknown as Ticks);
}

export interface ExposureOutcome {
  readonly state: ExposureState;
  /** True at or above the GDD's recovery gate. */
  readonly blocksRecovery: boolean;
  readonly isNight: boolean;
  readonly coldFront: boolean;
}

/**
 * Advance one tick of exposure.
 *
 * Takes the tick, whether the actor is sheltered, and the cold fronts. **It does
 * not take a light level** — that is what makes criterion 3 structural rather
 * than a promise: a visual setting has no parameter to arrive through.
 */
export function exposureTick(state: ExposureState, tick: Int, options: { readonly sheltered?: boolean; readonly coldFronts?: readonly ColdFront[] } = {}): ExposureOutcome {
  const clock = clockAt(tick);
  const cold = coldFrontActive(options.coldFronts ?? [], tick);
  let exposureMilli = state.exposureMilli;
  let gain = state.gain;
  let recovery = state.recovery;

  if (options.sheltered === true) {
    const recovered = advance(perMinute(EXPOSURE.shelterRecoveryPerMinute), recovery, 1 as Ticks);
    recovery = recovered.state;
    exposureMilli = clamp(sub(exposureMilli, recovered.delta), 0 as Int, mul(EXPOSURE.max, 1_000 as Int));
  } else if (clock.isNight || cold) {
    const perMinuteGain = add(clock.isNight ? EXPOSURE.nightGainPerMinute : (0 as Int), cold ? EXPOSURE.coldFrontGainPerMinute : (0 as Int));
    const gained = advance(perMinute(perMinuteGain), gain, 1 as Ticks);
    gain = gained.state;
    exposureMilli = clamp(add(exposureMilli, gained.delta), 0 as Int, mul(EXPOSURE.max, 1_000 as Int));
  }

  const next: ExposureState = { exposureMilli, gain, recovery };
  return {
    state: next,
    // Compared in thousandths, like every other threshold in this build.
    blocksRecovery: (exposureMilli as number) >= (EXPOSURE.recoveryBlockedAt as number) * 1_000,
    isNight: clock.isNight,
    coldFront: cold,
  };
}

export function exposurePoints(state: ExposureState): number {
  return Math.trunc((state.exposureMilli as number) / 1_000);
}
