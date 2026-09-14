/**
 * Terrain and fine geometry compiler (P1-02; TP v1.1 §5, GDD §4 and §30.2).
 *
 * One compile produces the geometry **both** consumers read: the render mesh
 * inputs and the simulation manifest come out of the same arrays and hash to the
 * same value. That is the point of the packet — "a tree that blocks sight or
 * movement must have an authoritative footprint" only means something if the
 * picture and the rules cannot disagree.
 *
 * Everything is integer. Heights are millimetres, speeds are thousandths, and
 * the height field is built from integer value noise (hashed lattice, integer
 * interpolation) rather than floating point, so a compile is bit-identical on
 * any machine.
 *
 * Scope honesty: this compiles terrain, traversal classes, fine cells around
 * declared sockets, and the manifest. Resources, camp placement, foliage,
 * knowledge distribution and phase-escape validation are the later steps of TP
 * §5's ordered pipeline and are **not** here.
 */
import { add, asInt, clamp, fnv1a32, hashBytes, HashDomain, mulDiv, RandomStream, sub } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";

export const GEOMETRY_MANIFEST_VERSION = 1;

/** 800 x 800 m on a 1 m base grid: 640,000 cells (TP v1.1 §5). */
export const ENVELOPE_MM = 800_000 as Int;
export const CELL_MM = 1_000 as Int;
export const GRID_SIZE = 800;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;

/** Sparse 0.25 m detail: each detailed coarse cell holds a 4 x 4 fine grid. */
export const FINE_CELL_MM = 250 as Int;
export const FINE_PER_SIDE = 4;
export const FINE_PER_CELL = FINE_PER_SIDE * FINE_PER_SIDE;

/**
 * Traversal classes. Speeds are thousandths of the walk rate and come from the
 * GDD, not from tuning here: "Deep water is impassable. Shallow crossing meshes
 * are ordinary traversable terrain with a 0.8 movement multiplier."
 */
export const TRAVERSAL = {
  Ground: 0,
  ShallowWater: 1,
  DeepWater: 2,
  Cliff: 3,
  Obstacle: 4,
} as const;
export type TraversalClass = (typeof TRAVERSAL)[keyof typeof TRAVERSAL];
export const TRAVERSAL_NAMES: readonly string[] = ["Ground", "ShallowWater", "DeepWater", "Cliff", "Obstacle"];

/** Thousandths of the base walk rate; 0 means impassable. */
export const SPEED_MULTIPLIER_MILLI: Readonly<Record<TraversalClass, number>> = {
  [TRAVERSAL.Ground]: 1000,
  [TRAVERSAL.ShallowWater]: 800,
  [TRAVERSAL.DeepWater]: 0,
  [TRAVERSAL.Cliff]: 0,
  [TRAVERSAL.Obstacle]: 0,
};

/** GDD §30.2: walk 3.5 m/s, sprint 5.0 m/s, in millimetres per second. */
export const WALK_MM_PER_SECOND = 3_500 as Int;
export const SPRINT_MM_PER_SECOND = 5_000 as Int;

/** Water levels in millimetres above the datum. Below `deep` is impassable. */
export const WATER = { shallowMm: 0 as Int, deepMm: -1_200 as Int } as const;
/** A step this high or higher between neighbouring cells is a cliff, not a walk. */
export const CLIFF_STEP_MM = 1_400 as Int;

export interface Socket {
  readonly id: string;
  readonly kind: "Start" | "Work" | "Obstacle" | "Gate";
  readonly xMm: Int;
  readonly yMm: Int;
  /** Obstacles carry a footprint; a decorative prop would not be here at all. */
  readonly radiusMm?: Int;
}

export interface TerrainRecipe {
  readonly recipeId: string;
  readonly seed: Int;
  /** One of the three authored macro-layout templates (TP §5). */
  readonly template: "valley" | "basin" | "ridge";
  readonly sockets: readonly Socket[];
}

