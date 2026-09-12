/**
 * Conformance: the typed fixture envelope in `packages/lab/fixture/envelope.ts`
 * against the supplied authority `contracts/fixture.schema.json` (W0-05).
 *
 * The envelope is a re-declaration, so it could drift from the schema it
 * mirrors. Every case below is run through both ajv (the supplied schema) and
 * the fixture parser, and the two must agree on the **structural** verdict.
 *
 * Semantic rules (notice, duplicates, profile rosters, fact provenance) are
 * expected to be caught by the parser alone — and the test asserts that ajv
 * *accepts* those cases, so a semantic rule can never quietly claim to be
 * schema-enforced.
 */
import { Ajv2020 } from "ajv/dist/2020.js";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseFixtureValue } from "../../packages/lab/dist/fixture/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const suppliedSchema = JSON.parse(readFileSync(path.join(repoRoot, "contracts", "fixture.schema.json"), "utf8")) as object;
const validateBySchema = new Ajv2020({ strict: false, allErrors: true }).compile(suppliedSchema);
const exampleDir = path.join(repoRoot, "tests", "fixtures", "examples");
const readExample = (file: string): Record<string, unknown> => JSON.parse(readFileSync(path.join(exampleDir, file), "utf8")) as Record<string, unknown>;

const STRUCTURAL_CODES = ["StructureInvalid", "UnknownSchemaVersion", "UnsupportedAssertion", "InputTooLarge", "MalformedJson"];

function verdict(doc: unknown): { schema: boolean; parser: boolean; codes: string[] } {
  const result = parseFixtureValue(doc);
  return { schema: validateBySchema(doc) === true, parser: result.ok, codes: result.ok ? [] : result.errors.map((e) => e.code) };
}

describe("the checked-in examples are the ones the kit supplied", () => {
  it("tests/fixtures/examples matches contracts/examples byte for byte", () => {
    const supplied = readdirSync(path.join(repoRoot, "contracts", "examples")).sort();
    expect(readdirSync(exampleDir).sort()).toEqual(supplied);
    for (const file of supplied) {
      expect(readFileSync(path.join(exampleDir, file), "utf8"), file).toBe(readFileSync(path.join(repoRoot, "contracts", "examples", file), "utf8"));
    }
  });

  it.each(readdirSync(exampleDir))("%s is accepted by both the supplied schema and the parser", (file) => {
    const v = verdict(readExample(file));
    expect(v.schema, `ajv rejected ${file}: ${JSON.stringify(validateBySchema.errors)}`).toBe(true);
    expect(v.parser, `parser rejected ${file}: ${v.codes.join(", ")}`).toBe(true);
  });
});

describe("structural rejections agree with the supplied schema", () => {
  const base = (): Record<string, unknown> => readExample("SAVE-BOOTSTRAP-01.json");

  it.each([
    ["unknown schema version", (f: Record<string, unknown>) => { f["schemaVersion"] = 2; }],
    ["unknown top-level field", (f: Record<string, unknown>) => { f["cheat"] = true; }],
    ["unknown actor field", (f: Record<string, unknown>) => { ((f["setup"] as Record<string, unknown>)["actors"] as Record<string, unknown>[])[0]!["luck"] = 1; }],
    ["malformed actor ID", (f: Record<string, unknown>) => { ((f["setup"] as Record<string, unknown>)["actors"] as Record<string, unknown>[])[0]!["id"] = "CC01"; }],
    ["vitals out of range", (f: Record<string, unknown>) => { ((f["setup"] as Record<string, unknown>)["actors"] as Record<string, Record<string, unknown>>[])[0]!["vitalsMilli"] = { health: 200000, fullness: 1, fatigue: 1, exposure: 1, stamina: 1 }; }],
    ["negative inventory count", (f: Record<string, unknown>) => { ((f["setup"] as Record<string, unknown>)["actors"] as Record<string, Record<string, unknown>>[])[0]!["inventory"] = { berries: -1 }; }],
    ["writeCareer true", (f: Record<string, unknown>) => { (f["profile"] as Record<string, unknown>)["writeCareer"] = true; }],
    ["unknown assertion kind", (f: Record<string, unknown>) => { f["assertions"] = [{ kind: "AllMatchingEventsAreValid", match: { type: "X" } }]; }],
    ["EventCountGte minimum 0", (f: Record<string, unknown>) => { f["assertions"] = [{ kind: "EventCountGte", match: { type: "X" }, minimum: 0 }]; }],
    ["maxTicks beyond the limit", (f: Record<string, unknown>) => { f["maxTicks"] = 400000; }],
    ["missing required section", (f: Record<string, unknown>) => { delete f["map"]; }],
    ["scheduled command at tick 0 (the supplied schema pins atTick >= 1, so this is structural after all)", (f: Record<string, unknown>) => {
      f["schedule"] = [{ atTick: 0, sequence: 1, expectedRulesVersion: 0, operation: "ScheduleLaw", payload: { lawId: "Truce", startTick: 900, endTick: 1200 }, expectAck: "Accepted" }];
    }],
  ])("%s is rejected by both", (_label, mutate) => {
    const doc = base();
    mutate(doc);
    const v = verdict(doc);
    expect(v.parser, "the parser accepted it").toBe(false);
    expect(v.schema, `the supplied schema accepted it: ${JSON.stringify(v.codes)}`).toBe(false);
    expect(STRUCTURAL_CODES).toEqual(expect.arrayContaining([v.codes[0] as string]));
  });
});

describe("semantic rejections are genuinely beyond JSON Schema", () => {
  const base = (): Record<string, unknown> => readExample("SAVE-BOOTSTRAP-01.json");

  it.each([
    ["short notice with expected acceptance", (f: Record<string, unknown>) => {
      f["schedule"] = [{ atTick: 1, sequence: 1, expectedRulesVersion: 0, operation: "ScheduleLaw", payload: { lawId: "Truce", startTick: 100, endTick: 1200 }, expectAck: "Accepted" }];
    }],
    ["rejection without an expected reason", (f: Record<string, unknown>) => {
      f["schedule"] = [{ atTick: 1, sequence: 1, expectedRulesVersion: 0, operation: "ScheduleLaw", payload: { lawId: "Truce", startTick: 900, endTick: 1200 }, expectAck: "Rejected" }];
    }],
    ["profile roster mismatch", (f: Record<string, unknown>) => { (f["profile"] as Record<string, unknown>)["contestantCount"] = 5; }],
    ["law interval inverted", (f: Record<string, unknown>) => { (f["setup"] as Record<string, unknown>)["precommittedLaws"] = [{ lawId: "Truce", startTick: 500, endTick: 100 }]; }],
    ["region law missing its radius", (f: Record<string, unknown>) => { (f["setup"] as Record<string, unknown>)["precommittedLaws"] = [{ lawId: "Sanctuary", startTick: 10, endTick: 100, centerMm: [0, 0] }]; }],
    ["hash variant beyond maxTicks", (f: Record<string, unknown>) => { f["assertions"] = [{ kind: "HashEqualVariant", variant: "SaveReload", startTick: 1, advanceTicks: 999999 }]; }],
  ])("%s: the parser refuses it and the supplied schema cannot", (_label, mutate) => {
    const doc = base();
    mutate(doc);
    const v = verdict(doc);
    expect(v.parser, "the parser accepted it").toBe(false);
    expect(v.schema, "JSON Schema also caught it — this rule is not semantic-only, and the claim should be corrected").toBe(true);
    for (const code of v.codes) expect(STRUCTURAL_CODES).not.toContain(code);
  });
});
