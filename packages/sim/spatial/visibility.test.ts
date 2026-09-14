import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { compileTerrain, TRAVERSAL } from "./terrain.js";
import type { CompiledTerrain, TerrainRecipe } from "./terrain.js";
import { BUCKET_MM, DEFAULT_SIGHT_BUDGET_CELLS, lineOfSight, SpatialHash, staticVisibility, visibleFrom } from "./visibility.js";

/**
 * P1-03. The terrain compile is ~3 s on this sandbox's single CPU, so the suite
 * compiles one world and asserts against it.
 *
 * The world is the accepted P1-02 valley: a trough running north–south with an
 * authored escarpment at each rim, so there is real occluding geometry to test
 * against rather than a flat plane where every ray trivially passes.
 */
const recipe: TerrainRecipe = {
  recipeId: "trough-test",
  seed: 4107 as Int,
  template: "trough",
  sockets: [
    { id: "start.north", kind: "Start", xMm: 400_000 as Int, yMm: 120_000 as Int },
    { id: "work.camp", kind: "Work", xMm: 412_000 as Int, yMm: 398_000 as Int },
    { id: "obstacle.boulder", kind: "Obstacle", xMm: 300_000 as Int, yMm: 300_000 as Int, radiusMm: 2_500 as Int },
  ],
};
const terrain: CompiledTerrain = compileTerrain(recipe);
/** A second world with a real occluding ridge; the valley has none (see the occlusion test). */
const ridge: CompiledTerrain = compileTerrain({ recipeId: "ridge-test", seed: 4107 as Int, template: "ridge", sockets: [{ id: "work.west", kind: "Work", xMm: 100_000 as Int, yMm: 400_000 as Int }] });
const RANGE = 200_000 as Int;

describe("broad phase", () => {
  const entries = [
    { id: "C001", xMm: 400_000 as Int, yMm: 400_000 as Int },
    { id: "C002", xMm: 405_000 as Int, yMm: 400_000 as Int },
    { id: "C003", xMm: 600_000 as Int, yMm: 400_000 as Int },
    { id: "C004", xMm: 400_000 as Int, yMm: 700_000 as Int },
  ];
  const hash = SpatialHash.build(entries);

  it("indexes every entry and finds only those inside the radius", () => {
    expect(hash.size).toBe(4);
    expect(hash.candidates(400_000 as Int, 400_000 as Int, 10_000 as Int).map((e) => e.id)).toEqual(["C001", "C002"]);
    expect(hash.candidates(400_000 as Int, 400_000 as Int, 250_000 as Int).map((e) => e.id)).toEqual(["C001", "C002", "C003"]);
    // C004 is 300 m away, so it only appears once the radius actually reaches it.
    expect(hash.candidates(400_000 as Int, 400_000 as Int, 320_000 as Int).map((e) => e.id)).toEqual(["C001", "C002", "C003", "C004"]);
  });

  it("returns candidates in a stable order, so two runs agree", () => {
    const forward = SpatialHash.build(entries).candidates(400_000 as Int, 400_000 as Int, 250_000 as Int);
    const reversed = SpatialHash.build([...entries].reverse()).candidates(400_000 as Int, 400_000 as Int, 250_000 as Int);
    expect(reversed.map((e) => e.id)).toEqual(forward.map((e) => e.id));
  });

  it("handles the envelope edges without falling off the grid", () => {
    const edge = SpatialHash.build([{ id: "C009", xMm: 799_999 as Int, yMm: 799_999 as Int }]);
    expect(edge.candidates(799_000 as Int, 799_000 as Int, BUCKET_MM).map((e) => e.id)).toEqual(["C009"]);
    expect(edge.candidates(0 as Int, 0 as Int, 10_000 as Int)).toEqual([]);
  });
});

