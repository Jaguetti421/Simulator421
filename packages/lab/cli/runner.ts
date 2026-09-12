/**
 * `clanlab run` (W0-06) — the fixture runner.
 *
 * What this packet ships is the **harness**: parse and validate a fixture, take
 * events from a declared host, judge every assertion, count the four outcomes
 * that must never be conflated (passed, failed, skipped, blocked), write bounded
 * logs and a reproducible failure bundle, and return an exit code that cannot
 * flatter the result.
 *
 * What it deliberately does not ship is a simulation. With the default host
 * nothing runs, so every assertion is Blocked and the exit code is 4. That is
 * the honest state of the build until W0-07, and the summary says so in words as
 * well as in counts.
 *
 * Exit codes (also in `clanlab --help`):
 *   0  every requested supported check passed, and nothing was blocked
 *   1  something failed: a failed assertion, an invalid fixture or an unusable host
 *   2  usage error
 *   4  nothing failed, but at least one requested check could not be evaluated
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateAssertion, parseFixtureText } from "../fixture/index.js";
import type { Fixture, FixtureAssertion, FixtureError, FixtureSkippedCheck, MatchableEvent } from "../fixture/index.js";
import type { BundleFailure } from "../bundle/index.js";
import { writeFailureBundle } from "../bundle/index.js";
import { geometryIdentity, runIdentity, sha256 } from "./identity.js";
import type { RunIdentity } from "./identity.js";
import { kernelHost, loadTape, noneHost, REASON_NOT_REPRESENTABLE } from "./host.js";
import type { RunError, RunHost, RunSkippedCheck } from "./host.js";
import { BoundedLog, DEFAULT_LOG_MAX_BYTES } from "./logfile.js";

export const RUN_SUMMARY_SCHEMA_VERSION = 1;

export type RunStatus = "Passed" | "Failed" | "Blocked" | "Invalid" | "Unreadable";

export interface AssertionRecord {
  readonly index: number;
  readonly kind: string;
  readonly status: "Passed" | "Failed" | "Blocked";
  readonly expected?: string;
  readonly observed?: number;
  readonly detail?: string;
  readonly availableFrom?: string;
  readonly evaluatedAtTick: number;
  readonly matchWindow?: { readonly fromTick: number; readonly throughTick: number | null };
  readonly nearMiss?: readonly MatchableEvent[];
}

/** The host a single fixture actually ran against — authoritative per run. */
export interface EffectiveHost {
  readonly kind: "none" | "tape" | "kernel";
  readonly id: string;
  readonly watermark: "FakeSim";
  readonly gateEligible: false;
  readonly tape?: { readonly sha256: string; readonly events: number; readonly producedBy: string };
}

export interface FixtureRunReport {
  readonly file: string;
  readonly fixtureSha256: string | null;
  readonly id: string | null;
  readonly gate: string | null;
  readonly profile: string | null;
  readonly seed: number | null;
  readonly maxTicks: number | null;
  readonly geometry?: ReturnType<typeof geometryIdentity>;
  readonly status: RunStatus;
  readonly host: EffectiveHost;
  readonly finalTick: number;
  readonly outcome: string;
  readonly counts: {
    readonly requested: number;
    readonly executed: number;
    readonly passed: number;
    readonly failed: number;
    readonly blocked: number;
    readonly skippedChecks: number;
  };
  readonly gateEvidence: { readonly eligible: false; readonly reason: string };
  readonly assertions: readonly AssertionRecord[];
  readonly validationErrors: readonly FixtureError[];
  readonly hostErrors: readonly RunError[];
  readonly skippedChecks: readonly (FixtureSkippedCheck | RunSkippedCheck)[];
  readonly artifacts: Readonly<Record<string, string | null>>;
}

export interface RunSummary {
  readonly tool: "clanlab";
  readonly command: "run";
  readonly schemaVersion: number;
  readonly identity: RunIdentity;
  /**
   * The host **requested** for this invocation, plus the kinds actually used.
   * Per-fixture effective hosts live on each run: a tape that fails to bind to
   * one fixture leaves that run on `none`, and a single top-level block could
   * not honestly describe both.
   */
  readonly host: {
    readonly requested: "none" | "tape" | "kernel";
    readonly eventsPath: string | null;
    readonly watermark: "FakeSim";
    readonly gateEligible: false;
    readonly simulated: false;
    readonly kindsUsed: readonly string[];
    readonly unsupportedSystems: readonly string[];
    readonly note: string;
  };
  readonly counts: {
    readonly fixtures: number;
    readonly requested: number;
    readonly executed: number;
    readonly passed: number;
    readonly failed: number;
    readonly blocked: number;
    readonly skippedChecks: number;
    readonly invalid: number;
    readonly unreadable: number;
  };
  readonly exitCode: number;
  readonly note: string;
  readonly runs: readonly FixtureRunReport[];
}

