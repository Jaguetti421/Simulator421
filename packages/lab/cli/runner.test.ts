import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runFixtures } from "./runner.js";
import type { RunSummary } from "./runner.js";
import { runCli } from "./run.js";

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "clanlab-run-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const NOW = "2026-09-12T00:00:00.000Z";
const VERSION = "test";

function fixtureDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: "W0-06-HARNESS",
    gate: "G0",
    evidenceStatus: "SCHEMA_EXAMPLE_UNEXECUTED",
    profile: { kind: "Fixture", definitions: "Prototype8", contestantCount: 1, writeCareer: false },
    map: { recipeId: "bootstrap-flat", seed: 4107 },
    setup: {
      actors: [
        {
          id: "C003",
          positionMm: [0, 0, 0],
          vitalsMilli: { health: 100000, fullness: 85000, fatigue: 10000, exposure: 0, stamina: 100000 },
          inventory: {},
        },
      ],
      precommittedLaws: [],
    },
    schedule: [],
    maxTicks: 100,
    assertions: [{ kind: "EventCountGte", match: { type: "actor.moved" }, minimum: 1 }],
    ...overrides,
  };
}

function writeFixture(doc: unknown, name = "fixture.json"): string {
  const path = join(dir, name);
  writeFileSync(path, `${JSON.stringify(doc, null, 1)}\n`);
  return path;
}

function event(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 0,
    runId: "run-w0-06-harness",
    branchId: "branch-main",
    sequence: 1,
    tick: 5,
    stage: 10,
    type: "actor.moved",
    causalParents: [],
    status: "Factual",
    payload: { kind: "actor.moved.v0", version: 0, fields: {} },
    ...overrides,
  };
}

function writeTape(events: readonly unknown[], name = "tape.json", overrides: Record<string, unknown> = {}): string {
  const path = join(dir, name);
  writeFileSync(
    path,
    `${JSON.stringify(
      { tapeVersion: 1, source: "hand-authored for the W0-06 harness tests", producedBy: "a test, not a simulation", fixtureId: "W0-06-HARNESS", events, ...overrides },
      null,
      1,
    )}\n`,
  );
  return path;
}

function run(files: readonly string[], extra: { eventsPath?: string; writeBundles?: boolean } = {}): { summary: RunSummary; exitCode: number } {
  return runFixtures({
    files,
    evidenceDir: join(dir, "evidence"),
    nowIso: NOW,
    version: VERSION,
    ...extra,
  });
}

describe("clanlab run with no host (the honest default at W0-06)", () => {
  it("blocks every assertion and exits 4, because nothing was simulated", () => {
    const { summary, exitCode } = run([writeFixture(fixtureDoc())]);
    expect(exitCode).toBe(4);
    expect(summary.counts).toMatchObject({ requested: 1, executed: 0, passed: 0, failed: 0, blocked: 1 });
    const assertion = summary.runs[0]?.assertions[0];
    expect(assertion?.status).toBe("Blocked");
    expect(assertion?.detail).toContain("nothing was simulated");
    expect(assertion?.availableFrom).toContain("W0-07");
    expect(summary.runs[0]?.status).toBe("Blocked");
  });

  it("never reports a blocked run as a pass anywhere in its output", () => {
    const { summary } = run([writeFixture(fixtureDoc())]);
    expect(JSON.stringify(summary)).not.toMatch(/"status":\s*"Passed"/u);
    expect(summary.note).toContain("blocked checks are checks this build cannot run yet");
  });
});