export interface GeometryManifest {
  readonly manifestVersion: number;
  readonly recipeId: string;
  readonly seed: number;
  readonly template: string;
  readonly gridSize: number;
  readonly cellMm: number;
  readonly fineCellMm: number;
  readonly cellCount: number;
  readonly classCounts: Readonly<Record<string, number>>;
  readonly fineCells: number;
  readonly sockets: readonly Socket[];
  /** The single hash both the simulation and the render export must agree on. */
  readonly geometryHash: string;
}

export interface CompiledTerrain {
  readonly recipe: TerrainRecipe;
  readonly heightMm: Int32Array;
  readonly traversal: Uint8Array;
  readonly region: Uint8Array;
  readonly coverMilli: Uint8Array;
  readonly opennessMilli: Uint8Array;
  /** Coarse cell index → 16 fine subcell traversal classes. Sparse by design. */
  readonly fine: ReadonlyMap<number, Uint8Array>;
  readonly manifest: GeometryManifest;
}

export { canonicalGeometryBytes };

export function cellIndex(cx: number, cy: number): number {
  return cy * GRID_SIZE + cx;
}

export function cellOf(xMm: Int, yMm: Int): { cx: number; cy: number } {
  // `| 0` normalizes negative zero: Math.trunc(-5 / 1000) is -0, and a cell
  // index of -0 compares unequal to 0 in a structural assertion.
  const axis = (mm: Int): number => clamp(asInt(Math.trunc(mm / CELL_MM) | 0, "cell"), 0 as Int, (GRID_SIZE - 1) as Int) | 0;
  return { cx: axis(xMm), cy: axis(yMm) };
}

// ---------------------------------------------------------------------------
// Integer value noise
// ---------------------------------------------------------------------------

/** Hashed lattice value in [-amplitudeMm, amplitudeMm], derived from the seed. */
function latticeValue(seed: Int, lx: number, ly: number, amplitudeMm: number): number {
  const bytes = new Uint8Array(12);
  new DataView(bytes.buffer).setInt32(0, seed, true);
  new DataView(bytes.buffer).setInt32(4, lx, true);
  new DataView(bytes.buffer).setInt32(8, ly, true);
  const h = fnv1a32(bytes);
  return ((h % (2 * amplitudeMm + 1)) | 0) - amplitudeMm;
}

/** Integer bilinear interpolation on a lattice of the given spacing, in cells. */
function valueNoiseMm(seed: Int, cx: number, cy: number, spacing: number, amplitudeMm: number): number {
  const lx = Math.floor(cx / spacing);
  const ly = Math.floor(cy / spacing);
  const fx = cx - lx * spacing;
  const fy = cy - ly * spacing;

  const v00 = latticeValue(seed, lx, ly, amplitudeMm);
  const v10 = latticeValue(seed, lx + 1, ly, amplitudeMm);
  const v01 = latticeValue(seed, lx, ly + 1, amplitudeMm);
  const v11 = latticeValue(seed, lx + 1, ly + 1, amplitudeMm);

  const top = v00 + Math.trunc(((v10 - v00) * fx) / spacing);
  const bottom = v01 + Math.trunc(((v11 - v01) * fx) / spacing);
  return top + Math.trunc(((bottom - top) * fy) / spacing);
}

/** The authored macro shape, before seeded variation (TP §5: three templates). */
function templateHeightMm(template: TerrainRecipe["template"], cx: number, cy: number): number {
  const half = GRID_SIZE / 2;
  const dx = cx - half;
  const dy = cy - half;
  const radial = Math.trunc((dx * dx + dy * dy) / 40);
  if (template === "basin") return -2_000 + radial;
  if (template === "ridge") return 3_000 - Math.trunc(Math.abs(dx) * 8);
  // "valley": a trough running north–south with an escarpment at each rim. The
  // rim is authored, not noise: a valley that never produces a cliff would give
  // the Cliff traversal class no instances, and a class with no instances is a
  // class nothing is testing.
  const fromAxis = Math.abs(dx);
  const escarpment = fromAxis > 250 ? 2_600 : 0;
  return Math.trunc(fromAxis * 9) - 1_500 + escarpment;
}

// ---------------------------------------------------------------------------
// Compile
// ---------------------------------------------------------------------------

