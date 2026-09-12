import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import {
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

const recipe: TerrainRecipe = { recipeId: "valley-standard", seed: 4107 as Int, template: "valley", sockets: SOCKETS };
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
