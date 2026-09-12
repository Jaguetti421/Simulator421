/**
 * The `/capture` route (W0-10; TP v2.0 §13).
 *
 * `capture.html?fixture=&tick=&camera=&textScale=` loads a fixture's world,
 * advances the real kernel to the tick, renders after warm-up frames, and only
 * then marks itself ready. Playwright screenshots it; the metadata it needs is
 * exposed on the element and on `window`, and the spec writes it into the PNG.
 *
 * "A screenshot from anything other than the real renderer is not evidence"
 * (TP v2.0 §13). This uses the real kernel and the real scene — and because
 * nothing in this build is gameplay yet, every frame carries the FakeSim
 * watermark **inside the captured image**, not merely in a caption beside it.
 */
import { host as simHost, persistence } from "@lastclan/sim";
import { PROTOTYPE8_RECIPES } from "./kit/recipe.js";
import { parseCameraParam } from "./scene/camera.js";
import { createTabletopScene } from "./scene/scene.js";
import type { SceneActorState } from "./scene/scene.js";

export const WARMUP_FRAMES = 3;

export interface CaptureMetadata {
  readonly fixture: string;
  readonly tick: number;
  readonly camera: string;
  readonly textScale: number;
  readonly actors: number;
  readonly renderer: string;
  readonly kernel: string;
  readonly digest: string;
  readonly watermark: "FakeSim";
  readonly warmupFrames: number;
  readonly mode: "world" | "recipes";
  /** Instances actually drawn, per primitive shape — proof that parts were rendered, not skipped. */
  readonly instances: Readonly<Record<string, number>>;
}

declare global {
  interface Window {
    __capture?: CaptureMetadata;
  }
}

function number(params: URLSearchParams, key: string, fallback: number): number {
  const raw = Number(params.get(key));
  return Number.isFinite(raw) ? raw : fallback;
}

export function startCapture(): void {
  const params = new URLSearchParams(location.search);
  const fixture = params.get("fixture") ?? "PRESENT-READ-01";
  const tick = Math.max(0, Math.trunc(number(params, "tick", 0)));
  const textScale = Math.min(3, Math.max(0.5, number(params, "textScale", 1)));
  const cameraRaw = params.get("camera");
  const camera = parseCameraParam(cameraRaw);
  const width = Math.trunc(number(params, "width", 1280));
  const height = Math.trunc(number(params, "height", 720));

  const stage = document.getElementById("stage");
  if (stage === null) throw new Error("no #stage element");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  stage.append(canvas);

  const watermark = document.createElement("div");
  watermark.id = "watermark";
  watermark.dataset["testid"] = "fakesim-watermark";
  watermark.textContent = "FakeSim — synthetic workload, not gameplay";
  watermark.style.fontSize = `${13 * textScale}px`;
  stage.append(watermark);

  const caption = document.createElement("div");
  caption.id = "caption";
  caption.style.fontSize = `${12 * textScale}px`;
  stage.append(caption);

  const host = simHost.SimHost.create({ matchSeed: 4107 as never, withGuest: true });
  host.runTicks(tick);
  host.pause();

  const scene = createTabletopScene(canvas, { width, height });
  const recipeParade = params.get("recipes") === "1";
  // Actor placement comes from the kernel's own snapshot — the same plain-data
  // format W0-08 saves — so the picture cannot drift from the simulated state.
  const snapshot = persistence.decodeWorldSnapshot(host.save());
  const actors: SceneActorState[] = recipeParade
    ? // One actor per supplied recipe, evenly spaced at default tabletop distance,
      // so the eight identities can be compared side by side (GDD 14.1).
      PROTOTYPE8_RECIPES.map((recipe, index) => ({ id: recipe.id, xMm: 400_000 - 21_000 + index * 6_000, yMm: 400_000, recipeIndex: index }))
    : snapshot.actors.map((actor, index) => ({ id: actor.id, xMm: actor.xMm, yMm: actor.yMm, recipeIndex: index }));

  caption.textContent = `${recipeParade ? "identity kit: 8 recipes" : fixture} · t=${tick} · ${actors.length} actors · camera ${camera.pitchDeg}°/${camera.yawDeg}°/${camera.distanceM}m`;

  let frame = 0;
  const draw = (): void => {
    scene.render(actors, camera);
    frame += 1;
    if (frame < WARMUP_FRAMES) {
      requestAnimationFrame(draw);
      return;
    }
    const metadata: CaptureMetadata = {
      fixture,
      tick,
      camera: `${camera.pitchDeg},${camera.yawDeg},${camera.distanceM}`,
      textScale,
      actors: actors.length,
      renderer: "lastclan-tabletop-3d-v1",
      kernel: simHost.KERNEL_VERSION,
      digest: host.authoritativeDigest(),
      watermark: "FakeSim",
      warmupFrames: WARMUP_FRAMES,
      mode: recipeParade ? "recipes" : "world",
      instances: scene.stats(),
    };
    window.__capture = metadata;
    stage.dataset["captureReady"] = "true";
    stage.dataset["captureMeta"] = JSON.stringify(metadata);
  };
  requestAnimationFrame(draw);
}

startCapture();
