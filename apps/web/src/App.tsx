import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatConfirmedTick, matchProgress, SPEEDS } from "./view/pacing.js";
import type { Speed } from "./view/pacing.js";
import type { MainToWorker, WorkerToMain } from "./worker/protocol.js";

/**
 * The runtime shell (W0-10a).
 *
 * No gameplay and no 3D yet — the Three.js scene, the identity kit and the
 * `/capture` route are W0-10b. What this proves is the thing underneath: the
 * kernel runs in a Worker, speed and pause work, and the number on screen is the
 * tick the Worker has actually confirmed.
 */
export const SEED = 4107;

export function App(): React.JSX.Element {
  const worker = useRef<Worker | null>(null);
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [actors, setActors] = useState(0);
  const [kernel, setKernel] = useState("");
  const [omissions, setOmissions] = useState<readonly string[]>([]);

  /**
   * What this build does not do yet.
   *
   * The composed host declares **no** omissions — it stubs nothing — so this
   * list is about scope rather than fakery, and it is the same list the G1
   * evidence prints. It lives here, not in the worker, because it describes the
   * goal library and the content, not the simulation kernel.
   */
  const notYet = [
    "building: sockets exist, no goal chooses to build",
    "combat: preparation, damage and wildlife exist, no goal chooses to fight",
    "perception: knowledge is given to actors, not earned by looking",
    "clans, trust, teaching and careers: all of P2",
  ];
  const [digest, setDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const w = new Worker(new URL("./worker/sim.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (event: MessageEvent<WorkerToMain>): void => {
      const message = event.data;
      if (message.type === "tick") {
        setTick(message.tick);
        setPaused(message.paused);
        setSpeed(message.speed);
      } else if (message.type === "ready") {
        setActors(message.actors);
        setKernel(message.kernel);
        setOmissions(message.omissions);
      } else if (message.type === "digest") {
        setDigest(message.digest);
      } else {
        setError(message.message);
      }
    };
    const init: MainToWorker = { type: "init", seed: SEED, withGuest: true };
    w.postMessage(init);
    return () => {
      w.terminate();
    };
  }, []);

  const send = useCallback((message: MainToWorker): void => {
    worker.current?.postMessage(message);
  }, []);

  const progress = useMemo(() => `${(matchProgress(tick) * 100).toFixed(1)}% of a Standard match`, [tick]);

  return (
    <main>
      {/*
        The watermark now states what this build actually is. It ran the W0-07
        synthetic workload until P1-35; it runs the composed host, so the claim
        changed with the code rather than outliving it. The list is the same one
        the G1 evidence prints — building and combat are composed and unchosen,
        and knowledge is supplied rather than perceived.
      */}
      <p className="watermark" data-testid="watermark">
        FIRST PLAYABLE (P1) — eight contestants surviving on the island. Not in it yet: building, combat, perceived
        knowledge, clans or careers.
      </p>

      <h1>The Last Clan — runtime shell</h1>
      <p className="tick" data-testid="confirmed-tick">
        {formatConfirmedTick(tick)}
      </p>
      <p data-testid="progress">{progress}</p>

      <div>
        {SPEEDS.map((s) => (
          <button key={s} type="button" aria-pressed={speed === s} data-testid={`speed-${s}`} onClick={() => send({ type: "setSpeed", speed: s })}>
            {s}×
          </button>
        ))}
        <button type="button" data-testid="pause" aria-pressed={paused} onClick={() => send({ type: paused ? "resume" : "pause" })}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" data-testid="digest" onClick={() => send({ type: "digest" })}>
          Authoritative digest
        </button>
      </div>

      <dl>
        <dt>State</dt>
        <dd data-testid="state">{paused ? "paused (settled on the last completed tick)" : `running at ${speed}×`}</dd>
        <dt>Actors</dt>
        <dd data-testid="actors">{actors}</dd>
        <dt>Kernel</dt>
        <dd data-testid="kernel">{kernel}</dd>
        <dt>Digest</dt>
        <dd data-testid="digest-value">{digest ?? "—"}</dd>
      </dl>

      {error !== null && <p data-testid="error">Worker error: {error}</p>}

      <h2>What this build does not do yet</h2>
      <ul>
        {[...omissions, ...notYet].map((o) => (
          <li key={o}>{o}</li>
        ))}
      </ul>
    </main>
  );
}