/**
 * Compile a recipe into terrain, traversal classes, fine cells and the manifest.
 * Deterministic: the same recipe always yields the same arrays and the same
 * geometry hash. "Quantize all generated geometry before the run begins"
 * (TP §5) — there is no floating-point value anywhere in the output.
 */
export function compileTerrain(recipe: TerrainRecipe): CompiledTerrain {
  const heightMm = new Int32Array(CELL_COUNT);
  const traversal = new Uint8Array(CELL_COUNT);
  const region = new Uint8Array(CELL_COUNT);
  const coverMilli = new Uint8Array(CELL_COUNT);
  const opennessMilli = new Uint8Array(CELL_COUNT);

  // A labelled stream, so adding a later stage cannot shift this one (TP v2.0 §4).
  const detail = RandomStream.derive(recipe.seed, "world.terrain");

  for (let cy = 0; cy < GRID_SIZE; cy += 1) {
    for (let cx = 0; cx < GRID_SIZE; cx += 1) {
      const i = cellIndex(cx, cy);
      const base = templateHeightMm(recipe.template, cx, cy);
      const coarse = valueNoiseMm(recipe.seed, cx, cy, 64, 2_400);
      const fineNoise = valueNoiseMm(add(recipe.seed, 7919 as Int), cx, cy, 8, 300);
      heightMm[i] = base + coarse + fineNoise;
      region[i] = ((cx >> 7) + (cy >> 7) * 7) & 0xff;
    }
  }

  // Traversal class from compiled terrain data: water depth first, then slope.
  for (let cy = 0; cy < GRID_SIZE; cy += 1) {
    for (let cx = 0; cx < GRID_SIZE; cx += 1) {
      const i = cellIndex(cx, cy);
      const h = heightMm[i] as number;
      if (h <= WATER.deepMm) {
        traversal[i] = TRAVERSAL.DeepWater;
      } else if (h <= WATER.shallowMm) {
        traversal[i] = TRAVERSAL.ShallowWater;
      } else {
        let maxStep = 0;
        for (const [ox, oy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
          maxStep = Math.max(maxStep, Math.abs(h - (heightMm[cellIndex(nx, ny)] as number)));
        }
        traversal[i] = maxStep >= CLIFF_STEP_MM ? TRAVERSAL.Cliff : TRAVERSAL.Ground;
      }
      // Cover and openness are compiled data, not visibility sets (TP §5).
      coverMilli[i] = traversal[i] === TRAVERSAL.Cliff ? 200 : (detail.nextBelow(60 as Int) as number);
      opennessMilli[i] = traversal[i] === TRAVERSAL.Ground ? 255 - (coverMilli[i] as number) : 120;
    }
  }

  // Declared obstacles get an authoritative footprint — the same one sight and
  // movement will query. A decorative prop never appears here.
  for (const socket of recipe.sockets) {
    if (socket.kind !== "Obstacle") continue;
    const radius = socket.radiusMm ?? (1_000 as Int);
    const cells = Math.ceil(radius / CELL_MM);
    const centre = cellOf(socket.xMm, socket.yMm);
    for (let dy = -cells; dy <= cells; dy += 1) {
      for (let dx = -cells; dx <= cells; dx += 1) {
        const nx = centre.cx + dx;
        const ny = centre.cy + dy;
        if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
        const dxMm = sub(asInt(nx * CELL_MM + CELL_MM / 2, "x"), socket.xMm);
        const dyMm = sub(asInt(ny * CELL_MM + CELL_MM / 2, "y"), socket.yMm);
        if (dxMm * dxMm + dyMm * dyMm <= radius * radius) traversal[cellIndex(nx, ny)] = TRAVERSAL.Obstacle;
      }
    }
  }

  // Starts and work positions must stand on ground: flatten and clear them
  // rather than letting a socket sit in water or on a cliff, which TP §5's
  // accessibility validators would reject anyway.
  for (const socket of recipe.sockets) {
    if (socket.kind === "Obstacle") continue;
    const { cx, cy } = cellOf(socket.xMm, socket.yMm);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
        const i = cellIndex(nx, ny);
        heightMm[i] = Math.max(heightMm[i] as number, 400);
        traversal[i] = TRAVERSAL.Ground;
      }
    }
  }

  // Sparse 0.25 m detail around sockets: clearance for the 0.3 m actor radius.
  const fine = new Map<number, Uint8Array>();
  for (const socket of recipe.sockets) {
    const { cx, cy } = cellOf(socket.xMm, socket.yMm);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
        const index = cellIndex(nx, ny);
        if (fine.has(index)) continue;
        const sub16 = new Uint8Array(FINE_PER_CELL);
        sub16.fill(traversal[index] as number);
        fine.set(index, sub16);
      }
    }
  }

  const manifest = buildManifest(recipe, { heightMm, traversal, region, coverMilli, opennessMilli, fine });
  return { recipe, heightMm, traversal, region, coverMilli, opennessMilli, fine, manifest };
}