describe("clanlab run against a declared event tape", () => {
  it("passes an assertion the tape actually satisfies, and exits 0 when nothing else is blocked", () => {
    const fixture = writeFixture(fixtureDoc());
    const { summary, exitCode } = run([fixture], { eventsPath: writeTape([event()]) });
    expect(exitCode).toBe(0);
    expect(summary.counts).toMatchObject({ requested: 1, executed: 1, passed: 1, failed: 0, blocked: 0 });
    expect(summary.runs[0]?.status).toBe("Passed");
    expect(summary.runs[0]?.finalTick).toBe(5);
  });

  it("fails an assertion the tape does not satisfy, exits 1 and shows the near misses with their ticks", () => {
    const fixture = writeFixture(
      fixtureDoc({ assertions: [{ kind: "EventCountGte", match: { type: "actor.moved", actorId: "C006" }, minimum: 1 }] }),
    );
    const { summary, exitCode } = run([fixture], { eventsPath: writeTape([event({ actorId: "C003" }), event({ sequence: 2, tick: 7, actorId: "C003" })]) });
    expect(exitCode).toBe(1);
    const assertion = summary.runs[0]?.assertions[0];
    expect(assertion?.status).toBe("Failed");
    expect(assertion?.observed).toBe(0);
    expect(assertion?.expected).toBe(">= 1");
    expect(assertion?.evaluatedAtTick).toBe(7);
    expect(assertion?.nearMiss?.map((e) => e.tick)).toEqual([5, 7]);
  });

  it("blocks — never fails — an assertion that matches on a reason the contract cannot carry", () => {
    const fixture = writeFixture(
      fixtureDoc({ assertions: [{ kind: "EventCountGte", match: { type: "CommandRejected", reasonId: "NoticeTooShort" }, minimum: 1 }] }),
    );
    const { summary, exitCode } = run([fixture], { eventsPath: writeTape([event()]) });
    expect(exitCode).toBe(4);
    const assertion = summary.runs[0]?.assertions[0];
    expect(assertion?.status).toBe("Blocked");
    expect(assertion?.detail).toContain("CommittedEvent at contract v0 has no reasonId");
    expect(assertion?.detail).toContain("blame the game for a gap in the contract");
    expect(assertion?.availableFrom).toContain("P1-12");
  });

  it("keeps Invariant and HashEqualVariant blocked, naming the packets that will evaluate them", () => {
    const fixture = writeFixture(
      fixtureDoc({
        assertions: [
          { kind: "Invariant", name: "NoIllegalEffects" },
          { kind: "HashEqualVariant", variant: "SaveReload", startTick: 1, advanceTicks: 10 },
        ],
      }),
    );
    const { summary, exitCode } = run([fixture], { eventsPath: writeTape([event()]) });
    expect(exitCode).toBe(4);
    expect(summary.runs[0]?.assertions.map((a) => a.status)).toEqual(["Blocked", "Blocked"]);
    expect(summary.runs[0]?.assertions[0]?.availableFrom).toContain("W0-07");
    expect(summary.runs[0]?.assertions[1]?.availableFrom).toContain("W0-08");
  });

  it("counts an explicit absence as a real pass, and catches it when the thing did happen", () => {
    const absent = writeFixture(fixtureDoc({ assertions: [{ kind: "EventCountEq", match: { type: "law.installed" }, count: 0 }] }), "absent.json");
    expect(run([absent], { eventsPath: writeTape([event()]) }).exitCode).toBe(0);

    const happened = writeTape([event({ type: "law.installed" })], "happened.json");
    const { summary, exitCode } = run([absent], { eventsPath: happened });
    expect(exitCode).toBe(1);
    expect(summary.runs[0]?.assertions[0]?.observed).toBe(1);
  });

  it("refuses a tape that is not valid and judges no assertion from it", () => {
    const fixture = writeFixture(fixtureDoc());
    const badTape = writeTape([event({ stage: 99 })], "bad.json");
    const { summary, exitCode } = run([fixture], { eventsPath: badTape });
    expect(exitCode).toBe(1);
    expect(summary.runs[0]?.status).toBe("Invalid");
    expect(summary.runs[0]?.hostErrors[0]?.code).toBe("TapeEventInvalid");
    expect(summary.runs[0]?.assertions).toHaveLength(0);
    expect(summary.runs[0]?.counts.executed).toBe(0);
  });
});

