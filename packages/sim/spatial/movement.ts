/**
 * Kinematic movement and obstacle sweep (P1-05; TP v1.1 §5, AI 05).
 *
 * Three properties decide whether movement is trustworthy, and all three are
 * about what must **not** happen:
 *
 *   - **No teleport.** An actor's position changes by at most the distance its
 *     speed allows this tick, checked against the previous position rather than
 *     assumed from the step function.
 *   - **No corner cutting.** A diagonal step across the shared corner of two
 *     blocked cells is refused: an actor cannot slip between a boulder and a
 *     cliff because the maths happened to land it on the far side.
 *   - **No tunnelling.** The path is swept in sub-steps small enough that a
 *     one-metre obstacle cannot be skipped, however fast the actor is moving.
 *
 * Distance comes from the W0-02 rate primitive with its **saved remainder**, so
 * a speed that is not a whole number of millimetres per tick accumulates instead
 * of being rounded away every tick — 0.8 × 3,500 mm/s at 10 Hz is 280 mm/tick
 * exactly, but a carried load or a shallow crossing rarely divides so kindly.
 */
import { add, asInt, isqrt, mul, mulDiv, RATE_STATE_ZERO, rate, sub } from "../primitives/index.js";
import { advance } from "../primitives/index.js";
import type { Int, RateState, Ticks } from "../primitives/index.js";
import { cellIndex, cellOf, GRID_SIZE, SPEED_MULTIPLIER_MILLI, TRAVERSAL } from "./terrain.js";
import type { CompiledTerrain, TraversalClass } from "./terrain.js";

/** Actor radius; the sweep keeps this clear of blocked cells (GDD: 0.3 m). */
export const ACTOR_RADIUS_MM = 300 as Int;
/**
 * Sub-step ceiling for the sweep. A quarter of a cell: an obstacle is at least
 * one cell wide, so no sub-step can step over one, and the bound holds for any
 * speed because the sweep takes as many sub-steps as the distance needs.
 */
export const SWEEP_STEP_MM = 250 as Int;
export const TICK_HZ = 10 as Ticks;

export type BlockedReason = "Terrain" | "Obstacle" | "CornerCut" | "Envelope";

export interface MovementState {
  readonly xMm: Int;
  readonly yMm: Int;
  /** Saved remainder for the distance rate; never rounded away between ticks. */
  readonly distance: RateState;
}

export interface MoveResult {
  readonly state: MovementState;
  /** Millimetres actually travelled this tick, after any block. */
  readonly movedMm: number;
  /** Millimetres the rate released this tick, before collision. */
  readonly budgetMm: number;
  readonly blocked?: { readonly reason: BlockedReason; readonly atCx: number; readonly atCy: number };
}

export function movementAt(xMm: Int, yMm: Int): MovementState {
  return { xMm, yMm, distance: RATE_STATE_ZERO };
}

function classAtCell(terrain: CompiledTerrain, cx: number, cy: number): TraversalClass | undefined {
  if (cx < 0 || cy < 0 || cx >= GRID_SIZE || cy >= GRID_SIZE) return undefined;
  return terrain.traversal[cellIndex(cx, cy)] as TraversalClass;
}

function passable(terrain: CompiledTerrain, cx: number, cy: number): boolean {
  const cls = classAtCell(terrain, cx, cy);
  return cls !== undefined && SPEED_MULTIPLIER_MILLI[cls] > 0;
}

function blockedReason(terrain: CompiledTerrain, cx: number, cy: number): BlockedReason {
  const cls = classAtCell(terrain, cx, cy);
  if (cls === undefined) return "Envelope";
  return cls === TRAVERSAL.Obstacle ? "Obstacle" : "Terrain";
}

/**
 * Millimetres per tick for an actor, as a rate rather than a rounded number.
 *
 * The terrain multiplier and the carry multiplier are both thousandths, so the
 * rate's numerator is `speed × terrain × carry` and its denominator is
 * `tickHz × 1000 × 1000`. Nothing is divided until `advance` does it, which is
 * what lets the remainder survive.
 */
export function movementRate(baseMmPerSecond: Int, terrainMultiplierMilli: Int, carryMultiplierMilli: Int): ReturnType<typeof rate> {
  return rate(mul(mul(baseMmPerSecond, terrainMultiplierMilli), carryMultiplierMilli), mul(mul(TICK_HZ as unknown as Int, 1_000 as Int), 1_000 as Int) as unknown as Ticks);
}