export interface RunOptions {
  readonly files: readonly string[];
  /** Run the real W0-07 kernel from each fixture's own map seed instead of reading a tape. */
  readonly kernelHost?: boolean;
  readonly eventsPath?: string;
  readonly evidenceDir: string;
  readonly writeBundles?: boolean;
  readonly logMaxBytes?: number;
  readonly nowIso: string;
  readonly version: string;
}

const GATE_INELIGIBLE =
  "no host in this build simulates anything, so no run here is gate evidence (AGENTS.md: FakeSim never passes a production gate)";

function hostWithoutEvents(host: RunHost): Omit<RunHost, "events"> {
  const { events: _events, ...rest } = host;
  return rest;
}

function effectiveHost(host: RunHost): EffectiveHost {
  return {
    kind: host.kind,
    id: host.id,
    watermark: host.watermark,
    gateEligible: host.gateEligible,
    ...(host.tape === undefined ? {} : { tape: { sha256: host.tape.sha256, events: host.tape.events, producedBy: host.tape.producedBy } }),
  };
}

function matchWindowOf(assertion: FixtureAssertion): { fromTick: number; throughTick: number | null } | undefined {
  if (assertion.kind !== "EventCountGte" && assertion.kind !== "EventCountEq") return undefined;
  return { fromTick: assertion.match.fromTick ?? 0, throughTick: assertion.match.throughTick ?? null };
}

/** Events of the right type that the assertion still rejected — the first thing a reader wants to see. */
function nearMisses(assertion: FixtureAssertion, events: readonly MatchableEvent[]): readonly MatchableEvent[] {
  if (assertion.kind !== "EventCountGte" && assertion.kind !== "EventCountEq") return [];
  return events.filter((e) => e.type === assertion.match.type).slice(0, 5);
}

/**
 * Judge one assertion. The order of the guards is the whole point: a kind that
 * needs a simulation, a match on a field the contract cannot carry, and a run
 * that never happened are three different reasons for "not evaluated", and none
 * of them may come out as Passed or as Failed.
 */
export function judgeAssertion(assertion: FixtureAssertion, index: number, host: RunHost): AssertionRecord {
  const window = matchWindowOf(assertion);
  const base = { index, kind: assertion.kind, evaluatedAtTick: host.finalTick, ...(window === undefined ? {} : { matchWindow: window }) };

  if (assertion.kind === "HashEqualVariant" && assertion.variant === "SaveReload" && host.saveReload !== undefined) {
    // Answerable now (12 Sep debt pass): the kernel host owns snapshots, so
    // "saved and continued equals never stopped" is a check, not a promise.
    const { uninterrupted, restored } = host.saveReload(assertion.startTick, assertion.advanceTicks);
    const ok = uninterrupted === restored;
    return {
      ...base,
      status: ok ? "Passed" : "Failed",
      expected: `authoritative digest ${uninterrupted}`,
      detail: ok
        ? `saved at tick ${assertion.startTick}, restored and advanced ${assertion.advanceTicks}: digest ${restored} matches an uninterrupted run`
        : `saved at tick ${assertion.startTick}, restored and advanced ${assertion.advanceTicks}: digest ${restored} differs from the uninterrupted ${uninterrupted}`,
    };
  }

  if (assertion.kind === "Invariant" || assertion.kind === "HashEqualVariant") {
    const outcome = evaluateAssertion(assertion, host.events, host.acks);
    return { ...base, status: "Blocked", detail: outcome.detail ?? "needs a running simulation", ...(outcome.availableFrom === undefined ? {} : { availableFrom: outcome.availableFrom }) };
  }

  if (assertion.match.reasonId !== undefined && host.acks === undefined) {
    return {
      ...base,
      status: "Blocked",
      detail: `this assertion matches on reasonId=${assertion.match.reasonId}, and ${REASON_NOT_REPRESENTABLE.reason}; this host supplied no acknowledgement stream, and judging it against committed events would blame the game for a gap in the contract`,
      availableFrom: "`clanlab run --host kernel`, or an event tape at version 2 or later carrying `acks`",
    };
  }

  if (
    (assertion.kind === "EventCountGte" || assertion.kind === "EventCountEq") &&
    host.emittableEventTypes !== undefined &&
    !host.emittableEventTypes.includes(assertion.match.type)
  ) {
    // Neither Passed nor Failed. This host cannot emit that type at all, so a
    // count of zero is a fact about the build, not about the game: reporting
    // Failed would blame a system that does not exist yet, and reporting a
    // zero-count Pass would be vacuous.
    return {
      ...base,
      status: "Blocked",
      detail: `this host cannot emit "${assertion.match.type}" at all, so neither its presence nor its absence is evidence`,
      availableFrom: `the packet that implements ${assertion.match.type.split(".")[0] ?? "this system"}`,
    };
  }

  if (host.events === undefined) {
    return {
      ...base,
      status: "Blocked",
      detail: `host "${host.kind}" produced no event stream: nothing was simulated, so this assertion was not evaluated`,
      availableFrom: "W0-07 (tick kernel), or pass --events <tape> to judge assertions against a declared event tape",
    };
  }

  const outcome = evaluateAssertion(assertion, host.events, host.acks);
  return {
    ...base,
    status: outcome.status,
    ...(outcome.expected === undefined ? {} : { expected: outcome.expected }),
    ...(outcome.observed === undefined ? {} : { observed: outcome.observed }),
    ...(outcome.detail === undefined ? {} : { detail: outcome.detail }),
    ...(outcome.status === "Failed" ? { nearMiss: nearMisses(assertion, host.events) } : {}),
  };
}

