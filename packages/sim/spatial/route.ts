/**
 * Knowledge-limited route segments (P1-04; TP v1.1 §5, AI 05, ROUTE-PROGRESS).
 *
 * A route is searched over what an actor **knows**, never over the world. The
 * search takes a `RouteKnowledge` — a per-actor overlay of observed cells — and
 * the compiled terrain is only ever read through it. That is what makes
 * criterion 1 structural: changing a cell the actor has not observed cannot
 * change the route, because the search never reads that cell.
 *
 * Searches are atomic and bounded. A search either returns a whole route, or a
 * **certified** partial to a portal the actor has actually observed, or says it
 * ran out of budget, or says it knows no route — four outcomes that stay
 * distinct, because collapsing "I ran out of time" into "there is no way" is how
 * an actor ends up standing still for reasons no one can explain.
 */
import { add, asInt, isqrt, mulDiv } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";
import { CELL_MM, cellIndex, cellOf, GRID_SIZE, SPEED_MULTIPLIER_MILLI, TRAVERSAL } from "./terrain.js";
import type { CompiledTerrain, TraversalClass } from "./terrain.js";

export const UNKNOWN = 255;
/** Node expansions a single search may spend. TUNE — no playtest has looked at it. */
export const DEFAULT_ROUTE_BUDGET = 4_000;
/** How many times the same portal may be returned before recovery kicks in. */
export const PORTAL_REPEAT_LIMIT = 2;

export type RouteStatus = "Complete" | "Partial" | "BudgetExhausted" | "NoKnownRoute";

export interface RouteCell {
  readonly cx: number;
  readonly cy: number;
}

export interface RouteResult {
  readonly status: RouteStatus;
  /** Cells from the start to wherever this result reaches. Empty for the two failure statuses. */
  readonly path: readonly RouteCell[];
  readonly expanded: number;
  readonly budget: number;
  /** Present on Partial: the observed boundary cell this segment is certified to reach. */
  readonly portal?: RouteCell & { readonly regionFrom: number; readonly regionTo: number };
  /** Present on Partial and the failures: why this is not a whole route. */
  readonly detail?: string;
  /** Present when a repeated partial triggered recovery instead of another identical segment. */
  readonly recovery?: { readonly kind: "PortalAbandoned" | "GaveUp"; readonly portal: RouteCell; readonly attempts: number };
}

/**
 * An actor's knowledge of the terrain: one byte per cell, `UNKNOWN` where the
 * actor has observed nothing. It holds beliefs, not truth — a cell the actor saw
 * before a landslide still reads as it did when it was seen.
 */
export class RouteKnowledge {
  readonly #classes: Uint8Array;
  #knownCount = 0;

  private constructor(classes: Uint8Array) {
    this.#classes = classes;
  }

  static empty(): RouteKnowledge {
    return new RouteKnowledge(new Uint8Array(GRID_SIZE * GRID_SIZE).fill(UNKNOWN));
  }

  get knownCells(): number {
    return this.#knownCount;
  }

  knows(cx: number, cy: number): boolean {
    return this.#classes[cellIndex(cx, cy)] !== UNKNOWN;
  }

  classAt(cx: number, cy: number): TraversalClass | undefined {
    const value = this.#classes[cellIndex(cx, cy)] as number;
    return value === UNKNOWN ? undefined : (value as TraversalClass);
  }

