/**
 * Pacing view model (W0-10a).
 *
 * The simulation runs at a fixed 10 Hz authoritative timestep (TP v1.1 §1: a
 * Standard match is at most 36,000 ticks in 60 simulation minutes; GDD §"fixed
 * 10 Hz authoritative timestep"). Speed multipliers change how many ticks are
 * advanced per wall-clock batch — never the tick length, because the tick is the
 * unit of determinism.
 *
 * Pure functions, so the numbers on screen can be asserted without a browser.
 */
export const TICK_HZ = 10;
export const BATCH_MS = 100;
export const MAX_STANDARD_TICKS = 36_000;
export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

export function isSpeed(value: number): value is Speed {
  return (SPEEDS as readonly number[]).includes(value);
}

/** Ticks to advance per 100 ms batch at a given speed. */
export function ticksPerBatch(speed: Speed): number {
  return speed;
}

/** Simulation seconds represented by a tick count. */
export function simSeconds(tick: number): number {
  return tick / TICK_HZ;
}

/** `t=1234 · 2:03.4 simulated` — the confirmed tick first, because that is the authoritative number. */
export function formatConfirmedTick(tick: number): string {
  const seconds = simSeconds(tick);
  const minutes = Math.floor(seconds / 60);
  const rest = (seconds - minutes * 60).toFixed(1).padStart(4, "0");
  return `t=${tick} · ${minutes}:${rest} simulated`;
}

/** Share of a Standard match completed, clamped — used for a progress readout, never for a claim about the match. */
export function matchProgress(tick: number): number {
  return Math.min(1, Math.max(0, tick / MAX_STANDARD_TICKS));
}
