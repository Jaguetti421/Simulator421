import { describe, expect, it } from "vitest";
import { host, persistence, spatial } from "../../packages/sim/dist/index.js";
import { assessReadability, buildScene, iconDistinctness } from "../../packages/lab/dist/render/index.js";

/**
 * P1-05 criterion 3: headless and rendered inputs produce identical movement
 * hashes.
 *
 * The claim is that rendering is not an input to movement. Asserting that from
 * the inside would be circular, so this runs the same movement twice — once
 * headless, once with a scene built and its readability assessed after **every
 * tick** — and requires the digests to match. If rendering ever became an input,
 * this is the test that would catch it.
 */
const SEED = 4107;

function world(): ReturnType<typeof spatial.compileTerrain> {
  return spatial.compileTerrain({
    recipeId: "movement-parity",
    seed: SEED as never,
    template: "ridge",
    sockets: [{ id: "block", kind: "Obstacle", xMm: 420_000 as never, yMm: 300_500 as never, radiusMm: 2_500 as never }],
  });
}

function runMovement(terrain: ReturnType<typeof spatial.compileTerrain>, onTick?: (tick: number) => void): string {
  let state = spatial.movementAt(400_500 as never, 300_500 as never);
  const states = [state];
  for (let tick = 0; tick < 40; tick += 1) {
    state = spatial.stepMovement(terrain, state, { xMm: 418_000 as never, yMm: 302_500 as never }, { carryMultiplierMilli: 870 as never }).state;
    states.push(state);
    onTick?.(tick);
  }
  return spatial.movementDigest(states);
}

describe("headless and rendered movement agree", () => {
  it("produces the same movement digest with rendering interleaved as without", () => {
    const terrain = world();
    const headless = runMovement(terrain);

    const sim = host.SimHost.create({ matchSeed: SEED as never, withGuest: true });
    const rendered = runMovement(terrain, () => {
      // Real render work between movement ticks: a scene is built from a real
      // snapshot and its readability assessed, exactly as `clanlab render` does.
      sim.runTicks(1);
      const scene = buildScene(persistence.decodeWorldSnapshot(sim.save()), { width: 640, height: 360, metresAcross: 180 });
      assessReadability(scene, iconDistinctness());
    });

    expect(rendered).toBe(headless);
    expect(headless).toMatch(/^[0-9a-f]{8}$/u);
  });

  it("agrees across a second compile of the same world, so the terrain is not carrying hidden state", () => {
    expect(runMovement(world())).toBe(runMovement(world()));
  });
});
