import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { asInt, IntegerError, type Int } from "./int.js";
import { advance, RATE_STATE_ZERO, rate, ratePerMinute, ratePerSecond, ratePerTick, type RateState, totalOver } from "./rate.js";
import {
  actionDurationTicks,
  composeMilli,
  milli,
  mm,
  mmFromMeters,
  mmPerTickFromMmPerSecond,
  scaleMilliFloor,
  STANDARD_MATCH_TICKS,
  ticks,
  ticksFromDeciseconds,
  ticksFromMinutes,
  ticksFromSeconds,
  TICKS_PER_MINUTE,
} from "./units.js";

const I = (n: number): Int => asInt(n);

describe("unit constructors reject invalid units explicitly", () => {
  it("ticks: non-integer, negative, unsafe", () => {
    for (const bad of [1.5, -1, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expect(() => ticks(bad)).toThrow(IntegerError);
      expect(() => ticks(bad)).toThrow(/INVALID_UNIT/);
    }
    expect(ticks(0)).toBe(0);
    expect(STANDARD_MATCH_TICKS).toBe(36000);
  });
  it("mm and milli: integers of either sign only", () => {
    expect(mm(-800_000)).toBe(-800_000);
    expect(milli(-6000)).toBe(-6000);
    expect(() => mm(0.5)).toThrow(/INVALID_UNIT/);
    expect(() => milli(2 ** 53)).toThrow(/INVALID_UNIT/);
  });
  it("conversions", () => {
    expect(ticksFromSeconds(I(3))).toBe(30); // eating: 3 seconds
    expect(ticksFromDeciseconds(I(12))).toBe(12); // 1.2 s
    expect(ticksFromMinutes(I(60))).toBe(36000);
    expect(mmFromMeters(I(800))).toBe(800_000);
    expect(ticks(TICKS_PER_MINUTE)).toBe(600);
  });
});

describe("GDD 30.2 movement vectors", () => {
  it("walk 3.5 m/s and sprint 5.0 m/s are exact per-tick amounts", () => {
    expect(mmPerTickFromMmPerSecond(mm(3500))).toBe(350);
    expect(mmPerTickFromMmPerSecond(mm(5000))).toBe(500);
  });
  it("a speed that is not an exact per-tick amount must be a Rate, not silently rounded", () => {
    expect(() => mmPerTickFromMmPerSecond(mm(3505))).toThrow(/INVALID_UNIT/);
    const r = ratePerSecond(I(3505)); // 350.5 mm per tick
    expect(totalOver(r, ticks(2))).toBe(701);
    expect(totalOver(r, ticks(10))).toBe(3505);
  });
  it("carry penalty 0.70 at hard limit and 0.850 at load 20 scale walk speed with floor rounding", () => {
    expect(scaleMilliFloor(mm(350), milli(700))).toBe(245);
    expect(scaleMilliFloor(mm(350), milli(850))).toBe(297); // 297.5 → floor; the half mm is a Rate remainder if needed
    expect(composeMilli(milli(850), milli(900))).toBe(765);
  });
});

describe("Addendum D02 durations: ceil after the single skill modifier", () => {
  it("1.2 s × 0.9 takes eleven ticks", () => {
    expect(actionDurationTicks(ticksFromDeciseconds(I(12)), milli(900))).toBe(11);
  });
  it("more vectors", () => {
    expect(actionDurationTicks(ticks(30), milli(1000))).toBe(30); // eating, no modifier
    expect(actionDurationTicks(ticks(30), milli(1150))).toBe(35); // fatigue +15 %: 34.5 → 35
    expect(actionDurationTicks(ticks(30), milli(850))).toBe(26); // 25.5 → 26
    expect(actionDurationTicks(ticks(1), milli(1))).toBe(1); // never zero
    expect(actionDurationTicks(ticks(7), milli(1000))).toBe(7);
  });
  it("a positive duration never rounds to zero and never rounds down", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100_000 }), fc.integer({ min: 1, max: 5000 }), (base, mod) => {
        const d = actionDurationTicks(ticks(base), milli(mod));
        expect(d).toBeGreaterThanOrEqual(1);
        expect(BigInt(d) * 1000n).toBeGreaterThanOrEqual(BigInt(base) * BigInt(mod));
        expect((BigInt(d) - 1n) * 1000n).toBeLessThan(BigInt(base) * BigInt(mod));
      }),
    );
  });
  it("rejects zero/negative base and non-positive modifiers", () => {
    expect(() => actionDurationTicks(ticks(0), milli(1000))).toThrow(/INVALID_UNIT/);
    expect(() => actionDurationTicks(ticks(10), milli(0))).toThrow(/INVALID_UNIT/);
    expect(() => actionDurationTicks(ticks(10), milli(-100))).toThrow(/INVALID_UNIT/);
  });
});

