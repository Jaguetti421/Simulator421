import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { compileTerrain, TRAVERSAL } from "./terrain.js";
import type { CompiledTerrain } from "./terrain.js";
import { omniscientKnowledge, walkingSecondsBetween } from "./route.js";
import { buildG1Scene, G1_SCENE, isInsideG1Window, validateG1Scene } from "./scene.js";

/**
 * The G1 first-playable scene (DESIGN-RULINGS-01 R3).
 *
 * The scene is a **window into the shipping island**, not a second grid — one
 * compile, one geometry hash, and the scene is a socket set plus R3's checks.
 * Every rule is measured from the compiled world; the walking times come from
 * real routes at 3.5 m/s.
 */
const island: CompiledTerrain = compileTerrain({ recipeId: "valley-shipping", seed: 4107 as Int, template: "valley", sockets: [] });
const scene = buildG1Scene(island);
const known = omniscientKnowledge(island);

const secondsTo = (from: { xMm: number; yMm: number }, targets: readonly { xMm: number; yMm: number }[]): number | null => {
  let best: number | null = null;
  for (const target of targets) {
    const seconds = walkingSecondsBetween(island, known, { xMm: from.xMm as Int, yMm: from.yMm as Int }, { xMm: target.xMm as Int, yMm: target.yMm as Int }, 60_000);
    if (seconds !== null && (best === null || seconds < best)) best = seconds;
  }
  return best;
};

const foodSeconds = scene.starts.map((s) => secondsTo(s, scene.foodNodes));
const campSeconds = scene.starts.map((s) => secondsTo(s, scene.campSockets));

describe("the G1 scene satisfies R3", () => {
  it("passes every rule, measured from the compiled world", () => {
    const validation = validateG1Scene(island, scene, { foodSeconds, campSeconds });
    for (const finding of validation.findings) expect(finding.ok, `${finding.rule} -> ${finding.detail}`).toBe(true);
    expect(validation.ok).toBe(true);
  });

  it("is 180 × 180 m and entirely inside the island grid", () => {
    expect(scene.window.sizeCells).toBe(180);
    expect(isInsideG1Window(scene.window.originCx, scene.window.originCy)).toBe(true);
    expect(isInsideG1Window(scene.window.originCx - 1, scene.window.originCy)).toBe(false);
    expect(scene.window.originCx + 180).toBeLessThanOrEqual(800);
    expect(scene.window.originCy + 180).toBeLessThanOrEqual(800);
  });

  it("puts all eight starts on walkable ground inside the window", () => {
    expect(scene.starts).toHaveLength(G1_SCENE.contestants);
    for (const start of scene.starts) {
      const cx = Math.trunc(start.xMm / 1_000);
      const cy = Math.trunc(start.yMm / 1_000);
      expect(isInsideG1Window(cx, cy), `${start.id} is outside the window`).toBe(true);
      expect(island.traversal[cy * 800 + cx], `${start.id} is not on ground`).toBe(TRAVERSAL.Ground);
    }
    expect(new Set(scene.starts.map((s) => `${s.xMm},${s.yMm}`)).size).toBe(G1_SCENE.contestants);
  });

  it("keeps every start within 45 s of food and 90 s of a camp, by real routes", () => {
    for (const [i, seconds] of foodSeconds.entries()) {
      expect(seconds, `${scene.starts[i]?.id} cannot reach food`).not.toBeNull();
      expect(seconds ?? 1e9).toBeLessThanOrEqual(G1_SCENE.foodWithinSeconds);
    }
    for (const [i, seconds] of campSeconds.entries()) {
      expect(seconds, `${scene.starts[i]?.id} cannot reach a camp`).not.toBeNull();
      expect(seconds ?? 1e9).toBeLessThanOrEqual(G1_SCENE.campWithinSeconds);
    }
  });

  it("derives socket positions from the compiled world, so a map change moves them", () => {
    // Same seed, same sockets. A different seed reshapes the island, and the
    // scene's sockets follow rather than sitting where they were written down.
    const other = compileTerrain({ recipeId: "valley-shipping", seed: 4108 as Int, template: "valley", sockets: [] });
    const otherScene = buildG1Scene(other);
    expect(otherScene.starts).toHaveLength(G1_SCENE.contestants);
    for (const start of otherScene.starts) {
      const cx = Math.trunc(start.xMm / 1_000);
      const cy = Math.trunc(start.yMm / 1_000);
      expect(other.traversal[cy * 800 + cx], `${start.id} is not on ground for seed 4108`).toBe(TRAVERSAL.Ground);
    }
  });

  it("fails loudly when a rule stops holding", () => {
    const brokenTimes = { foodSeconds: foodSeconds.map(() => 120), campSeconds };
    const validation = validateG1Scene(island, scene, brokenTimes);
    expect(validation.ok).toBe(false);
    expect(validation.findings.find((f) => f.rule.includes("45 s"))?.ok).toBe(false);
  });
});
