import { describe, expect, it } from "vitest";
import { BATCH_MS, formatConfirmedTick, isSpeed, matchProgress, MAX_STANDARD_TICKS, simSeconds, SPEEDS, TICK_HZ, ticksPerBatch } from "./pacing.js";

describe("pacing", () => {
  it("keeps the documented 10 Hz timestep and the 36,000-tick Standard ceiling", () => {
    expect(TICK_HZ).toBe(10);
    expect(MAX_STANDARD_TICKS).toBe(36_000);
    expect(MAX_STANDARD_TICKS / TICK_HZ / 60).toBe(60);
  });

  it("changes ticks per batch, never the tick length", () => {
    expect(SPEEDS).toEqual([1, 2, 4]);
    for (const speed of SPEEDS) {
      expect(ticksPerBatch(speed)).toBe(speed);
      expect((ticksPerBatch(speed) / BATCH_MS) * 1000).toBe(TICK_HZ * speed);
    }
  });

  it("rejects a speed that is not offered", () => {
    expect(isSpeed(2)).toBe(true);
    expect(isSpeed(3)).toBe(false);
    expect(isSpeed(0)).toBe(false);
  });

  it("shows the confirmed tick first, then the simulated time it stands for", () => {
    expect(formatConfirmedTick(0)).toBe("t=0 · 0:00.0 simulated");
    expect(formatConfirmedTick(1234)).toBe("t=1234 · 2:03.4 simulated");
    expect(simSeconds(600)).toBe(60);
  });

  it("clamps match progress instead of reporting more than a whole match", () => {
    expect(matchProgress(0)).toBe(0);
    expect(matchProgress(18_000)).toBe(0.5);
    expect(matchProgress(40_000)).toBe(1);
  });
});
