/**
 * `packages/sim/host` — the composition root for both runtimes (TP v2.0 §3).
 *
 * The same object is driven by Node (lab, `worker_threads`) and by the browser
 * Worker (W0-10). It owns nothing platform-specific: no clock, no timers, no
 * Node built-ins, no DOM. Callers that need wall-time measure around
 * `runTicks`, which is why the timing harness lives in the test, not here.
 *
 * The pause barrier is explicit: `pause()` takes effect at a tick boundary, and
 * a paused host runs zero ticks and says so rather than silently doing nothing.
 */
import { asInt, formatDigest, sub } from "../primitives/index.js";
import { authoritativeHash, createWorld, runTick, STAGE_ORDER, WORKLOAD_OMISSIONS } from "../core/index.js";
import { decodeWorld, encodeWorld } from "./snapshot.js";
import type { CommandOutcome, Counters, KernelEvent, QueuedCommand, World, WorldConfig } from "../core/index.js";

export const KERNEL_VERSION = "w0-07-synthetic-1" as const;
export const TAPE_VERSION = 1;

export interface RunResult {
  readonly ticksRun: number;
  readonly tick: number;
  /** Present when fewer ticks ran than were asked for, with the reason in plain words. */
  readonly refused?: string;
}

export interface SubmitResult {
  readonly queued: boolean;
  readonly reason?: string;
}

export interface KernelReport {
  readonly kernel: string;
  readonly synthetic: true;
  readonly matchSeed: number;
  readonly actors: number;
  readonly withGuest: boolean;
  readonly tick: number;
  readonly paused: boolean;
  readonly stageOrder: readonly string[];
  readonly counters: Counters & { readonly perTick: Readonly<Record<string, number>> };
  readonly authoritativeDigest: string;
  readonly eventsDropped: number;
  readonly omissions: readonly string[];
  readonly cannotCertify: string;
}

export interface EventTape {
  readonly tapeVersion: number;
  readonly source: string;
  readonly producedBy: string;
  readonly fixtureId: string;
  readonly events: readonly unknown[];
}

export { decodeWorld, encodeWorld, fromSnapshot, toSnapshot } from "./snapshot.js";

export class SimHost {
  readonly #world: World;
  readonly #withGuest: boolean;

  private constructor(world: World, withGuest: boolean) {
    this.#world = world;
    this.#withGuest = withGuest;
  }

  static create(config: WorldConfig): SimHost {
    return new SimHost(createWorld(config), config.withGuest === true);
  }

  get tick(): number {
    return this.#world.tick;
  }

  get paused(): boolean {
    return this.#world.paused;
  }

  get actorCount(): number {
    return this.#world.actors.length;
  }

  /** Takes effect at the current tick boundary; a tick in progress is never cut in half. */
  pause(): void {
    this.#world.paused = true;
  }

  resume(): void {
    this.#world.paused = false;
  }

