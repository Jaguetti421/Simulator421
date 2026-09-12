import { describe, expect, it } from "vitest";
import { contracts } from "@lastclan/sim";
import type { Fixture } from "./envelope.js";
import { PROFILE_CONTESTANT_COUNTS, validateSemantics } from "./semantics.js";

const knownReasonIds = new Set(contracts.MANDATORY_V0_REASON_IDS);

/** Semantics runs on an already-structurally-valid object; building one directly
 *  covers the path a future generator or editor would take. */
function fixture(over: Partial<Record<string, unknown>> = {}): Fixture {
  return {
    schemaVersion: 1,
    id: "SEM-BASE",
    gate: "G0",
    evidenceStatus: "SCHEMA_EXAMPLE_UNEXECUTED",
    profile: { kind: "Fixture", definitions: "Prototype8", contestantCount: 1, writeCareer: false },
    map: { recipeId: "bootstrap-flat", seed: 1 },
    setup: {
      actors: [{ id: "C001", positionMm: [0, 0, 0], vitalsMilli: { health: 1, fullness: 1, fatigue: 0, exposure: 0, stamina: 1 }, inventory: {} }],
      precommittedLaws: [],
    },
    schedule: [],
    maxTicks: 1200,
    assertions: [{ kind: "EventCountGte", match: { type: "TickCompleted" }, minimum: 1 }],
    ...over,
  } as unknown as Fixture;
}

describe("validateSemantics as a standalone stage", () => {
  it("passes a clean fixture and reports no skipped checks when nothing needs a catalog", () => {
    const report = validateSemantics(fixture(), { knownReasonIds });
    expect(report.errors).toEqual([]);
    expect(report.skipped).toEqual([]);
  });

  it("refuses writeCareer true even when the caller bypassed the envelope", () => {
    const f = fixture({ profile: { kind: "Fixture", definitions: "Prototype8", contestantCount: 1, writeCareer: true } });
    const report = validateSemantics(f, { knownReasonIds });
    expect(report.errors.map((e) => e.code)).toContain("CareerWriteForbidden");
  });

  it("records a skipped content check whenever a fixture names items, goals or overrides", () => {
    const f = fixture({
      setup: {
        actors: [
          {
            id: "C001",
            positionMm: [0, 0, 0],
            vitalsMilli: { health: 1, fullness: 1, fatigue: 0, exposure: 0, stamina: 1 },
            inventory: { berries: 2 },
            initialGoal: "goal.wait",
          },
        ],
        precommittedLaws: [],
      },
    });
    const report = validateSemantics(f, { knownReasonIds });
    expect(report.errors).toEqual([]);
    expect(report.skipped.map((s) => s.code)).toEqual(["ContentCatalogUnavailable"]);
    expect(report.skipped[0]?.availableFrom).toContain("content packets");
  });

  it("checks those IDs for real once a catalog is supplied", () => {
    const f = fixture({
      setup: {
        actors: [
          {
            id: "C001",
            positionMm: [0, 0, 0],
            vitalsMilli: { health: 1, fullness: 1, fatigue: 0, exposure: 0, stamina: 1 },
            inventory: { berries: 2, moonrocks: 1 },
            initialGoal: "goal.invent",
          },
        ],
        precommittedLaws: [],
      },
    });
    const catalog = { itemIds: new Set(["berries"]), goalIds: new Set(["goal.wait"]), profileOverrideIds: new Set<string>() };
    const report = validateSemantics(f, { knownReasonIds, catalog });
    expect(report.skipped).toEqual([]);
    expect(report.errors.map((e) => e.path)).toEqual(["/setup/actors/0/inventory/moonrocks", "/setup/actors/0/initialGoal"]);
  });

  it("knows the profile roster sizes from Addendum D07", () => {
    expect(PROFILE_CONTESTANT_COUNTS).toEqual({ Fixture: null, Prototype8: 8, Trial24: 24, Standard100: 100 });
  });

  it("does not invent a rule that a law must start before maxTicks", () => {
    // LAW-NOTICE-REJECTION schedules a law at tick 101 with maxTicks 100 and
    // expects the command to be rejected; the law never taking effect is the point.
    const f = fixture({
      maxTicks: 100,
      schedule: [
        {
          atTick: 1,
          sequence: 1,
          expectedRulesVersion: 0,
          operation: "ScheduleLaw",
          payload: { lawId: "Truce", startTick: 101, endTick: 1301 },
          expectAck: "Rejected",
          expectedReasonId: "NoticeTooShort",
        },
      ],
    });
    expect(validateSemantics(f, { knownReasonIds }).errors).toEqual([]);
  });
});
