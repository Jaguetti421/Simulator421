import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { compileTerrain, TRAVERSAL } from "./terrain.js";
import type { CompiledTerrain } from "./terrain.js";
import { ACTOR_RADIUS_MM, movementAt, movementDigest, movementRate, stepMovement, SWEEP_STEP_MM } from "./movement.js";
import { advance } from "../primitives/index.js";
import { RATE_STATE_ZERO } from "../primitives/index.js";

/**
 * P1-05. The three criteria are all about what must not happen, so every test
 * here constructs the situation that would produce the failure and requires the
 * movement to refuse it.
 */
const world: CompiledTerrain = compileTerrain({
  recipeId: "movement-test",
  seed: 4107 as Int,
  template: "ridge",
  sockets: [{ id: "block", kind: "Obstacle", xMm: 420_000 as Int, yMm: 300_500 as Int, radiusMm: 2_500 as Int }],
});

const P = (xMm: number, yMm: number): { xMm: Int; yMm: Int } => ({ xMm: xMm as Int, yMm: yMm as Int });

describe("no teleport (criterion 1)", () => {
  it("never moves further in a tick than the rate released", () => {
    let state = movementAt(400_500 as Int, 300_500 as Int);
    for (let tick = 0; tick < 30; tick += 1) {
      const before = { x: state.xMm as number, y: state.yMm as number };
      const result = stepMovement(world, state, P(418_000, 300_500));
      state = result.state;
      const travelled = Math.hypot((state.xMm as number) - before.x, (state.yMm as number) - before.y);
      expect(travelled, `tick ${tick} moved ${travelled} mm on a ${result.budgetMm} mm budget`).toBeLessThanOrEqual(result.budgetMm + 1);
    }
  });

  it("stops short of a blocked cell instead of appearing beyond it", () => {
    let state = movementAt(400_500 as Int, 300_500 as Int);
    let blocked: ReturnType<typeof stepMovement>["blocked"];
    for (let tick = 0; tick < 200 && blocked === undefined; tick += 1) {
      const result = stepMovement(world, state, P(440_000, 300_500));
      state = result.state;
      blocked = result.blocked;
    }
    expect(blocked, "the sweep never met the obstacle").toBeDefined();
    expect(blocked?.reason).toBe("Obstacle");
    // The actor is on the near side, not past it.
    expect(state.xMm).toBeLessThan(420_000);
    expect(world.traversal[300 * 800 + Math.trunc((state.xMm as number) / 1_000)]).not.toBe(TRAVERSAL.Obstacle);
  });
});

describe("no corner cutting (criterion 1)", () => {
  it("refuses a diagonal step between two blocked cells", () => {
    // Two obstacles meeting at a corner: the diagonal gap between them is not a door.
    const corner = compileTerrain({
      recipeId: "corner-test",
      seed: 4107 as Int,
      template: "ridge",
      sockets: [
        { id: "a", kind: "Obstacle", xMm: 301_500 as Int, yMm: 300_500 as Int, radiusMm: 700 as Int },
        { id: "b", kind: "Obstacle", xMm: 300_500 as Int, yMm: 301_500 as Int, radiusMm: 700 as Int },
      ],
    });
    expect(corner.traversal[300 * 800 + 301]).toBe(TRAVERSAL.Obstacle);
    expect(corner.traversal[301 * 800 + 300]).toBe(TRAVERSAL.Obstacle);

    let state = movementAt(300_500 as Int, 300_500 as Int);
    let reason: string | undefined;
    for (let tick = 0; tick < 20 && reason === undefined; tick += 1) {
      const result = stepMovement(corner, state, P(301_500, 301_500));
      state = result.state;
      reason = result.blocked?.reason;
    }
    expect(reason).toBe("CornerCut");
    // It did not end up in the cell beyond the corner.
    expect(Math.trunc((state.xMm as number) / 1_000) === 301 && Math.trunc((state.yMm as number) / 1_000) === 301).toBe(false);
  });
});

