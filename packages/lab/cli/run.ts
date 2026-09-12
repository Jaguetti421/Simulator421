import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { buildSummary, validateFixtureFile } from "./validate.js";
import { inspectBundle } from "./inspect.js";
import { runFixtures } from "./runner.js";
import { renderFixture } from "../render/command.js";
import { DEFAULT_LOG_MAX_BYTES } from "./logfile.js";

/**
 * CLI dispatcher for clanlab. Kept free of process/global state so it can
 * be tested without spawning. Exit codes:
 *   0  help / version, or every requested supported check passed
 *   1  a requested check failed: a failed assertion, an invalid fixture, an unusable host or an inconsistent bundle
 *   2  usage error (unknown command or missing argument)
 *   3  NOT_IMPLEMENTED — the command exists in the plan but its packet has not shipped
 *   4  BLOCKED — nothing failed, but a requested check could not be evaluated by this build
 */
export const CLANLAB_VERSION = "0.1.0-w0-09";
export const DEFAULT_EVIDENCE_DIR = "clanlab-out";

/**
 * `clanlab validate [--fixture <path>]... [--summary <path>] [paths...]`
 * Exit 0 when every fixture is valid, 1 when any is invalid or unreadable,
 * 2 on a usage error. Blocked assertions never affect the exit code because
 * validate does not claim to have run them.
 */
function runValidate(args: readonly string[], io: CliIo): number {
  const files: string[] = [];
  let summaryPath: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] as string;
    if (arg === "--fixture") {
      const next = args[i + 1];
      if (next === undefined) {
        io.err("clanlab validate: --fixture needs a path");
        return 2;
      }
      files.push(next);
      i += 1;
    } else if (arg === "--summary") {
      const next = args[i + 1];
      if (next === undefined) {
        io.err("clanlab validate: --summary needs a path");
        return 2;
      }
      summaryPath = next;
      i += 1;
    } else if (arg.startsWith("--")) {
      io.err(`clanlab validate: unknown option ${arg}`);
      return 2;
    } else {
      files.push(arg);
    }
  }

  const expanded = files.flatMap((f) => {
    try {
      return statSync(f).isDirectory()
        ? readdirSync(f)
            .filter((n) => n.endsWith(".json") && n !== "index.json")
            .sort()
            .map((n) => `${f}/${n}`)
        : [f];
    } catch {
      return [f];
    }
  });
  if (expanded.length === 0) {
    io.err("clanlab validate: no fixture paths given");
    return 2;
  }

  const summary = buildSummary(expanded.map(validateFixtureFile));
  const text = `${JSON.stringify(summary, null, 1)}\n`;
  if (summaryPath !== undefined) writeFileSync(summaryPath, text);
  io.out(text.trimEnd());
  for (const report of summary.reports) {
    for (const e of report.errors) io.err(`${report.file}: ${e.code} at ${e.path} — ${e.message}`);
  }
  return summary.invalid + summary.unreadable > 0 ? 1 : 0;
}

/** Expand `--fixture` arguments: a directory means every fixture JSON inside it, in name order. */
function expandFixturePaths(files: readonly string[]): readonly string[] {
  return files.flatMap((f) => {
    try {
      return statSync(f).isDirectory()
        ? readdirSync(f)
            .filter((n) => n.endsWith(".json") && n !== "index.json")
            .sort()
            .map((n) => `${f}/${n}`)
        : [f];
    } catch {
      return [f];
    }
  });
}

/**
 * `clanlab run --fixture <path|dir>... [--events <tape>] [--summary <path>]
 *             [--evidence <dir>] [--no-bundle] [--log-max-bytes <n>]`
 *
 * Summary JSON on stdout; everything detailed goes to files under the evidence
 * directory. Exit 0 only when every requested supported check passed.
 */
