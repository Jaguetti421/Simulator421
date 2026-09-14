import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import {
  canonicalGeometryBytes,
  CELL_COUNT,
  CELL_MM,
  cellOf,
  classAt,
  compileTerrain,
  exportForRender,
  exportForSimulation,
  fineClearance,
  GRID_SIZE,
  heightAt,
  isPassable,
  SPEED_MULTIPLIER_MILLI,
  SPRINT_MM_PER_SECOND,
  TRAVERSAL,
  walkSpeedMmPerSecond,
  WALK_MM_PER_SECOND,
} from "./terrain.js";
import type { CompiledTerrain, TerrainRecipe } from "./terrain.js";
import { SHIPPING_VALLEY, STREAM_EXTENT } from "./island.js";

/**
 * P1-02. A compile takes ~3 s on this sandbox's single CPU, so the suite
 * compiles once and asserts against that result; the determinism test compiles
 * a second time on purpose.
 */
const SOCKETS = [
  { id: "start.north", kind: "Start", xMm: 400_000 as Int, yMm: 120_000 as Int },
  { id: "start.south", kind: "Start", xMm: 380_000 as Int, yMm: 660_000 as Int },
  { id: "work.camp", kind: "Work", xMm: 412_000 as Int, yMm: 398_000 as Int },
  { id: "obstacle.boulder", kind: "Obstacle", xMm: 300_000 as Int, yMm: 300_000 as Int, radiusMm: 2_500 as Int },
] as const;

const recipe: TerrainRecipe = { recipeId: "trough-test", seed: 4107 as Int, template: "trough", sockets: SOCKETS };
const terrain: CompiledTerrain = compileTerrain(recipe);

describe("one geometry, one hash (criterion 1)", () => {
  it("gives the render export and the simulation manifest the same hash", () => {
    expect(exportForRender(terrain).geometryHash).toBe(exportForSimulation(terrain).geometryHash);
    expect(terrain.manifest.geometryHash).toMatch(/^[0-9a-f]{8}$/u);
  });

  it("derives the render export from the same arrays the simulation queries", () => {
    const render = exportForRender(terrain);
    expect(render.heightMm).toBe(terrain.heightMm);
    expect(render.traversal).toBe(terrain.traversal);
    const { cx, cy } = cellOf(412_000 as Int, 398_000 as Int);
    expect(render.heightMm[cy * GRID_SIZE + cx]).toBe(heightAt(terrain, 412_000 as Int, 398_000 as Int));
  });

  it("recompiles to the same hash from the same recipe, and a different one when the seed changes", () => {
    expect(compileTerrain(recipe).manifest.geometryHash).toBe(terrain.manifest.geometryHash);
    expect(compileTerrain({ ...recipe, seed: 4108 as Int }).manifest.geometryHash).not.toBe(terrain.manifest.geometryHash);
  });

  it("changes the hash when the fine geometry changes, not only the coarse grid", () => {
    const extraDetail = compileTerrain({ ...recipe, sockets: [...SOCKETS, { id: "work.extra", kind: "Work", xMm: 200_000 as Int, yMm: 200_000 as Int }] });
    expect(extraDetail.manifest.fineCells).toBeGreaterThan(terrain.manifest.fineCells);
    expect(extraDetail.manifest.geometryHash).not.toBe(terrain.manifest.geometryHash);
  });

  it("compiles the documented grid: 800 x 800 one-metre cells", () => {
    expect(GRID_SIZE).toBe(800);
    expect(CELL_MM).toBe(1_000);
    expect(CELL_COUNT).toBe(640_000);
    expect(terrain.manifest.cellCount).toBe(640_000);
    expect(terrain.traversal).toHaveLength(640_000);
  });
});

