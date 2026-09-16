import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import {
  clockAt,
  DAY,
  EXPOSURE,
  exposurePoints,
  exposureTick,
  mechanicalSightMilli,
  NIGHT_INTERVALS,
  NIGHT_SIGHT_MILLI,
  NIGHT_STARTS_AT_TICK,
  startingExposure,
  TICKS_PER_DAY,
  visualLightMilli,
} from "./daynight.js";
import type { ColdFront, ExposureState } from "./daynight.js";

/** P1-11. */
const T = (n: number): Int => n as Int;
const minute = (m: number): Int => T(m * 600);

describe("night boundaries and twilight authority match the GDD (criterion 1)", () => {
  it("publishes the five night intervals the GDD lists", () => {
    expect(NIGHT_INTERVALS).toEqual([
      [8, 12],
      [20, 24],
      [32, 36],
      [44, 48],
      [56, 60],
    ]);
    expect(DAY.minutesPerDay).toBe(12);
    expect(DAY.daylightMinutes).toBe(8);
    expect(TICKS_PER_DAY).toBe(7_200);
  });

  it("starts mechanical night exactly at the published tick, not a moment earlier", () => {
    expect(clockAt(T(NIGHT_STARTS_AT_TICK - 1)).isNight).toBe(false);
    expect(clockAt(T(NIGHT_STARTS_AT_TICK)).isNight).toBe(true);
    expect(mechanicalSightMilli(T(NIGHT_STARTS_AT_TICK - 1))).toBe(1_000);
    expect(mechanicalSightMilli(T(NIGHT_STARTS_AT_TICK))).toBe(NIGHT_SIGHT_MILLI);
  });

  it("agrees with every published interval across all five days", () => {
    for (const [from, through] of NIGHT_INTERVALS) {
      expect(clockAt(minute(from - 1)).isNight, `minute ${from - 1} should be day`).toBe(false);
      expect(clockAt(minute(from)).isNight, `minute ${from} should be night`).toBe(true);
      expect(clockAt(minute(through - 1)).isNight, `minute ${through - 1} should be night`).toBe(true);
      expect(clockAt(minute(through)).isNight, `minute ${through} should be day`).toBe(false);
    }
  });

  it("numbers the days and counts down to the next boundary", () => {
    expect(clockAt(T(0)).day).toBe(1);
    expect(clockAt(minute(12)).day).toBe(2);
    expect(clockAt(minute(59)).day).toBe(5);
    expect(clockAt(T(NIGHT_STARTS_AT_TICK - 10)).ticksToBoundary).toBe(10);
  });

  it("blends twilight only in the visual light, over the 30 seconds before a boundary", () => {
    const beforeBlend = visualLightMilli(T(NIGHT_STARTS_AT_TICK - 400));
    const midBlend = visualLightMilli(T(NIGHT_STARTS_AT_TICK - 150));
    expect(beforeBlend).toBe(1_000);
    expect(midBlend).toBeLessThan(1_000);
    expect(midBlend).toBeGreaterThan(NIGHT_SIGHT_MILLI);
    // And the mechanical value has not moved at all during the blend.
    expect(mechanicalSightMilli(T(NIGHT_STARTS_AT_TICK - 150))).toBe(1_000);
  });
});

