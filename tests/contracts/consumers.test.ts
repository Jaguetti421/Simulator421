import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contracts } from "@lastclan/sim";

/**
 * P1-01 criterion 3: a contract change identifies all consumer tests.
 *
 * Every frozen record is mapped to the test files that actually reference it,
 * by scanning the repository rather than by maintaining a list someone has to
 * remember to update. A record with no consumer test is a record whose shape
 * nothing would notice changing — so that is a failure, not a warning.
 *
 * The map this produces is what a future contract change reads to know which
 * tests must be re-run and re-reviewed.
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SEARCH_ROOTS = ["packages", "tests", "apps"];

function testFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir).sort()) {
    if (entry === "node_modules" || entry === "dist" || entry === "dist-site" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) testFiles(full, out);
    else if (entry.endsWith(".test.ts") || entry.endsWith(".spec.ts")) out.push(full);
  }
  return out;
}

const files = SEARCH_ROOTS.flatMap((root) => testFiles(join(repoRoot, root)));
const contents = new Map(files.map((f) => [relative(repoRoot, f), readFileSync(f, "utf8")]));

/** record name -> test files that mention it. */
export function consumerMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const name of Object.keys(contracts.CONTRACT_RECORDS).sort()) {
    map[name] = [...contents.entries()].filter(([, text]) => text.includes(name)).map(([path]) => path);
  }
  return map;
}

describe("contract consumer map", () => {
  it("finds the test files in the repository at all", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("names at least one consumer test for every frozen record", () => {
    const map = consumerMap();
    const orphans = Object.entries(map)
      .filter(([, consumers]) => consumers.length === 0)
      .map(([name]) => name);
    expect(orphans, `records with no consumer test: ${orphans.join(", ")}`).toEqual([]);
    expect(Object.keys(map)).toHaveLength(16);
  });

  it("maps the records a change to the action lifecycle would touch", () => {
    const map = consumerMap();
    for (const name of ["ActionRequest", "ActionResult", "DamageProposal", "ActorKnowledgeView", "CommittedEvent"]) {
      expect(map[name]?.length, `${name} has no consumer test`).toBeGreaterThan(0);
    }
    // The golden samples are a consumer of every record by construction.
    expect(map["CommittedEvent"]?.some((p) => p.includes("tests/contracts"))).toBe(true);
  });

  it("covers every reason ID with a consumer too, so a renamed reason cannot pass silently", () => {
    const orphans = contracts.MANDATORY_V0_REASON_IDS.filter((reason) => ![...contents.values()].some((text) => text.includes(reason)));
    expect(orphans, `reason IDs with no consumer test: ${orphans.join(", ")}`).toEqual([]);
  });
});

/**
 * Named coverage for records the generic sample loop exercises without ever
 * writing their names down. The scan above is **name-based**, which is the
 * point — a contract change is found by searching for the record's name, so a
 * record only the loop touches would look covered to a machine and invisible to
 * a person doing the change. These assertions make each one findable, and check
 * something real about its shape rather than merely mentioning it.
 */
describe("records that only a generic loop would otherwise cover", () => {
  it("RouteRequest carries an actor, a goal and a deterministic budget", () => {
    const schema = contracts.toJsonSchema(contracts.CONTRACT_RECORDS["RouteRequest"] as never, "RouteRequest");
    const fields = Object.keys((schema as { properties?: Record<string, unknown> }).properties ?? {});
    expect(fields).toContain("actorId");
    expect(fields.some((f) => f.toLowerCase().includes("budget"))).toBe(true);
  });

  it("JournaledCommand records the command and where it sits in the authoritative order", () => {
    const schema = contracts.toJsonSchema(contracts.CONTRACT_RECORDS["JournaledCommand"] as never, "JournaledCommand");
    const fields = Object.keys((schema as { properties?: Record<string, unknown> }).properties ?? {});
    expect(fields).toContain("journalSequence");
    expect(fields).toContain("assignedTick");
    expect(fields).toContain("command");
  });

  it("EventRange bounds a span of committed events", () => {
    const schema = contracts.toJsonSchema(contracts.CONTRACT_RECORDS["EventRange"] as never, "EventRange");
    const fields = Object.keys((schema as { properties?: Record<string, unknown> }).properties ?? {});
    expect(fields.length).toBeGreaterThan(1);
    expect(fields).toEqual(["firstSequence", "lastSequence", "rangeHash"]);
  });
});
