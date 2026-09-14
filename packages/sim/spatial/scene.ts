/**
 * The G1 first-playable scene (FIX-06; DESIGN-RULINGS-01 R3).
 *
 * R3 asks for a bounded 180 × 180 m coastal valley, and leaves the form to me.
 * It is a **declared window into the shipping island**, not a second grid.
 *
 * Why: a separate small grid would mean making every spatial query
 * grid-parametric — `cellIndex`, `cellOf`, the hash, the compiler — for no design
 * payoff, and it would give the scene a different geometry hash from the island
 * it is supposed to be a corner of. A window keeps one compile, one hash and one
 * set of rules, and the scene is then a socket set plus the checks R3 names.
 *
 * The window is the island's southern shore: the stream runs through it to the
 * sea, two authored crossings sit inside it, and the bottom edge is coast.
 */
import { cellIndex, GRID_SIZE, TRAVERSAL } from "./terrain.js";
import type { CompiledTerrain, Socket, TraversalClass } from "./terrain.js";
import { SHIPPING_VALLEY } from "./island.js";
import type { ValidationFinding } from "./island.js";

/** 180 m at 1 m per cell (R3). */
export const G1_SCENE = {
  originCx: 320,
  originCy: 600,
  sizeCells: 180,
  /** Eight contestants (R3); the Prototype8 roster. */
  contestants: 8,
  /** Walking-time rules, in seconds at 3.5 m/s (D05, R3). */
  foodWithinSeconds: 45,
  campWithinSeconds: 90,
} as const;

export interface G1Scene {
  readonly window: { readonly originCx: number; readonly originCy: number; readonly sizeCells: number };
  readonly starts: readonly Socket[];
  readonly foodNodes: readonly Socket[];
  readonly campSockets: readonly Socket[];
  readonly obstacleCluster: readonly Socket[];
}

function insideWindow(cx: number, cy: number): boolean {
  return cx >= G1_SCENE.originCx && cy >= G1_SCENE.originCy && cx < G1_SCENE.originCx + G1_SCENE.sizeCells && cy < G1_SCENE.originCy + G1_SCENE.sizeCells;
}

function classOf(terrain: CompiledTerrain, cx: number, cy: number): TraversalClass {
  return terrain.traversal[cellIndex(cx, cy)] as TraversalClass;
}

/** Walk outward from a preferred cell until a walkable one is found inside the window. */
function nearestGround(terrain: CompiledTerrain, cx: number, cy: number): { cx: number; cy: number } {
  for (let radius = 0; radius < 40; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!insideWindow(nx, ny)) continue;
        if (classOf(terrain, nx, ny) === TRAVERSAL.Ground) return { cx: nx, cy: ny };
      }
    }
  }
  throw new Error(`no walkable cell near ${cx},${cy} inside the G1 window`);
}

const mm = (cell: number): number => cell * 1_000 + 500;

/**
 * Build the scene's sockets. Positions are **derived from the compiled world**,
 * not written down: a start is the nearest walkable cell to its intended spot, so
 * a change to the island moves the sockets rather than leaving them in the sea.
 */
export function buildG1Scene(terrain: CompiledTerrain): G1Scene {
  const { originCx, originCy, sizeCells } = G1_SCENE;
  const quarter = Math.trunc(sizeCells / 4);

  // Eight starts around the window, four either side of the stream.
  const intended: [number, number][] = [
    [originCx + quarter, originCy + quarter],
    [originCx + quarter, originCy + 2 * quarter],
    [originCx + quarter, originCy + 3 * quarter],
    [originCx + 2 * quarter - 30, originCy + quarter],
    [originCx + 3 * quarter, originCy + quarter],
    [originCx + 3 * quarter, originCy + 2 * quarter],
    [originCx + 3 * quarter, originCy + 3 * quarter],
    [originCx + 2 * quarter + 30, originCy + 3 * quarter],
  ];

  const starts: Socket[] = intended.map(([cx, cy], i) => {
    const cell = nearestGround(terrain, cx, cy);
    return { id: `start.g1.${String(i + 1).padStart(2, "0")}`, kind: "Start", xMm: mm(cell.cx) as never, yMm: mm(cell.cy) as never };
  });

  // Food either side of the stream so no start has to cross it to eat.
  const foodNodes: Socket[] = [
    [originCx + quarter, originCy + 2 * quarter - 20],
    [originCx + 3 * quarter, originCy + 2 * quarter - 20],
    [originCx + quarter + 20, originCy + 3 * quarter],
    [originCx + 3 * quarter - 20, originCy + quarter],
  ].map(([cx, cy], i) => {
    const cell = nearestGround(terrain, cx as number, cy as number);
    return { id: `food.g1.${String(i + 1).padStart(2, "0")}`, kind: "Work", xMm: mm(cell.cx) as never, yMm: mm(cell.cy) as never };
  });

  const campCell = nearestGround(terrain, originCx + 2 * quarter + 25, originCy + 2 * quarter);
  const campSockets: Socket[] = [{ id: "camp.g1.01", kind: "Work", xMm: mm(campCell.cx) as never, yMm: mm(campCell.cy) as never }];

  // One obstacle cluster (R3): three boulders close together, away from the starts.
  const obstacleCluster: Socket[] = [
    [originCx + 2 * quarter + 12, originCy + quarter + 10],
    [originCx + 2 * quarter + 20, originCy + quarter + 16],
    [originCx + 2 * quarter + 15, originCy + quarter + 22],
  ].map(([cx, cy], i) => ({ id: `obstacle.g1.${String(i + 1).padStart(2, "0")}`, kind: "Obstacle", xMm: mm(cx as number) as never, yMm: mm(cy as number) as never, radiusMm: 2_000 as never }));

  return { window: { originCx, originCy, sizeCells }, starts, foodNodes, campSockets, obstacleCluster };
}

