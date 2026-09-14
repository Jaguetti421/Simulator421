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
import { add, asInt, clamp, divCeil, divFloor, fnv1a32, hashBytes, HashDomain, isqrt, modFloor, mul, mulDiv, RandomStream, sub } from "../primitives/index.js";
import { coastRadiusCells, ISLAND, isCrossing, isDeepPool, isLagoon, isPass, SHIPPING_VALLEY, validateIsland } from "./island.js";
import type { IslandValidation } from "./island.js";
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
  /**
   * `valley` is the shipping island (DESIGN-RULINGS-01 R2). `trough` is the
   * former `valley` — a north–south flooded trough kept as a **test** template
   * because it instances every traversal class; it is not an island and is not
   * shipped. `basin` and `ridge` are the other authored macro layouts.
   */
  readonly template: "valley" | "trough" | "basin" | "ridge";
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
  /** Is this template an island the game ships, or a test landform? (R1, R2) */
  readonly shipping: boolean;
  /** R1 validation, measured from the compiled cells. `null` for test templates. */
  readonly island: IslandValidation | null;
  /** The single hash both the simulation and the render export must agree on. */
  readonly geometryHash: string;
}

export interface CompiledTerrain {
  readonly recipe: TerrainRecipe;
  readonly heightMm: Int32Array;
  readonly traversal: Uint8Array;
  /**
   * **Spatial tiles, not named places** (DESIGN-RULINGS-01 R9).
   *
   * Each cell carries the ID of the 128 × 128-cell tile it sits in. These are a
   * partition for the route graph's coarse layer and nothing else: a tile has no
   * name, no content, no ownership and no meaning to an actor, and two cells
   * sharing one is not evidence that they belong to the same place. Named
   * regions — a valley, a camp's surroundings, a clan's territory — are content,
   * and will arrive as their own records rather than by reinterpreting this
   * array.
   */
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
  const axis = (mm: Int): number => (clamp(divFloor(mm, CELL_MM), 0 as Int, (GRID_SIZE - 1) as Int) as number) | 0;
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
  return (modFloor(h, asInt(2 * amplitudeMm + 1, "noiseRange")) as number) - amplitudeMm;
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

/**
 * The authored macro shape, before seeded variation.
 *
 * `trough`, `basin` and `ridge` are full-envelope landforms. `valley` is the
 * shipping island: its macro shape is applied **inside** the island mask, so the
 * coast and the sea come from `islandHeightMm` and the valley only sculpts the
 * land interior (DESIGN-RULINGS-01 R1, R2).
 */
function templateHeightMm(template: TerrainRecipe["template"], cx: number, cy: number): number {
  const half = GRID_SIZE / 2;
  const dx = cx - half;
  const dy = cy - half;
  const radial = Math.trunc((dx * dx + dy * dy) / 40);
  if (template === "basin") return -2_000 + radial;
  if (template === "ridge") return 3_000 - Math.trunc(Math.abs(dx) * 8);
  if (template === "trough") {
    // The former `valley`: a flooded trough with an authored escarpment at each
    // rim. Kept because it is the only template that instances every traversal
    // class, which is a test property, not a design one (R2).
    const fromAxis = Math.abs(dx);
    const escarpment = fromAxis > 250 ? 2_600 : 0;
    return Math.trunc(fromAxis * 9) - 1_500 + escarpment;
  }
  // `valley` handled by valleyInteriorMm inside the island mask.
  return 0;
}

/** Integer pseudo-angle in [0, 1024), monotonic in the true angle. */
function pseudoAngle1024(dx: number, dy: number): number {
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  const sum = adx + ady;
  if (sum === 0) return 0;
  const p = Math.trunc((ady * 256) / sum);
  if (dx >= 0 && dy >= 0) return p;
  if (dx < 0 && dy >= 0) return 512 - p;
  if (dx < 0) return 512 + p;
  return (1024 - p) % 1024;
}

/**
 * The shipping island's surface (R1): sea at the edge, a shallow coastal band at
 * the waterline, land inside. Returns the base height before the macro shape and
 * noise are added on land.
 */
function islandHeightMm(seed: Int, cx: number, cy: number): { readonly baseMm: number; readonly onLand: boolean; readonly distanceInsideCells: number } {
  const half = GRID_SIZE / 2;
  const dx = cx - half;
  const dy = cy - half;
  const distance = isqrt(asInt(dx * dx + dy * dy, "islandDistance"));
  // 1024 samples around the island. The index is an integer **pseudo-angle** —
  // monotonic in the real angle, computed with division rather than `atan2` —
  // because terrain is consequential and the float ban applies to it. A
  // coastline indexed by pseudo-angle is no less varied; it is only unevenly
  // sampled, which noise does not care about.
  const angleIndex = pseudoAngle1024(dx, dy);
  const coast = coastRadiusCells(seed, angleIndex);
  const inside = coast - (distance as number);

  if (inside <= -ISLAND.coastBandCells) {
    // Open sea: deepens toward the envelope edge so the edge is unambiguously deep.
    const beyond = -inside - ISLAND.coastBandCells;
    return { baseMm: Math.max(ISLAND.seaFloorMm, -1_400 - beyond * 40), onLand: false, distanceInsideCells: inside };
  }
  if (inside <= 0) {
    // Shallow coastal band: between the deep line and the waterline.
    const t = (inside + ISLAND.coastBandCells) / ISLAND.coastBandCells; // 0 at deep edge, 1 at shore
    return { baseMm: Math.trunc(-1_180 + t * 1_100), onLand: false, distanceInsideCells: inside };
  }
  // Land: rises from the shore toward the interior.
  const rise = Math.min(ISLAND.interiorRiseMm, Math.trunc((inside * ISLAND.interiorRiseMm) / 180));
  return { baseMm: 200 + rise, onLand: true, distanceInsideCells: inside };
}

/**
 * The shipping valley, sculpted into the island's land (R2): a floor 190 cells
 * wide running north–south, a stream down its length with authored shallow
 * crossings, and rim escarpments with passes.
 */
function valleyInteriorMm(baseMm: number, cx: number, cy: number): number {
  const half = GRID_SIZE / 2;
  const fromAxis = Math.abs(cx - half);
  const halfFloor = SHIPPING_VALLEY.floorWidthCells / 2;

  if (fromAxis <= SHIPPING_VALLEY.streamWidthCells / 2) {
    // The stream. Authored crossings are firm and shallow; elsewhere the channel
    // alternates shallow reaches with short deep pools, none longer than R2's
    // 40-cell cap, so the stream is an obstacle with character rather than a
    // wall or a formality.
    if (isCrossing(cy)) return -260;
    return isDeepPool(cy) ? -1_600 : -700;
  }
  if (fromAxis <= halfFloor) {
    // Valley floor: gently rising away from the stream.
    return Math.trunc(300 + (fromAxis - SHIPPING_VALLEY.streamWidthCells) * 6);
  }
  // Rim: the floor climbs, with an escarpment landmark except at the passes.
  const up = Math.trunc((fromAxis - halfFloor) * 26);
  const escarpment = isPass(cy) ? 0 : SHIPPING_VALLEY.escarpmentRiseMm;
  return Math.min(baseMm + up + escarpment, baseMm + 6_000);
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
      if (recipe.template === "valley") {
        const island = islandHeightMm(recipe.seed, cx, cy);
        if (!island.onLand) {
          // Sea and coast take the island's own height, with only gentle noise so
          // the waterline stays where the mask put it.
          heightMm[i] = island.baseMm + valueNoiseMm(recipe.seed, cx, cy, 64, 160);
        } else if (isLagoon(cx, cy)) {
          // The lagoon: land height replaced by a wadeable shallow, with a firm
          // rim so it reads as a bay rather than a hole in the island.
          heightMm[i] = -420 + valueNoiseMm(recipe.seed, cx, cy, 32, 220);
        } else {
          const shaped = valleyInteriorMm(island.baseMm, cx, cy);
          const noise = valueNoiseMm(recipe.seed, cx, cy, 64, 700) + valueNoiseMm(add(recipe.seed, 7919 as Int), cx, cy, 8, 160);
          // Near the shore, blend toward the island profile so the valley never
          // cuts a cliff into the coastline.
          const blend = Math.min(1_000, island.distanceInsideCells * 40);
          const blended = Math.trunc((shaped * blend + island.baseMm * (1_000 - blend)) / 1_000) + noise;
          // A crossing is authored to be *shallow* (R2), so it is clamped below
          // the waterline. Without this, height noise lifted the crossing at
          // y=640 into dry ground — walkable, but not the wadeable ford the
          // ruling asks for, and the kind of difference that only shows up on
          // one seed.
          const isStreamCell = Math.abs(cx - GRID_SIZE / 2) <= SHIPPING_VALLEY.streamWidthCells / 2;
          heightMm[i] = isStreamCell && isCrossing(cy) ? clamp(asInt(blended, "crossing"), -800 as Int, -80 as Int) : blended;
        }
      } else {
        const base = templateHeightMm(recipe.template, cx, cy);
        const coarse = valueNoiseMm(recipe.seed, cx, cy, 64, 2_400);
        const fineNoise = valueNoiseMm(add(recipe.seed, 7919 as Int), cx, cy, 8, 300);
        heightMm[i] = base + coarse + fineNoise;
      }
      // Tile ID from the cell's 128-cell block. Deliberately arithmetic on the
      // grid, so a tile is a rectangle and nothing more (R9).
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
    const cells = divCeil(radius, CELL_MM) as number;
    const centre = cellOf(socket.xMm, socket.yMm);
    for (let dy = -cells; dy <= cells; dy += 1) {
      for (let dx = -cells; dx <= cells; dx += 1) {
        const nx = centre.cx + dx;
        const ny = centre.cy + dy;
        if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
        const half = divFloor(CELL_MM, 2 as Int);
        const dxMm = sub(add(mul(asInt(nx, "nx"), CELL_MM), half), socket.xMm);
        const dyMm = sub(add(mul(asInt(ny, "ny"), CELL_MM), half), socket.yMm);
        if (add(mul(dxMm, dxMm), mul(dyMm, dyMm)) <= mul(radius, radius)) traversal[cellIndex(nx, ny)] = TRAVERSAL.Obstacle;
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

/**
 * The largest body of deep water that does not touch the envelope edge — the sea
 * is flood-filled from the edge first, so what remains is inland (R1 caps one
 * inland lake at 15,000 cells).
 */
function largestInlandWaterBody(traversal: Uint8Array): number {
  const seen = new Uint8Array(traversal.length);
  const stack: number[] = [];
  for (let cx = 0; cx < GRID_SIZE; cx += 1) {
    for (const cy of [0, GRID_SIZE - 1]) {
      const i = cellIndex(cx, cy);
      if (traversal[i] === TRAVERSAL.DeepWater && seen[i] === 0) {
        seen[i] = 1;
        stack.push(i);
      }
    }
  }
  const flood = (from: number[]): number => {
    let size = 0;
    while (from.length > 0) {
      const i = from.pop() as number;
      size += 1;
      const cx = i % GRID_SIZE;
      const cy = (i - cx) / GRID_SIZE;
      for (const [ox, oy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = cx + ox;
        const ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
        const j = cellIndex(nx, ny);
        if (seen[j] === 0 && traversal[j] === TRAVERSAL.DeepWater) {
          seen[j] = 1;
          from.push(j);
        }
      }
    }
    return size;
  };
  flood(stack); // the sea
  let largest = 0;
  for (let i = 0; i < traversal.length; i += 1) {
    if (traversal[i] !== TRAVERSAL.DeepWater || seen[i] === 1) continue;
    seen[i] = 1;
    largest = Math.max(largest, flood([i]));
  }
  return largest;
}

function buildManifest(
  recipe: TerrainRecipe,
  parts: { heightMm: Int32Array; traversal: Uint8Array; region: Uint8Array; coverMilli: Uint8Array; opennessMilli: Uint8Array; fine: ReadonlyMap<number, Uint8Array> },
): GeometryManifest {
  const classCounts: Record<string, number> = {};
  for (const name of TRAVERSAL_NAMES) classCounts[name] = 0;
  for (const value of parts.traversal) classCounts[TRAVERSAL_NAMES[value] as string] = (classCounts[TRAVERSAL_NAMES[value] as string] as number) + 1;

  const shipping = recipe.template === "valley";
  let largestInlandLake = 0;
  let seaTouchesEdge = false;
  if (shipping) {
    for (let cx = 0; cx < GRID_SIZE; cx += 1) {
      if (parts.traversal[cellIndex(cx, 0)] === TRAVERSAL.DeepWater || parts.traversal[cellIndex(cx, GRID_SIZE - 1)] === TRAVERSAL.DeepWater) seaTouchesEdge = true;
    }
    largestInlandLake = largestInlandWaterBody(parts.traversal);
  }

  return {
    manifestVersion: GEOMETRY_MANIFEST_VERSION,
    shipping,
    island: shipping ? validateIsland(classCounts, CELL_COUNT, { seaTouchesEdge, largestInlandLakeCells: largestInlandLake }) : null,
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
    geometryHash: ((hashArrays(parts) as number) >>> 0).toString(16).padStart(8, "0"),
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
  const fx = Math.min(FINE_PER_SIDE - 1, divFloor(sub(xMm, mul(asInt(cx, "cx"), CELL_MM)), FINE_CELL_MM));
  const fy = Math.min(FINE_PER_SIDE - 1, divFloor(sub(yMm, mul(asInt(cy, "cy"), CELL_MM)), FINE_CELL_MM));
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