describe("water and speeds match the GDD (criterion 2)", () => {
  it("uses the GDD's 0.8 shallow multiplier and leaves deep water impassable", () => {
    expect(SPEED_MULTIPLIER_MILLI[TRAVERSAL.Ground]).toBe(1000);
    expect(SPEED_MULTIPLIER_MILLI[TRAVERSAL.ShallowWater]).toBe(800);
    expect(SPEED_MULTIPLIER_MILLI[TRAVERSAL.DeepWater]).toBe(0);
    expect(WALK_MM_PER_SECOND).toBe(3_500);
    expect(SPRINT_MM_PER_SECOND).toBe(5_000);
  });

  it("applies the multiplier to walk and sprint at a real shallow cell", () => {
    const shallow = findCell(TRAVERSAL.ShallowWater);
    expect(walkSpeedMmPerSecond(terrain, shallow.xMm, shallow.yMm)).toBe(2_800);
    expect(walkSpeedMmPerSecond(terrain, shallow.xMm, shallow.yMm, true)).toBe(4_000);
    expect(isPassable(terrain, shallow.xMm, shallow.yMm)).toBe(true);
  });

  it("refuses deep water and cliffs as movement, at real compiled cells", () => {
    for (const traversalClass of [TRAVERSAL.DeepWater, TRAVERSAL.Cliff] as const) {
      const cell = findCell(traversalClass);
      expect(isPassable(terrain, cell.xMm, cell.yMm), `${traversalClass} should be impassable`).toBe(false);
      expect(walkSpeedMmPerSecond(terrain, cell.xMm, cell.yMm)).toBe(0);
    }
  });

  it("compiles instances of every traversal class, so no class is untested by construction", () => {
    for (const name of ["Ground", "ShallowWater", "DeepWater", "Cliff", "Obstacle"]) {
      expect(terrain.manifest.classCounts[name], `${name} has no cells`).toBeGreaterThan(0);
    }
  });

  it("classifies by compiled height: everything below the deep line is deep water", () => {
    let checked = 0;
    for (let i = 0; i < CELL_COUNT; i += 997) {
      const h = terrain.heightMm[i] as number;
      const cls = terrain.traversal[i] as number;
      if (cls === TRAVERSAL.Obstacle) continue;
      if (h <= -1_200) expect(cls).toBe(TRAVERSAL.DeepWater);
      else if (h <= 0) expect(cls).toBe(TRAVERSAL.ShallowWater);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(500);
  });
});

describe("known coordinates match query results (criterion 3)", () => {
  it("puts every start and work socket on passable ground", () => {
    for (const socket of SOCKETS.filter((s) => s.kind !== "Obstacle")) {
      expect(classAt(terrain, socket.xMm, socket.yMm), `${socket.id} is not walkable`).toBe(TRAVERSAL.Ground);
      expect(isPassable(terrain, socket.xMm, socket.yMm)).toBe(true);
      expect(walkSpeedMmPerSecond(terrain, socket.xMm, socket.yMm)).toBe(3_500);
    }
  });

  it("gives a declared obstacle an authoritative footprint at its own coordinates", () => {
    const boulder = SOCKETS[3];
    expect(classAt(terrain, boulder.xMm, boulder.yMm)).toBe(TRAVERSAL.Obstacle);
    expect(isPassable(terrain, boulder.xMm, boulder.yMm)).toBe(false);
    // Just outside the 2.5 m radius the world is walkable again.
    expect(isPassable(terrain, (boulder.xMm + 6_000) as Int, boulder.yMm)).toBe(true);
  });

  it("reports the sockets it compiled in the manifest, with their coordinates unchanged", () => {
    expect(terrain.manifest.sockets).toEqual(SOCKETS);
  });

  it("has 0.25 m detail around sockets and none elsewhere", () => {
    const atWork = fineClearance(terrain, 412_000 as Int, 398_000 as Int);
    expect(atWork.detailed).toBe(true);
    expect(atWork.passable).toBe(true);
    const faraway = fineClearance(terrain, 700_000 as Int, 700_000 as Int);
    expect(faraway.detailed).toBe(false);
    expect(terrain.manifest.fineCellMm).toBe(250);
  });

  it("maps positions to cells the way the grid says, including the envelope edges", () => {
    expect(cellOf(0 as Int, 0 as Int)).toEqual({ cx: 0, cy: 0 });
    expect(cellOf(799_999 as Int, 799_999 as Int)).toEqual({ cx: 799, cy: 799 });
    expect(cellOf(1_500_000 as Int, -5 as Int)).toEqual({ cx: 799, cy: 0 });
  });
});

function findCell(traversalClass: number): { xMm: Int; yMm: Int } {
  for (let i = 0; i < CELL_COUNT; i += 1) {
    if (terrain.traversal[i] !== traversalClass) continue;
    const cy = Math.floor(i / GRID_SIZE);
    const cx = i - cy * GRID_SIZE;
    return { xMm: (cx * CELL_MM + 500) as Int, yMm: (cy * CELL_MM + 500) as Int };
  }
  throw new Error(`no cell of class ${traversalClass} was compiled`);
}

/**
 * Canonical serialization (REVIEW-EXTERNAL-01, P1-02 Medium).
 *
 * The first geometry hash XOR-combined five separate hashes. XOR is commutative
 * and self-cancelling, so array order carried no weight and collisions were
 * cheap to construct. These tests pin the properties the replacement must have,
 * and one of them constructs a collision the old scheme would have accepted.
 */
describe("the geometry hash is canonical", () => {
  it("serializes to one byte stream whose length is the sum of its declared parts", () => {
    const bytes = canonicalGeometryBytes(terrain);
    // header + heights + four byte arrays + fine cells, each length-prefixed
    const expected = 24 + (4 + CELL_COUNT * 4) + 4 * (4 + CELL_COUNT) + 4 + terrain.fine.size * (4 + 4 + 16);
    expect(bytes.byteLength).toBe(expected);
  });

  it("writes little-endian explicitly rather than trusting the platform", () => {
    const bytes = canonicalGeometryBytes(terrain);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(0, true)).toBe(0x4c43_4730);
    expect(view.getUint32(8, true)).toBe(GRID_SIZE);
    expect(view.getUint32(12, true)).toBe(CELL_MM);
  });

  it("would reject the swap the old XOR scheme accepted: exchanging two arrays changes the hash", () => {
    const swapped = { ...terrain, region: terrain.coverMilli, coverMilli: terrain.region } as typeof terrain;
    // Under XOR-of-hashes this combination is identical to the original.
    expect(canonicalGeometryBytes(swapped)).not.toEqual(canonicalGeometryBytes(terrain));
  });

  it("puts the grid shape inside the hash, so the same cells on a different grid are a different world", () => {
    const bytes = canonicalGeometryBytes(terrain);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(4, true)).toBe(terrain.manifest.manifestVersion);
    expect(view.getUint32(16, true)).toBe(terrain.manifest.fineCellMm);
  });
});