function runRun(args: readonly string[], io: CliIo, now: () => string): number {
  const files: string[] = [];
  let summaryPath: string | undefined;
  let eventsPath: string | undefined;
  let evidenceDir = DEFAULT_EVIDENCE_DIR;
  let writeBundles = true;
  let kernelHost = false;
  let logMaxBytes = DEFAULT_LOG_MAX_BYTES;

  const needValue = (flag: string, value: string | undefined): value is string => {
    if (value === undefined) {
      io.err(`clanlab run: ${flag} needs a value`);
      return false;
    }
    return true;
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] as string;
    const next = args[i + 1];
    if (arg === "--fixture") {
      if (!needValue(arg, next)) return 2;
      files.push(next);
      i += 1;
    } else if (arg === "--summary") {
      if (!needValue(arg, next)) return 2;
      summaryPath = next;
      i += 1;
    } else if (arg === "--events") {
      if (!needValue(arg, next)) return 2;
      eventsPath = next;
      i += 1;
    } else if (arg === "--evidence") {
      if (!needValue(arg, next)) return 2;
      evidenceDir = next;
      i += 1;
    } else if (arg === "--log-max-bytes") {
      if (!needValue(arg, next)) return 2;
      const parsed = Number(next);
      if (!Number.isSafeInteger(parsed) || parsed < 1024) {
        io.err(`clanlab run: --log-max-bytes needs an integer of at least 1024, got ${next}`);
        return 2;
      }
      logMaxBytes = parsed;
      i += 1;
    } else if (arg === "--host") {
      if (!needValue(arg, next)) return 2;
      if (next !== "kernel" && next !== "none") {
        io.err(`clanlab run: --host takes "kernel" or "none" (use --events <tape> for a tape host), got ${next}`);
        return 2;
      }
      kernelHost = next === "kernel";
      i += 1;
    } else if (arg === "--no-bundle") {
      writeBundles = false;
    } else if (arg.startsWith("--")) {
      io.err(`clanlab run: unknown option ${arg}`);
      return 2;
    } else {
      files.push(arg);
    }
  }

  const expanded = expandFixturePaths(files);
  if (expanded.length === 0) {
    io.err("clanlab run: no fixture paths given");
    return 2;
  }

  mkdirSync(evidenceDir, { recursive: true });
  if (kernelHost && eventsPath !== undefined) {
    io.err("clanlab run: --host kernel and --events are two different hosts; pick one");
    return 2;
  }

  const { summary, exitCode } = runFixtures({
    files: expanded,
    ...(kernelHost ? { kernelHost: true } : {}),
    ...(eventsPath === undefined ? {} : { eventsPath }),
    evidenceDir,
    writeBundles,
    logMaxBytes,
    nowIso: now(),
    version: CLANLAB_VERSION,
  });

  const text = `${JSON.stringify(summary, null, 1)}\n`;
  if (summaryPath !== undefined) writeFileSync(summaryPath, text);
  io.out(text.trimEnd());
  return exitCode;
}

/** `clanlab render --fixture <f> --tick <t> --out <png> [--summary <path>]` (W0-09). */
function runRender(args: readonly string[], io: CliIo): number {
  let fixturePath: string | undefined;
  let outPath: string | undefined;
  let summaryPath: string | undefined;
  let tick: number | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] as string;
    const next = args[i + 1];
    const needs = (): boolean => {
      if (next === undefined) {
        io.err(`clanlab render: ${arg} needs a value`);
        return false;
      }
      return true;
    };
    if (arg === "--fixture") {
      if (!needs()) return 2;
      fixturePath = next;
      i += 1;
    } else if (arg === "--out") {
      if (!needs()) return 2;
      outPath = next;
      i += 1;
    } else if (arg === "--summary") {
      if (!needs()) return 2;
      summaryPath = next;
      i += 1;
    } else if (arg === "--tick") {
      if (!needs()) return 2;
      tick = Number(next);
      if (!Number.isSafeInteger(tick) || tick < 0) {
        io.err(`clanlab render: --tick needs a non-negative integer, got ${next}`);
        return 2;
      }
      i += 1;
    } else if (arg.startsWith("--")) {
      io.err(`clanlab render: unknown option ${arg}`);
      return 2;
    }
  }
  if (fixturePath === undefined || outPath === undefined || tick === undefined) {
    io.err("clanlab render: --fixture, --tick and --out are all required");
    return 2;
  }

  const result = renderFixture({ fixturePath, tick, outPath, version: CLANLAB_VERSION });
  if ("error" in result) {
    io.err(`clanlab render: ${result.error}`);
    return result.exitCode;
  }
  const text = `${JSON.stringify(result.summary, null, 1)}\n`;
  if (summaryPath !== undefined) writeFileSync(summaryPath, text);
  io.out(text.trimEnd());
  return result.exitCode;
}

/** `clanlab inspect --failure <directory>` — reopen a failure bundle. */
function runInspect(args: readonly string[], io: CliIo): number {
  let directory: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] as string;
    if (arg === "--failure") {
      const next = args[i + 1];
      if (next === undefined) {
        io.err("clanlab inspect: --failure needs a directory");
        return 2;
      }
      directory = next;
      i += 1;
    } else if (arg.startsWith("--")) {
      io.err(`clanlab inspect: unknown option ${arg}`);
      return 2;
    } else {
      directory = arg;
    }
  }
  if (directory === undefined) {
    io.err("clanlab inspect: no bundle directory given (--failure <directory>)");
    return 2;
  }
  const { output, exitCode } = inspectBundle(directory);
  io.out(JSON.stringify(output, null, 1));
  for (const e of output.errors ?? []) io.err(`${e.code}: ${e.message}`);
  return exitCode;
}

