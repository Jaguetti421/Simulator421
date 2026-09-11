/**
 * Pure CLI dispatcher for clanlab. Kept free of process/global state so it can
 * be tested without spawning. Exit codes:
 *   0  help / version
 *   2  usage error (unknown command)
 *   3  NOT_IMPLEMENTED — the command exists in the plan but its packet has not shipped
 */
export const CLANLAB_VERSION = "0.0.0-w0-01-stub";

export interface CliIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

/** Commands from TP v2.0 §19 and the W0 cards, with the packet that implements each. */
export const PLANNED_COMMANDS: Readonly<Record<string, { implementedBy: string; summary: string }>> = {
  validate: { implementedBy: "W0-05", summary: "Parse and semantically validate fixture files (fixture DSL v1)." },
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