function reproduceCommand(file: string, eventsPath: string | undefined, evidenceDir: string): string {
  const parts = ["node packages/lab/dist/cli/index.js run", `--fixture ${file}`];
  if (eventsPath !== undefined) parts.push(`--events ${eventsPath}`);
  parts.push(`--evidence ${evidenceDir}`);
  return parts.join(" ");
}

function toBundleFailures(assertions: readonly AssertionRecord[]): readonly BundleFailure[] {
  return assertions
    .filter((a) => a.status === "Failed")
    .map((a) => ({
      index: a.index,
      kind: a.kind,
      ...(a.expected === undefined ? {} : { expected: a.expected }),
      ...(a.observed === undefined ? {} : { observed: a.observed }),
      detail: a.detail ?? "failed",
      evaluatedAtTick: a.evaluatedAtTick,
      ...(a.matchWindow === undefined ? {} : { matchWindow: a.matchWindow }),
      ...(a.nearMiss === undefined ? {} : { nearMiss: a.nearMiss.map((e) => ({ type: e.type, tick: e.tick, ...(e.actorId === undefined ? {} : { actorId: e.actorId }), ...(e.targetId === undefined ? {} : { targetId: e.targetId }) })) }),
    }));
}

/** Run every requested fixture and produce the machine summary plus its artifacts. */
export function runFixtures(options: RunOptions): { readonly summary: RunSummary; readonly exitCode: number } {
  const identity = runIdentity(options.version);
  const logMaxBytes = options.logMaxBytes ?? DEFAULT_LOG_MAX_BYTES;
  const writeBundles = options.writeBundles ?? true;
  const reports: FixtureRunReport[] = [];

  for (const file of options.files) {
    const log = new BoundedLog(logMaxBytes);
    log.write(`clanlab run ${options.version} — fixture ${file}`);

    let text: string;
    let bytes: number;
    try {
      bytes = statSync(file).size;
      text = readFileSync(file, "utf8");
    } catch (e) {
      log.write(`unreadable: ${(e as Error).message}`);
      reports.push(unreadableReport(file, e as Error, writeArtifacts(options.evidenceDir, fileKey(file), { log: log.text() })));
      continue;
    }

    const fixtureSha = sha256(text);
    log.write(`fixture sha256 ${fixtureSha} (${bytes} bytes)`);
    const parsed = parseFixtureText(text, { inputBytes: bytes });

    if (!parsed.ok) {
      log.write(`invalid fixture: ${parsed.errors.length} error(s)`);
      for (const e of parsed.errors) log.write(`  ${e.code} at ${e.path} — ${e.message}`);
      const artifacts = writeArtifacts(options.evidenceDir, fileKey(file), { log: log.text(), fixture: text });
      const report: FixtureRunReport = {
        file,
        fixtureSha256: fixtureSha,
        id: null,
        gate: null,
        profile: null,
        seed: null,
        maxTicks: null,
        status: "Invalid",
        host: effectiveHost(noneHost()),
        finalTick: 0,
        outcome: "the fixture did not validate, so nothing was run",
        counts: { requested: 0, executed: 0, passed: 0, failed: 0, blocked: 0, skippedChecks: parsed.skipped.length },
        gateEvidence: { eligible: false, reason: GATE_INELIGIBLE },
        assertions: [],
        validationErrors: parsed.errors,
        hostErrors: [],
        skippedChecks: parsed.skipped,
        artifacts,
      };
      reports.push(
        writeBundles
          ? withBundle(report, { options, identity, host: noneHost(), fixtureText: text, logText: log.text(), status: "Invalid", failures: [] })
          : report,
      );
      continue;
    }

    const fixture: Fixture = parsed.fixture;
    log.write(`fixture ${fixture.id} — gate ${fixture.gate}, profile ${fixture.profile.kind}, seed ${fixture.map.seed}, maxTicks ${fixture.maxTicks}`);
    for (const s of parsed.skipped) log.write(`  skipped check ${s.code} at ${s.path}: ${s.message} (${s.availableFrom})`);

    // ---- host -------------------------------------------------------------
    let host = noneHost();
    let hostErrors: readonly RunError[] = [];
    let hostSkipped: readonly RunSkippedCheck[] = [];
    let eventsText: string | undefined;
    if (options.kernelHost === true) {
      host = kernelHost({ seed: fixture.map.seed, withGuest: fixture.setup.actors.some((a) => a.id.startsWith("G")), ticks: fixture.maxTicks, schedule: fixture.schedule as never });
      log.write(`host kernel ${host.id} — ${host.events?.length ?? 0} event(s), ${host.acks?.length ?? 0} acknowledgement(s), final tick ${host.finalTick}`);
      log.write(`  ${host.note}`);
      for (const u of host.unsubmittedCommands ?? []) log.write(`  unsubmitted command: ${u}`);
    } else if (options.eventsPath !== undefined) {
      const loaded = loadTape(options.eventsPath, { maxTicks: fixture.maxTicks, fixtureId: fixture.id });
      if (loaded.ok) {
        host = loaded.host;
        hostSkipped = loaded.skipped;
        eventsText = readFileSync(options.eventsPath, "utf8");
        log.write(`host tape ${host.tape?.sha256} — ${host.tape?.events} event(s) produced by ${host.tape?.producedBy}`);
        log.write(`  declared source: ${host.tape?.declaredSource}`);
        for (const s of hostSkipped) log.write(`  skipped check ${s.code}: ${s.message} (${s.availableFrom})`);
        const byType = new Map<string, number>();
        for (const e of host.events ?? []) byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
        for (const [type, n] of [...byType.entries()].sort()) log.write(`  event type ${type}: ${n}`);
      } else {
        hostErrors = loaded.errors;
        log.write(`host unusable: ${hostErrors.length} error(s) in ${options.eventsPath}`);
        for (const e of hostErrors) log.write(`  ${e.code} at ${e.path} — ${e.message}`);
      }
    } else {
      log.write(`host none — ${host.note}`);
    }

    if (hostErrors.length > 0) {
      const artifacts = writeArtifacts(options.evidenceDir, fileKey(file), { log: log.text(), fixture: text });
      const report: FixtureRunReport = {
        file,
        fixtureSha256: fixtureSha,
        id: fixture.id,
        gate: fixture.gate,
        profile: fixture.profile.kind,
        seed: fixture.map.seed,
        maxTicks: fixture.maxTicks,
        geometry: geometryIdentity(fixture.map.recipeId, fixture.map.seed),
        status: "Invalid",
        host: effectiveHost(host),
        finalTick: 0,
        outcome: "the event tape did not validate, so no assertion was judged",
        counts: { requested: fixture.assertions.length, executed: 0, passed: 0, failed: 0, blocked: 0, skippedChecks: parsed.skipped.length },
        gateEvidence: { eligible: false, reason: GATE_INELIGIBLE },
        assertions: [],
        validationErrors: [],
        hostErrors,
        skippedChecks: [...parsed.skipped, ...hostSkipped],
        artifacts,
      };
      reports.push(
        writeBundles
          ? withBundle(report, { options, identity, host, fixtureText: text, logText: log.text(), status: "Invalid", failures: [], ...(eventsText === undefined ? {} : { eventsText }) })
          : report,
      );
      continue;
    }

    // ---- assertions --------------------------------------------------------
    const assertions = fixture.assertions.map((a, i) => judgeAssertion(a, i, host));
    for (const a of assertions) {
      log.write(`assertion ${a.index} ${a.kind}: ${a.status}${a.observed === undefined ? "" : ` (observed ${a.observed}, expected ${a.expected ?? "?"})`}`);
      if (a.detail !== undefined) log.write(`  ${a.detail}`);
      if (a.availableFrom !== undefined) log.write(`  available from: ${a.availableFrom}`);
      for (const e of a.nearMiss ?? []) log.write(`  near miss: ${e.type} at tick ${e.tick}${e.actorId === undefined ? "" : ` actor ${e.actorId}`}`);
    }

    const passed = assertions.filter((a) => a.status === "Passed").length;
    const failed = assertions.filter((a) => a.status === "Failed").length;
    const blocked = assertions.filter((a) => a.status === "Blocked").length;
    const status: RunStatus = failed > 0 ? "Failed" : blocked > 0 ? "Blocked" : "Passed";
    const skippedChecks = [...parsed.skipped, ...hostSkipped];
    log.write(`result ${status}: ${passed} passed, ${failed} failed, ${blocked} blocked, ${skippedChecks.length} skipped check(s)`);

    const artifacts = writeArtifacts(options.evidenceDir, fileKey(file), {
      log: log.text(),
      fixture: text,
      ...(eventsText === undefined ? {} : { events: eventsText }),
    });
    const report: FixtureRunReport = {
      file,
      fixtureSha256: fixtureSha,
      id: fixture.id,
      gate: fixture.gate,
      profile: fixture.profile.kind,
      seed: fixture.map.seed,
      maxTicks: fixture.maxTicks,
      geometry: geometryIdentity(fixture.map.recipeId, fixture.map.seed),
      status,
      host: effectiveHost(host),
      finalTick: host.finalTick,
      outcome:
        status === "Passed"
          ? "every requested supported check passed"
          : status === "Failed"
            ? "at least one assertion failed"
            : "no assertion failed, and at least one could not be evaluated by this host",
      counts: { requested: assertions.length, executed: passed + failed, passed, failed, blocked, skippedChecks: skippedChecks.length },
      gateEvidence: { eligible: false, reason: GATE_INELIGIBLE },
      assertions,
      validationErrors: [],
      hostErrors: [],
      skippedChecks,
      artifacts,
    };
    reports.push(
      writeBundles && status === "Failed"
        ? withBundle(report, { options, identity, host, fixtureText: text, logText: log.text(), status: "Failed", failures: toBundleFailures(assertions), ...(eventsText === undefined ? {} : { eventsText }) })
        : report,
    );
  }

  const counts = {
    fixtures: reports.length,
    requested: reports.reduce((n, r) => n + r.counts.requested, 0),
    executed: reports.reduce((n, r) => n + r.counts.executed, 0),
    passed: reports.reduce((n, r) => n + r.counts.passed, 0),
    failed: reports.reduce((n, r) => n + r.counts.failed, 0),
    blocked: reports.reduce((n, r) => n + r.counts.blocked, 0),
    skippedChecks: reports.reduce((n, r) => n + r.counts.skippedChecks, 0),
    invalid: reports.filter((r) => r.status === "Invalid").length,
    unreadable: reports.filter((r) => r.status === "Unreadable").length,
  };
  const exitCode = counts.failed + counts.invalid + counts.unreadable > 0 ? 1 : counts.blocked > 0 ? 4 : 0;

  const summary: RunSummary = {
    tool: "clanlab",
    command: "run",
    schemaVersion: RUN_SUMMARY_SCHEMA_VERSION,
    identity,
    host: {
      requested: options.kernelHost === true ? "kernel" : options.eventsPath === undefined ? "none" : "tape",
      eventsPath: options.eventsPath ?? null,
      watermark: "FakeSim",
      gateEligible: false,
      simulated: false,
      kindsUsed: [...new Set(reports.map((r) => r.host.kind))].sort(),
      unsupportedSystems: noneHost().unsupportedSystems,
      note:
        options.eventsPath === undefined
          ? noneHost().note
          : "Events were requested from a declared tape; nothing was simulated. Each run records the host it actually used and that tape's hash. A tape run proves the harness, never the game.",
    },
    counts,
    exitCode,
    note:
      exitCode === 0
        ? "Every requested supported check passed. Read the host: a tape host proves the harness and the assertions, never the game."
        : exitCode === 4
          ? "Nothing failed, and nothing passed that was not evaluated: blocked checks are checks this build cannot run yet, and they keep the exit code nonzero."
          : "At least one fixture failed, was invalid or could not be read. Details are in the run logs and the failure bundles named in artifacts.",
    runs: reports,
  };
  return { summary, exitCode };
}

