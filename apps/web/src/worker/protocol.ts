/**
 * The Worker protocol (W0-10a; TP v2.0 §3).
 *
 * Main → Worker: control only. Worker → Main: the confirmed tick and, on
 * request, the authoritative digest. The main thread never reaches into
 * simulation state; it receives what the Worker has already committed, which is
 * what makes "the page shows the confirmed tick" a truthful claim rather than an
 * optimistic one.
 */
import type { Speed } from "../view/pacing.js";

export type MainToWorker =
  | { readonly type: "init"; readonly seed: number; readonly withGuest: boolean }
  | { readonly type: "setSpeed"; readonly speed: Speed }
  | { readonly type: "pause" }
  | { readonly type: "resume" }
  | { readonly type: "runTicks"; readonly ticks: number }
  | { readonly type: "digest" };

export type WorkerToMain =
  | { readonly type: "ready"; readonly actors: number; readonly kernel: string; readonly omissions: readonly string[] }
  | { readonly type: "tick"; readonly tick: number; readonly paused: boolean; readonly speed: Speed }
  | { readonly type: "digest"; readonly tick: number; readonly digest: string; readonly actors: number }
  | { readonly type: "error"; readonly message: string };
