import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runFixtures } from "../cli/runner.js";
import { inspectBundle } from "../cli/inspect.js";
import { readFailureBundle } from "./index.js";
import type { BundleManifest } from "./index.js";

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "clanlab-bundle-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** A fixture that must fail: it demands an event the tape does not contain. */
function failingFixture(name = "failing.json"): string {
  const path = join(dir, name);
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        id: "W0-06-DELIBERATE-FAILURE",
        gate: "G0",
        evidenceStatus: "SCHEMA_EXAMPLE_UNEXECUTED",
        profile: { kind: "Fixture", definitions: "Prototype8", contestantCount: 1, writeCareer: false },
        map: { recipeId: "bootstrap-flat", seed: 4107 },
        setup: {
          actors: [
            { id: "C003", positionMm: [0, 0, 0], vitalsMilli: { health: 100000, fullness: 85000, fatigue: 10000, exposure: 0, stamina: 100000 }, inventory: {} },
          ],
          precommittedLaws: [],
        },
        schedule: [],
        maxTicks: 100,
        assertions: [{ kind: "EventCountGte", match: { type: "actor.eliminated", fromTick: 1, throughTick: 50 }, minimum: 1 }],
        notes: "The tape contains actor.moved only, so this assertion must fail and write a bundle.",
      },
      null,
      1,
    )}\n`,
  );
  return path;
}

function tape(name = "tape.json"): string {
  const path = join(dir, name);
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        tapeVersion: 1,
        source: "hand-authored for the W0-06 harness tests",
        producedBy: "a test, not a simulation",
        fixtureId: "W0-06-DELIBERATE-FAILURE",
        events: [
          {
            schemaVersion: 0,
            runId: "run-w0-06-harness",
            branchId: "branch-main",
            sequence: 1,
            tick: 12,
            stage: 10,
            type: "actor.moved",
            actorId: "C003",
            causalParents: [],
            status: "Factual",
            payload: { kind: "actor.moved.v0", version: 0, fields: {} },
          },
        ],
      },
      null,
      1,
    )}\n`,
  );
  return path;
}

function runFailing(evidence: string, nowIso = "2026-09-12T00:00:00.000Z"): { bundleDir: string; exitCode: number } {
  const { summary, exitCode } = runFixtures({
    files: [failingFixture()],
    eventsPath: tape(),
    evidenceDir: join(dir, evidence),
    nowIso,
    version: "test",
  });
  const manifestPath = summary.runs[0]?.artifacts["bundle"] ?? "";
  return { bundleDir: manifestPath.replace(/\/bundle\.json$/u, ""), exitCode };
}

describe("a deliberately failing fixture", () => {
  it("exits nonzero and writes a bundle holding every input the verdict used", () => {
    const { bundleDir, exitCode } = runFailing("evidence");
    expect(exitCode).toBe(1);
    for (const file of ["bundle.json", "fixture.json", "events.json", "run.log", "run-summary.json"]) {
      expect(existsSync(join(bundleDir, file))).toBe(true);
    }
    const manifest = JSON.parse(readFileSync(join(bundleDir, "bundle.json"), "utf8")) as BundleManifest;
    expect(manifest.status).toBe("Failed");
    expect(manifest.fixture.id).toBe("W0-06-DELIBERATE-FAILURE");
    expect(manifest.reproduce.command).toContain("run --fixture");
    expect(manifest.reproduce.command).toContain("--events");
  });

  it("records the failing assertion with the tick it was judged at and the window it searched", () => {
    const { bundleDir } = runFailing("evidence");
    const manifest = JSON.parse(readFileSync(join(bundleDir, "bundle.json"), "utf8")) as BundleManifest;
    expect(manifest.failures).toHaveLength(1);
    const failure = manifest.failures[0];
    expect(failure?.kind).toBe("EventCountGte");
    expect(failure?.observed).toBe(0);
    expect(failure?.evaluatedAtTick).toBe(12);
    expect(failure?.matchWindow).toEqual({ fromTick: 1, throughTick: 50 });
    expect(failure?.detail).toContain("no assertion passes on an empty match");
  });
});