describe("the machine summary", () => {
  it("carries build, contract, content and geometry identity, the profile, the seed and the artifact paths", () => {
    const fixture = writeFixture(fixtureDoc());
    const { summary } = run([fixture], { eventsPath: writeTape([event()]) });

    expect(summary.identity.build.sourceDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(summary.identity.build.files).toBeGreaterThan(0);
    expect(summary.identity.contract.version).toBe(0);
    expect(summary.identity.contract.records).toBe(23);
    expect(summary.identity.contract.recordsDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(summary.identity.content.status).toBe("Unavailable");
    expect(summary.identity.content.availableFrom).toContain("content packets");

    const report = summary.runs[0];
    expect(report?.profile).toBe("Fixture");
    expect(report?.seed).toBe(4107);
    expect(report?.geometry?.recipeId).toBe("bootstrap-flat");
    expect(report?.geometry?.compiled.status).toBe("Unavailable");
    expect(report?.fixtureSha256).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(existsSync(report?.artifacts["log"] ?? "")).toBe(true);
    expect(existsSync(report?.artifacts["events"] ?? "")).toBe(true);
  });

  it("is valid JSON, and keeps the detail in files rather than on stdout", () => {
    const fixture = writeFixture(fixtureDoc());
    const out: string[] = [];
    const err: string[] = [];
    const code = runCli(
      ["run", "--fixture", fixture, "--events", writeTape([event()]), "--evidence", join(dir, "cli-evidence"), "--summary", join(dir, "summary.json")],
      { out: (l) => out.push(l), err: (l) => err.push(l) },
      { now: () => NOW },
    );
    expect(code).toBe(0);
    const printed = JSON.parse(out.join("\n")) as RunSummary;
    expect(printed.command).toBe("run");
    expect(JSON.parse(readFileSync(join(dir, "summary.json"), "utf8"))).toEqual(printed);

    const logPath = printed.runs[0]?.artifacts["log"] ?? "";
    const log = readFileSync(logPath, "utf8");
    expect(log).toContain("assertion 0 EventCountGte: Passed");
    expect(log).toContain("event type actor.moved: 1");
    expect(out.join("\n")).not.toContain("event type actor.moved: 1");
  });

  it("says in every run that no host here is gate evidence", () => {
    const { summary } = run([writeFixture(fixtureDoc())], { eventsPath: writeTape([event()]) });
    expect(summary.host.gateEligible).toBe(false);
    expect(summary.host.watermark).toBe("FakeSim");
    expect(summary.runs[0]?.host.gateEligible).toBe(false);
    expect(summary.runs[0]?.gateEvidence.eligible).toBe(false);
    expect(summary.runs[0]?.gateEvidence.reason).toContain("FakeSim never passes a production gate");
  });

  it("separates the host that was requested from the hosts the fixtures actually ran on", () => {
    const bound = writeFixture(fixtureDoc(), "bound.json");
    const unbound = writeFixture(fixtureDoc({ id: "W0-06-OTHER" }), "other.json");
    const { summary } = run([bound, unbound], { eventsPath: writeTape([event()]) });

    expect(summary.host.requested).toBe("tape");
    expect(summary.host.kindsUsed).toEqual(["none", "tape"]);
    // The second fixture is not the one the tape declares, so it never got a tape host.
    expect(summary.runs[0]?.host.kind).toBe("tape");
    expect(summary.runs[0]?.host.tape?.producedBy).toContain("not a simulation");
    expect(summary.runs[1]?.host.kind).toBe("none");
    expect(summary.runs[1]?.hostErrors[0]?.code).toBe("TapeFixtureMismatch");
  });

  it("reports skipped checks that could not run, without letting them look like passes", () => {
    const withInventory = fixtureDoc();
    (withInventory["setup"] as { actors: Record<string, unknown>[] }).actors[0]!["inventory"] = { berries: 2 };
    const { summary } = run([writeFixture(withInventory, "inventory.json")], { eventsPath: writeTape([event()]) });
    expect(summary.counts.skippedChecks).toBe(1);
    expect(summary.runs[0]?.skippedChecks[0]).toMatchObject({ code: "ContentCatalogUnavailable" });
  });
});

describe("exit codes", () => {
  it("uses 1 for an invalid fixture and 1 for an unreadable one", () => {
    const invalid = writeFixture(fixtureDoc({ schemaVersion: 2 }), "invalid.json");
    const invalidRun = run([invalid]);
    expect(invalidRun.exitCode).toBe(1);
    expect(invalidRun.summary.runs[0]?.status).toBe("Invalid");
    expect(invalidRun.summary.runs[0]?.validationErrors[0]?.code).toBe("UnknownSchemaVersion");

    const missing = run([join(dir, "no-such-fixture.json")]);
    expect(missing.exitCode).toBe(1);
    expect(missing.summary.runs[0]?.status).toBe("Unreadable");
  });

  it("prefers 1 over 4 when one fixture fails and another is only blocked", () => {
    const failing = writeFixture(fixtureDoc({ assertions: [{ kind: "EventCountGte", match: { type: "never.happens" }, minimum: 1 }] }), "failing.json");
    const blocked = writeFixture(fixtureDoc({ assertions: [{ kind: "Invariant", name: "NoIllegalEffects" }] }), "blocked.json");
    const { summary, exitCode } = run([failing, blocked], { eventsPath: writeTape([event()]) });
    expect(exitCode).toBe(1);
    expect(summary.counts).toMatchObject({ fixtures: 2, failed: 1, blocked: 1, passed: 0 });
    expect(summary.exitCode).toBe(1);
  });

  it("only reaches 0 when every requested check was supported and passed", () => {
    const fixture = writeFixture(fixtureDoc());
    expect(run([fixture], { eventsPath: writeTape([event()]) }).exitCode).toBe(0);
    expect(run([fixture]).exitCode).toBe(4);
  });
});