describe("rates carry remainders in saved integer state (TP v1.1 §4, D02)", () => {
  function run(r: ReturnType<typeof rate>, n: number): { total: Int; state: RateState } {
    let state: RateState = RATE_STATE_ZERO;
    let total = 0;
    for (let i = 0; i < n; i += 1) {
      const step = advance(r, state);
      total += step.delta;
      state = step.state;
    }
    return { total: I(total), state };
  }

  it("0.1 HP per tick accumulates exactly one HP every ten ticks", () => {
    const r = ratePerTick(milli(100)); // 0.100 HP per tick in milli-HP
    const { total } = run(r, 100);
    expect(total).toBe(10_000); // exactly 10 HP in milli
    // in whole HP units with a tenth per tick:
    const tenth = rate(I(1), ticks(10));
    expect(run(tenth, 9).total).toBe(0);
    expect(run(tenth, 10).total).toBe(1);
    expect(run(tenth, 25).total).toBe(2);
    expect(run(tenth, 25).state.remainder).toBe(5);
  });
  it("GDD need rates over one minute: food −6, ordinary recovery +3, fatigue +8, rest −45, exposure +12", () => {
    for (const [perMinute, expected] of [
      [-6000, -6000],
      [3000, 3000],
      [8000, 8000],
      [-45000, -45000],
      [12000, 12000],
    ] as const) {
      const r = ratePerMinute(milli(perMinute));
      const { total, state } = run(r, 600);
      expect(total).toBe(expected);
      expect(state.remainder).toBe(0);
    }
  });
  it("fatigue +8/minute releases 13 or 14 milli per tick with nothing lost", () => {
    const r = ratePerMinute(milli(8000)); // 13.333… milli per tick
    let state: RateState = RATE_STATE_ZERO;
    const deltas: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const step = advance(r, state);
      deltas.push(step.delta);
      state = step.state;
    }
    expect(deltas).toEqual([13, 13, 14, 13, 13, 14]);
    expect(run(r, 60).total).toBe(800);
  });
  it("night exposure: four minutes add 48 without mitigation (GDD 30.2 arithmetic check)", () => {
    expect(totalOver(ratePerMinute(milli(12000)), ticksFromMinutes(I(4)))).toBe(48_000);
    expect(totalOver(ratePerMinute(milli(36000)), ticksFromMinutes(I(2)))).toBe(72_000); // cold front + night
  });
  it("negative rates use floor semantics so totals over N ticks equal floor(N·num/den) exactly", () => {
    fc.assert(
      fc.property(fc.integer({ min: -100_000, max: 100_000 }), fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 0, max: 3000 }), (num, den, n) => {
        const r = rate(I(num), ticks(den));
        const total = run(r, n).total;
        const expected = BigInt(num) * BigInt(n);
        const q = expected / BigInt(den);
        const floor = expected % BigInt(den) !== 0n && expected < 0n ? q - 1n : q;
        expect(BigInt(total)).toBe(floor);
        expect(BigInt(totalOver(r, ticks(n)))).toBe(floor);
      }),
    );
  });
  it("advancing by k ticks at once equals k single-tick advances (partition invariance)", () => {
    fc.assert(
      fc.property(fc.integer({ min: -50_000, max: 50_000 }), fc.integer({ min: 1, max: 700 }), fc.array(fc.integer({ min: 0, max: 50 }), { maxLength: 40 }), (num, den, chunks) => {
        const r = rate(I(num), ticks(den));
        let state: RateState = RATE_STATE_ZERO;
        let total = 0;
        let n = 0;
        for (const k of chunks) {
          const step = advance(r, state, ticks(k));
          total += step.delta;
          state = step.state;
          n += k;
        }
        const single = run(r, n);
        expect(total).toBe(single.total);
        expect(state.remainder).toBe(single.state.remainder);
        expect(state.remainder >= 0 && state.remainder < den).toBe(true);
      }),
    );
  });
  it("rejects a non-positive denominator", () => {
    expect(() => rate(I(1), 0 as never)).toThrow(/INVALID_UNIT/);
  });
});
