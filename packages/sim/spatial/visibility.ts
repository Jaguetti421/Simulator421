/**
 * Spatial index and line of sight (P1-03; TP v1.1 §5–6).
 *
 * Two things, both of which only ever see **geometry and positions**:
 *
 *   - a broad-phase uniform spatial hash that finds nearby candidates, and
 *   - an exact height-field line-of-sight test over the compiled terrain.
 *
 * Neither takes an actor's knowledge, beliefs or identity. "Static visibility
 * means height, openness and cover, not hidden precomputed actor knowledge"
 * (P1-03 criterion 3) is enforced by the shape of the inputs: this module cannot
 * read a knowledge view because nothing here accepts one, and it stores no
 * per-actor state between calls.
 *
 * Every query is bounded. When the budget runs out the result says so, and a
 * budget-exhausted result is **never** treated as visible — the one default that
 * would quietly hand an AI free information (TP §6: "the authoritative world can
 * reject an illegal interaction without telling the planner who is hiding behind
 * a wall").
 */
import { asInt, isqrt, mulDiv } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";
import { CELL_MM, cellIndex, cellOf, GRID_SIZE, TRAVERSAL } from "./terrain.js";
import type { CompiledTerrain } from "./terrain.js";

// ---------------------------------------------------------------------------
// Broad phase
// ---------------------------------------------------------------------------

/** Bucket edge in millimetres. 16 m keeps a sight-range query to a handful of buckets. */
export const BUCKET_MM = 16_000 as Int;
const BUCKETS_PER_SIDE = Math.ceil((GRID_SIZE * CELL_MM) / BUCKET_MM);

export interface SpatialEntry {
  readonly id: string;
  readonly xMm: Int;
  readonly yMm: Int;
}

/**
 * A uniform hash over the envelope. Rebuilt per tick from authoritative
 * positions; it holds no history, so it cannot become a second source of truth
 * about where things were.
 */
export class SpatialHash {
  readonly #buckets = new Map<number, SpatialEntry[]>();
  #size = 0;

  static bucketOf(xMm: Int, yMm: Int): number {
    const bx = Math.min(BUCKETS_PER_SIDE - 1, Math.max(0, Math.trunc(xMm / BUCKET_MM) | 0));
    const by = Math.min(BUCKETS_PER_SIDE - 1, Math.max(0, Math.trunc(yMm / BUCKET_MM) | 0));
    return by * BUCKETS_PER_SIDE + bx;
  }

  static build(entries: readonly SpatialEntry[]): SpatialHash {
    const hash = new SpatialHash();
    for (const entry of entries) hash.insert(entry);
    return hash;
  }

  insert(entry: SpatialEntry): void {
    const key = SpatialHash.bucketOf(entry.xMm, entry.yMm);
    const bucket = this.#buckets.get(key);
    if (bucket === undefined) this.#buckets.set(key, [entry]);
    else bucket.push(entry);
    this.#size += 1;
  }

  get size(): number {
    return this.#size;
  }

  get bucketCount(): number {
    return this.#buckets.size;
  }