/**
 * The shipping island (FIX-04; DESIGN-RULINGS-01 R1, R2).
 *
 * `valley` is now an island: sea at the envelope edge, a shallow coastal band,
 * land interior, a stream with authored crossings and rims with passes. The old
 * full-envelope trough is kept as `trough`, a **test** template, because it is
 * the only one that instances every traversal class — a test property, not a
 * design one.
 */
describe("the shipping valley is an island", () => {
  const island = compileTerrain({ recipeId: "valley-shipping", seed: 4107 as Int, template: "valley", sockets: [] });
  const classOf = (cx: number, cy: number): number => island.traversal[cy * GRID_SIZE + cx] as number;

  it("passes every R1 rule, measured from the compiled cells", () => {
    expect(island.manifest.shipping).toBe(true);
    const validation = island.manifest.island;
    expect(validation).not.toBeNull();
    for (const finding of validation?.findings ?? []) expect(finding.ok, `${finding.rule} -> ${finding.detail}`).toBe(true);
    expect(validation?.ok).toBe(true);
  });

  it("lands inside the fraction bands rather than near them", () => {
    const f = island.manifest.island?.fractions;
    expect(f?.landMilli).toBeGreaterThanOrEqual(550);
    expect(f?.landMilli).toBeLessThanOrEqual(650);
    expect(f?.shallowMilli).toBeGreaterThanOrEqual(80);
    expect(f?.shallowMilli).toBeLessThanOrEqual(120);
  });

  it("puts sea on every envelope edge and land in the middle", () => {
    for (const [cx, cy] of [
      [0, 400],
      [799, 400],
      [400, 0],
      [400, 799],
    ] as const) {
      expect(classOf(cx, cy), `edge ${cx},${cy} is not sea`).toBe(TRAVERSAL.DeepWater);
    }
    expect([TRAVERSAL.Ground, TRAVERSAL.Cliff]).toContain(classOf(600, 400));
  });

  it("has a stream with authored crossings that are wadeable", () => {
    for (const crossing of SHIPPING_VALLEY.crossings) {
      expect(classOf(400, crossing.atCellY), `crossing at ${crossing.atCellY} is not wadeable`).toBe(TRAVERSAL.ShallowWater);
      expect(SPEED_MULTIPLIER_MILLI[classOf(400, crossing.atCellY) as 1]).toBe(800);
    }
    expect(SHIPPING_VALLEY.crossings.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps every deep stretch of the stream inside R2's 40-cell cap", () => {
    // Measured over the stream's authored extent only: north and south of the
    // island the same axis is open sea, and the sea is allowed to be deep.
    let run = 0;
    let longest = 0;
    for (let cy = STREAM_EXTENT.fromCellY; cy <= STREAM_EXTENT.throughCellY; cy += 1) {
      run = classOf(400, cy) === TRAVERSAL.DeepWater ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    expect(longest, "a deep segment of the stream is longer than 40 cells").toBeLessThanOrEqual(40);
  });

  it("gives each rim at least two passes, so an escarpment is a landmark and not a wall", () => {
    expect(SHIPPING_VALLEY.passes.length).toBeGreaterThanOrEqual(2);
    for (const pass of SHIPPING_VALLEY.passes) {
      const onRim = 400 + Math.trunc(SHIPPING_VALLEY.floorWidthCells / 2) + 20;
      expect([TRAVERSAL.Ground, TRAVERSAL.ShallowWater], `no walkable pass at y=${pass.atCellY}`).toContain(classOf(onRim, pass.atCellY));
    }
  });

  it("keeps `trough` as an unshipped test template that still instances every class", () => {
    const trough = compileTerrain({ recipeId: "trough-test", seed: 4107 as Int, template: "trough", sockets: [] });
    expect(trough.manifest.shipping).toBe(false);
    expect(trough.manifest.island).toBeNull();
    for (const name of ["Ground", "ShallowWater", "DeepWater", "Cliff"]) {
      expect(trough.manifest.classCounts[name], `${name} has no cells in trough`).toBeGreaterThan(0);
    }
  });
});