  /** Run whole ticks. A paused host runs none and reports why (TP v1.1 §4). */
  runTicks(count: number): RunResult {
    if (!Number.isSafeInteger(count) || count < 0) throw new Error(`runTicks needs a non-negative integer, got ${count}`);
    if (this.#world.paused) {
      return { ticksRun: 0, tick: this.#world.tick, refused: "the host is paused; ticks resume only after resume()" };
    }
    for (let i = 0; i < count; i += 1) runTick(this.#world);
    return { ticksRun: count, tick: this.#world.tick };
  }

  /**
   * Queue a law command for the authoritative stage-2 application. Queuing is
   * not acceptance: the validator runs on the tick the command is due, and the
   * outcome appears in `outcomes()`.
   */
  submit(command: { sequence: number; atTick: number; expectedRulesVersion: number; lawId: string; startTick: number; endTick: number }): SubmitResult {
    const queued: QueuedCommand = {
      sequence: asInt(command.sequence, "sequence"),
      atTick: asInt(command.atTick, "atTick"),
      expectedRulesVersion: asInt(command.expectedRulesVersion, "expectedRulesVersion"),
      lawId: command.lawId,
      startTick: asInt(command.startTick, "startTick"),
      endTick: asInt(command.endTick, "endTick"),
    };
    if (queued.atTick <= this.#world.tick) {
      return { queued: false, reason: `atTick ${queued.atTick} is not in the future; the host is at tick ${this.#world.tick}` };
    }
    if (this.#world.pending.some((c) => c.sequence === queued.sequence)) {
      return { queued: false, reason: `sequence ${queued.sequence} is already queued` };
    }
    this.#world.pending.push(queued);
    return { queued: true };
  }

  outcomes(): readonly CommandOutcome[] {
    return this.#world.outcomes;
  }

  events(): readonly KernelEvent[] {
    return this.#world.events;
  }

  authoritativeDigest(): string {
    return formatDigest(authoritativeHash(this.#world));
  }

  /**
   * Counters plus their per-tick averages, the stage order actually executed and
   * the workload's omissions. The omissions travel with the numbers on purpose:
   * a counter from this workload is not a production measurement.
   */
  report(): KernelReport {
    const c = this.#world.counters;
    const ticks = Math.max(1, c.ticks);
    return {
      kernel: KERNEL_VERSION,
      synthetic: true,
      matchSeed: this.#world.matchSeed,
      actors: this.#world.actors.length,
      withGuest: this.#withGuest,
      tick: this.#world.tick,
      paused: this.#world.paused,
      stageOrder: STAGE_ORDER,
      counters: {
        ...c,
        perTick: {
          routeQueries: c.routeQueries / ticks,
          perceptionQueries: c.perceptionQueries / ticks,
          lawQueries: c.lawQueries / ticks,
          eventsCommitted: c.eventsCommitted / ticks,
        },
      },
      authoritativeDigest: this.authoritativeDigest(),
      eventsDropped: this.#world.eventsDropped,
      omissions: WORKLOAD_OMISSIONS,
      cannotCertify:
        "Synthetic workload (W0-07). These counts and any timing measured around them cannot certify FINALE 01, AI latency or any production budget (G0 contract).",
    };
  }

  /**
   * Export the committed events as a clanlab event tape (W0-06 tape v1), with
   * every record in the frozen `CommittedEvent` shape. `producedBy` names this
   * kernel and its seed, which is what distinguishes a kernel tape from a
   * hand-authored one.
   */
  eventTape(fixtureId: string): EventTape {
    const runId = `run-${KERNEL_VERSION}-seed${this.#world.matchSeed}`;
    return {
      tapeVersion: TAPE_VERSION,
      source: `deterministic kernel run: seed ${this.#world.matchSeed}, ${this.#world.actors.length} synthetic actors, ${this.#world.counters.ticks} ticks`,
      producedBy: `${KERNEL_VERSION} (synthetic workload; authoritative digest ${this.authoritativeDigest()})`,
      fixtureId,
      events: this.#world.events.map((e) => ({
        schemaVersion: 0,
        runId,
        branchId: "branch-main",
        sequence: e.sequence,
        tick: e.tick,
        stage: e.stage,
        type: e.type,
        ...(e.actorId === undefined ? {} : { actorId: e.actorId }),
        causalParents: [],
        status: "Factual",
        payload: { kind: `${e.type}.v0`, version: 0, fields: {} },
      })),
    };
  }

  /** The world as save bytes: a checksummed, versioned container (W0-08). */
  save(): Uint8Array {
    return encodeWorld(this.#world);
  }

  /**
   * Rebuild a host from save bytes. The restored host continues the run: the
   * random streams resume from their saved words, so its digests match an
   * uninterrupted run tick for tick.
   */
  static restore(bytes: Uint8Array): SimHost {
    const world = decodeWorld(bytes);
    return new SimHost(world, world.actors.some((a) => a.kind === "Guest"));
  }

  /** Ticks remaining in a Standard match from here — used by callers that pace a run. */
  ticksUntil(target: number): number {
    const t = asInt(target, "target");
    return Math.max(0, sub(t, this.#world.tick));
  }
}

export { dataAgeLabel, freezeSnapshot, InterpolationCache, sampleOf, settlePause, SnapshotBridge } from "./bridge.js";
export type { ActorSample, InterpolatedActor, PauseState, ReadResult, Snapshot } from "./bridge.js";