describe("occlusion, distance and boundaries (criterion 1)", () => {
  it("sees a near target across open ground", () => {
    const result = lineOfSight(terrain, 400_000 as Int, 398_000 as Int, 408_000 as Int, 398_000 as Int, { rangeMm: RANGE });
    expect(result.status).toBe("Visible");
    expect(result.visible).toBe(true);
    expect(result.distanceMm).toBe(8_000);
  });

  it("is blocked by terrain, and names the cell that blocked it", () => {
    // Deliberately the `ridge` template, not the valley: the valley's height
    // rises monotonically outward from its floor, so nothing in it ever occludes
    // a sight line — I checked by scanning the compiled world before writing
    // this. A ridge between two lower points is the case that matters.
    const result = lineOfSight(ridge, 200_500 as Int, 400_500 as Int, 600_500 as Int, 400_500 as Int, { rangeMm: 900_000 as Int, budgetCells: 800 });
    expect(result.status).toBe("Blocked");
    expect(result.visible).toBe(false);
    expect(result.blockedAt?.reason).toBe("Terrain");
    expect(result.cellsStepped).toBeGreaterThan(0);
  });

  it("sees across the trough, because that template has nothing to occlude with", () => {
    const result = lineOfSight(terrain, 400_000 as Int, 400_000 as Int, 680_000 as Int, 400_000 as Int, { rangeMm: 400_000 as Int, budgetCells: 400 });
    expect(result.status).toBe("Visible");
  });

  it("is blocked by a declared obstacle's own footprint, reported as an obstacle", () => {
    const boulder = { xMm: 300_000 as Int, yMm: 300_000 as Int };
    const result = lineOfSight(terrain, (boulder.xMm - 12_000) as Int, boulder.yMm, (boulder.xMm + 12_000) as Int, boulder.yMm, { rangeMm: RANGE });
    expect(result.status).toBe("Blocked");
    expect(result.blockedAt?.reason).toBe("Obstacle");
    expect(terrain.traversal[(result.blockedAt as { cy: number }).cy * 800 + (result.blockedAt as { cx: number }).cx]).toBe(TRAVERSAL.Obstacle);
  });

  it("refuses a target beyond range before doing any work", () => {
    const result = lineOfSight(terrain, 400_000 as Int, 400_000 as Int, 700_000 as Int, 400_000 as Int, { rangeMm: 50_000 as Int });
    expect(result.status).toBe("OutOfRange");
    expect(result.visible).toBe(false);
    expect(result.cellsStepped).toBe(0);
  });

  it("handles the boundary cases: zero distance, exactly at range, and one millimetre past it", () => {
    const same = lineOfSight(terrain, 400_000 as Int, 400_000 as Int, 400_000 as Int, 400_000 as Int, { rangeMm: RANGE });
    expect(same.status).toBe("Visible");
    expect(same.cellsStepped).toBe(0);

    const atRange = lineOfSight(terrain, 400_000 as Int, 398_000 as Int, 410_000 as Int, 398_000 as Int, { rangeMm: 10_000 as Int });
    expect(atRange.status).not.toBe("OutOfRange");

    const pastRange = lineOfSight(terrain, 400_000 as Int, 398_000 as Int, 410_001 as Int, 398_000 as Int, { rangeMm: 10_000 as Int });
    expect(pastRange.status).toBe("OutOfRange");
  });

  it("is symmetric, including across a blocking ridge", () => {
    for (const [ax, ay, bx, by, world] of [
      [400_000, 398_000, 430_000, 402_000, terrain],
      [200_500, 400_500, 600_500, 400_500, ridge],
      [150_500, 400_500, 650_500, 404_500, ridge],
    ] as const) {
      const options = { rangeMm: 900_000 as Int, budgetCells: 800 };
      const there = lineOfSight(world as CompiledTerrain, ax as Int, ay as Int, bx as Int, by as Int, options);
      const back = lineOfSight(world as CompiledTerrain, bx as Int, by as Int, ax as Int, ay as Int, options);
      expect(back.status, `${ax},${ay} -> ${bx},${by}`).toBe(there.status);
      expect(back.blockedAt).toEqual(there.blockedAt);
    }
  });

  it("gives the same answer twice, with no state carried between queries", () => {
    const args = [ridge, 200_500 as Int, 400_500 as Int, 600_500 as Int, 400_500 as Int, { rangeMm: 900_000 as Int, budgetCells: 800 }] as const;
    expect(lineOfSight(...args)).toEqual(lineOfSight(...args));
  });
});

