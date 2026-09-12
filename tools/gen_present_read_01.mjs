/** Generates tests/fixtures/PRESENT-READ-01.json — the readability scene (W0-09). */
import { writeFileSync } from "node:fs";
import { core } from "../packages/sim/dist/index.js";

const TICKS = 600;
const world = core.createWorld({ matchSeed: 4107, withGuest: true });
const fixture = {
  schemaVersion: 1,
  id: "PRESENT-READ-01",
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
  assertions: [{ kind: "EventCountEq", match: { type: "tick.committed" }, count: TICKS }],
  notes:
    "Readability scene for `clanlab render` (W0-09). The readability checks — nameplate overlap ratio, ring contrast, action-icon distinctness — are NOT expressible in fixture DSL v1: its assertion kinds are EventCount*, Invariant (four registered names, none of them about presentation) and HashEqualVariant. They are executed instead by `clanlab render`, which exits 1 when any of them fails, and by packages/lab/render/render.test.ts. Adding a readability assertion kind to the DSL is a named gap for a later lab packet; until then this fixture carries only what the DSL can honestly express, and the render summary is where the readability verdict lives.",
};
writeFileSync("tests/fixtures/PRESENT-READ-01.json", `${JSON.stringify(fixture, null, 1)}\n`);
console.log(`wrote tests/fixtures/PRESENT-READ-01.json — ${fixture.setup.actors.length} actors`);