function fileKey(file: string): string {
  const base = file.split("/").at(-1) ?? file;
  return base.replace(/\.json$/u, "").replace(/[^A-Za-z0-9._-]/gu, "_");
}

function writeArtifacts(evidenceDir: string, key: string, files: { log: string; fixture?: string; events?: string }): Readonly<Record<string, string | null>> {
  const directory = join(evidenceDir, key);
  mkdirSync(directory, { recursive: true });
  const written: Record<string, string | null> = { log: null, fixture: null, events: null, bundle: null };
  const logPath = join(directory, "run.log");
  writeFileSync(logPath, files.log);
  written["log"] = logPath;
  if (files.fixture !== undefined) {
    const p = join(directory, "fixture.json");
    writeFileSync(p, files.fixture);
    written["fixture"] = p;
  }
  if (files.events !== undefined) {
    const p = join(directory, "events.json");
    writeFileSync(p, files.events);
    written["events"] = p;
  }
  return written;
}

function unreadableReport(file: string, error: Error, artifacts: Readonly<Record<string, string | null>>): FixtureRunReport {
  return {
    file,
    fixtureSha256: null,
    id: null,
    gate: null,
    profile: null,
    seed: null,
    maxTicks: null,
    status: "Unreadable",
    host: effectiveHost(noneHost()),
    finalTick: 0,
    outcome: "the fixture file could not be read",
    counts: { requested: 0, executed: 0, passed: 0, failed: 0, blocked: 0, skippedChecks: 0 },
    gateEvidence: { eligible: false, reason: GATE_INELIGIBLE },
    assertions: [],
    validationErrors: [{ code: "MalformedJson", path: "/", message: error.message }],
    hostErrors: [],
    skippedChecks: [],
    artifacts,
  };
}

