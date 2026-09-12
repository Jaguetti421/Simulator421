import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { core, host as simHost } from "../../packages/sim/dist/index.js";
import { runFixtures } from "../../packages/lab/dist/cli/runner.js";

/**
 * Cross-runtime determinism and the end-to-end fixture run (W0-07).
 *
 * These live under `tests/` rather than in `packages/sim` because they need
 * Node's `worker_threads` and the filesystem, which `packages/sim` may not
 * import by design — the kernel has to stay runnable in a browser Worker.
 */
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const SEED = 4107;
const TICKS = 600;

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "clanlab-kernel-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function digestInProcess(ticks: number, withGuest = true): string {
  const host = simHost.SimHost.create({ matchSeed: SEED as never, withGuest });
  host.runTicks(ticks);
  return host.authoritativeDigest();
}

async function digestInWorker(ticks: number, withGuest = true): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(join(here, "kernel-worker.mjs"), { workerData: { seed: SEED, ticks, withGuest } });
    worker.once("message", (m: { digest?: string; error?: string }) => {
      void worker.terminate();
      if (m.error !== undefined) reject(new Error(m.error));
      else resolve(m.digest as string);
    });
    worker.once("error", reject);
  });
}

describe("cross-runtime determinism (G0 criterion 1)", () => {
  it("gives the same authoritative digest on repeated Node runs", () => {
    const first = digestInProcess(TICKS);
    const second = digestInProcess(TICKS);
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{8}$/u);
  });

  it("gives the same digest in a Node worker_thread as in the main thread", async () => {
    const main = digestInProcess(200);
    const worker = await digestInWorker(200);
    expect(worker).toBe(main);
  });

  it("keeps the 136-actor and 137-actor workloads distinguishable", async () => {
    const core136 = digestInProcess(100, false);
    const core137 = digestInProcess(100, true);
    expect(core136).not.toBe(core137);
    expect(await digestInWorker(100, false)).toBe(core136);
  });

  /**
   * The browser half of criterion 1 is BLOCKED here: there is no app shell or
   * `/capture` route until W0-10, so no browser Worker can be started. This test
   * records the block rather than letting the Node half look like the whole
   * claim.
   */
  it("records the browser Worker half as BLOCKED until W0-10", () => {
    const blocked = {
      check: "browser Worker digest equals Node digest",
      status: "BLOCKED_RENDER",
      reason: "no app shell, Worker bootstrap or Playwright job exists before W0-10",
      availableFrom: "W0-10 (web app shell and Worker bootstrap)",
    };
    expect(blocked.status).toBe("BLOCKED_RENDER");
    expect(blocked.availableFrom).toContain("W0-10");
  });
});

