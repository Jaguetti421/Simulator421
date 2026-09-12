/**
 * Generates tests/fixtures/PERF-OPS-BASE.json from the kernel's own initial
 * world, so the fixture and the workload cannot drift apart. Run:
 *   node tools/gen_perf_ops_base.mjs
 */
import { writeFileSync } from "node:fs";
import { core } from "../packages/sim/dist/index.js";

const TICKS = 600;
const world = core.createWorld({ matchSeed: 4107, withGuest: true });

const actors = world.actors.map((a) => ({
  id: a.id,
  positionMm: [a.xMm, a.yMm, 0],
  vitalsMilli: { health: a.healthMilli, fullness: 85000, fatigue: 10000, exposure: 0, stamina: a.staminaMilli },
  inventory: {},
}));

const stageAssertions = core.STAGE_ORDER.map((name, i) => ({
  kind: "EventCountEq",
  match: { type: `stage.${String(i + 1).padStart(2, "0")}.${name}` },
  count: 1,
}));

const fixture = {
  schemaVersion: 1,
  id: "PERF-OPS-BASE",
  gate: "G0",
  evidenceStatus: "IMPLEMENTED_UNVERIFIED",
  profile: { kind: "Standard100", definitions: "Prototype8", contestantCount: 100, writeCareer: false },
  map: { recipeId: "bootstrap-flat", seed: 4107 },
  setup: { actors, precommittedLaws: [] },
  schedule: [],
  maxTicks: TICKS,
  assertions: [
    ...stageAssertions,
    { kind: "EventCountEq", match: { type: "tick.committed" }, count: TICKS },
    { kind: "EventCountGte", match: { type: "law.installed" }, minimum: 1 },
    { kind: "EventCountEq", match: { type: "command.rejected" }, count: 0 },
  ],
  notes:
    "Operation-count and stage-order baseline for the W0-07 synthetic kernel. The ten stage assertions use the ordinal each stage EXECUTED at, so a reordered tick loop fails this fixture. Counts come from a kernel event tape, never from a hand-authored one; the workload is synthetic and certifies no production budget.",
};

writeFileSync("tests/fixtures/PERF-OPS-BASE.json", `${JSON.stringify(fixture, null, 1)}\n`);
console.log(`wrote tests/fixtures/PERF-OPS-BASE.json — ${actors.length} actors, ${fixture.assertions.length} assertions, ${TICKS} ticks`);