  /**
   * Candidates within a radius — a superset, deliberately. The broad phase is
   * allowed to be generous; the exact query below is what decides.
   * Results are sorted by id so two runs order them identically.
   */
  candidates(xMm: Int, yMm: Int, radiusMm: Int): readonly SpatialEntry[] {
    const reach = Math.ceil(radiusMm / BUCKET_MM);
    const bx = Math.min(BUCKETS_PER_SIDE - 1, Math.max(0, Math.trunc(xMm / BUCKET_MM) | 0));
    const by = Math.min(BUCKETS_PER_SIDE - 1, Math.max(0, Math.trunc(yMm / BUCKET_MM) | 0));
    const found: SpatialEntry[] = [];
    const radiusSquared = radiusMm * radiusMm;
    for (let dy = -reach; dy <= reach; dy += 1) {
      for (let dx = -reach; dx <= reach; dx += 1) {
        const nx = bx + dx;
        const ny = by + dy;
        if (nx < 0 || ny < 0 || nx >= BUCKETS_PER_SIDE || ny >= BUCKETS_PER_SIDE) continue;
        for (const entry of this.#buckets.get(ny * BUCKETS_PER_SIDE + nx) ?? []) {
          const ex = entry.xMm - xMm;
          const ey = entry.yMm - yMm;
          if (ex * ex + ey * ey <= radiusSquared) found.push(entry);
        }
      }
    }
    return found.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
}

// ---------------------------------------------------------------------------
// Line of sight
// ---------------------------------------------------------------------------

/** Eye height above the ground, in millimetres. TUNE — no playtest has looked at it. */
export const EYE_HEIGHT_MM = 1_600 as Int;
/** How much an obstacle cell rises above its ground height for sight purposes. TUNE. */
export const OBSTACLE_HEIGHT_MM = 2_200 as Int;
/** Default step ceiling for one sight query, in cells. */
export const DEFAULT_SIGHT_BUDGET_CELLS = 260;

export type VisibilityStatus = "Visible" | "Blocked" | "OutOfRange" | "BudgetExhausted";

export interface VisibilityResult {
  readonly status: VisibilityStatus;
  /** True only for `Visible`. Kept explicit so no caller infers sight from the absence of a block. */
  readonly visible: boolean;
  readonly distanceMm: number;
  readonly cellsStepped: number;
  /** The cell that blocked the ray, when one did. */
  readonly blockedAt?: { readonly cx: number; readonly cy: number; readonly reason: "Terrain" | "Obstacle" };
  /** Present on BudgetExhausted: what the query would have needed. */
  readonly budget?: { readonly allowedCells: number; readonly neededCells: number };
}

export interface SightOptions {
  readonly rangeMm: Int;
  readonly budgetCells?: number;
  readonly observerEyeMm?: Int;
  readonly targetEyeMm?: Int;
}

function groundHeightAt(terrain: CompiledTerrain, cx: number, cy: number): number {
  return terrain.heightMm[cellIndex(cx, cy)] as number;
}

/** Sight-blocking height of a cell: its ground, plus an obstacle's own rise. */
function occluderHeightAt(terrain: CompiledTerrain, cx: number, cy: number): { height: number; reason: "Terrain" | "Obstacle" } {
  const i = cellIndex(cx, cy);
  const ground = terrain.heightMm[i] as number;
  return terrain.traversal[i] === TRAVERSAL.Obstacle ? { height: ground + OBSTACLE_HEIGHT_MM, reason: "Obstacle" } : { height: ground, reason: "Terrain" };
}

/**
 * Height-field line of sight between two ground positions.
 *
 * Integer DDA across the coarse grid: at each cell the ray's height is
 * interpolated with `mulDiv` and compared against that cell's occluder height.
 * No floating point, so the same pair of positions gives the same answer
 * everywhere.
 */
export function lineOfSight(terrain: CompiledTerrain, fromXMm: Int, fromYMm: Int, toXMm: Int, toYMm: Int, options: SightOptions): VisibilityResult {
  const dx = toXMm - fromXMm;
  const dy = toYMm - fromYMm;
  const distanceSquared = dx * dx + dy * dy;
  // Integer square root: distance is consequential, so it never goes through a float.
  const distanceMm = isqrt(asInt(distanceSquared, "distanceSquared"));

  if (distanceSquared > options.rangeMm * options.rangeMm) {
    return { status: "OutOfRange", visible: false, distanceMm, cellsStepped: 0 };
  }

  // Canonical direction. Tracing from A to B and from B to A would round the
  // interpolation differently and could disagree about a marginal cell — an
  // asymmetry a real build would eventually surface as "he can see me but I
  // cannot see him". Both directions trace the identical cell sequence instead.
  const a = cellOf(fromXMm, fromYMm);
  const b = cellOf(toXMm, toYMm);
  const swap = a.cx > b.cx || (a.cx === b.cx && a.cy > b.cy);
  const from = swap ? b : a;
  const to = swap ? a : b;
  const steps = Math.max(Math.abs(to.cx - from.cx), Math.abs(to.cy - from.cy));
  const budget = options.budgetCells ?? DEFAULT_SIGHT_BUDGET_CELLS;

  if (steps > budget) {
    // Explicitly not visible. A budget is a limit on what we checked, never a
    // claim about what is there.
    return { status: "BudgetExhausted", visible: false, distanceMm, cellsStepped: 0, budget: { allowedCells: budget, neededCells: steps } };
  }
  if (steps === 0) {
    return { status: "Visible", visible: true, distanceMm, cellsStepped: 0 };
  }

  const observerEye = options.observerEyeMm ?? EYE_HEIGHT_MM;
  const targetEye = options.targetEyeMm ?? EYE_HEIGHT_MM;
  const eyeFrom = groundHeightAt(terrain, from.cx, from.cy) + (swap ? targetEye : observerEye);
  const eyeTo = groundHeightAt(terrain, to.cx, to.cy) + (swap ? observerEye : targetEye);

  for (let step = 1; step < steps; step += 1) {
    const cx = from.cx + Math.trunc(((to.cx - from.cx) * step) / steps);
    const cy = from.cy + Math.trunc(((to.cy - from.cy) * step) / steps);
    const rayHeight = eyeFrom + mulDiv(asInt(eyeTo - eyeFrom, "eyeDelta"), asInt(step, "step"), asInt(steps, "steps"));
    const occluder = occluderHeightAt(terrain, cx, cy);
    if (occluder.height > rayHeight) {
      return { status: "Blocked", visible: false, distanceMm, cellsStepped: step, blockedAt: { cx, cy, reason: occluder.reason } };
    }
  }

  return { status: "Visible", visible: true, distanceMm, cellsStepped: steps };
}

/**
 * Static visibility factors at a position: what the compiled terrain says about
 * being seen there. Cover and openness are **terrain** properties — nothing here
 * consults who is nearby or what anyone knows.
 */
export function staticVisibility(terrain: CompiledTerrain, xMm: Int, yMm: Int): {
  readonly coverMilli: number;
  readonly opennessMilli: number;
  readonly heightMm: number;
  readonly inputs: readonly string[];
} {
  const { cx, cy } = cellOf(xMm, yMm);
  const i = cellIndex(cx, cy);
  return {
    coverMilli: terrain.coverMilli[i] as number,
    opennessMilli: terrain.opennessMilli[i] as number,
    heightMm: terrain.heightMm[i] as number,
    // Named so a test can assert the set has not grown to include anything
    // actor-derived.
    inputs: ["terrain.height", "terrain.cover", "terrain.openness"],
  };
}

/**
 * The two-phase query an exact perception check runs: broad phase for
 * candidates, then line of sight per candidate, within one shared budget.
 * Candidates that exhaust the budget come back as `BudgetExhausted` — present in
 * the result and not visible — rather than being silently dropped, which would
 * look identical to "nothing was there".
 */
export function visibleFrom(
  terrain: CompiledTerrain,
  hash: SpatialHash,
  observer: { readonly xMm: Int; readonly yMm: Int },
  options: SightOptions & { readonly totalBudgetCells?: number },
): { readonly seen: readonly SpatialEntry[]; readonly results: ReadonlyMap<string, VisibilityResult>; readonly budgetSpentCells: number } {
  const results = new Map<string, VisibilityResult>();
  const seen: SpatialEntry[] = [];
  let spent = 0;
  const total = options.totalBudgetCells ?? DEFAULT_SIGHT_BUDGET_CELLS * 8;

  for (const candidate of hash.candidates(observer.xMm, observer.yMm, options.rangeMm)) {
    const remaining = total - spent;
    const result = lineOfSight(terrain, observer.xMm, observer.yMm, candidate.xMm, candidate.yMm, {
      ...options,
      budgetCells: Math.max(0, Math.min(options.budgetCells ?? DEFAULT_SIGHT_BUDGET_CELLS, remaining)),
    });
    results.set(candidate.id, result);
    spent += result.cellsStepped;
    if (result.visible) seen.push(candidate);
  }
  return { seen, results, budgetSpentCells: spent };
}
