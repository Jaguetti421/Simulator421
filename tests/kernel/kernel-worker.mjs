/**
 * Node worker_threads entry for the cross-runtime digest check (W0-07).
 * Imports the built package so the worker runs the same bytes as the main
 * thread; `npm run verify` builds before it tests.
 */
import { parentPort, workerData } from "node:worker_threads";
import { host } from "../../packages/sim/dist/index.js";

try {
  const sim = host.SimHost.create({ matchSeed: workerData.seed, withGuest: workerData.withGuest });
  sim.runTicks(workerData.ticks);
  parentPort.postMessage({ digest: sim.authoritativeDigest(), tick: sim.tick, actors: sim.actorCount });
} catch (error) {
  parentPort.postMessage({ error: String(error) });
}
