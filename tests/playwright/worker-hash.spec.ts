import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { host as simHost } from "../../packages/sim/dist/index.js";

/**
 * Browser Worker hashes equal Node hashes (W0-10a; closes the half of W0-07's
 * criterion 1 that was recorded BLOCKED_RENDER).
 *
 * The browser runs the **same built bytes** Node runs — `packages/sim/dist` is
 * served over HTTP and imported inside a real `Worker`, not re-implemented — so
 * an equal digest means the same code produced the same state, which is the
 * whole claim.
 */
/**
 * `Worker`, `Blob` and `URL.createObjectURL` exist in the page, not in this file:
 * the block below runs inside `page.evaluate`. Declaring them structurally keeps
 * the spec type-checked by the repo's tsc project without pulling in the DOM lib
 * — the same approach the IndexedDB adapter and the renderer's drawing surface
 * take.
 */
interface WorkerLike {
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: { message: string }) => void) | null;
  postMessage: (message: unknown) => void;
  terminate: () => void;
}
declare const Worker: new (url: string, options: { type: string }) => WorkerLike;
declare const Blob: new (parts: string[], options: { type: string }) => unknown;
declare const URL: { createObjectURL: (blob: unknown) => string; revokeObjectURL: (url: string) => void };

const HARNESS = "http://127.0.0.1:4173/tests/playwright/blank.html";
const SIM_MODULE = "http://127.0.0.1:4173/packages/sim/dist/index.js";

async function digestInBrowserWorker(page: Page, ticks: number, withGuest: boolean): Promise<{ digest: string; tick: number; actors: number }> {
  return page.evaluate(
    async ({ moduleUrl, ticks: n, withGuest: guest }) => {
      const source = `
        import { host } from "${moduleUrl}";
        self.onmessage = (e) => {
          const sim = host.SimHost.create({ matchSeed: e.data.seed, withGuest: e.data.withGuest });
          sim.runTicks(e.data.ticks);
          self.postMessage({ digest: sim.authoritativeDigest(), tick: sim.tick, actors: sim.actorCount });
        };
      `;
      const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      const worker = new Worker(url, { type: "module" });
      const result = await new Promise<{ digest: string; tick: number; actors: number }>((resolve, reject) => {
        worker.onmessage = (event: { data: unknown }): void => {
          resolve(event.data as { digest: string; tick: number; actors: number });
        };
        worker.onerror = (event: { message: string }): void => {
          reject(new Error(event.message));
        };
        worker.postMessage({ seed: 4107, ticks: n, withGuest: guest });
      });
      worker.terminate();
      URL.revokeObjectURL(url);
      return result;
    },
    { moduleUrl: SIM_MODULE, ticks, withGuest },
  );
}

function digestInNode(ticks: number, withGuest: boolean): string {
  const sim = simHost.SimHost.create({ matchSeed: 4107 as never, withGuest });
  sim.runTicks(ticks);
  return sim.authoritativeDigest();
}

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
});

test("a browser Worker reaches the same authoritative digest as Node, 137 actors", async ({ page }) => {
  const browser = await digestInBrowserWorker(page, 600, true);
  expect(browser.tick).toBe(600);
  expect(browser.actors).toBe(137);
  expect(browser.digest).toBe(digestInNode(600, true));
});

test("and for the 136-actor workload, at a different tick count", async ({ page }) => {
  const browser = await digestInBrowserWorker(page, 250, false);
  expect(browser.actors).toBe(136);
  expect(browser.digest).toBe(digestInNode(250, false));
});

test("the digests are not trivially equal: the two workloads differ from each other", async ({ page }) => {
  const guest = await digestInBrowserWorker(page, 250, true);
  const core = await digestInBrowserWorker(page, 250, false);
  expect(guest.digest).not.toBe(core.digest);
});