  /**
   * Record what the actor observed. This is the **only** way terrain enters
   * knowledge: nothing in the search reads the compiled terrain directly, so an
   * unobserved change cannot reach a route.
   */
  observe(terrain: CompiledTerrain, cx: number, cy: number): void {
    if (cx < 0 || cy < 0 || cx >= GRID_SIZE || cy >= GRID_SIZE) return;
    const i = cellIndex(cx, cy);
    if (this.#classes[i] === UNKNOWN) this.#knownCount += 1;
    this.#classes[i] = terrain.traversal[i] as number;
  }

  /** Observe a square neighbourhood — a stand-in for a perception sweep, not a sight model. */
  observeArea(terrain: CompiledTerrain, centre: RouteCell, radiusCells: number): void {
    for (let dy = -radiusCells; dy <= radiusCells; dy += 1) {
      for (let dx = -radiusCells; dx <= radiusCells; dx += 1) this.observe(terrain, centre.cx + dx, centre.cy + dy);
    }
  }

  /** A belief the actor holds that is not what the world says — reports, or stale observations. */
  believe(cx: number, cy: number, traversalClass: TraversalClass): void {
    const i = cellIndex(cx, cy);
    if (this.#classes[i] === UNKNOWN) this.#knownCount += 1;
    this.#classes[i] = traversalClass;
  }
}

interface SearchOptions {
  readonly budget?: number;
  /** Region IDs from the compiled terrain, used for the coarse layer. */
  readonly regions?: Uint8Array;
}

function stepCostMilli(traversalClass: TraversalClass): number {
  const multiplier = SPEED_MULTIPLIER_MILLI[traversalClass];
  // Impassable cells are never expanded, so a zero multiplier cannot divide here.
  return multiplier === 0 ? 0 : Math.trunc(1_000_000 / multiplier);
}

function heuristicMilli(from: RouteCell, to: RouteCell): number {
  const dx = from.cx - to.cx;
  const dy = from.cy - to.cy;
  return isqrt(asInt(dx * dx + dy * dy, "h")) * 1000;
}

/**
 * Search a route from `start` to `goal` over known cells only.
 *
 * Hierarchical in the sense TP §5 asks for: the coarse layer is the compiled
 * region ID, and a search that cannot reach the goal certifies progress to a
 * **portal** — an observed cell on the boundary of the region the goal lies in
 * the direction of. A portal the actor has not observed is not a portal.
 */
export function findRoute(
  terrain: CompiledTerrain,
  knowledge: RouteKnowledge,
  startMm: { readonly xMm: Int; readonly yMm: Int },
  goalMm: { readonly xMm: Int; readonly yMm: Int },
  options: SearchOptions = {},
): RouteResult {
  const budget = options.budget ?? DEFAULT_ROUTE_BUDGET;
  const regions = options.regions ?? terrain.region;
  const start = cellOf(startMm.xMm, startMm.yMm);
  const goal = cellOf(goalMm.xMm, goalMm.yMm);

  if (!knowledge.knows(start.cx, start.cy)) {
    return { status: "NoKnownRoute", path: [], expanded: 0, budget, detail: "the actor does not know the cell it is standing on" };
  }

  const startIndex = cellIndex(start.cx, start.cy);
  const goalIndex = cellIndex(goal.cx, goal.cy);
  const goalRegion = regions[goalIndex] as number;

  const gScore = new Map<number, number>([[startIndex, 0]]);
  const cameFrom = new Map<number, number>();
  const open: { index: number; f: number }[] = [{ index: startIndex, f: heuristicMilli(start, goal) }];
  const closed = new Set<number>();
  let expanded = 0;
  /** The best observed boundary cell seen so far, by closeness to the goal. */
  let bestPortal: { index: number; distance: number } | undefined;

  const cellFor = (index: number): RouteCell => ({ cx: index % GRID_SIZE, cy: Math.floor(index / GRID_SIZE) });
  const rebuild = (index: number): RouteCell[] => {
    const out: RouteCell[] = [];
    let cursor: number | undefined = index;
    while (cursor !== undefined) {
      out.push(cellFor(cursor));
      cursor = cameFrom.get(cursor);
    }
    return out.reverse();
  };

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift() as { index: number; f: number };
    if (closed.has(current.index)) continue;
    closed.add(current.index);

    if (current.index === goalIndex) {
      return { status: "Complete", path: rebuild(current.index), expanded, budget };
    }

    expanded += 1;
    if (expanded > budget) break;

    const here = cellFor(current.index);
    // A cell on the boundary of another region, known, is a candidate portal.
    for (const [ox, oy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = here.cx + ox;
      const ny = here.cy + oy;
      if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
      if (!knowledge.knows(nx, ny)) continue;
      const neighbourClass = knowledge.classAt(nx, ny) as TraversalClass;
      if (SPEED_MULTIPLIER_MILLI[neighbourClass] === 0) continue;

      const neighbourIndex = cellIndex(nx, ny);
      const tentative = (gScore.get(current.index) as number) + stepCostMilli(neighbourClass);
      if (tentative >= (gScore.get(neighbourIndex) ?? Number.MAX_SAFE_INTEGER)) continue;

      gScore.set(neighbourIndex, tentative);
      cameFrom.set(neighbourIndex, current.index);
      open.push({ index: neighbourIndex, f: tentative + heuristicMilli({ cx: nx, cy: ny }, goal) });

      if ((regions[neighbourIndex] as number) !== (regions[current.index] as number)) {
        const distance = heuristicMilli({ cx: nx, cy: ny }, goal);
        if (bestPortal === undefined || distance < bestPortal.distance) bestPortal = { index: neighbourIndex, distance };
      }
    }
  }

  const exhausted = expanded > budget;
  if (bestPortal !== undefined) {
    const portalCell = cellFor(bestPortal.index);
    return {
      status: "Partial",
      path: rebuild(bestPortal.index),
      expanded,
      budget,
      portal: { ...portalCell, regionFrom: regions[startIndex] as number, regionTo: regions[bestPortal.index] as number },
      detail: exhausted
        ? `budget spent before reaching the goal; certified as far as an observed portal in region ${regions[bestPortal.index] as number}`
        : `no known route to the goal region ${goalRegion}; certified as far as an observed portal in region ${regions[bestPortal.index] as number}`,
    };
  }

  if (exhausted) {
    return { status: "BudgetExhausted", path: [], expanded, budget, detail: `expanded ${expanded} of ${budget} nodes without reaching the goal or an observed portal` };
  }
  return { status: "NoKnownRoute", path: [], expanded, budget, detail: "every known cell was explored and none reaches the goal" };
}

/**
 * Repeated partial requests. Each call advances from where the last segment
 * ended; if the same portal comes back more often than `PORTAL_REPEAT_LIMIT`,
 * the tracker abandons that portal (bounded recovery) rather than returning the
 * same segment forever — the failure mode ROUTE-PROGRESS exists to catch.
 */
export class RouteProgress {
  readonly #attempts = new Map<number, number>();
  readonly #abandoned = new Set<number>();

  get abandonedPortals(): number {
    return this.#abandoned.size;
  }

  next(
    terrain: CompiledTerrain,
    knowledge: RouteKnowledge,
    fromMm: { readonly xMm: Int; readonly yMm: Int },
    goalMm: { readonly xMm: Int; readonly yMm: Int },
    options: SearchOptions = {},
  ): RouteResult {
    const result = findRoute(terrain, knowledge, fromMm, goalMm, options);
    if (result.status !== "Partial" || result.portal === undefined) return result;

    const index = cellIndex(result.portal.cx, result.portal.cy);
    if (this.#abandoned.has(index)) {
      return {
        ...result,
        status: "NoKnownRoute",
        path: [],
        detail: "the only certified portal was already abandoned after repeated attempts made no progress",
        recovery: { kind: "GaveUp", portal: { cx: result.portal.cx, cy: result.portal.cy }, attempts: this.#attempts.get(index) ?? 0 },
      };
    }

    const attempts = (this.#attempts.get(index) ?? 0) + 1;
    this.#attempts.set(index, attempts);
    if (attempts > PORTAL_REPEAT_LIMIT) {
      this.#abandoned.add(index);
      return {
        ...result,
        detail: `the same portal was certified ${attempts} times without progress; abandoning it`,
        recovery: { kind: "PortalAbandoned", portal: { cx: result.portal.cx, cy: result.portal.cy }, attempts },
      };
    }
    return result;
  }
}

/** Metres per tick an actor covers on a cell, for a caller pacing movement along a route. */
export function stepDurationTicks(traversalClass: TraversalClass, walkMmPerSecond: Int, tickHz: Int): Int {
  const multiplier = SPEED_MULTIPLIER_MILLI[traversalClass];
  if (multiplier === 0) return 0 as Int;
  const mmPerTick = mulDiv(mulDiv(walkMmPerSecond, asInt(multiplier, "multiplier"), 1000 as Int), 1 as Int, tickHz);
  return mmPerTick <= 0 ? (0 as Int) : (add(asInt(Math.trunc(CELL_MM / mmPerTick), "ticks"), 1 as Int) as Int);
}

export { TRAVERSAL };
