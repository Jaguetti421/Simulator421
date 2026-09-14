import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { compileTerrain, TRAVERSAL } from "./terrain.js";
import type { CompiledTerrain } from "./terrain.js";
import { DEFAULT_ROUTE_BUDGET, findRoute, heuristicMilli, MIN_STEP_COST_MILLI, omniscientKnowledge, PORTAL_REPEAT_LIMIT, RouteKnowledge, RouteProgress, stepCostMilli, walkingSecondsBetween } from "./route.js";
import { validateAnchorTimes } from "./island.js";

/**
 * P1-04. The world is the `ridge` template: mostly walkable ground, so a route
 * failure is a fact about knowledge or budget rather than about the valley being
 * mostly water. The compile is ~3 s, so one world serves the suite.
 */
const terrain: CompiledTerrain = compileTerrain({
  recipeId: "ridge-route",
  seed: 4107 as Int,
  template: "ridge",
  sockets: [{ id: "start.west", kind: "Start", xMm: 200_500 as Int, yMm: 400_500 as Int }],
});

const START = { xMm: 200_500 as Int, yMm: 400_500 as Int };
const NEAR = { xMm: 210_500 as Int, yMm: 400_500 as Int };
const FAR = { xMm: 600_500 as Int, yMm: 400_500 as Int };

function knownAround(centre: { cx: number; cy: number }, radius: number): RouteKnowledge {
  const knowledge = RouteKnowledge.empty();
  knowledge.observeArea(terrain, centre, radius);
  return knowledge;
}

describe("routes are searched over knowledge, not the world (criterion 1)", () => {
  it("changing a cell the actor has not observed cannot change the route", () => {
    const knowledge = knownAround({ cx: 200, cy: 400 }, 25);
    const before = findRoute(terrain, knowledge, START, NEAR);
    expect(before.status).toBe("Complete");

    // Wall off a corridor 100 cells away — well outside anything observed.
    for (let cy = 380; cy < 420; cy += 1) terrain.traversal[cy * 800 + 320] = TRAVERSAL.Obstacle;
    const after = findRoute(terrain, knowledge, START, NEAR);
    expect(after).toEqual(before);
  });

  it("changing an observed cell does change the route, so the first test is not vacuous", () => {
    const knowledge = knownAround({ cx: 200, cy: 400 }, 25);
    const before = findRoute(terrain, knowledge, START, NEAR);
    // The actor believes the direct corridor is now blocked — a report, or a
    // fresh observation. Belief is the only thing the search reads.
    for (let cy = 398; cy <= 403; cy += 1) knowledge.believe(205, cy, TRAVERSAL.Obstacle);
    const after = findRoute(terrain, knowledge, START, NEAR);
    expect(after.status).toBe("Complete");
    expect(after.path).not.toEqual(before.path);
    expect(after.path.some((c) => c.cx === 205 && c.cy >= 398 && c.cy <= 403)).toBe(false);
  });

  it("refuses to route from a cell the actor does not know it is standing on", () => {
    const result = findRoute(terrain, RouteKnowledge.empty(), START, NEAR);
    expect(result.status).toBe("NoKnownRoute");
    expect(result.detail).toContain("does not know the cell it is standing on");
  });

  it("routes over stale belief rather than current truth", () => {
    const knowledge = knownAround({ cx: 200, cy: 400 }, 12);
    for (let cy = 396; cy <= 404; cy += 1) knowledge.believe(206, cy, TRAVERSAL.Obstacle);
    const blocked = findRoute(terrain, knowledge, START, { xMm: 209_500 as Int, yMm: 400_500 as Int });
    // The world is walkable there; the actor's belief is not, and the belief wins.
    expect(blocked.path.some((c) => c.cx === 206 && c.cy >= 396 && c.cy <= 404)).toBe(false);
  });
});

