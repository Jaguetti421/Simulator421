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
  await expect(page.getByTestId("actors")).toHaveText("137");
  await expect(page.getByTestId("kernel")).toContainText("w0-07-synthetic");
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

test("carries the synthetic watermark and lists what the workload does not do", async ({ page }) => {
  await expect(page.getByTestId("watermark")).toContainText("SYNTHETIC WORKLOAD");
  await expect(page.getByTestId("watermark")).toContainText("not gameplay");
  await expect(page.locator("main ul li")).not.toHaveCount(0);
});

test("reports the authoritative digest the Worker actually holds", async ({ page }) => {
  await page.getByTestId("pause").click();
  await page.getByTestId("digest").click();
  await expect(page.getByTestId("digest-value")).toHaveText(/^[0-9a-f]{8}$/u);
});
