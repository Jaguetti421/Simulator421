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
const NEW_RECORDS = ["ActionResources", "ActionExecution", "ActionInterruption", "ActionCompletion", "ActionFailure", "StateSectionSet", "AppearanceRecipe"] as const;

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
  it("registers seven new records, taking the contract surface from 16 to 23", () => {
    expect(Object.keys(contracts.LIFECYCLE_RECORDS)).toEqual([...NEW_RECORDS]);
    expect(Object.keys(contracts.CONTRACT_RECORDS)).toHaveLength(23);
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
