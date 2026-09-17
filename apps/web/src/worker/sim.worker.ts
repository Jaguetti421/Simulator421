/**
 * The simulation Worker (W0-10a; TP v2.0 §3).
 *
 * One simulation writer, in a Worker, running the **same** `@lastclan/sim` bytes
 * Node runs — which is what makes the browser/Node hash parity check meaningful
 * rather than a comparison of two implementations.
 *
 * Since P1-35 this runs the **composed host** (P1-32), not the W0-07 synthetic
 * workload: the build a player watches and the build the evidence describes are
 * the same one. The composed host declares no omissions, and the shell shows
 * that rather than a FakeSim watermark.
 *
 * The wall clock lives here, outside `packages/sim`: the kernel is advanced in
 * whole ticks by a fixed-interval pump, and pausing settles on the last
 * completed tick (TP v1.1 §7: "On pause, settle to the last completed tick").
 */
import { host as simHost } from "@lastclan/sim";
import { BATCH_MS, ticksPerBatch } from "../view/pacing.js";
import type { Speed } from "../view/pacing.js";
import type { MainToWorker, WorkerToMain } from "./protocol.js";

let host: ReturnType<typeof simHost.ComposedHost.create> | null = null;
let speed: Speed = 1;
let pump: ReturnType<typeof setInterval> | null = null;

function send(message: WorkerToMain): void {
  self.postMessage(message);
}

function stopPump(): void {
  if (pump !== null) {
    clearInterval(pump);
    pump = null;
  }
}

function startPump(): void {
  stopPump();
  pump = setInterval(() => {
    if (host === null || host.paused) return;
    host.runTicks(ticksPerBatch(speed));
    send({ type: "tick", tick: host.tick, paused: host.paused, speed });
  }, BATCH_MS);
}

self.onmessage = (event: MessageEvent<MainToWorker>): void => {
  const message = event.data;
  try {
    if (message.type === "init") {
      stopPump();
      host = simHost.ComposedHost.create({ seed: message.seed as never });
      send({ type: "ready", actors: host.actorCount, kernel: simHost.HOST_VERSION, omissions: host.omissions });
      send({ type: "tick", tick: host.tick, paused: host.paused, speed });
      startPump();
      return;
    }
    if (host === null) {
      send({ type: "error", message: `received ${message.type} before init` });
      return;
    }
    if (message.type === "setSpeed") speed = message.speed;
    else if (message.type === "pause") host.pause();
    else if (message.type === "resume") host.resume();
    else if (message.type === "runTicks") {
      const wasPaused = host.paused;
      if (wasPaused) host.resume();
      host.runTicks(message.ticks);
      if (wasPaused) host.pause();
    } else if (message.type === "digest") {
      send({ type: "digest", tick: host.tick, digest: host.authoritativeDigest(), actors: host.actorCount });
      return;
    }
    send({ type: "tick", tick: host.tick, paused: host.paused, speed });
  } catch (e) {
    send({ type: "error", message: (e as Error).message });
  }
};
