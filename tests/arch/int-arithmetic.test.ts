import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The typed `Int` rule is wired and it bites (FIX-07).
 *
 * Lives in `tests/` rather than beside the code it guards: it shells out to
 * ESLint, and `packages/sim` has no Node types on purpose. Putting it there is
 * what broke the build on the first attempt.
 *
 * Deferred four times — W0-02 to W0-07 to "the first P1 packet with
 * comparison-heavy arithmetic" to the debt passes — and delivered by the
 * reviewing agent in answer to REVIEW-REQUEST-01 §5.1. A rule nobody runs is a
 * rule that does not exist, so this test runs ESLint for real and requires the
 * rule to reject bare arithmetic on a branded `Int` in `packages/sim`.
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function lint(filePath: string): { ruleHits: number; output: string } {
  try {
    const output = execFileSync("npx", ["eslint", "--format", "json", filePath], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ruleHits: (output.match(/no-bare-int-arithmetic/gu) ?? []).length, output };
  } catch (e) {
    const output = String((e as { stdout?: string }).stdout ?? "");
    return { ruleHits: (output.match(/no-bare-int-arithmetic/gu) ?? []).length, output };
  }
}

describe("no-bare-int-arithmetic is enforced", () => {
  it("flags bare arithmetic on Int in a cleaned file", { timeout: 120_000 }, () => {
    // visibility.ts is clean; a probe file beside it inherits the same config.
    const probe = join(repoRoot, "packages/sim/spatial/__int_probe__.ts");
    writeFileSync(
      probe,
      `import type { Int } from "../primitives/index.js";\ndeclare const a: Int;\ndeclare const b: Int;\nexport const bad = (a + b) > 0;\n`,
    );
    try {
      expect(lint(probe).ruleHits).toBeGreaterThan(0);
    } finally {
      rmSync(probe, { force: true });
    }
  });

  it("leaves the cleaned file clean", { timeout: 120_000 }, () => {
    expect(lint(join(repoRoot, "packages/sim/spatial/visibility.ts")).ruleHits).toBe(0);
  });
});