describe("PERF-OPS-BASE through the real harness (G0 criteria 1 and 2)", () => {
  it("passes every assertion when run against a tape the kernel produced", () => {
    const host = simHost.SimHost.create({ matchSeed: SEED as never, withGuest: true });
    host.runTicks(TICKS);
    const tape = host.eventTape("PERF-OPS-BASE");
    const tapePath = join(dir, "kernel-tape.json");
    writeFileSync(tapePath, `${JSON.stringify(tape, null, 1)}\n`);

    const { summary, exitCode } = runFixtures({
      files: [join(repoRoot, "tests/fixtures/PERF-OPS-BASE.json")],
      eventsPath: tapePath,
      evidenceDir: join(dir, "evidence"),
      nowIso: "2026-09-12T00:00:00.000Z",
      version: "w0-07-test",
    });

    expect(exitCode).toBe(0);
    expect(summary.counts).toMatchObject({ requested: 13, executed: 13, passed: 13, failed: 0, blocked: 0 });
    expect(summary.runs[0]?.host.tape?.producedBy).toContain("w0-07-synthetic");
  });

  it("fails the fixture if the tick loop runs its stages in a different order", () => {
    const host = simHost.SimHost.create({ matchSeed: SEED as never, withGuest: true });
    host.runTicks(TICKS);
    const tape = host.eventTape("PERF-OPS-BASE");
    // Swap two stage markers, as a reordered tick loop would produce.
    const events = (tape.events as Record<string, unknown>[]).map((e) =>
      e["type"] === "stage.05.advance" ? { ...e, type: "stage.04.advance" } : e["type"] === "stage.04.decisions" ? { ...e, type: "stage.05.decisions" } : e,
    );
    const tapePath = join(dir, "scrambled-tape.json");
    writeFileSync(tapePath, `${JSON.stringify({ ...tape, events }, null, 1)}\n`);

    const { exitCode, summary } = runFixtures({
      files: [join(repoRoot, "tests/fixtures/PERF-OPS-BASE.json")],
      eventsPath: tapePath,
      evidenceDir: join(dir, "evidence-scrambled"),
      nowIso: "2026-09-12T00:00:00.000Z",
      version: "w0-07-test",
    });
    expect(exitCode).toBe(1);
    expect(summary.counts.failed).toBe(2);
  });

  it("describes the same world the kernel builds, so the fixture cannot drift from the workload", () => {
    const fixture = JSON.parse(readFileSync(join(repoRoot, "tests/fixtures/PERF-OPS-BASE.json"), "utf8")) as {
      setup: { actors: { id: string; positionMm: number[] }[] };
      profile: { kind: string; contestantCount: number };
      maxTicks: number;
    };
    const world = core.createWorld({ matchSeed: SEED as never, withGuest: true });
    expect(fixture.setup.actors).toHaveLength(world.actors.length);
    expect(fixture.maxTicks).toBe(TICKS);
    expect(fixture.profile).toMatchObject({ kind: "Standard100", contestantCount: 100 });
    fixture.setup.actors.forEach((actor, i) => {
      expect(actor.id).toBe(world.actors[i]?.id);
      expect(actor.positionMm[0]).toBe(world.actors[i]?.xMm);
      expect(actor.positionMm[1]).toBe(world.actors[i]?.yMm);
    });
  });
});

describe("SAVE-ROUNDTRIP through the real harness (G0 criterion 1)", () => {
  it("passes when the tape comes from a run that was saved, restored and continued", () => {
    const original = simHost.SimHost.create({ matchSeed: SEED as never, withGuest: true });
    original.runTicks(300);
    const restored = simHost.SimHost.restore(original.save());
    restored.runTicks(300);

    const tapePath = join(dir, "restored-tape.json");
    writeFileSync(tapePath, `${JSON.stringify(restored.eventTape("SAVE-ROUNDTRIP"), null, 1)}\n`);

    const { summary, exitCode } = runFixtures({
      files: [join(repoRoot, "tests/fixtures/SAVE-ROUNDTRIP.json")],
      eventsPath: tapePath,
      evidenceDir: join(dir, "evidence-save"),
      nowIso: "2026-09-12T00:00:00.000Z",
      version: "w0-08-test",
    });
    expect(exitCode).toBe(0);
    expect(summary.counts).toMatchObject({ requested: 4, executed: 4, passed: 4, failed: 0, blocked: 0 });
  });

  it("fails the same fixture when the tape comes from a run that restarted instead of continuing", () => {
    const restarted = simHost.SimHost.create({ matchSeed: SEED as never, withGuest: true });
    restarted.runTicks(300);
    const tapePath = join(dir, "restarted-tape.json");
    writeFileSync(tapePath, `${JSON.stringify(restarted.eventTape("SAVE-ROUNDTRIP"), null, 1)}\n`);

    const { exitCode, summary } = runFixtures({
      files: [join(repoRoot, "tests/fixtures/SAVE-ROUNDTRIP.json")],
      eventsPath: tapePath,
      evidenceDir: join(dir, "evidence-restart"),
      nowIso: "2026-09-12T00:00:00.000Z",
      version: "w0-08-test",
    });
    expect(exitCode).toBe(1);
    expect(summary.counts.failed).toBeGreaterThan(0);
  });
});
