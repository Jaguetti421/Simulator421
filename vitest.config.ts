import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "docs/**"],
    // Deterministic, serial test execution: the sandbox has one CPU and the
    // architecture test spawns ESLint. Parallelism is revisited in a later packet.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