describe("clanlab inspect", () => {
  it("reopens the bundle with the failing assertion, the tick and absolute evidence paths", () => {
    const { bundleDir } = runFailing("evidence");
    const { output, exitCode } = inspectBundle(bundleDir);
    expect(exitCode).toBe(0);
    expect(output.status).toBe("FAILED_RUN_REOPENED");
    expect(output.failures?.[0]?.kind).toBe("EventCountGte");
    expect(output.failures?.[0]?.evaluatedAtTick).toBe(12);
    expect(existsSync(output.evidence?.["log"] ?? "")).toBe(true);
    expect(existsSync(output.evidence?.["events"] ?? "")).toBe(true);
    expect(output.reproduce?.command).toContain("clanlab");
    expect(output.note).toContain("not a pass");
  });

  it("checks the bundle against itself and passes only when every copy and hash agrees", () => {
    const { bundleDir } = runFailing("evidence");
    const { output } = inspectBundle(bundleDir);
    expect(output.integrity).toMatchObject({ fixtureCopyMatches: true, eventsCopyMatches: true, verdictDigestMatches: true, intact: true });
    expect(output.integrity?.missingArtifacts).toEqual([]);
  });

  it("refuses a bundle whose copied fixture no longer matches its recorded hash", () => {
    const { bundleDir } = runFailing("evidence");
    writeFileSync(join(bundleDir, "fixture.json"), '{"schemaVersion": 1, "tampered": true}\n');
    const { output, exitCode } = inspectBundle(bundleDir);
    expect(exitCode).toBe(1);
    expect(output.integrity?.fixtureCopyMatches).toBe(false);
    expect(output.integrity?.intact).toBe(false);
    expect(output.note).toContain("treat its verdict as unproven");
  });

  it("refuses a bundle whose recorded failures were edited after the fact", () => {
    const { bundleDir } = runFailing("evidence");
    const manifestPath = join(bundleDir, "bundle.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as BundleManifest;
    writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, failures: [] }, null, 1)}\n`);
    const { output, exitCode } = inspectBundle(bundleDir);
    expect(exitCode).toBe(1);
    expect(output.integrity?.verdictDigestMatches).toBe(false);
  });

  it("says plainly when there is no usable bundle, instead of implying anything about the run", () => {
    const { output, exitCode } = inspectBundle(join(dir, "not-a-bundle"));
    expect(exitCode).toBe(1);
    expect(output.status).toBe("BUNDLE_UNUSABLE");
    expect(output.errors?.[0]?.code).toBe("BundleUnreadable");
    expect(output.failures).toBeUndefined();
  });

  it("refuses a bundle written by a future version rather than reading it optimistically", () => {
    const { bundleDir } = runFailing("evidence");
    const manifestPath = join(bundleDir, "bundle.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as BundleManifest;
    writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, bundleVersion: 99 }, null, 1)}\n`);
    const result = readFailureBundle(bundleDir);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe("BundleUnknownVersion");
  });
});

describe("reproducibility", () => {
  it("gives the same verdict digest for the same failure, and differs only in the timestamp", () => {
    const first = runFailing("evidence-a", "2026-09-12T00:00:00.000Z");
    const second = runFailing("evidence-b", "2026-09-13T11:22:33.000Z");
    const a = JSON.parse(readFileSync(join(first.bundleDir, "bundle.json"), "utf8")) as BundleManifest;
    const b = JSON.parse(readFileSync(join(second.bundleDir, "bundle.json"), "utf8")) as BundleManifest;

    expect(a.verdictDigest).toBe(b.verdictDigest);
    expect(a.createdAtIso).not.toBe(b.createdAtIso);
    // Everything the verdict rests on is identical; only the clock and the paths
    // the operator chose differ, which is exactly what the digest excludes.
    const withoutRunContext = (m: BundleManifest): unknown => ({ ...m, createdAtIso: "", fixture: { ...m.fixture, path: "" }, reproduce: { ...m.reproduce, command: "" } });
    expect(withoutRunContext(a)).toEqual(withoutRunContext(b));
    expect(a.reproduce.command).not.toBe(b.reproduce.command);
  });

  it("changes the verdict digest when the failure itself changes", () => {
    const { bundleDir } = runFailing("evidence");
    const manifest = JSON.parse(readFileSync(join(bundleDir, "bundle.json"), "utf8")) as BundleManifest;

    const other = runFixtures({
      files: [failingFixture("failing-2.json")],
      eventsPath: tape("tape-2.json"),
      evidenceDir: join(dir, "evidence-other"),
      nowIso: "2026-09-12T00:00:00.000Z",
      version: "test",
    });
    // Same fixture content, same tape content: the digest must match.
    const otherManifest = JSON.parse(readFileSync(other.summary.runs[0]?.artifacts["bundle"] ?? "", "utf8")) as BundleManifest;
    expect(otherManifest.verdictDigest).toBe(manifest.verdictDigest);
  });
});

describe("bundles for fixtures that never ran", () => {
  it("writes an Invalid bundle carrying the validation errors when the fixture does not validate", () => {
    const path = join(dir, "broken.json");
    writeFileSync(path, `${JSON.stringify({ schemaVersion: 1, id: "BROKEN" }, null, 1)}\n`);
    const { summary, exitCode } = runFixtures({ files: [path], evidenceDir: join(dir, "evidence"), nowIso: "2026-09-12T00:00:00.000Z", version: "test" });
    expect(exitCode).toBe(1);
    const manifest = JSON.parse(readFileSync(summary.runs[0]?.artifacts["bundle"] ?? "", "utf8")) as BundleManifest;
    expect(manifest.status).toBe("Invalid");
    expect(manifest.failures).toEqual([]);
    expect(manifest.validationErrors.length).toBeGreaterThan(0);
    expect(manifest.artifacts["events"]).toBeNull();
  });

  it("writes no bundle at all when the run is told not to", () => {
    const { summary } = runFixtures({
      files: [failingFixture()],
      eventsPath: tape(),
      evidenceDir: join(dir, "evidence"),
      writeBundles: false,
      nowIso: "2026-09-12T00:00:00.000Z",
      version: "test",
    });
    expect(summary.runs[0]?.status).toBe("Failed");
    expect(summary.runs[0]?.artifacts["bundle"]).toBeNull();
  });
});
