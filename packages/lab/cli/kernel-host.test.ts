import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BLOCKED_KINDS } from "../fixture/index.js";
import { kernelHost } from "./host.js";
import { runFixtures } from "./runner.js";

/**
 * Debt pass, 12 September 2026 (producer-directed).
 *
 * Three things recorded as gaps in earlier packets are closed here, and this
 * suite is what keeps them closed:
 *
 *   1. W0-06: an assertion matching on `reasonId` was always Blocked, because a
 *      committed event cannot carry a reason. It now resolves against the
 *      **acknowledgement** stream, which is where contract v0 puts it.
 *   2. W0-06/W0-07: `availableFrom` cited W0-07 and W0-08 long after both
 *      shipped. The messages now name what is actually missing.
 *   3. W0-08: `HashEqualVariant: SaveReload` was Blocked; the kernel host owns
 *      snapshots, so it is now evaluated.
 */
let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "clanlab-debt-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function fixture(overrides: Record<string, unknown>, name = "f.json"): string {
  const path = join(dir, name);
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        id: "DEBT-KERNEL",
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
        assertions: [{ kind: "EventCountGte", match: { type: "tick.committed" }, minimum: 1 }],
        ...overrides,
      },
      null,
      1,
    )}\n`,
  );
  return path;
}

function run(path: string): ReturnType<typeof runFixtures> {
  return runFixtures({ files: [path], kernelHost: true, evidenceDir: join(dir, "evidence"), nowIso: "2026-09-12T00:00:00.000Z", version: "debt" });
}

describe("the kernel host closes the reasonId gap (W0-06)", () => {
  it("submits the fixture's scheduled command and matches its rejection reason against acknowledgements", () => {
    const path = fixture({
      maxTicks: 100,
      schedule: [
        { atTick: 1, sequence: 1, expectedRulesVersion: 0, operation: "ScheduleLaw", payload: { lawId: "Truce", startTick: 101, endTick: 1301 }, expectAck: "Rejected", expectedReasonId: "NoticeTooShort" },
      ],
      assertions: [{ kind: "EventCountGte", match: { type: "CommandRejected", reasonId: "NoticeTooShort" }, minimum: 1 }],
    });
    const { summary, exitCode } = run(path);
    expect(exitCode).toBe(0);
    expect(summary.runs[0]?.assertions[0]?.status).toBe("Passed");
    expect(summary.runs[0]?.assertions[0]?.observed).toBe(1);
  });

  it("fails, rather than passing vacuously, when the reason does not occur", () => {
    const path = fixture({
      schedule: [{ atTick: 1, sequence: 1, expectedRulesVersion: 0, operation: "ScheduleLaw", payload: { lawId: "Truce", startTick: 1001, endTick: 2001 }, expectAck: "Accepted" }],
      maxTicks: 100,
      assertions: [{ kind: "EventCountGte", match: { type: "CommandRejected", reasonId: "NoticeTooShort" }, minimum: 1 }],
    });
    const { summary, exitCode } = run(path);
    expect(exitCode).toBe(1);
    expect(summary.runs[0]?.assertions[0]?.status).toBe("Failed");
    expect(summary.runs[0]?.assertions[0]?.detail).toContain("acknowledgements matched");
  });

  it("stays Blocked — never Failed — when the host supplies no acknowledgement stream", () => {
    const path = fixture({ assertions: [{ kind: "EventCountGte", match: { type: "CommandRejected", reasonId: "NoticeTooShort" }, minimum: 1 }] });
    const { summary, exitCode } = runFixtures({ files: [path], evidenceDir: join(dir, "e2"), nowIso: "2026-09-12T00:00:00.000Z", version: "debt" });
    expect(exitCode).toBe(4);
    expect(summary.runs[0]?.assertions[0]?.status).toBe("Blocked");
    expect(summary.runs[0]?.assertions[0]?.availableFrom).toContain("--host kernel");
  });

  it("reports a scheduled command it could not submit instead of dropping it", () => {
    const host = kernelHost({
      seed: 4107,
      withGuest: false,
      ticks: 10,
      schedule: [{ atTick: 1, sequence: 1, expectedRulesVersion: 0, operation: "SomethingElse", payload: {} }],
    });
    expect(host.unsubmittedCommands?.[0]).toContain("the kernel implements ScheduleLaw only");
    expect(host.note).toContain("could not be submitted");
  });
});

describe("SaveReload is evaluated, not blocked (W0-08)", () => {
  it("passes when a run saved and continued reaches the uninterrupted digest", () => {
    const path = fixture({ maxTicks: 600, assertions: [{ kind: "HashEqualVariant", variant: "SaveReload", startTick: 300, advanceTicks: 300 }] });
    const { summary, exitCode } = run(path);
    expect(exitCode).toBe(0);
    expect(summary.runs[0]?.assertions[0]?.status).toBe("Passed");
    expect(summary.runs[0]?.assertions[0]?.detail).toContain("matches an uninterrupted run");
  });

  it("leaves the variants no host can produce Blocked, naming what each needs", () => {
    const path = fixture({ maxTicks: 600, assertions: [{ kind: "HashEqualVariant", variant: "ObserverToggle", startTick: 100, advanceTicks: 50 }] });
    const { summary, exitCode } = run(path);
    expect(exitCode).toBe(4);
    expect(summary.runs[0]?.assertions[0]?.status).toBe("Blocked");
    expect(summary.runs[0]?.assertions[0]?.availableFrom).toContain("observer state");
  });
});

describe("stale availability claims are gone", () => {
  it("no longer tells a reader to wait for W0-07 or W0-08, both of which shipped", () => {
    const text = `${BLOCKED_KINDS.Invariant} ${BLOCKED_KINDS.HashEqualVariant}`;
    expect(text).not.toMatch(/\bW0-07\b/u);
    expect(text).not.toMatch(/\bW0-08\b/u);
    expect(BLOCKED_KINDS.Invariant).toContain("P1 action packets");
    expect(BLOCKED_KINDS.HashEqualVariant).toContain("--host kernel");
  });

  it("runs the supplied example fixtures against the real kernel", () => {
    const { summary, exitCode } = runFixtures({
      files: ["contracts/examples/LAW-NOTICE-REJECTION.json"],
      kernelHost: true,
      evidenceDir: join(dir, "examples"),
      nowIso: "2026-09-12T00:00:00.000Z",
      version: "debt",
    });
    // Two remain Blocked, both honestly: the Invariant has no actions to check,
    // and `LawActivated` is a type this kernel cannot emit at all — so its
    // absence is a fact about the build, not about the game.
    expect(exitCode).toBe(4);
    expect(summary.counts.passed).toBe(1);
    expect(summary.counts.failed).toBe(0);
    expect(summary.counts.blocked).toBe(2);
    const blocked = summary.runs[0]?.assertions.filter((a) => a.status === "Blocked") ?? [];
    expect(blocked.some((a) => a.detail?.includes("cannot emit"))).toBe(true);
    expect(blocked.some((a) => a.detail?.includes("has nothing to check yet"))).toBe(true);
  });
});

describe("an event type the host cannot emit is Blocked, not Failed", () => {
  it("blocks an assertion about a system that does not exist, rather than blaming the game for it", () => {
    const path = fixture({ assertions: [{ kind: "EventCountGte", match: { type: "DecisionChosen" }, minimum: 1 }] });
    const { summary, exitCode } = run(path);
    expect(exitCode).toBe(4);
    expect(summary.runs[0]?.assertions[0]?.status).toBe("Blocked");
    expect(summary.runs[0]?.assertions[0]?.detail).toContain("cannot emit");
  });

  it("blocks a zero-count assertion about the same type, because a vacuous pass is not evidence", () => {
    const path = fixture({ assertions: [{ kind: "EventCountEq", match: { type: "DecisionChosen" }, count: 0 }] });
    const { summary } = run(path);
    expect(summary.runs[0]?.assertions[0]?.status).toBe("Blocked");
  });

  it("still judges the types the kernel really does emit", () => {
    const path = fixture({ assertions: [{ kind: "EventCountEq", match: { type: "tick.committed" }, count: 100 }] });
    const { summary, exitCode } = run(path);
    expect(exitCode).toBe(0);
    expect(summary.runs[0]?.assertions[0]?.status).toBe("Passed");
  });
});
