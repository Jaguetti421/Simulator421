import { defineConfig } from "@playwright/test";

/**
 * Playwright configuration (W0-08).
 *
 * Browsers are pre-installed in this sandbox at /opt/pw-browsers (Chromium build
 * 1194, matching Playwright 1.56.x) — see state/STATUS.md. This suite is NOT part
 * of `npm run verify`: verify must pass anywhere `npm ci` runs, and the GitHub
 * runner has no browsers installed. Run it with `npm run test:e2e`.
 *
 * What it proves is narrow and real: the browser's own IndexedDB implementation
 * satisfies the same storage contract the Node adapters do. It proves nothing
 * about rendering, frame budgets or GPU behaviour — those stay HUMAN_REQUIRED.
 */
export default defineConfig({
  testDir: "tests/playwright",
  reporter: [["list"]],
  workers: 1,
  use: { headless: true },
  webServer: {
    command: "node tools/static_server.mjs",
    url: "http://127.0.0.1:4173/tests/playwright/blank.html",
    reuseExistingServer: true,
    timeout: 20_000,
  },
});
