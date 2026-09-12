import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { embedPngText, readPngText } from "../../packages/lab/dist/render/draw.js";

/**
 * The `/capture` route under Playwright (W0-10, acceptance criterion 3).
 *
 * The card expected BLOCKED_RENDER in the sandbox. It is not blocked: Chromium
 * runs here with software WebGL (SwiftShader), so the route renders and the
 * screenshot is real. What software rendering **cannot** prove is frame budget
 * or GPU quality — those stay HUMAN_REQUIRED on Jani's PC, and this spec does
 * not claim them.
 *
 * The PNG gets the same `tEXt` metadata treatment the readability renderer uses,
 * from the same function, so a capture can never be separated from the fixture,
 * tick, camera and digest that produced it.
 */
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "..", "handoffs", "W0-10", "evidence");
const CAPTURE = "http://127.0.0.1:4173/apps/web/dist-site/capture.html";
/**
 * Software WebGL is slow: composing and reading back a frame takes seconds here,
 * where a GPU would take milliseconds. The generous timeout is a statement about
 * SwiftShader, not about the renderer — and it is exactly why frame budgets
 * stay HUMAN_REQUIRED on real hardware.
 */
const SOFTWARE_WEBGL_TIMEOUT_MS = 180_000;
/** Runs inside the page, not here — declared so this spec type-checks without the DOM lib. */
declare const getComputedStyle: (element: unknown) => { fontSize: string };
const SIZE = "width=960&height=540";

interface CaptureMeta {
  fixture: string;
  tick: number;
  camera: string;
  actors: number;
  renderer: string;
  kernel: string;
  digest: string;
  watermark: string;
  warmupFrames: number;
}

test("renders after warm-up frames and writes a PNG carrying its own metadata", async ({ page }) => {
  test.setTimeout(SOFTWARE_WEBGL_TIMEOUT_MS);
  await page.goto(`${CAPTURE}?fixture=PRESENT-READ-01&tick=300&camera=45,30,220&textScale=1&${SIZE}`);
  const stage = page.locator("#stage");
  await expect(stage).toHaveAttribute("data-capture-ready", "true", { timeout: 20_000 });

  const meta = JSON.parse((await stage.getAttribute("data-capture-meta")) ?? "{}") as CaptureMeta;
  expect(meta.actors).toBe(137);
  expect(meta.tick).toBe(300);
  expect(meta.warmupFrames).toBeGreaterThanOrEqual(3);
  expect(meta.digest).toMatch(/^[0-9a-f]{8}$/u);

  const shot = await stage.screenshot();
  const png = embedPngText(shot, {
    Software: meta.renderer,
    Fixture: meta.fixture,
    Tick: String(meta.tick),
    Camera: meta.camera,
    Actors: String(meta.actors),
    Kernel: meta.kernel,
    AuthoritativeDigest: meta.digest,
    Watermark: meta.watermark,
    Renderer: "software WebGL (SwiftShader) in the sandbox - proves layout and correctness, never frame budget or GPU quality",
  });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "capture-t300.png"), png);

  const text = readPngText(png);
  expect(text["Fixture"]).toBe("PRESENT-READ-01");
  expect(text["Tick"]).toBe("300");
  expect(text["AuthoritativeDigest"]).toBe(meta.digest);
  expect(text["Watermark"]).toBe("FakeSim");
  expect(png.byteLength).toBeGreaterThan(5_000);
});

test("every FakeSim frame carries a visible watermark inside the captured image", async ({ page }) => {
  await page.goto(`${CAPTURE}?fixture=PRESENT-READ-01&tick=50`);
  await expect(page.locator("#stage")).toHaveAttribute("data-capture-ready", "true", { timeout: 20_000 });
  const watermark = page.getByTestId("fakesim-watermark");
  await expect(watermark).toBeVisible();
  await expect(watermark).toContainText("FakeSim");
  const box = await watermark.boundingBox();
  const stageBox = await page.locator("#stage").boundingBox();
  expect(box).not.toBeNull();
  expect(stageBox).not.toBeNull();
  // Inside the captured region, not beside it.
  expect((box?.x ?? 0) >= (stageBox?.x ?? 0) && (box?.y ?? 0) >= (stageBox?.y ?? 0)).toBe(true);
});

test("honours the camera and textScale parameters", async ({ page }) => {
  await page.goto(`${CAPTURE}?fixture=PRESENT-READ-01&tick=10&camera=60,180,90&textScale=2`);
  await expect(page.locator("#stage")).toHaveAttribute("data-capture-ready", "true", { timeout: 20_000 });
  const meta = JSON.parse((await page.locator("#stage").getAttribute("data-capture-meta")) ?? "{}") as CaptureMeta;
  expect(meta.camera).toBe("60,180,90");
  const fontSize = await page.getByTestId("fakesim-watermark").evaluate((el) => getComputedStyle(el).fontSize);
  expect(fontSize).toBe("26px");
});

test("a different tick produces a different picture", async ({ page }) => {
  test.setTimeout(SOFTWARE_WEBGL_TIMEOUT_MS);
  const shotAt = async (tick: number): Promise<Buffer> => {
    await page.goto(`${CAPTURE}?fixture=PRESENT-READ-01&tick=${tick}&camera=45,0,220&${SIZE}`);
    await expect(page.locator("#stage")).toHaveAttribute("data-capture-ready", "true", { timeout: 20_000 });
    return page.locator("#stage").screenshot();
  };
  const early = await shotAt(20);
  const late = await shotAt(600);
  expect(late.equals(early)).toBe(false);
});

test("renders the eight supplied recipes side by side at default tabletop distance", async ({ page }) => {
  test.setTimeout(SOFTWARE_WEBGL_TIMEOUT_MS);
  await page.goto(`${CAPTURE}?recipes=1&tick=0&camera=45,0,60&${SIZE}`);
  await expect(page.locator("#stage")).toHaveAttribute("data-capture-ready", "true", { timeout: 20_000 });

  const meta = JSON.parse((await page.locator("#stage").getAttribute("data-capture-meta")) ?? "{}") as CaptureMeta & {
    mode: string;
    instances: Record<string, number>;
  };
  expect(meta.mode).toBe("recipes");
  expect(meta.actors).toBe(8);

  // Every recipe's parts were actually drawn: 8 torsos (box) + 8 legs (cylinder)
  // + 8 heads (sphere), plus the headwear and accessories the recipes declare.
  expect(meta.instances["cylinder"]).toBeGreaterThanOrEqual(8);
  expect(meta.instances["sphere"]).toBeGreaterThanOrEqual(8);
  expect(meta.instances["box"]).toBeGreaterThanOrEqual(8);
  expect(meta.instances["cone"]).toBeGreaterThanOrEqual(2);
  // 24 body parts (8 x legs/torso/head) + 8 headwear (every Prototype8 recipe
  // declares one) + 7 accessories (P8-06 declares none, and a "none" slot draws
  // nothing rather than an invisible part).
  const total = Object.values(meta.instances).reduce((a, b) => a + b, 0);
  expect(total).toBe(39);

  const png = embedPngText(await page.locator("#stage").screenshot(), {
    Software: meta.renderer,
    Fixture: "identity-kit-prototype8",
    Camera: meta.camera,
    Actors: String(meta.actors),
    Note: "eight supplied AppearanceRecipe identities at default tabletop distance; visual distinguishability is a HUMAN_REQUIRED judgement, the automated check is structural",
  });
  writeFileSync(join(outDir, "identity-kit-prototype8.png"), png);
  expect(png.byteLength).toBeGreaterThan(5_000);
});