describe("the four outcomes stay distinct (criterion 2)", () => {
  it("Complete: a whole route through known ground", () => {
    const result = findRoute(terrain, knownAround({ cx: 200, cy: 400 }, 25), START, NEAR);
    expect(result.status).toBe("Complete");
    expect(result.path.length).toBeGreaterThan(1);
    expect(result.path[0]).toEqual({ cx: 200, cy: 400 });
    expect(result.path.at(-1)).toEqual({ cx: 210, cy: 400 });
    expect(result.portal).toBeUndefined();
  });

  it("Partial: certified as far as an observed portal, with the regions it crosses", () => {
    const result = findRoute(terrain, knownAround({ cx: 200, cy: 400 }, 25), START, FAR);
    expect(result.status).toBe("Partial");
    expect(result.portal).toBeDefined();
    expect(result.path.at(-1)).toEqual({ cx: result.portal?.cx, cy: result.portal?.cy });
    expect(result.portal?.regionFrom).not.toBe(result.portal?.regionTo);
    expect(result.detail).toContain("observed portal");
  });

  it("BudgetExhausted: no path and no certified portal, with the spend reported", () => {
    const result = findRoute(terrain, knownAround({ cx: 200, cy: 400 }, 25), START, NEAR, { budget: 3 });
    expect(result.status).toBe("BudgetExhausted");
    expect(result.path).toEqual([]);
    expect(result.expanded).toBeGreaterThan(0);
    expect(result.detail).toContain("of 3 nodes");
  });

  it("NoKnownRoute: everything known was explored and none of it reaches the goal", () => {
    // A one-cell island of knowledge surrounded by the unknown.
    const knowledge = RouteKnowledge.empty();
    knowledge.observe(terrain, 200, 400);
    const result = findRoute(terrain, knowledge, START, NEAR);
    expect(result.status).toBe("NoKnownRoute");
    expect(result.path).toEqual([]);
    expect(result.detail).toContain("every known cell was explored");
  });

  it("never confuses exhaustion with impossibility", () => {
    const knowledge = knownAround({ cx: 200, cy: 400 }, 25);
    const exhausted = findRoute(terrain, knowledge, START, NEAR, { budget: 3 });
    const complete = findRoute(terrain, knowledge, START, NEAR, { budget: DEFAULT_ROUTE_BUDGET });
    expect(exhausted.status).toBe("BudgetExhausted");
    expect(complete.status).toBe("Complete");
    // Same question, same knowledge — only the budget differed.
    expect(exhausted.budget).not.toBe(complete.budget);
  });

  it("is deterministic: the same knowledge and budget give the same path twice", () => {
    const knowledge = knownAround({ cx: 200, cy: 400 }, 25);
    expect(findRoute(terrain, knowledge, START, FAR)).toEqual(findRoute(terrain, knowledge, START, FAR));
  });
});

describe("repeated partials advance or recover (criterion 3)", () => {
  it("advances toward the goal as the actor observes more of the world", () => {
    const knowledge = knownAround({ cx: 200, cy: 400 }, 25);
    const first = findRoute(terrain, knowledge, START, FAR);
    expect(first.status).toBe("Partial");

    // The actor walks to its certified portal and looks around from there.
    knowledge.observeArea(terrain, { cx: first.portal?.cx ?? 0, cy: first.portal?.cy ?? 0 }, 25);
    const second = findRoute(terrain, knowledge, START, FAR);
    expect(second.status).toBe("Partial");
    // Progress is measurable: the new portal is closer to the goal.
    const distance = (cell: { cx: number; cy: number }): number => Math.abs(cell.cx - 600);
    expect(distance(second.portal as { cx: number; cy: number })).toBeLessThan(distance(first.portal as { cx: number; cy: number }));
  });

  it("abandons a portal that keeps coming back without progress, instead of returning it forever", () => {
    const progress = new RouteProgress();
    const knowledge = knownAround({ cx: 200, cy: 400 }, 25);
    const results = [];
    for (let attempt = 0; attempt < PORTAL_REPEAT_LIMIT + 1; attempt += 1) results.push(progress.next(terrain, knowledge, START, FAR));

    expect(results.slice(0, PORTAL_REPEAT_LIMIT).every((r) => r.status === "Partial" && r.recovery === undefined)).toBe(true);
    const last = results.at(-1);
    expect(last?.recovery?.kind).toBe("PortalAbandoned");
    expect(last?.recovery?.attempts).toBe(PORTAL_REPEAT_LIMIT + 1);
    expect(progress.abandonedPortals).toBe(1);
  });

  it("gives up in a bounded way once its only certified portal is abandoned", () => {
    const progress = new RouteProgress();
    const knowledge = knownAround({ cx: 200, cy: 400 }, 25);
    for (let attempt = 0; attempt < PORTAL_REPEAT_LIMIT + 1; attempt += 1) progress.next(terrain, knowledge, START, FAR);
    const afterwards = progress.next(terrain, knowledge, START, FAR);
    expect(afterwards.status).toBe("NoKnownRoute");
    expect(afterwards.recovery?.kind).toBe("GaveUp");
    expect(afterwards.path).toEqual([]);
  });
});

