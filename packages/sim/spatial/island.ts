/**
 * Island shaping and template validation (FIX-04; DESIGN-RULINGS-01 R1–R3).
 *
 * The three compiled templates were not islands. GDD §4 describes an island with
 * a coast; `basin`, `ridge` and the old `valley` were full-envelope landforms
 * with water wherever the height field happened to dip. R1 rules that every
 * full-envelope template is an island: **sea at the envelope edge, a shallow
 * coastal band, land interior**, with fractions a validator checks rather than a
 * developer asserts.
 *
 * Every number here is **TUNE** (R7): a starting point for the G1 playtest.
 */
import { asInt, fnv1a32 } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";

export const ISLAND = {
  /** Mean island radius in cells, tuned so land lands inside R1's 55–65 % band. */
  radiusCells: 362,
  /** How far the coastline wanders from the mean radius, in cells. Bays lengthen the coast. */
  coastWanderCells: 78,
  /** Shallow band at the waterline, in cells (R1: 3–12). */
  coastBandCells: 12,
  /** Height at the island's high ground, in millimetres. */
  interiorRiseMm: 5_200,
  /** Sea floor depth at the envelope edge. */
  seaFloorMm: -9_000,
  /**
   * A shallow lagoon on the island's south-west shore.
   *
   * **Finding, recorded rather than tuned around (FIX-04):** R1 asks for 8–12 %
   * shallow water *and* a 3–12 cell coastal band. A 12-cell band around a single
   * island of this size yields about **4 %** however convoluted the coastline is
   * made — radial coast noise lengthens the shore far less than it looks. The
   * remaining shallow has to come from an authored feature, so the shipping
   * valley has a lagoon. If the reviewer intended the band alone to reach 8 %,
   * one of the two numbers needs to move, and it should be theirs to move.
   */
  lagoon: { centreCx: 250, centreCy: 250, radiusCells: 105 },
} as const;

/**
 * R1's fraction bands, in **thousandths**. The float ban applies here too: a
 * fraction is a consequential value the validator compares against, and the
 * cheapest way to keep it exact is to never leave integers.
 */
export const R1_TARGETS = {
  landMilliMin: 550,
  landMilliMax: 650,
  shallowMilliMin: 80,
  shallowMilliMax: 120,
  coastBandMinCells: 3,
  coastBandMaxCells: 12,
  maxInlandLakeCells: 15_000,
} as const;

/** Deterministic lattice noise on the coastline angle, so a seed gives one coast. */
export const COAST_LATTICE = 16;

export function coastRadiusCells(seed: Int, angleIndex: number, lattice: number = COAST_LATTICE): number {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setInt32(0, seed, true);
  view.setInt32(4, Math.floor(angleIndex / lattice), true);
  const a = fnv1a32(bytes) % 2_001;
  view.setInt32(4, Math.floor(angleIndex / lattice) + 1, true);
  const b = fnv1a32(bytes) % 2_001;
  const t = angleIndex - Math.floor(angleIndex / lattice) * lattice;
  const blended = a + Math.trunc(((b - a) * t) / lattice);
  return ISLAND.radiusCells + Math.trunc(((blended - 1_000) * ISLAND.coastWanderCells) / 1_000);
}

/** Is this land cell inside the authored lagoon (shallow, wadeable)? */
export function isLagoon(cx: number, cy: number): boolean {
  const dx = cx - ISLAND.lagoon.centreCx;
  const dy = cy - ISLAND.lagoon.centreCy;
  return dx * dx + dy * dy <= ISLAND.lagoon.radiusCells * ISLAND.lagoon.radiusCells;
}

export interface IslandFractions {
  /** Thousandths of the envelope. */
  readonly landMilli: number;
  readonly shallowMilli: number;
  readonly deepMilli: number;
  readonly cells: number;
}