function withBundle(
  report: FixtureRunReport,
  input: {
    options: RunOptions;
    identity: RunIdentity;
    host: RunHost;
    fixtureText: string;
    logText: string;
    status: "Failed" | "Invalid";
    failures: readonly BundleFailure[];
    eventsText?: string;
  },
): FixtureRunReport {
  const directory = join(input.options.evidenceDir, fileKey(report.file), "bundle");
  const { manifest } = writeFailureBundle({
    directory,
    createdAtIso: input.options.nowIso,
    status: input.status,
    fixture: {
      path: report.file,
      sha256: report.fixtureSha256 ?? "sha256:unknown",
      id: report.id,
      gate: report.gate,
      profile: report.profile,
      seed: report.seed,
      maxTicks: report.maxTicks,
    },
    fixtureText: input.fixtureText,
    ...(input.eventsText === undefined
      ? {}
      : { eventsText: input.eventsText, ...(input.host.tape?.sha256 === undefined ? {} : { eventsSha256: input.host.tape.sha256 }) }),
    logText: input.logText,
    runSummary: report,
    identity: input.identity,
    host: hostWithoutEvents(input.host),
    counts: report.counts,
    failures: input.failures,
    validationErrors: [
      ...report.validationErrors.map((e) => ({ code: e.code as string, path: e.path, message: e.message })),
      ...report.hostErrors.map((e) => ({ code: e.code as string, path: e.path, message: e.message })),
    ],
    reproduceCommand: reproduceCommand(report.file, input.options.eventsPath, input.options.evidenceDir),
  });
  return { ...report, artifacts: { ...report.artifacts, bundle: join(directory, "bundle.json"), verdictDigest: manifest.verdictDigest } };
}