describe("budget exhaustion is explicit and never means visible (criterion 2)", () => {
  it("reports BudgetExhausted with what it would have needed, and is not visible", () => {
    const result = lineOfSight(terrain, 400_000 as Int, 398_000 as Int, 500_000 as Int, 398_000 as Int, { rangeMm: RANGE, budgetCells: 10 });
    expect(result.status).toBe("BudgetExhausted");
    expect(result.visible).toBe(false);
    expect(result.budget).toEqual({ allowedCells: 10, neededCells: 100 });
  });

  it("never returns visible: true for any status other than Visible", () => {
    const statuses = [
      lineOfSight(terrain, 400_000 as Int, 398_000 as Int, 500_000 as Int, 398_000 as Int, { rangeMm: RANGE, budgetCells: 10 }),
      lineOfSight(terrain, 400_000 as Int, 400_000 as Int, 700_000 as Int, 400_000 as Int, { rangeMm: 50_000 as Int }),
      lineOfSight(ridge, 200_500 as Int, 400_500 as Int, 600_500 as Int, 400_500 as Int, { rangeMm: 900_000 as Int, budgetCells: 800 }),
    ];
    for (const result of statuses) {
      expect(result.visible, `${result.status} must not be visible`).toBe(false);
      expect(result.status).not.toBe("Visible");
    }
  });

  it("keeps exhausted candidates in the result rather than dropping them, so absence never looks like emptiness", () => {
    const hash = SpatialHash.build([
      { id: "C001", xMm: 404_000 as Int, yMm: 398_000 as Int },
      { id: "C002", xMm: 480_000 as Int, yMm: 398_000 as Int },
    ]);
    const { seen, results } = visibleFrom(terrain, hash, { xMm: 400_000 as Int, yMm: 398_000 as Int }, { rangeMm: RANGE, budgetCells: 12 });
    expect(results.size).toBe(2);
    expect(results.get("C002")?.status).toBe("BudgetExhausted");
    expect(results.get("C002")?.visible).toBe(false);
    expect(seen.map((e) => e.id)).not.toContain("C002");
  });

  it("spends a shared budget across candidates and still reports every one", () => {
    const hash = SpatialHash.build(
      Array.from({ length: 6 }, (_, i) => ({ id: `C10${i}`, xMm: (402_000 + i * 4_000) as Int, yMm: 398_000 as Int })),
    );
    const { results, budgetSpentCells } = visibleFrom(terrain, hash, { xMm: 400_000 as Int, yMm: 398_000 as Int }, { rangeMm: RANGE, totalBudgetCells: 20 });
    expect(results.size).toBe(6);
    expect(budgetSpentCells).toBeLessThanOrEqual(20 + DEFAULT_SIGHT_BUDGET_CELLS);
    expect([...results.values()].some((r) => r.status === "BudgetExhausted")).toBe(true);
  });
});

describe("static visibility is terrain only (criterion 3)", () => {
  it("reports height, cover and openness, and names exactly those inputs", () => {
    const factors = staticVisibility(terrain, 412_000 as Int, 398_000 as Int);
    expect(factors.inputs).toEqual(["terrain.height", "terrain.cover", "terrain.openness"]);
    expect(factors.coverMilli).toBeGreaterThanOrEqual(0);
    expect(factors.opennessMilli).toBeGreaterThan(0);
  });

  it("depends on position alone: the same cell gives the same factors regardless of who asks", () => {
    expect(staticVisibility(terrain, 412_000 as Int, 398_000 as Int)).toEqual(staticVisibility(terrain, 412_400 as Int, 398_400 as Int));
  });

  it("takes no actor knowledge: the sight query's inputs are terrain and two positions", () => {
    // If an actor ID, belief or knowledge view ever becomes an input here, this
    // call stops compiling — which is the check. Sight cannot consult knowledge
    // it has no way to receive (TP v1.1 §6).
    const result = lineOfSight(terrain, 400_000 as Int, 398_000 as Int, 404_000 as Int, 398_000 as Int, { rangeMm: RANGE });
    expect(result.status).toBe("Visible");
    expect(Object.keys(result).sort()).toEqual(["cellsStepped", "distanceMm", "status", "visible"]);
  });
});
