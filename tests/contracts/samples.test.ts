/**
 * Golden sample sweep (W0-04 acceptance 1).
 *
 * Walks contracts/samples/index.json and, for every listed file:
 *   - validates it against the **emitted JSON Schema** with an independent
 *     validator (ajv, draft 2020-12) — this checks the schema we ship, not our
 *     own validator's opinion of it;
 *   - validates it against the contract validator, which additionally enforces
 *     the cross-field refinements JSON Schema cannot express;
 *   - for accepted samples, decodes and re-encodes it and requires the bytes on
 *     disk to be exactly the canonical form.
 *
 * A sample the manifest says must be rejected has to be rejected by the layer
 * the manifest names. That distinction is deliberate: `enforcedBy: "schema"`
 * claims something ajv alone catches; `enforcedBy: "refinement"` does not.
 */
import { Ajv2020 } from "ajv/dist/2020.js";
import { contracts } from "@lastclan/sim";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const sampleDir = path.join(repoRoot, "contracts", "samples");
const schemaDir = path.join(repoRoot, "packages", "sim", "contracts", "schemas");

interface SampleEntry {
  file: string;
  record: string;
  expect: "accept" | "reject";
  enforcedBy?: "schema" | "refinement";
  note?: string;
}
const manifest = JSON.parse(readFileSync(path.join(sampleDir, "index.json"), "utf8")) as { contractVersion: number; samples: SampleEntry[] };

const ajv = new Ajv2020({ strict: false, allErrors: true });
const compiled = new Map<string, ReturnType<typeof ajv.compile>>();
function schemaFor(record: string): ReturnType<typeof ajv.compile> {
  const existing = compiled.get(record);
  if (existing !== undefined) return existing;
  const schema = JSON.parse(readFileSync(path.join(schemaDir, `${record}.schema.json`), "utf8")) as object;
  const fn = ajv.compile(schema);
  compiled.set(record, fn);
  return fn;
}
const readSample = (file: string): { text: string; value: unknown } => {
  const text = readFileSync(path.join(sampleDir, file), "utf8");
  return { text, value: JSON.parse(text) as unknown };
};

describe("the sample manifest covers exactly what is on disk", () => {
  it("no unlisted sample files and no missing ones", () => {
    const onDisk = readdirSync(sampleDir).filter((f) => f !== "index.json").sort();
    expect(manifest.samples.map((s) => s.file).sort()).toEqual(onDisk);
  });

  it("every record in the contract map has an emitted schema, and every schema a record", () => {
    const schemas = readdirSync(schemaDir).map((f) => f.replace(/\.schema\.json$/, "")).sort();
    expect(schemas).toEqual(Object.keys(contracts.CONTRACT_RECORDS).sort());
  });

  it("covers the records INTERFACES.md requires samples for: command, ack, event, trace, snapshot, result", () => {
    const accepted = new Set(manifest.samples.filter((s) => s.expect === "accept").map((s) => s.record));
    for (const required of ["PlayerCommand", "CommandAck", "CommittedEvent", "DecisionTrace", "RenderSnapshot", "FinalResult"]) {
      expect(accepted.has(required), required).toBe(true);
    }
    expect(manifest.samples.some((s) => s.file.includes("unknown-version"))).toBe(true);
    expect(manifest.samples.filter((s) => s.expect === "reject").length).toBeGreaterThanOrEqual(6);
  });

  it("the emitted schemas match what the current declarations produce (no hand-edited artifact)", () => {
    for (const [name, shape] of Object.entries(contracts.CONTRACT_RECORDS)) {
      const onDisk = readFileSync(path.join(schemaDir, `${name}.schema.json`), "utf8");
      expect(onDisk, name).toBe(`${JSON.stringify(contracts.toJsonSchema(shape, name), null, 1)}\n`);
    }
  });
});

describe("accepted samples validate and are byte-exactly canonical", () => {
  const accepted = manifest.samples.filter((s) => s.expect === "accept");
  it.each(accepted.map((s) => [s.file, s.record] as const))("%s (%s)", (file, record) => {
    const { text, value } = readSample(file);
    const shape = contracts.CONTRACT_RECORDS[record];
    expect(shape, `unknown record ${record}`).toBeDefined();

    const bySchema = schemaFor(record);
    expect(bySchema(value), JSON.stringify(bySchema.errors)).toBe(true);

    const result = contracts.validate(shape as never, value);
    expect(result.ok ? "" : result.errors.map((e) => `${e.path} ${e.message}`).join("; ")).toBe("");

    const decoded = contracts.decodeJson(shape as never, text);
    expect(contracts.encodeJsonPretty(shape as never, decoded)).toBe(text);
  });
});

describe("rejected samples are refused by the layer the manifest names", () => {
  const rejected = manifest.samples.filter((s) => s.expect === "reject");
  it.each(rejected.map((s) => [s.file, s.record, s.enforcedBy ?? "refinement"] as const))("%s (%s, %s)", (file, record, enforcedBy) => {
    const { text, value } = readSample(file);
    const shape = contracts.CONTRACT_RECORDS[record];

    // The contract validator must always refuse it.
    expect(contracts.validate(shape as never, value).ok).toBe(false);
    expect(() => contracts.decodeJson(shape as never, text)).toThrow();

    const bySchema = schemaFor(record);
    const schemaAccepts = bySchema(value);
    if (enforcedBy === "schema") {
      expect(schemaAccepts, `JSON Schema should catch ${file}: ${JSON.stringify(bySchema.errors)}`).toBe(false);
    } else {
      // Honest accounting: JSON Schema cannot express these cross-field rules,
      // which is exactly why the contract validator exists and why the manifest
      // records which layer is responsible.
      expect(schemaAccepts, `${file} is marked refinement-enforced but JSON Schema also rejects it`).toBe(true);
    }
  });
});