export interface CliIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

/** Commands from TP v2.0 §19 and the W0 cards, with the packet that implements each. */
export const PLANNED_COMMANDS: Readonly<Record<string, { implementedBy: string; summary: string }>> = {
  validate: { implementedBy: "W0-05", summary: "Parse and semantically validate fixture files (fixture DSL v1). IMPLEMENTED." },
  run: { implementedBy: "W0-06", summary: "Run fixtures against a declared host; summary JSON, bounded logs, failure bundles. IMPLEMENTED." },
  inspect: { implementedBy: "W0-06", summary: "Reopen a failure bundle: failing assertions, ticks, evidence paths. IMPLEMENTED." },
  batch: { implementedBy: "P3 (seed batches)", summary: "Run a seed batch for a profile." },
  replay: { implementedBy: "W0-08 (snapshots and hashes)", summary: "Replay a bundle and compare canonical hashes." },
  render: { implementedBy: "W0-09", summary: "Render a snapshot with the 2D readability renderer; readability checks decide the exit code. IMPLEMENTED." },
};

export function usage(): string[] {
  const lines = [
    `clanlab ${CLANLAB_VERSION}`,
    "",
    "Usage: clanlab <command> [args...]",
    "",
    "Commands (unimplemented ones exit 3 and name the packet that ships them):",
  ];
  for (const [name, info] of Object.entries(PLANNED_COMMANDS)) {
    lines.push(`  ${name.padEnd(10)} ${info.summary} [${info.implementedBy}]`);
  }
  lines.push(
    "",
    "clanlab run options:",
    "  --fixture <path|dir>   Fixture file, or a directory of fixture JSON (repeatable)",
    "  --host kernel          Run the real W0-07 kernel from each fixture's map seed (supplies events, acknowledgements and snapshots)",
    "  --events <tape>        Declared event tape to judge assertions against (default: no host, everything Blocked)",
    "  --summary <path>       Write the summary JSON to a file as well as stdout",
    `  --evidence <dir>       Where logs and bundles are written (default: ${DEFAULT_EVIDENCE_DIR})`,
    "  --no-bundle            Do not write failure bundles",
    "  --log-max-bytes <n>    Per-run log ceiling (default: " + String(DEFAULT_LOG_MAX_BYTES) + ")",
    "",
    "clanlab render options:",
    "  --fixture <path>       Fixture whose map seed builds the world",
    "  --tick <n>             Tick to advance to before rendering",
    "  --out <path.png>       Where to write the PNG (metadata is embedded in it)",
    "  --summary <path>       Write the render summary JSON to a file as well as stdout",
    "",
    "clanlab inspect options:",
    "  --failure <dir>        Bundle directory written by a failing run",
    "",
    "Exit codes:",
    "  0  every requested supported check passed, and nothing was blocked",
    "  1  failed: an assertion failed, a fixture was invalid or unreadable, or a bundle is inconsistent",
    "  2  usage error",
    "  3  the command is planned but its packet has not shipped",
    "  4  blocked: nothing failed, and at least one requested check could not be evaluated by this build",
    "",
    "Options:",
    "  --help, -h       Show this help",
    "  --version, -v    Print the version",
  );
  return lines;
}

export interface CliDeps {
  /** Wall clock, injected so a test can assert that two runs differ only in their timestamp. */
  readonly now?: () => string;
}

export function runCli(argv: readonly string[], io: CliIo, deps: CliDeps = {}): number {
  const now = deps.now ?? ((): string => new Date().toISOString());
  const [command, ...rest] = argv;
  if (command === undefined || command === "--help" || command === "-h") {
    for (const line of usage()) io.out(line);
    return 0;
  }
  if (command === "--version" || command === "-v") {
    io.out(`clanlab ${CLANLAB_VERSION}`);
    return 0;
  }
  if (command === "validate") return runValidate(rest, io);
  if (command === "run") return runRun(rest, io, now);
  if (command === "inspect") return runInspect(rest, io);
  if (command === "render") return runRender(rest, io);

  const planned = PLANNED_COMMANDS[command];
  if (planned === undefined) {
    io.err(`clanlab: unknown command "${command}"`);
    for (const line of usage()) io.err(line);
    return 2;
  }
  io.out(
    JSON.stringify({
      tool: "clanlab",
      version: CLANLAB_VERSION,
      command,
      status: "NOT_IMPLEMENTED",
      implementedBy: planned.implementedBy,
      inputs: rest,
      note: `Not implemented in this build (${planned.implementedBy}). No fixture was validated or run; this is not a PASS.`,
    }),
  );
  return 3;
}
