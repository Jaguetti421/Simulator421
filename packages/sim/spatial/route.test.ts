import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { compileTerrain, TRAVERSAL } from "./terrain.js";
import type { CompiledTerrain } from "./terrain.js";
import { DEFAULT_ROUTE_BUDGET, findRoute, PORTAL_REPEAT_LIMIT, RouteKnowledge, RouteProgress } from "./route.js";

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
