import { describe, expect, it } from "vitest";
import { CLANLAB_VERSION, PLANNED_COMMANDS, runCli } from "./run.js";

/** Commands that have shipped; the rest must still report NOT_IMPLEMENTED. */
const IMPLEMENTED_COMMANDS = ["validate"];

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) }, out, err };
}

describe("clanlab stub CLI (W0-01)", () => {
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

  it("names the three W0 lab packets", () => {
    expect(Object.keys(PLANNED_COMMANDS)).toEqual(["validate", "run", "render"]);
    expect(Object.values(PLANNED_COMMANDS).map((p) => p.implementedBy)).toEqual(["W0-05", "W0-06", "W0-09"]);
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
});
