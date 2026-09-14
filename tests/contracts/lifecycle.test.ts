import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contracts } from "@lastclan/sim";

/**
 * Golden samples for the P1-01 records (TP v1.1 §8's action table, the complete
 * state-section set, and AppearanceRecipe).
 *
 * Each record has a valid sample and at least one reject sample naming the rule
 * it violates — so a refinement that stops working fails here rather than being
 * discovered by a fixture months later. The sample files are the artifact a
 * contract change diffs against.
 */
const samplesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "contracts", "samples");
const NEW_RECORDS = ["ActionInstance", "ActionResources", "ActionExecution", "ActionInterruption", "ActionCompletion", "ActionFailure", "StateSectionSet", "AppearanceRecipe"] as const;

interface ManifestEntry {
  file: string;
  record: string;
  expect: "accept" | "reject";
  rule?: string;
}

const manifest = (JSON.parse(readFileSync(join(samplesDir, "index.json"), "utf8")) as { samples: ManifestEntry[] }).samples;

function samplesFor(record: string, expectation: "accept" | "reject"): { entry: ManifestEntry; value: unknown }[] {
  return manifest
    .filter((e) => e.record === record && e.expect === expectation)
    .map((entry) => ({ entry, value: JSON.parse(readFileSync(join(samplesDir, entry.file), "utf8")) as unknown }));
}

describe("P1-01 lifecycle records", () => {
  it("registers eight new records, taking the contract surface from 16 to 24", () => {
    expect(Object.keys(contracts.LIFECYCLE_RECORDS)).toEqual([...NEW_RECORDS]);
    expect(Object.keys(contracts.CONTRACT_RECORDS)).toHaveLength(24);
  });

  it.each(NEW_RECORDS)("%s has a valid golden sample that round-trips through the canonical codec", (record) => {
    const valid = samplesFor(record, "accept");
    expect(valid.length, `${record} has no valid sample`).toBeGreaterThan(0);
    for (const { value } of valid) {
      const shape = contracts.CONTRACT_RECORDS[record] as never;
      const parsed = contracts.parse(shape, value, record);
      const text = contracts.encodeJson(shape, parsed, record);
      expect(contracts.decodeJson(shape, text, record)).toEqual(parsed);
    }
  });

  it.each(NEW_RECORDS)("%s has a reject sample that names the rule it breaks", (record) => {
    const rejects = samplesFor(record, "reject");
    expect(rejects.length, `${record} has no reject sample`).toBeGreaterThan(0);
    for (const { entry, value } of rejects) {
      const result = contracts.validate(contracts.CONTRACT_RECORDS[record] as never, value);
      expect(result.ok, `${record}: ${entry.rule ?? entry.file} was accepted`).toBe(false);
    }
  });

  it("completes TP v1.1 §8: resources, execution, interruption, completion and failure all have a record", () => {
    const fields = (name: string): string[] => Object.keys((contracts.toJsonSchema(contracts.CONTRACT_RECORDS[name] as never, name) as { properties?: Record<string, unknown> }).properties ?? {});
    expect(fields("ActionResources")).toEqual(expect.arrayContaining(["inputs", "outputCapacity", "ownershipPolicy", "reservations"]));
    expect(fields("ActionExecution")).toEqual(expect.arrayContaining(["durationTicks", "workPositionMm", "milestones", "animationCue", "soundCue"]));
    expect(fields("ActionInterruption")).toEqual(expect.arrayContaining(["consumedInputs", "unconsumedInputs", "retainedProgressMilli", "releasedReservations", "cooldownTicks"]));
    expect(fields("ActionCompletion")).toEqual(expect.arrayContaining(["outputs", "outputEntityId", "knowledgeEffects", "committedEventTypes"]));
    expect(fields("ActionFailure")).toEqual(expect.arrayContaining(["reasonId", "intentTemplateId", "recoveryMethods", "retryable"]));
  });

  it("keeps text out of the contract: failures carry a template ID, never a display string", () => {
    const schema = contracts.toJsonSchema(contracts.CONTRACT_RECORDS["ActionFailure"] as never, "ActionFailure") as { properties: Record<string, { pattern?: string }> };
    expect(schema.properties["intentTemplateId"]?.pattern).toBe(contracts.DURABLE_ID_PATTERN);
  });

  it("StateSectionSet refuses a save that omits a required section", () => {
    const result = contracts.validate(contracts.CONTRACT_RECORDS["StateSectionSet"] as never, {
      schemaVersion: 0, containerVersion: 1, sections: { world: 1 }, requiredSections: ["world", "random"],
      authoritativeHash: "4d0bd28a", capturedAtTick: 600, journalSequence: 7,
    });
    expect(result.ok).toBe(false);
  });

  it("AppearanceRecipe selects from the GDD 14.1 families and carries no stats", () => {
    const schema = contracts.toJsonSchema(contracts.CONTRACT_RECORDS["AppearanceRecipe"] as never, "AppearanceRecipe") as { properties: Record<string, { enum?: string[] }> };
    expect(schema.properties["build"]?.enum).toHaveLength(3);
    expect(schema.properties["head"]?.enum).toHaveLength(4);
    expect(schema.properties["headwear"]?.enum).toHaveLength(10);
    expect(schema.properties["accessory"]?.enum).toHaveLength(6);
    expect(Object.keys(schema.properties)).not.toEqual(expect.arrayContaining(["skills", "traits", "stats"]));
  });
});