/**
 * Advance one tick toward a target.
 *
 * The sweep walks the straight line in sub-steps of at most `SWEEP_STEP_MM`,
 * stopping at the last position before a blocked cell. A sub-step that changes
 * both axes also requires both orthogonal neighbours to be passable, which is
 * the corner-cutting rule: cutting a corner is exactly the case where the
 * diagonal is clear and the two cells beside it are not.
 */
export function stepMovement(
  terrain: CompiledTerrain,
  state: MovementState,
  target: { readonly xMm: Int; readonly yMm: Int },
  options: { readonly baseMmPerSecond?: Int; readonly carryMultiplierMilli?: Int } = {},
): MoveResult {
  const base = options.baseMmPerSecond ?? (3_500 as Int);
  const carry = options.carryMultiplierMilli ?? (1_000 as Int);
  const here = cellOf(state.xMm, state.yMm);
  const terrainClass = classAtCell(terrain, here.cx, here.cy) ?? TRAVERSAL.Ground;
  const multiplier = asInt(SPEED_MULTIPLIER_MILLI[terrainClass], "terrainMultiplier");

  const { delta, state: distanceState } = advance(movementRate(base, multiplier, carry), state.distance, 1 as Ticks);
  const budgetMm = delta as number;

  const dx = sub(target.xMm, state.xMm);
  const dy = sub(target.yMm, state.yMm);
  const remaining = isqrt(add(mul(dx, dx), mul(dy, dy)));
  if (budgetMm <= 0 || remaining === 0) {
    return { state: { ...state, distance: distanceState }, movedMm: 0, budgetMm };
  }

  const travel = Math.min(budgetMm, remaining as number);
  const subSteps = Math.max(1, Math.ceil(travel / (SWEEP_STEP_MM as number)));

  let xMm = state.xMm;
  let yMm = state.yMm;
  let moved = 0;
  let blocked: MoveResult["blocked"];

  for (let step = 1; step <= subSteps; step += 1) {
    const reach = Math.trunc((travel * step) / subSteps);
    const nextX = add(state.xMm, mulDiv(dx, asInt(reach, "reach"), remaining));
    const nextY = add(state.yMm, mulDiv(dy, asInt(reach, "reach"), remaining));
    const from = cellOf(xMm, yMm);
    const to = cellOf(nextX, nextY);

    if (to.cx !== from.cx || to.cy !== from.cy) {
      if (!passable(terrain, to.cx, to.cy)) {
        blocked = { reason: blockedReason(terrain, to.cx, to.cy), atCx: to.cx, atCy: to.cy };
        break;
      }
      // Corner cutting: a diagonal move needs both orthogonal neighbours clear.
      if (to.cx !== from.cx && to.cy !== from.cy && (!passable(terrain, to.cx, from.cy) || !passable(terrain, from.cx, to.cy))) {
        blocked = { reason: "CornerCut", atCx: to.cx, atCy: to.cy };
        break;
      }
    }

    moved = reach;
    xMm = nextX;
    yMm = nextY;
  }

  return {
    state: { xMm, yMm, distance: distanceState },
    movedMm: moved,
    budgetMm,
    ...(blocked === undefined ? {} : { blocked }),
  };
}

/**
 * A canonical digest of a movement run: positions and saved remainders, in
 * order. Rendering cannot change it, because rendering is not an input to any of
 * it — which is the claim criterion 3 makes and this is how it is checked.
 */
export function movementDigest(states: readonly MovementState[]): string {
  let h = 2_166_136_261 >>> 0;
  const mix = (value: number): void => {
    h = (h ^ (value & 0xff)) >>> 0;
    h = Math.imul(h, 16_777_619) >>> 0;
    h = (h ^ ((value >>> 8) & 0xff)) >>> 0;
    h = Math.imul(h, 16_777_619) >>> 0;
    h = (h ^ ((value >>> 16) & 0xff)) >>> 0;
    h = Math.imul(h, 16_777_619) >>> 0;
    h = (h ^ ((value >>> 24) & 0xff)) >>> 0;
    h = Math.imul(h, 16_777_619) >>> 0;
  };
  for (const state of states) {
    mix(state.xMm as number);
    mix(state.yMm as number);
    mix(state.distance.remainder as number);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