export interface ValidationFinding {
  readonly rule: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface IslandValidation {
  readonly ok: boolean;
  readonly fractions: IslandFractions;
  readonly findings: readonly ValidationFinding[];
}

/**
 * Check a compiled template against R1. This is the acceptance R1 asks for: the
 * fractions are measured from the compiled cells, not promised by the recipe.
 */
export function validateIsland(
  counts: Readonly<Record<string, number>>,
  cellCount: number,
  extra: { readonly seaTouchesEdge: boolean; readonly largestInlandLakeCells: number },
): IslandValidation {
  const milli = (cells: number): number => Math.trunc((cells * 1000) / cellCount);
  const landMilli = milli((counts["Ground"] ?? 0) + (counts["Cliff"] ?? 0) + (counts["Obstacle"] ?? 0));
  const shallowMilli = milli(counts["ShallowWater"] ?? 0);
  const deepMilli = milli(counts["DeepWater"] ?? 0);
  const pct = (m: number): string => `${(m / 10).toFixed(1)} %`;

  const findings: ValidationFinding[] = [
    {
      rule: `land is ${R1_TARGETS.landMilliMin / 10}–${R1_TARGETS.landMilliMax / 10} % of the envelope`,
      ok: landMilli >= R1_TARGETS.landMilliMin && landMilli <= R1_TARGETS.landMilliMax,
      detail: pct(landMilli),
    },
    {
      rule: `shallow water is ${R1_TARGETS.shallowMilliMin / 10}–${R1_TARGETS.shallowMilliMax / 10} % of the envelope`,
      ok: shallowMilli >= R1_TARGETS.shallowMilliMin && shallowMilli <= R1_TARGETS.shallowMilliMax,
      detail: pct(shallowMilli),
    },
    { rule: "the sea reaches the envelope edge", ok: extra.seaTouchesEdge, detail: extra.seaTouchesEdge ? "edge is deep water" : "no deep water at the edge" },
    {
      rule: `at most one inland lake, up to ${R1_TARGETS.maxInlandLakeCells} cells`,
      ok: extra.largestInlandLakeCells <= R1_TARGETS.maxInlandLakeCells,
      detail: `largest inland water body ${extra.largestInlandLakeCells} cells`,
    },
  ];

  return { ok: findings.every((f) => f.ok), fractions: { landMilli, shallowMilli, deepMilli, cells: cellCount }, findings };
}

/** Shipping-valley shape (R2): floor width, stream width, crossings, rim passes. TUNE. */
export const SHIPPING_VALLEY = {
  /** Valley floor width in cells (R2: 150–250). */
  floorWidthCells: 190,
  /** Stream width in cells (R2: at most 6). */
  streamWidthCells: 5,
  /** Crossings are shallow steps in the stream; R2 requires at least three. */
  crossings: [{ atCellY: 240 }, { atCellY: 400 }, { atCellY: 560 }] as const,
  /** Crossing length along the stream, in cells. */
  crossingLengthCells: 14,
  /** Rim escarpment rise, as a landmark rather than a test device (R2). */
  escarpmentRiseMm: 2_600,
  /** Passes through each rim; R2 requires at least two per rim. */
  passes: [{ atCellY: 300, widthCells: 18 }, { atCellY: 520, widthCells: 18 }] as const,
} as const;

/** Is this cell inside a stream crossing (shallow, walkable at 0.8) rather than the deep channel? */
export function isCrossing(cy: number): boolean {
  return SHIPPING_VALLEY.crossings.some((c) => Math.abs(cy - c.atCellY) * 2 <= SHIPPING_VALLEY.crossingLengthCells);
}

/** Is this cell inside a rim pass, where the escarpment is absent so the rim is walkable? */
/**
 * Deep pools along the stream. R2 caps a deep segment at 40 cells, so pools are
 * 32 cells long with 80 cells of wadeable water between them, and never inside a
 * crossing.
 */
export function isDeepPool(cy: number): boolean {
  if (isCrossing(cy)) return false;
  // 26 cells, not 40: height noise can deepen a cell or two at each end, and a
  // rule with no margin is a rule that fails on the seed nobody tested.
  return cy % 112 < 26;
}

/** The stream's authored extent along the island, in cells. Outside it, the axis is sea. */
export const STREAM_EXTENT = { fromCellY: 120, throughCellY: 680 } as const;

export function isPass(cy: number): boolean {
  return SHIPPING_VALLEY.passes.some((p) => Math.abs(cy - p.atCellY) * 2 <= p.widthCells);
}

export function asIntSafe(value: number, what: string): Int {
  return asInt(Math.trunc(value), what);
}