/**
 * Refinement liveness (REVIEW-EXTERNAL-01, P1-01 Medium).
 *
 * Two refinements in this packet could never fail: one ended in `length >= 0`,
 * the other returned `true`. Both read as checks and were not. This test makes
 * that class of defect impossible to ship again: **every refinement on every
 * record must reject at least one value.** A refinement nothing can violate is
 * decoration, and decoration in a contract is worse than an absent rule, because
 * a reader trusts it.
 */
describe("every refinement is live", () => {
  /**
   * A refinement that can never fail is decoration, and decoration in a contract
   * is worse than an absent rule because a reader trusts it. Liveness is checked
   * against **crafted samples**, not against generic junk: for each refinement on
   * a P1-01 record there must be a sample it actually rejects.
   *
   * Only one test guards this, on purpose: a weaker heuristic version (does the
   * refinement accept an empty object and a generic one?) mislabelled live
   * refinements as dead, and a check that cries wolf is worse than no check.
   *
   * Scope, stated rather than implied: this covers the eight records this packet
   * owns. Extending it to the sixteen W0-04 records needs a reject sample per
   * refinement authored for each of them — real work, named as a follow-up
   * rather than skipped silently.
   */
  const refinementsOf = (name: string): { rule: string; check: (v: Record<string, unknown>) => boolean }[] =>
    (contracts.CONTRACT_RECORDS[name] as { node?: { refinements?: { rule: string; check: (v: Record<string, unknown>) => boolean }[] } }).node?.refinements ?? [];

  it.each(NEW_RECORDS)("%s: every refinement rejects at least one crafted sample", (record) => {
    const samples = [...samplesFor(record, "reject"), ...samplesFor(record, "accept")].map(({ value }) => value as Record<string, unknown>);
    expect(samples.length, `${record} has no samples`).toBeGreaterThan(0);
    for (const refinement of refinementsOf(record)) {
      const rejectsOne = samples.some((sample) => {
        try {
          return refinement.check(sample) === false;
        } catch {
          return true;
        }
      });
      expect(rejectsOne, `${record}: "${refinement.rule}" accepts every crafted sample — it may be unable to fail at all`).toBe(true);
    }
  });
});

describe("the in-flight action record", () => {
  it("exists, so a save taken mid-action can restore it", () => {
    expect(Object.keys(contracts.CONTRACT_RECORDS)).toContain("ActionInstance");
    const fields = Object.keys((contracts.toJsonSchema(contracts.CONTRACT_RECORDS["ActionInstance"] as never, "ActionInstance") as { properties?: Record<string, unknown> }).properties ?? {});
    expect(fields).toEqual(expect.arrayContaining(["instanceId", "progressMilli", "state", "consumedInputs", "heldReservations", "revalidateEveryTicks"]));
  });

  it("refuses an interrupted action that still holds reservations", () => {
    const base = { schemaVersion: 0, instanceId: "act.craft.1", actorId: "C003", planId: "plan.craft", actionDefId: "action.craft", startedAtTick: 10, progressMilli: 40_000, state: "Interrupted", consumedInputs: {}, heldReservations: ["station.workbench.01"], revalidateEveryTicks: 10 };
    expect(contracts.validate(contracts.CONTRACT_RECORDS["ActionInstance"] as never, base).ok).toBe(false);
    expect(contracts.validate(contracts.CONTRACT_RECORDS["ActionInstance"] as never, { ...base, heldReservations: [] }).ok).toBe(true);
  });
});