describe("exposure follows night and cold fronts (criterion 2)", () => {
  function accumulate(ticks: number, options: Parameters<typeof exposureTick>[2] = {}, from: ExposureState = startingExposure(), startTick = NIGHT_STARTS_AT_TICK): ExposureState {
    let state = from;
    for (let i = 0; i < ticks; i += 1) state = exposureTick(state, T(startTick + i), options).state;
    return state;
  }

  it("gains nothing outdoors during the day", () => {
    expect(exposurePoints(accumulate(600, {}, startingExposure(), 0))).toBe(0);
  });

  it("gains the night rate outdoors for a four-minute night", () => {
    const afterNight = accumulate(4 * 600);
    expect(exposurePoints(afterNight)).toBe(4 * (EXPOSURE.nightGainPerMinute as number));
  });

  it("adds the cold front on top of night, for the two minutes it overlaps", () => {
    const fronts: readonly ColdFront[] = [{ fromTick: T(NIGHT_STARTS_AT_TICK), throughTick: T(NIGHT_STARTS_AT_TICK + 2 * 600) }];
    const state = accumulate(4 * 600, { coldFronts: fronts });
    // Two minutes at night+cold, two at night alone.
    const expected = 2 * ((EXPOSURE.nightGainPerMinute as number) + (EXPOSURE.coldFrontGainPerMinute as number)) + 2 * (EXPOSURE.nightGainPerMinute as number);
    expect(exposurePoints(state)).toBe(expected);
  });

  it("recovers under shelter and never goes below zero", () => {
    const exposed = accumulate(4 * 600);
    const sheltered = accumulate(10 * 600, { sheltered: true }, exposed);
    expect(exposurePoints(sheltered)).toBe(0);
    expect(sheltered.exposureMilli).toBe(0);
  });

  it("blocks ordinary recovery at 60 and not at 59", () => {
    const at59: ExposureState = { ...startingExposure(), exposureMilli: T(59_000) };
    expect(exposureTick(at59, minute(0)).blocksRecovery).toBe(false);
    const at60: ExposureState = { ...startingExposure(), exposureMilli: T(60_000) };
    expect(exposureTick(at60, minute(0)).blocksRecovery).toBe(true);
    expect(EXPOSURE.recoveryBlockedAt).toBe(60);
  });

  it("keeps the fraction of a per-minute rate across ticks", () => {
    const oneTick = exposureTick(startingExposure(), T(NIGHT_STARTS_AT_TICK)).state;
    expect(oneTick.exposureMilli).toBeGreaterThan(0);
    expect(oneTick.exposureMilli).toBeLessThan(1_000);
  });

  it("gains from a cold front during daylight too, because cold is not night", () => {
    const fronts: readonly ColdFront[] = [{ fromTick: T(0), throughTick: T(600) }];
    const state = accumulate(600, { coldFronts: fronts }, startingExposure(), 0);
    expect(exposurePoints(state)).toBe(EXPOSURE.coldFrontGainPerMinute as number);
  });
});

describe("visual light cannot change a fact (criterion 3)", () => {
  it("gives the mechanical functions no way to receive a light setting", () => {
    // If a light parameter is ever added, these calls stop compiling — which is
    // the check. A visual value has no door into a mechanical one.
    expect(clockAt.length).toBe(1);
    expect(mechanicalSightMilli.length).toBe(1);
    expect(exposureTick.length).toBeLessThanOrEqual(3);
  });

  it("produces identical exposure whatever the visual light is doing", () => {
    // Mid-twilight, when the visual light is between day and night values.
    const twilight = T(NIGHT_STARTS_AT_TICK - 150);
    expect(visualLightMilli(twilight)).toBeLessThan(1_000);
    const outcome = exposureTick(startingExposure(), twilight);
    // Still daylight mechanically, so no gain at all.
    expect(outcome.isNight).toBe(false);
    expect(outcome.state.exposureMilli).toBe(0);
  });

  it("steps the mechanical sight multiplier at the boundary while the visual blends through it", () => {
    const before = T(NIGHT_STARTS_AT_TICK - 1);
    const after = T(NIGHT_STARTS_AT_TICK);
    expect(mechanicalSightMilli(before)).toBe(1_000);
    expect(mechanicalSightMilli(after)).toBe(NIGHT_SIGHT_MILLI);
    // The visual has been moving for 30 seconds by then.
    expect(visualLightMilli(before)).toBeLessThan(1_000);
    expect(visualLightMilli(before)).toBeGreaterThan(NIGHT_SIGHT_MILLI);
  });
});
