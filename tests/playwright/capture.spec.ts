import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { createCanvas, loadImage } from "canvas";
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

/**
 * Pixel-level sanity (added 14 Sep 2026, REVIEW-EXTERNAL-01 W0-10 High).
 *
 * A capture used as evidence must contain something. Structural counts and
 * correct metadata are not enough: this build produced two empty images that
 * passed every assertion, were cited as gate evidence, and were described to the
 * producer as showing characters. The picture is now measured.
 */
async function centralNonBackgroundFraction(png: Buffer): Promise<number> {
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  // The middle half of the frame, where the subjects are supposed to be.
  const x0 = Math.floor(image.width / 4);
  const y0 = Math.floor(image.height / 4);
  const w = Math.floor(image.width / 2);
  const h = Math.floor(image.height / 2);
  const { data } = ctx.getImageData(x0, y0, w, h);
  // #12161c is the clear colour; #1b2028 is the bare ground plane.
  const isBackground = (r: number, g: number, b: number): boolean =>
    (Math.abs(r - 0x12) < 6 && Math.abs(g - 0x16) < 6 && Math.abs(b - 0x1c) < 6) || (Math.abs(r - 0x1b) < 6 && Math.abs(g - 0x20) < 6 && Math.abs(b - 0x28) < 6);
  let interesting = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (!isBackground(data[i] as number, data[i + 1] as number, data[i + 2] as number)) interesting += 1;
  }
  return interesting / (w * h);
}

interface CaptureMeta {
  fixture: string;
  tick: number;
  camera: string;
  actors: number;
  actorsInViewport: number;
  cameraTargetM: [number, number, number];
  renderer: string;
  kernel: string;
  digest: string;
  watermark: string;
  warmupFrames: number;
}

test("renders after warm-up frames and writes a PNG carrying its own metadata", async ({ page }) => {
  test.setTimeout(SOFTWARE_WEBGL_TIMEOUT_MS);
  await page.goto(`${CAPTURE}?fixture=PRESENT-READ-01&tick=300&camera=40,30,30&textScale=1&${SIZE}`);
  const stage = page.locator("#stage");
  await expect(stage).toHaveAttribute("data-capture-ready", "true", { timeout: 20_000 });

  const meta = JSON.parse((await stage.getAttribute("data-capture-meta")) ?? "{}") as CaptureMeta;
  expect(meta.actors).toBe(137);
  expect(meta.tick).toBe(300);
  expect(meta.warmupFrames).toBeGreaterThanOrEqual(3);
  // The subjects are in frame, and the frame is not empty.
  // Not "most of them": the tabletop camera is clamped to 420 m at a 28-degree
  // field of view, so it frames roughly 110 m of an 800 m island by design
  // (GDD 14.2). A dozen actors in frame is a real picture; zero was not. The bar
  // is set from what the camera can actually do, not raised to flatter it.
  // Not "most of them": the tabletop camera has a 28-degree field of view, so at
  // the 60 m the evidence is captured from it frames a neighbourhood, not the
  // island (GDD 14.2). One actor in frame beats the zero this build shipped, and
  // the pixel check below is what actually proves the picture is not empty.
  expect(meta.actorsInViewport, "no actor projects inside the viewport").toBeGreaterThan(0);
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

  // Measured, not wished for: at the 220 m the evidence used to be captured at,
  // a 1.8 m actor is about four pixels tall and the middle of the frame reads as
  // empty even with twelve actors in it. The tabletop camera is for watching a
  // neighbourhood; the island overview is the 2D readability renderer's job
  // (W0-09). Evidence is now captured at 60 m, where a person can see people.
  expect(await centralNonBackgroundFraction(png), "the middle of the capture is empty background").toBeGreaterThan(0.005);

  const text = readPngText(png);
  expect(text["Fixture"]).toBe("PRESENT-READ-01");
  expect(text["Tick"]).toBe("300");
  expect(text["AuthoritativeDigest"]).toBe(meta.digest);
  expect(text["Watermark"]).toBe("FirstPlayable");
  expect(png.byteLength).toBeGreaterThan(5_000);
});

test("every captured frame carries a visible watermark inside the image", async ({ page }) => {
  await page.goto(`${CAPTURE}?fixture=PRESENT-READ-01&tick=50`);
  await expect(page.locator("#stage")).toHaveAttribute("data-capture-ready", "true", { timeout: 20_000 });
  const watermark = page.getByTestId("fakesim-watermark");
  await expect(watermark).toBeVisible();
  await expect(watermark).toContainText("First playable");
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
  await page.goto(`${CAPTURE}?recipes=1&tick=0&camera=30,0,22&${SIZE}`);
  await expect(page.locator("#stage")).toHaveAttribute("data-capture-ready", "true", { timeout: 20_000 });

  const meta = JSON.parse((await page.locator("#stage").getAttribute("data-capture-meta")) ?? "{}") as CaptureMeta & {
    mode: string;
    instances: Record<string, number>;
  };
  expect(meta.mode).toBe("recipes");
  expect(meta.actors).toBe(8);
  expect(meta.actorsInViewport, "the eight identities are not in frame").toBe(8);

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
  expect(await centralNonBackgroundFraction(png), "the identity kit capture shows no characters").toBeGreaterThan(0.02);
});