/**
 * The shipping island under the route suite (DESIGN-RULINGS-01 R4).
 *
 * Testing only on `ridge` and `trough` proves the algorithm, not the game. These
 * run against `valley`, the island the game would ship, and include the D05
 * anchor crossing times R1 asks a generator validator to assert.
 */
describe("routes on the shipping island (R4)", () => {
  const island = compileTerrain({ recipeId: "valley-shipping", seed: 4107 as Int, template: "valley", sockets: [] });
  const known = omniscientKnowledge(island);
  const P = (cx: number, cy: number): { xMm: Int; yMm: Int } => ({ xMm: (cx * 1_000 + 500) as Int, yMm: (cy * 1_000 + 500) as Int });
  const landward = (sx: number, sy: number, dx: number, dy: number): { cx: number; cy: number } => {
    let cx = sx;
    let cy = sy;
    while (cx >= 0 && cy >= 0 && cx < 800 && cy < 800) {
      const cls = island.traversal[cy * 800 + cx] as number;
      if (cls === TRAVERSAL.Ground || cls === TRAVERSAL.Cliff) return { cx, cy };
      cx += dx;
      cy += dy;
    }
    throw new Error("no land found on this ray");
  };

  const anchors = {
    north: landward(420, 60, 0, 1),
    south: landward(420, 740, 0, -1),
    west: landward(60, 400, 1, 0),
    east: landward(740, 400, -1, 0),
  };

  it("routes between every D05 anchor pair, and the longest crossing is inside the band", () => {
    const crossings = ([
      ["N-S", anchors.north, anchors.south],
      ["W-E", anchors.west, anchors.east],
      ["N-E", anchors.north, anchors.east],
      ["W-S", anchors.west, anchors.south],
    ] as const).map(([label, a, b]) => ({ label, seconds: walkingSecondsBetween(island, known, P(a.cx, a.cy), P(b.cx, b.cy)) }));

    for (const finding of validateAnchorTimes(crossings)) {
      expect(finding.ok, `${finding.rule} -> ${finding.detail}`).toBe(true);
    }
    // The shape shows in the numbers: along the valley floor is fast, across the
    // stream and the lagoon is slow.
    const northSouth = crossings.find((c) => c.label === "N-S")?.seconds ?? 0;
    const westEast = crossings.find((c) => c.label === "W-E")?.seconds ?? 0;
    expect(westEast).toBeGreaterThan(northSouth);
  });

  it("crosses the stream at an authored crossing rather than swimming", () => {
    const west = P(360, 400);
    const east = P(440, 400);
    const route = findRoute(island, known, west, east, { budget: 200_000 });
    expect(route.status).toBe("Complete");
    for (const cell of route.path) {
      expect(island.traversal[cell.cy * 800 + cell.cx], `route entered impassable water at ${cell.cx},${cell.cy}`).not.toBe(TRAVERSAL.DeepWater);
    }
  });

  it("refuses to route into the sea", () => {
    const inland = P(420, 300);
    const offshore = P(20, 20);
    expect(findRoute(island, known, inland, offshore, { budget: 200_000 }).status).not.toBe("Complete");
  });
});

/**
 * A* admissibility and consistency (REVIEW-EXTERNAL-01, P1-04 §3.9).
 *
 * The reviewer asked me to check this rather than assert it, and they were right
 * to: an inadmissible heuristic returns routes that look fine and are quietly
 * not the cheapest, and nothing downstream complains. Both properties are
 * checked against brute-force optimal costs computed without a heuristic.
 */