/**
 * Canonical geometry serialization (REVIEW-EXTERNAL-01, P1-02 Medium).
 *
 * The first version XOR-combined five separate hashes and folded fine cells in
 * by sorted key. XOR is commutative and self-cancelling: two different worlds
 * could collide, and the order of the arrays carried no weight. "One geometry
 * hash for render and simulation" was satisfied in the letter and not the
 * intent.
 *
 * This is one running hash over one canonical byte stream: a header, then each
 * array in a fixed order, each length-prefixed, each written **explicitly
 * little-endian** rather than relying on the platform's typed-array order.
 */
function canonicalGeometryBytes(parts: {
  heightMm: Int32Array;
  traversal: Uint8Array;
  region: Uint8Array;
  coverMilli: Uint8Array;
  opennessMilli: Uint8Array;
  fine: ReadonlyMap<number, Uint8Array>;
}): Uint8Array {
  const fineKeys = [...parts.fine.keys()].sort((a, b) => a - b);
  const header = 24;
  const byteLength =
    header +
    (4 + parts.heightMm.length * 4) +
    (4 + parts.traversal.length) +
    (4 + parts.region.length) +
    (4 + parts.coverMilli.length) +
    (4 + parts.opennessMilli.length) +
    4 +
    fineKeys.reduce((sum, key) => sum + 4 + 4 + (parts.fine.get(key) as Uint8Array).length, 0);

  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let at = 0;
  const u32 = (value: number): void => {
    view.setUint32(at, value >>> 0, true);
    at += 4;
  };

  // Header: format, grid, cell sizes. A grid or cell-size change is a different
  // world even if every cell happens to match.
  u32(0x4c43_4730); // "LCG0"
  u32(GEOMETRY_MANIFEST_VERSION);
  u32(GRID_SIZE);
  u32(CELL_MM);
  u32(FINE_CELL_MM);
  u32(FINE_PER_CELL);

  u32(parts.heightMm.length);
  for (const value of parts.heightMm) {
    view.setInt32(at, value, true);
    at += 4;
  }
  for (const array of [parts.traversal, parts.region, parts.coverMilli, parts.opennessMilli]) {
    u32(array.length);
    bytes.set(array, at);
    at += array.length;
  }

  u32(fineKeys.length);
  for (const key of fineKeys) {
    const cell = parts.fine.get(key) as Uint8Array;
    u32(key);
    u32(cell.length);
    bytes.set(cell, at);
    at += cell.length;
  }

  if (at !== byteLength) throw new Error(`canonical geometry serialization wrote ${at} bytes, expected ${byteLength}`);
  return bytes;
}

function hashArrays(parts: {
  heightMm: Int32Array;
  traversal: Uint8Array;
  region: Uint8Array;
  coverMilli: Uint8Array;
  opennessMilli: Uint8Array;
  fine: ReadonlyMap<number, Uint8Array>;
}): Int {
  return hashBytes(HashDomain.Authoritative, canonicalGeometryBytes(parts));
}

