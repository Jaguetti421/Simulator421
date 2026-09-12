import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The web app build (W0-10a; TP v2.0 §3, §21).
 *
 * `base: "./"` so the built site works from a file path or any sub-path — the
 * Playwright jobs and a reviewer opening `dist-site/index.html` get the same
 * bytes. The output goes to `dist-site` because `dist` is already the TypeScript
 * build output for this package.
 */
export default defineConfig({
  root: "apps/web",
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist-site",
    emptyOutDir: true,
    target: "es2023",
    // Two entries: the shell and the /capture route. A static host maps
    // /capture to capture.html; opening the file directly works too.
    rollupOptions: { input: { index: "apps/web/index.html", capture: "apps/web/capture.html" } },
  },
  worker: { format: "es" },
});
