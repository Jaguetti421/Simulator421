import { expect, test } from "@playwright/test";

/**
 * The built static site (W0-10a, acceptance criterion 1).
 *
 * This drives `apps/web/dist-site` — the real build output, not a dev server —
 * so "opening it runs the synthetic workload in a Worker" is checked the way a
 * reviewer would check it.
 */
const SITE = "http://127.0.0.1:4173/apps/web/dist-site/index.html";

test.beforeEach(async ({ page }) => {
  await page.goto(SITE);
});

test("boots the kernel in a Worker and shows the confirmed tick advancing", async ({ page }) => {
  await expect(page.getByTestId("actors")).toHaveText("8", { timeout: 20_000 });
  await expect(page.getByTestId("kernel")).toContainText("composed-1");
  // Deliberately not asserting that t=0 is ever observed: the Worker may have
  // advanced before the first paint, and a race is not the claim. The claim is
  // that the number on screen is a tick the Worker confirmed, and that it moves.
  const read = async (): Promise<number> => Number(/t=(\d+)/u.exec((await page.getByTestId("confirmed-tick").textContent()) ?? "")?.[1] ?? "-1");
  const first = await read();
  expect(first).toBeGreaterThanOrEqual(0);
  await expect.poll(read, { timeout: 5000 }).toBeGreaterThan(first);
  await expect(page.getByTestId("error")).toHaveCount(0);
});

test("pause settles on a tick and nothing advances past it", async ({ page }) => {
  await page.getByTestId("pause").click();
  await expect(page.getByTestId("state")).toContainText("paused (settled on the last completed tick)");
  const settled = await page.getByTestId("confirmed-tick").textContent();
  await page.waitForTimeout(600);
  expect(await page.getByTestId("confirmed-tick").textContent()).toBe(settled);

  await page.getByTestId("pause").click();
  await expect(page.getByTestId("confirmed-tick")).not.toHaveText(settled ?? "", { timeout: 5000 });
});

test("offers 1x, 2x and 4x, and 4x advances more ticks per second than 1x", async ({ page }) => {
  for (const speed of [1, 2, 4]) await expect(page.getByTestId(`speed-${speed}`)).toBeVisible();

  // The composed host compiles the island before its first tick, so the shell
  // is genuinely busy for a few seconds at boot. Wait for it to be running
  // before measuring rates, rather than measuring the compile.
  await expect(page.getByTestId("actors")).toHaveText("8", { timeout: 20_000 });

  const measure = async (speed: number): Promise<number> => {
    await page.getByTestId(`speed-${speed}`).click();
    await expect(page.getByTestId(`speed-${speed}`)).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(200);
    const read = async (): Promise<number> => Number(/t=(\d+)/u.exec((await page.getByTestId("confirmed-tick").textContent()) ?? "")?.[1] ?? "0");
    const before = await read();
    await page.waitForTimeout(1000);
    return (await read()) - before;
  };

  const atOne = await measure(1);
  const atFour = await measure(4);
  expect(atOne).toBeGreaterThan(0);
  expect(atFour).toBeGreaterThan(atOne);
});

test("carries a watermark naming what this build is and is not", async ({ page }) => {
  // The claim changed with the build: this runs the composed host, so the
  // watermark names what is missing instead of calling the whole thing fake.
  await expect(page.getByTestId("watermark")).toContainText("FIRST PLAYABLE");
  await expect(page.getByTestId("watermark")).toContainText("Not in it yet");
  for (const missing of ["building", "combat", "clans"]) {
    await expect(page.getByTestId("watermark")).toContainText(missing);
  }
  await expect(page.locator("main ul li")).not.toHaveCount(0);
});

test("reports the authoritative digest the Worker actually holds", async ({ page }) => {
  await page.getByTestId("pause").click();
  await page.getByTestId("digest").click();
  await expect(page.getByTestId("digest-value")).toHaveText(/^[0-9a-f]{8}$/u);
});

test("serves offline: the built site boots with every non-local request blocked", async ({ page }) => {
  // The grep for "https://" in the bundle finds React error URLs and XML
  // namespace strings, which are text, not fetches. This is the check that
  // actually answers the G0 criterion: block every external origin and see
  // whether the site still runs the workload.
  const blocked: string[] = [];
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith("http://127.0.0.1:4173/") || url.startsWith("data:") || url.startsWith("blob:")) {
      await route.continue();
      return;
    }
    blocked.push(url);
    await route.abort();
  });

  await page.goto(SITE);
  await expect(page.getByTestId("actors")).toHaveText("8", { timeout: 20_000 });
  const read = async (): Promise<number> => Number(/t=(\d+)/u.exec((await page.getByTestId("confirmed-tick").textContent()) ?? "")?.[1] ?? "-1");
  await expect.poll(read, { timeout: 5000 }).toBeGreaterThan(0);
  await expect(page.getByTestId("error")).toHaveCount(0);
  expect(blocked, `the site requested external origins: ${blocked.join(", ")}`).toEqual([]);
});
