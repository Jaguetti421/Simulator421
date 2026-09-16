/**
 * Snapshot bridge and interpolation ownership (P1-27; TP v1.1 §3,
 * BRIDGE-OWNERSHIP).
 *
 * The rule the whole bridge exists to enforce: **the simulation publishes, the
 * view reads, and nothing flows back**. A renderer that can reach into the core
 * — to hold a buffer, to smooth a position, to ask for one more tick — is a
 * renderer that can change the outcome of a match by being slow, and that is the
 * bug nobody can reproduce.
 *
 * So:
 *
 *   - The core publishes an immutable snapshot into a **single** slot. Nobody
 *     queues; a late reader gets the newest one and skips the ones it missed.
 *   - Interpolation belongs to the view. The bridge hands out an authoritative
 *     sample and the view keeps its own previous copy; the core never sees a
 *     smoothed value and has no field to receive one through.
 *   - Pause settles on the **acknowledged** tick — the last one the core
 *     actually committed — and the view can always say how old its data is.
 */
import { asInt, sub } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";

export interface ActorSample {
  readonly actorId: string;
  readonly xMm: Int;
  readonly yMm: Int;
  readonly facingMm: readonly [Int, Int];
  readonly state: string;
}

/**
 * One published frame of authoritative state. Frozen on publish, so a view that
 * keeps a reference is keeping a value rather than a handle into the core.
 */
export interface Snapshot {
  readonly tick: Int;
  readonly actors: readonly ActorSample[];
  readonly digest: string;
  /** Wall-clock is not in here on purpose: a snapshot is a fact about a tick. */
  readonly publishedSequence: number;
}

export function freezeSnapshot(snapshot: Snapshot): Snapshot {
  const actors = snapshot.actors.map((actor) => Object.freeze({ ...actor, facingMm: Object.freeze([...actor.facingMm]) as unknown as readonly [Int, Int] }));
  return Object.freeze({ ...snapshot, actors: Object.freeze(actors) });
}

export interface ReadResult {
  readonly snapshot: Snapshot;
  /** Ticks between this snapshot and the core's newest committed tick. */
  readonly ageTicks: number;
  /** Snapshots published since the reader's last read and never seen by it. */
  readonly skipped: number;
}

/**
 * The bridge.
 *
 * One slot, one writer, many readers. `publish` overwrites; it never grows a
 * queue, so a slow reader costs memory of exactly one snapshot and costs the
 * core nothing at all.
 */
export class SnapshotBridge {
  #latest: Snapshot | undefined;
  #published = 0;
  #lastReadSequence = 0;
  /** The last tick the core acknowledged committing — what a pause settles to. */
  #acknowledgedTick: Int = 0 as Int;

  get publishedCount(): number {
    return this.#published;
  }

  get acknowledgedTick(): Int {
    return this.#acknowledgedTick;
  }

  /** Called by the core, once per committed tick. Never blocks on a reader. */
  publish(snapshot: Snapshot): void {
    this.#published += 1;
    this.#acknowledgedTick = snapshot.tick;
    this.#latest = freezeSnapshot({ ...snapshot, publishedSequence: this.#published });
  }

  /** Called by the view. Returns the newest snapshot and how much it missed. */
  read(): ReadResult | undefined {
    const snapshot = this.#latest;
    if (snapshot === undefined) return undefined;
    const skipped = Math.max(0, snapshot.publishedSequence - this.#lastReadSequence - 1);
    this.#lastReadSequence = snapshot.publishedSequence;
    return { snapshot, ageTicks: Math.max(0, sub(this.#acknowledgedTick, snapshot.tick) as number), skipped };
  }

  /** Peek without consuming, for a view that wants the age before deciding to draw. */
  peekAgeTicks(): number | undefined {
    return this.#latest === undefined ? undefined : Math.max(0, sub(this.#acknowledgedTick, this.#latest.tick) as number);
  }
}

// ---------------------------------------------------------------------------
// View-side interpolation
// ---------------------------------------------------------------------------

export interface InterpolatedActor {
  readonly actorId: string;
  /** Interpolated for drawing. Millimetres, but **not** authoritative. */
  readonly xMm: number;
  readonly yMm: number;
  readonly state: string;
  /** True when this position was smoothed rather than taken from a snapshot. */
  readonly interpolated: boolean;
}

/**
 * The view's own cache of the previous sample.
 *
 * It lives here, on the view side, and holds copies. The core has no reference
 * to it and no way to read an interpolated value: `InterpolatedActor` is a
 * different type from `ActorSample` precisely so a smoothed position cannot be
 * passed back into the simulation by mistake.
 */
export class InterpolationCache {
  readonly #previous = new Map<string, ActorSample>();
  #previousTick: Int = 0 as Int;

  get size(): number {
    return this.#previous.size;
  }

  /**
   * Interpolate toward `snapshot` by `alphaMilli` (0 = previous, 1000 = current),
   * then remember the current sample as the next previous.
   */
  interpolate(snapshot: Snapshot, alphaMilli: number): readonly InterpolatedActor[] {
    const alpha = Math.max(0, Math.min(1_000, alphaMilli));
    const out: InterpolatedActor[] = snapshot.actors.map((actor) => {
      const previous = this.#previous.get(actor.actorId);
      if (previous === undefined) {
        return { actorId: actor.actorId, xMm: actor.xMm as number, yMm: actor.yMm as number, state: actor.state, interpolated: false };
      }
      return {
        actorId: actor.actorId,
        xMm: (previous.xMm as number) + Math.trunc((((actor.xMm as number) - (previous.xMm as number)) * alpha) / 1_000),
        yMm: (previous.yMm as number) + Math.trunc((((actor.yMm as number) - (previous.yMm as number)) * alpha) / 1_000),
        state: actor.state,
        interpolated: alpha < 1_000,
      };
    });

    for (const actor of snapshot.actors) this.#previous.set(actor.actorId, { ...actor });
    this.#previousTick = snapshot.tick;
    return out;
  }

  get previousTick(): Int {
    return this.#previousTick;
  }

  /** Drop an actor the view no longer draws. */
  forget(actorId: string): void {
    this.#previous.delete(actorId);
  }
}

// ---------------------------------------------------------------------------
// Pause
// ---------------------------------------------------------------------------

export interface PauseState {
  readonly paused: boolean;
  /** The tick the world is settled on while paused. */
  readonly settledTick: Int;
  /** How stale the view's most recent read was when the pause settled. */
  readonly ageAtPauseTicks: number;
}

/**
 * Settle a pause.
 *
 * The world stops on the tick the **core acknowledged**, not on whatever the
 * view happened to be drawing — a view mid-interpolation is between two ticks,
 * and stopping there would leave the authoritative state on a fraction.
 */
export function settlePause(bridge: SnapshotBridge): PauseState {
  return {
    paused: true,
    settledTick: bridge.acknowledgedTick,
    ageAtPauseTicks: bridge.peekAgeTicks() ?? 0,
  };
}

/** A short line a view can show: which tick, and how stale. */
export function dataAgeLabel(result: ReadResult): string {
  const age = result.ageTicks;
  const skipped = result.skipped;
  return `tick ${result.snapshot.tick}${age === 0 ? " (current)" : ` (${age} tick${age === 1 ? "" : "s"} behind)`}${skipped > 0 ? `, ${skipped} skipped` : ""}`;
}

export function sampleOf(actorId: string, xMm: number, yMm: number, state = "Standing"): ActorSample {
  return { actorId, xMm: asInt(xMm, "xMm"), yMm: asInt(yMm, "yMm"), facingMm: [asInt(1_000, "fx"), asInt(0, "fy")], state };
}