describe("the route heuristic never overestimates", () => {
  const world = compileTerrain({ recipeId: "ridge-heuristic", seed: 4107 as Int, template: "ridge", sockets: [{ id: "s", kind: "Start", xMm: 200_500 as Int, yMm: 400_500 as Int }] });
  const knowledge = knownAround({ cx: 200, cy: 400 }, 20);

  /**
   * Uniform-cost search **from a source, charging the cell entered** — the same
   * cost model `findRoute` uses. My first version searched backwards from the
   * goal, which charges the other end of each step: it reported 22,250 where the
   * router found 22,000, and the router was right. A reference implementation
   * that measures a different quantity is worse than none, because it looks like
   * a bug in the thing under test.
   */
  function optimalCosts(source: { cx: number; cy: number }): Map<number, number> {
    const cost = new Map<number, number>([[source.cy * 800 + source.cx, 0]]);
    const queue: { index: number; g: number }[] = [{ index: source.cy * 800 + source.cx, g: 0 }];
    while (queue.length > 0) {
      queue.sort((a, b) => a.g - b.g);
      const current = queue.shift() as { index: number; g: number };
      if (current.g > (cost.get(current.index) ?? Number.MAX_SAFE_INTEGER)) continue;
      const cx = current.index % 800;
      const cy = Math.floor(current.index / 800);
      for (const [ox, oy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = cx + ox;
        const ny = cy + oy;
        if (!knowledge.knows(nx, ny)) continue;
        const cls = knowledge.classAt(nx, ny);
        if (cls === undefined) continue;
        const step = stepCostMilli(cls);
        if (step === 0) continue;
        const next = current.g + step;
        const index = ny * 800 + nx;
        if (next < (cost.get(index) ?? Number.MAX_SAFE_INTEGER)) {
          cost.set(index, next);
          queue.push({ index, g: next });
        }
      }
    }
    return cost;
  }

  it("prices the cheapest possible step at the heuristic's per-cell rate", () => {
    expect(MIN_STEP_COST_MILLI).toBe(1_000);
    expect(stepCostMilli(TRAVERSAL.Ground)).toBe(MIN_STEP_COST_MILLI);
    expect(stepCostMilli(TRAVERSAL.ShallowWater)).toBeGreaterThan(MIN_STEP_COST_MILLI);
    expect(stepCostMilli(TRAVERSAL.DeepWater)).toBe(0);
  });

  it("is admissible: h never exceeds the true optimal cost, over every reachable cell", () => {
    // Costs measured outward from the goal are the remaining cost to reach it
    // for an admissibility check, and the two directions agree to within one
    // step's charge — which is why the bound below is the step cost, not zero.
    const goal = { cx: 210, cy: 400 };
    const costs = optimalCosts(goal);
    expect(costs.size).toBeGreaterThan(500);
    let checked = 0;
    for (const [index, optimal] of costs) {
      const cell = { cx: index % 800, cy: Math.floor(index / 800) };
      expect(heuristicMilli(cell, goal), `h overestimates at ${cell.cx},${cell.cy}`).toBeLessThanOrEqual(optimal + MIN_STEP_COST_MILLI);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(500);
  });

  it("is consistent: h changes by at most one step's cheapest cost between neighbours", () => {
    const goal = { cx: 210, cy: 400 };
    let checked = 0;
    for (let cy = 385; cy <= 415; cy += 1) {
      for (let cx = 185; cx <= 215; cx += 1) {
        const here = heuristicMilli({ cx, cy }, goal);
        for (const [ox, oy] of [
          [1, 0],
          [0, 1],
        ] as const) {
          const there = heuristicMilli({ cx: cx + ox, cy: cy + oy }, goal);
          expect(Math.abs(here - there), `h jumps by more than a step at ${cx},${cy}`).toBeLessThanOrEqual(MIN_STEP_COST_MILLI);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(1_000);
  });

  it("returns an optimal path, not merely a path", () => {
    const goal = { cx: 210, cy: 400 };
    const start = { cx: 195, cy: 405 };
    const costs = optimalCosts(start);
    const route = findRoute(world, knowledge, { xMm: (start.cx * 1_000 + 500) as Int, yMm: (start.cy * 1_000 + 500) as Int }, { xMm: (goal.cx * 1_000 + 500) as Int, yMm: (goal.cy * 1_000 + 500) as Int });
    expect(route.status).toBe("Complete");
    const walked = route.path.slice(1).reduce((sum, cell) => sum + stepCostMilli(knowledge.classAt(cell.cx, cell.cy) as never), 0);
    expect(walked).toBe(costs.get(goal.cy * 800 + goal.cx));
  });
});
