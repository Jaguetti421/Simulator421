/**
 * Generates tests/fixtures/SAVE-ROUNDTRIP.json from the kernel's own initial
 * world. The fixture is checked against a tape produced by a run that was
 * SAVED at tick 300, RESTORED and continued to 600 — so its assertions state
 * what a continued run must look like: 300 further tick commits, and no stage
 * markers, because those only commit on tick 1 of a run that actually started.
 */
import { writeFileSync } from "node:fs";
import { core } from "../packages/sim/dist/index.js";

const SAVE_AT = 300;
const TICKS = 600;
const world = core.createWorld({ matchSeed: 4107, withGuest: true });

const fixture = {
  schemaVersion: 1,
  id: "SAVE-ROUNDTRIP",
  gate: "G0",
  evidenceStatus: "IMPLEMENTED_UNVERIFIED",
  profile: { kind: "Standard100", definitions: "Prototype8", contestantCount: 100, writeCareer: false },
  map: { recipeId: "bootstrap-flat", seed: 4107 },
  setup: {
    actors: world.actors.map((a) => ({
      id: a.id,
      positionMm: [a.xMm, a.yMm, 0],
      vitalsMilli: { health: a.healthMilli, fullness: 85000, fatigue: 10000, exposure: 0, stamina: a.staminaMilli },
      inventory: {},
    })),
    precommittedLaws: [],
  },
  schedule: [],
  maxTicks: TICKS,
  assertions: [
    { kind: "EventCountEq", match: { type: "tick.committed" }, count: TICKS - SAVE_AT },
    { kind: "EventCountEq", match: { type: "tick.committed", fromTick: 1, throughTick: SAVE_AT }, count: 0 },
    { kind: "EventCountEq", match: { type: "stage.01.install" }, count: 0 },
    { kind: "EventCountGte", match: { type: "tick.committed", fromTick: SAVE_AT + 1, throughTick: TICKS }, minimum: TICKS - SAVE_AT },
  ],
  notes:
    `Save round trip: the run is saved at tick ${SAVE_AT}, restored from the container and continued to ${TICKS}. The restored run must commit exactly ${TICKS - SAVE_AT} further ticks, none of them at or before ${SAVE_AT}, and no stage markers — a restored run continues, it does not restart. The authoritative digest equality against an uninterrupted run is asserted in packages/sim/host/snapshot.test.ts; this fixture is the event-stream half of the same claim.`,
};

writeFileSync("tests/fixtures/SAVE-ROUNDTRIP.json", `${JSON.stringify(fixture, null, 1)}\n`);
console.log(`wrote tests/fixtures/SAVE-ROUNDTRIP.json — ${fixture.setup.actors.length} actors, ${fixture.assertions.length} assertions`);
