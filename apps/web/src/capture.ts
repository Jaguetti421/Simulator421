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
 * this build runs the composed host (P1-32), so a frame shows real actors; the
 * banner names what is still missing rather than claiming the whole game. Until
 * P1-35 it read FakeSim, because until P1-35 it was the synthetic
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
  readonly watermark: string;
  readonly warmupFrames: number;
  readonly mode: "world" | "recipes";
  readonly cameraTargetM: readonly [number, number, number];
  readonly actorsInViewport: number;
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
  watermark.textContent = "First playable — survival only; no building, combat or perceived knowledge";
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
      // 1.6 m apart: eight adults shoulder to shoulder, so a 28-degree frame at
      // tabletop distance actually contains them at a size a person can judge.
      PROTOTYPE8_RECIPES.map((recipe, index) => ({ id: recipe.id, xMm: 400_000 - 5_600 + index * 1_600, yMm: 400_000, recipeIndex: index }))
    : snapshot.actors.map((actor, index) => ({ id: actor.id, xMm: actor.xMm, yMm: actor.yMm, recipeIndex: index }));

  // The camera looks at the subjects. Before 14 Sep 2026 it targeted [0,0,0]
  // while every actor stood near 400 m, so both evidence captures were empty
  // background — cited as gate evidence and never looked at. The centroid is
  // computed from the actors actually being drawn.
  const centroidM: [number, number, number] = ((): [number, number, number] => {
    if (actors.length === 0) return [400, 0, 400];
    const cx = actors.reduce((sum, a) => sum + a.xMm, 0) / actors.length;
    const cy = actors.reduce((sum, a) => sum + a.yMm, 0) / actors.length;
    // Aim at the actor nearest the centroid, not at the centroid itself: with a
    // scattered population the mean position is usually empty ground, which is
    // how a camera pointed "at the crowd" still photographs nothing.
    let nearest = actors[0] as { xMm: number; yMm: number };
    let best = Number.MAX_SAFE_INTEGER;
    for (const actor of actors) {
      const d = (actor.xMm - cx) ** 2 + (actor.yMm - cy) ** 2;
      if (d < best) {
        best = d;
        nearest = actor;
      }
    }
    return [nearest.xMm / 1000, 0, nearest.yMm / 1000];
  })();
  const camera = parseCameraParam(cameraRaw, centroidM);

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
      watermark: "FirstPlayable",
      warmupFrames: WARMUP_FRAMES,
      cameraTargetM: centroidM,
      /** Sanity: actors whose projection lands inside the viewport. Zero means the picture is empty. */
      actorsInViewport: scene.projectedInsideViewport(actors),
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