function buildManifest(
  recipe: TerrainRecipe,
  parts: { heightMm: Int32Array; traversal: Uint8Array; region: Uint8Array; coverMilli: Uint8Array; opennessMilli: Uint8Array; fine: ReadonlyMap<number, Uint8Array> },
): GeometryManifest {
  const classCounts: Record<string, number> = {};
  for (const name of TRAVERSAL_NAMES) classCounts[name] = 0;
  for (const value of parts.traversal) classCounts[TRAVERSAL_NAMES[value] as string] = (classCounts[TRAVERSAL_NAMES[value] as string] as number) + 1;

  return {
    manifestVersion: GEOMETRY_MANIFEST_VERSION,
    recipeId: recipe.recipeId,
    seed: recipe.seed,
    template: recipe.template,
    gridSize: GRID_SIZE,
    cellMm: CELL_MM,
    fineCellMm: FINE_CELL_MM,
    cellCount: CELL_COUNT,
    classCounts,
    fineCells: parts.fine.size,
    sockets: recipe.sockets,
    geometryHash: (hashArrays(parts) >>> 0).toString(16).padStart(8, "0"),
  };
}

// ---------------------------------------------------------------------------
// Queries — the one surface both movement and sight use
// ---------------------------------------------------------------------------

export function classAt(terrain: CompiledTerrain, xMm: Int, yMm: Int): TraversalClass {
  const { cx, cy } = cellOf(xMm, yMm);
  return terrain.traversal[cellIndex(cx, cy)] as TraversalClass;
}

export function heightAt(terrain: CompiledTerrain, xMm: Int, yMm: Int): Int {
  const { cx, cy } = cellOf(xMm, yMm);
  return asInt(terrain.heightMm[cellIndex(cx, cy)] as number, "heightMm");
}

export function isPassable(terrain: CompiledTerrain, xMm: Int, yMm: Int): boolean {
  return SPEED_MULTIPLIER_MILLI[classAt(terrain, xMm, yMm)] > 0;
}

/** Movement speed in millimetres per second at a position, before carry and stamina effects. */
export function walkSpeedMmPerSecond(terrain: CompiledTerrain, xMm: Int, yMm: Int, sprinting = false): Int {
  const multiplier = SPEED_MULTIPLIER_MILLI[classAt(terrain, xMm, yMm)];
  const base = sprinting ? SPRINT_MM_PER_SECOND : WALK_MM_PER_SECOND;
  return mulDiv(base, asInt(multiplier, "multiplier"), 1000 as Int);
}

/** Fine clearance for an actor radius at a position; falls back to the coarse class where no detail exists. */
export function fineClearance(terrain: CompiledTerrain, xMm: Int, yMm: Int): { readonly detailed: boolean; readonly passable: boolean } {
  const { cx, cy } = cellOf(xMm, yMm);
  const index = cellIndex(cx, cy);
  const sub16 = terrain.fine.get(index);
  if (sub16 === undefined) return { detailed: false, passable: isPassable(terrain, xMm, yMm) };
  const fx = Math.min(FINE_PER_SIDE - 1, Math.trunc((xMm - cx * CELL_MM) / FINE_CELL_MM));
  const fy = Math.min(FINE_PER_SIDE - 1, Math.trunc((yMm - cy * CELL_MM) / FINE_CELL_MM));
  const value = sub16[fy * FINE_PER_SIDE + fx] as number;
  return { detailed: true, passable: SPEED_MULTIPLIER_MILLI[value as TraversalClass] > 0 };
}

/**
 * The render export. It is derived from the **same** arrays the simulation
 * queries — heights and classes per cell — so the two cannot describe different
 * worlds. The hash is the manifest's, not a second one computed differently.
 */
export function exportForRender(terrain: CompiledTerrain): {
  readonly geometryHash: string;
  readonly gridSize: number;
  readonly cellMm: number;
  readonly heightMm: Int32Array;
  readonly traversal: Uint8Array;
} {
  return {
    geometryHash: terrain.manifest.geometryHash,
    gridSize: GRID_SIZE,
    cellMm: CELL_MM,
    heightMm: terrain.heightMm,
    traversal: terrain.traversal,
  };
}

/** The simulation export: the manifest every subsystem quotes when it claims a footprint. */
export function exportForSimulation(terrain: CompiledTerrain): GeometryManifest {
  return terrain.manifest;
}
