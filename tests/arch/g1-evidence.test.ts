import { describe, expect, it } from "vitest";
import { core, host } from "../../packages/sim/dist/index.js";

/**
 * P1-34: the claims the G1 evidence pass makes, asserted as tests.
 *
 * The generator writes a report; this is what keeps the report honest — every
 * line it prints corresponds to something checked here, so the evidence cannot
 * drift from the build while still looking plausible.
 */
const SEED = 4107;
const TERRAIN = host.ComposedHost.create({ seed: SEED as never }).terrain;
const make = (): ReturnType<typeof host.ComposedHost.create> => host.ComposedHost.create({ seed: SEED as never, terrain: TERRAIN });

describe("eight contestants complete meaningful tasks with traceable reasons (criterion 1)", () => {
  const run = make();
  const before = run.summary().fullness;
  const completions: string[] = [];
  for (let tick = 0; tick < 1_200; tick += 1) {
    run.advance();
    for (const actor of run.actors) {
      if (actor.lastStatus?.kind === "Completed") completions.push(`${actor.agent.actorId}:${actor.lastStatus.goalId}`);
    }
  }

  it("completes real goals, not idle cycles", () => {
    expect(completions.length).toBeGreaterThan(0);
    expect(new Set(completions.map((c) => c.split(":")[1]))).toContain("goal.eat");
  });

  it("leaves actors fuller than they started", () => {
    const after = run.summary().fullness;
    expect(after.some((value, index) => value > (before[index] as number))).toBe(true);
  });

  it("keeps everyone alive across two minutes of match time", () => {
    expect(run.summary().living).toBe(8);
  });

  it("produces a decision trace a reviewer can follow", () => {
    const decision = core.decide(
      {
        actorId: "C001",
        traits: ["industrious"],
        evidence: [{ factId: 1, ageTicks: 20 }],
        candidates: [
          { candidateId: "goal.eat", considerations: [{ id: "hunger", inputMilli: 700, weightMilli: 1_000 }] },
          { candidateId: "goal.rest", considerations: [{ id: "fatigue", inputMilli: 200, weightMilli: 1_000 }] },
        ],
      },
      100 as never,
    );
    expect(decision.chosenCandidateId).toBe("goal.eat");
    const scored = decision.trace.candidates.find((c) => c.candidateId === "goal.eat");
    expect(scored?.scoreMilli).toBe(scored?.considerations.reduce((sum, c) => sum + c.contributionMilli, 0));
  });
});

describe("all G1-mapped scenes execute, and omissions are listed (criterion 2)", () => {
  it("runs every mapped scene", () => {
    expect(TERRAIN.manifest.island?.ok).toBe(true);
    const scene = make();
    expect(scene.knowledge.food.length).toBeGreaterThan(0);
    expect(scene.knowledge.restSockets.length).toBeGreaterThan(0);
    expect(make().runTicks(5_200).isNight).toBe(true);
    expect(host.replayDivergence(SEED as never, 120, 600, TERRAIN)).toBeNull();
  }, 180_000);

  it("enforces a law installed at composition", () => {
    const lawful = host.ComposedHost.create({
      seed: SEED as never,
      terrain: TERRAIN,
      laws: [{ lawId: "law.truce", version: 1 as never, permission: "SentientHarm", activationTick: 0 as never, endTick: 10_000 as never, scope: {}, reasonId: "WaitingForLaw" }],
    });
    lawful.runTicks(20);
    expect(lawful.permissions.check({ permission: "SentientHarm", tick: 10 as never, actorPositionMm: [400_000 as never, 400_000 as never] }).verdict).toBe("Denied");
  });

  it("does not claim behaviour it has not exercised", () => {
    // Building and combat are composed but unchosen: no goal in the library
    // selects them, and the evidence says so rather than implying coverage.
    const run = make();
    run.runTicks(600);
    const goals = run.actors.map((a) => a.agent.plan?.goalId).filter((g) => g !== undefined);
    for (const goal of goals) expect(["goal.eat", "goal.rest", "goal.explore"]).toContain(goal);
  });
});

describe("synthetic counters and real evidence stay separate (criterion 3)", () => {
  it("keeps the synthetic workload's omissions attached to the synthetic workload", () => {
    expect(core.WORKLOAD_OMISSIONS.length).toBeGreaterThan(0);
    expect(make().omissions).toEqual([]);
    expect(make().simulated).toBe(false);
  });

  it("measures the two populations separately and does not mix them", () => {
    const synthetic = host.SimHost.create({ matchSeed: SEED as never, withGuest: true });
    synthetic.runTicks(600);
    expect(synthetic.actorCount).toBe(137);
    expect(make().actors).toHaveLength(8);
    // Two different workloads over two different populations: a reviewer must
    // not read one as evidence about the other.
    expect(synthetic.actorCount).not.toBe(make().actors.length);
  });

  it("does not present any rendering measurement as produced", () => {
    // Nothing in the composed host measures a frame; GPU timing is HUMAN_REQUIRED.
    const surface = Object.keys(make());
    for (const forbidden of ["fps", "frameMs", "renderMs", "gpu"]) expect(surface).not.toContain(forbidden);
  });
});