describe("no tunnelling (criterion 1)", () => {
  it("cannot skip a one-metre obstacle however fast the actor moves", () => {
    for (const speed of [3_500, 20_000, 120_000]) {
      let state = movementAt(400_500 as Int, 300_500 as Int);
      let passedThrough = false;
      for (let tick = 0; tick < 60; tick += 1) {
        const result = stepMovement(world, state, P(440_000, 300_500), { baseMmPerSecond: speed as Int });
        state = result.state;
        if ((state.xMm as number) > 422_000) passedThrough = true;
      }
      expect(passedThrough, `an actor at ${speed} mm/s tunnelled through the obstacle`).toBe(false);
    }
  });

  it("sweeps in sub-steps no larger than a quarter cell", () => {
    expect(SWEEP_STEP_MM).toBe(250);
    expect(SWEEP_STEP_MM).toBeLessThan(1_000);
    expect(ACTOR_RADIUS_MM).toBe(300);
  });
});

describe("saved remainders (criterion 2)", () => {
  it("accumulates a fractional millimetre-per-tick rate instead of rounding it away", () => {
    // 3.5 m/s × 0.8 shallow × 0.93 carried = 260.4 mm per tick at 10 Hz.
    const carried = movementRate(3_500 as Int, 800 as Int, 930 as Int);
    let rateState = RATE_STATE_ZERO;
    let total = 0;
    for (let tick = 0; tick < 10; tick += 1) {
      const step = advance(carried, rateState, 1 as never);
      rateState = step.state;
      total += step.delta as number;
    }
    // Rounding each tick down would lose 4 mm over ten ticks; the remainder keeps it.
    expect(total).toBe(2_604);
    expect(10 * Math.floor(260.4)).toBe(2_600);
  });

  it("carries the remainder across ticks in a real movement run", () => {
    let state = movementAt(400_500 as Int, 400_500 as Int);
    let travelled = 0;
    for (let tick = 0; tick < 10; tick += 1) {
      const result = stepMovement(world, state, P(500_000, 400_500), { carryMultiplierMilli: 930 as Int });
      state = result.state;
      travelled += result.movedMm;
    }
    expect(travelled).toBe(3_255); // ground: 3,500 × 0.93 ÷ 10 = 325.5 mm per tick, exact over ten
    expect(state.distance.remainder).toBe(0);
  });

  it("applies the terrain multiplier from the cell the actor is standing in", () => {
    const groundRate = movementRate(3_500 as Int, 1_000 as Int, 1_000 as Int);
    const shallowRate = movementRate(3_500 as Int, 800 as Int, 1_000 as Int);
    expect(advance(groundRate, RATE_STATE_ZERO, 1 as never).delta).toBe(350);
    expect(advance(shallowRate, RATE_STATE_ZERO, 1 as never).delta).toBe(280);
  });
});

describe("movement is deterministic", () => {
  it("gives the same digest for the same inputs, twice", () => {
    const run = (): string => {
      let state = movementAt(400_500 as Int, 300_500 as Int);
      const states = [state];
      for (let tick = 0; tick < 50; tick += 1) {
        state = stepMovement(world, state, P(418_000, 302_500), { carryMultiplierMilli: 870 as Int }).state;
        states.push(state);
      }
      return movementDigest(states);
    };
    expect(run()).toBe(run());
  });

  it("changes the digest when the carry multiplier changes, so the digest is not blind", () => {
    const run = (carry: number): string => {
      let state = movementAt(400_500 as Int, 300_500 as Int);
      const states = [state];
      for (let tick = 0; tick < 20; tick += 1) {
        state = stepMovement(world, state, P(418_000, 302_500), { carryMultiplierMilli: carry as Int }).state;
        states.push(state);
      }
      return movementDigest(states);
    };
    expect(run(1_000)).not.toBe(run(870));
  });
});
