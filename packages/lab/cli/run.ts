import { readdirSync, statSync, writeFileSync } from "node:fs";
import { buildSummary, validateFixtureFile } from "./validate.js";

/**
 * CLI dispatcher for clanlab. Kept free of process/global state so it can
 * be tested without spawning. Exit codes:
 *   0  help / version
 *   2  usage error (unknown command)
 *   1  a requested check failed (an invalid fixture)
 *   3  NOT_IMPLEMENTED — the command exists in the plan but its packet has not shipped
 */
export const CLANLAB_VERSION = "0.0.0-w0-05";

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

export interface CliIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

/** Commands from TP v2.0 §19 and the W0 cards, with the packet that implements each. */
export const PLANNED_COMMANDS: Readonly<Record<string, { implementedBy: string; summary: string }>> = {
  validate: { implementedBy: "W0-05", summary: "Parse and semantically validate fixture files (fixture DSL v1). IMPLEMENTED." },
  run: { implementedBy: "W0-06", summary: "Run fixtures, print summaries, write failure bundles." },
  render: { implementedBy: "W0-09", summary: "Render a snapshot with the 2D readability renderer." },
};

export function usage(): string[] {
  const lines = [
    `clanlab ${CLANLAB_VERSION}`,
    "",
    "Usage: clanlab <command> [args...]",
    "",
    "Commands (all NOT_IMPLEMENTED at W0-01; each exits 3 and names its packet):",
  ];
  for (const [name, info] of Object.entries(PLANNED_COMMANDS)) {
    lines.push(`  ${name.padEnd(10)} ${info.summary} [${info.implementedBy}]`);
  }
  lines.push("", "Options:", "  --help, -h       Show this help", "  --version, -v    Print the version");
  return lines;
}

export function runCli(argv: readonly string[], io: CliIo): number {
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
      note: "Stub from W0-01. No fixture was validated or run; this is not a PASS.",
    }),
  );
  return 3;
}
