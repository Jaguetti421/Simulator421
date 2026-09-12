import { describe, expect, it } from "vitest";
import { CLANLAB_VERSION, PLANNED_COMMANDS, runCli } from "./run.js";

/** Commands that have shipped; the rest must still report NOT_IMPLEMENTED. */
const IMPLEMENTED_COMMANDS = ["validate", "run", "inspect", "render"];

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) }, out, err };
}

describe("clanlab CLI dispatch", () => {
  it("prints usage and exits 0 with no arguments or --help", () => {
    for (const argv of [[], ["--help"], ["-h"]]) {
      const c = capture();
      expect(runCli(argv, c.io)).toBe(0);
      expect(c.out.join("\n")).toContain("Usage: clanlab <command>");
      expect(c.err).toHaveLength(0);
    }
  });

  it("prints the version and exits 0 with --version", () => {
    const c = capture();
    expect(runCli(["--version"], c.io)).toBe(0);
    expect(c.out).toEqual([`clanlab ${CLANLAB_VERSION}`]);
  });

  it("rejects an unknown command with exit 2 and usage on stderr", () => {
    const c = capture();
    expect(runCli(["frobnicate"], c.io)).toBe(2);
    expect(c.err[0]).toContain('unknown command "frobnicate"');
    expect(c.out).toHaveLength(0);
  });

  it("reports every still-unimplemented command as NOT_IMPLEMENTED with exit 3, naming its packet — never a PASS", () => {
    for (const [name, info] of Object.entries(PLANNED_COMMANDS)) {
      if (IMPLEMENTED_COMMANDS.includes(name)) continue;
      const c = capture();
      const code = runCli([name, "contracts/examples/AI-03-PATIENT-WAIT.json"], c.io);
      expect(code).toBe(3);
      const report = JSON.parse(c.out[0] ?? "{}") as Record<string, unknown>;
      expect(report["status"]).toBe("NOT_IMPLEMENTED");
      expect(report["implementedBy"]).toBe(info.implementedBy);
      expect(report["inputs"]).toEqual(["contracts/examples/AI-03-PATIENT-WAIT.json"]);
      expect(JSON.stringify(report)).not.toMatch(/"PASS"/);
    }
  });

  it("names every planned lab command and the packet that ships it", () => {
    expect(Object.keys(PLANNED_COMMANDS)).toEqual(["validate", "run", "inspect", "batch", "replay", "render"]);
    expect(Object.values(PLANNED_COMMANDS).map((p) => p.implementedBy)).toEqual([
      "W0-05",
      "W0-06",
      "W0-06",
      "P3 (seed batches)",
      "W0-08 (snapshots and hashes)",
      "W0-09",
    ]);
  });

  it("validate is implemented (W0-05): it reports usage errors, not NOT_IMPLEMENTED", () => {
    const c = capture();
    expect(runCli(["validate"], c.io)).toBe(2);
    expect(c.err.join("\n")).toContain("no fixture paths given");
    expect(c.out.join("\n")).not.toContain("NOT_IMPLEMENTED");

    const opt = capture();
    expect(runCli(["validate", "--fixture"], opt.io)).toBe(2);
    expect(opt.err.join("\n")).toContain("--fixture needs a path");
  });

  it("run and inspect are implemented (W0-06): they report usage errors, not NOT_IMPLEMENTED", () => {
    const noFixture = capture();
    expect(runCli(["run"], noFixture.io)).toBe(2);
    expect(noFixture.err.join("\n")).toContain("no fixture paths given");
    expect(noFixture.out.join("\n")).not.toContain("NOT_IMPLEMENTED");

    const badOption = capture();
    expect(runCli(["run", "--fixture", "x.json", "--frobnicate"], badOption.io)).toBe(2);
    expect(badOption.err.join("\n")).toContain("unknown option --frobnicate");

    const badCeiling = capture();
    expect(runCli(["run", "--fixture", "x.json", "--log-max-bytes", "12"], badCeiling.io)).toBe(2);
    expect(badCeiling.err.join("\n")).toContain("at least 1024");

    const noBundle = capture();
    expect(runCli(["inspect"], noBundle.io)).toBe(2);
    expect(noBundle.err.join("\n")).toContain("no bundle directory given");

    const noOut = capture();
    expect(runCli(["render", "--fixture", "x.json", "--tick", "1"], noOut.io)).toBe(2);
    expect(noOut.err.join("\n")).toContain("--fixture, --tick and --out are all required");
  });

  it("documents every exit code it can return, including BLOCKED", () => {
    const c = capture();
    runCli(["--help"], c.io);
    const help = c.out.join("\n");
    for (const line of ["0  every requested supported check passed", "1  failed", "2  usage error", "3  the command is planned", "4  blocked"]) {
      expect(help).toContain(line);
    }
  });
});