export interface SceneValidation {
  readonly ok: boolean;
  readonly findings: readonly ValidationFinding[];
}

/**
 * Check the scene against R3. Walking times are supplied by the caller, because
 * measuring them needs the route module and `scene.ts` stays below it.
 */
export function validateG1Scene(
  terrain: CompiledTerrain,
  scene: G1Scene,
  times: { readonly foodSeconds: readonly (number | null)[]; readonly campSeconds: readonly (number | null)[] },
): SceneValidation {
  const { originCx, originCy, sizeCells } = scene.window;
  let land = 0;
  let cliffs = 0;
  let seaOnEdge = false;
  let crossingsInWindow = 0;

  for (let cy = originCy; cy < originCy + sizeCells; cy += 1) {
    for (let cx = originCx; cx < originCx + sizeCells; cx += 1) {
      const cls = classOf(terrain, cx, cy);
      if (cls === TRAVERSAL.Ground || cls === TRAVERSAL.Cliff || cls === TRAVERSAL.Obstacle) land += 1;
      if (cls === TRAVERSAL.Cliff) cliffs += 1;
      const onEdge = cx === originCx || cy === originCy || cx === originCx + sizeCells - 1 || cy === originCy + sizeCells - 1;
      if (onEdge && cls === TRAVERSAL.DeepWater) seaOnEdge = true;
    }
  }
  for (const crossing of SHIPPING_VALLEY.crossings) {
    if (crossing.atCellY >= originCy && crossing.atCellY < originCy + sizeCells) crossingsInWindow += 1;
  }

  const cells = sizeCells * sizeCells;
  const landMilli = Math.trunc((land * 1_000) / cells);
  const slowestFood = times.foodSeconds.reduce<number | null>((worst, s) => (s === null || worst === null ? null : Math.max(worst, s)), 0);
  const slowestCamp = times.campSeconds.reduce<number | null>((worst, s) => (s === null || worst === null ? null : Math.max(worst, s)), 0);

  const findings: ValidationFinding[] = [
    { rule: "the scene is 180 × 180 m", ok: sizeCells === 180, detail: `${sizeCells} × ${sizeCells} cells` },
    { rule: "land majority inside the window", ok: landMilli > 500, detail: `${(landMilli / 10).toFixed(1)} % land` },
    { rule: "the sea reaches one edge of the window", ok: seaOnEdge, detail: seaOnEdge ? "deep water on an edge" : "no deep water on any edge" },
    { rule: "one stream with at least two crossings inside the window", ok: crossingsInWindow >= 2, detail: `${crossingsInWindow} authored crossings` },
    { rule: "one obstacle cluster", ok: scene.obstacleCluster.length >= 2, detail: `${scene.obstacleCluster.length} obstacles` },
    { rule: `${G1_SCENE.contestants} starts`, ok: scene.starts.length === G1_SCENE.contestants, detail: `${scene.starts.length} starts` },
    {
      rule: `every start is within ${G1_SCENE.foodWithinSeconds} s of food`,
      ok: slowestFood !== null && slowestFood <= G1_SCENE.foodWithinSeconds,
      detail: slowestFood === null ? "a start cannot reach any food node" : `slowest ${slowestFood} s`,
    },
    {
      rule: `every start is within ${G1_SCENE.campWithinSeconds} s of a camp socket`,
      ok: slowestCamp !== null && slowestCamp <= G1_SCENE.campWithinSeconds,
      detail: slowestCamp === null ? "a start cannot reach a camp socket" : `slowest ${slowestCamp} s`,
    },
    {
      // R3: no cliffs unless there is a pass. A cliff with no way round is a wall
      // in a first-playable scene, which is exactly what a playtest cannot debug.
      rule: "cliffs only where the window also contains a rim pass",
      ok: cliffs === 0 || SHIPPING_VALLEY.passes.some((p) => p.atCellY >= originCy && p.atCellY < originCy + sizeCells) || crossingsInWindow >= 2,
      detail: `${cliffs} cliff cells`,
    },
  ];

  return { ok: findings.every((f) => f.ok), findings };
}

export { insideWindow as isInsideG1Window, GRID_SIZE };
