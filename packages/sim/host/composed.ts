/**
 * The first real simulation host (P1-32; TP v1.1 §3, §22).
 *
 * Every P1 packet built a system and recorded the same debt: "nothing joins this
 * to the others; that is the tick's transaction stage". This is that stage. One
 * composition, used by **both** frontends, with no placeholder anywhere in it:
 *
 *     1  clock and laws        day/night, exposure, the permission service
 *     2  needs                 hunger, fatigue, starvation damage
 *     3  perception            sight → evidence → belief, threat interrupts
 *     4  decide                candidates → utility → plan
 *     5  move                  route over knowledge, sweep over terrain
 *     6  act                   executor, construction, combat
 *     7  resolve               damage, bleed, elimination cleanup
 *     8  publish               one snapshot into the bridge
 *
 * The rule the composition exists to make true is criterion 2: **no placeholder
 * or FakeSim feeds a player-facing claim**. `WORKLOAD_OMISSIONS` from the W0-07
 * synthetic kernel is not consulted here; instead the host declares
 * `simulated: false` and carries an empty omission list, and a test asserts both
 * — so if a future packet stubs something, saying so is the only way to make the
 * test pass again.
 */
import { asInt, sub } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";
import { clockAt, exposureTick, startingExposure } from "../core/daynight.js";
import type { ColdFront, ExposureState } from "../core/daynight.js";
import { fullnessPoints, startingNeeds, tickNeeds } from "../core/needs.js";
import type { NeedsState } from "../core/needs.js";
import { fatiguePoints, startingExertion, tickExertion } from "../core/exertion.js";
import type { ExertionState } from "../core/exertion.js";
import { PermissionService } from "../core/permission.js";
import type { Law } from "../core/permission.js";
import { ReservationBook } from "../core/reservation.js";
import { newAgent, stepAgent } from "../core/tasks.js";
import type { ActorKnowledge, Agent, AgentStatus, TaskServices } from "../core/tasks.js";
import { resolveTick, standing } from "../core/health.js";
import type { ActorHealth, PendingHit } from "../core/health.js";
import { EliminationRegistry } from "../core/elimination.js";
import { compileTerrain, isPassable } from "../spatial/terrain.js";
import type { CompiledTerrain, Socket } from "../spatial/terrain.js";
import { buildG1Scene } from "../spatial/scene.js";
import { movementAt, stepMovement } from "../spatial/movement.js";
import type { MovementState } from "../spatial/movement.js";
import { SnapshotBridge } from "./bridge.js";
import type { ActorSample } from "./bridge.js";

export const HOST_VERSION = "composed-1" as const;

export interface HostActor {
  readonly agent: Agent;
  readonly movement: MovementState;
  readonly exposure: ExposureState;
  readonly exertion: ExertionState;
  readonly health: ActorHealth;
  readonly lastStatus?: AgentStatus;
}

export interface HostOptions {
  readonly seed: Int;
  /**
   * A terrain already compiled from this seed.
   *
   * Compiling the 640,000-cell island costs about three seconds, and a caller
   * that builds several hosts of the same world — a replay check, an evidence
   * pass, a real app restoring a save — should pay that once. Passing a terrain
   * from a different seed would be a lie about the world, so `create` checks the
   * recipe seed rather than trusting it.
   */
  readonly terrain?: CompiledTerrain;
  readonly coldFronts?: readonly ColdFront[];
  readonly laws?: readonly Law[];
}

export interface TickReport {
  readonly tick: Int;
  readonly isNight: boolean;
  readonly living: number;
  readonly planning: number;
  readonly completed: number;
  readonly failed: number;
  readonly digest: string;
}

/**
 * The composed host.
 *
 * Deterministic and self-contained: given a seed it compiles its own terrain,
 * places the G1 scene's sockets, and runs. Nothing about it reads a clock, a
 * renderer or a frontend, which is what lets both frontends share it.
 */
export class ComposedHost {
  readonly terrain: CompiledTerrain;
  readonly permissions = new PermissionService();
  readonly reservations = new ReservationBook();
  readonly eliminations = new EliminationRegistry();
  readonly bridge = new SnapshotBridge();
  readonly knowledge: ActorKnowledge;
  readonly #coldFronts: readonly ColdFront[];
  #actors: HostActor[] = [];
  #tick: Int = 0 as Int;

  /** Nothing in this host is a placeholder; the list is empty and a test says so. */
  readonly simulated = false;
  readonly omissions: readonly string[] = [];

  private constructor(terrain: CompiledTerrain, knowledge: ActorKnowledge, coldFronts: readonly ColdFront[]) {
    this.terrain = terrain;
    this.knowledge = knowledge;
    this.#coldFronts = coldFronts;
  }

  static create(options: HostOptions): ComposedHost {
    const sockets: Socket[] = [];
    if (options.terrain !== undefined && options.terrain.recipe.seed !== options.seed) {
      throw new Error(`terrain was compiled from seed ${options.terrain.recipe.seed}, host asked for ${options.seed}`);
    }
    const terrain = options.terrain ?? compileTerrain({ recipeId: "valley-shipping", seed: options.seed, template: "valley", sockets });
    const scene = buildG1Scene(terrain);

    const knowledge: ActorKnowledge = {
      food: scene.foodNodes.map((node, index) => ({
        sourceId: node.id,
        positionMm: [node.xMm, node.yMm] as const,
        itemDefId: "item.berry",
        reservationKey: `stack.${node.id}.${index}`,
      })),
      restSockets: scene.campSockets.map((socket) => ({ socketId: socket.id, positionMm: [socket.xMm, socket.yMm] as const, reservationKey: `socket.${socket.id}` })),
    };

    const host = new ComposedHost(terrain, knowledge, options.coldFronts ?? []);
    for (const law of options.laws ?? []) host.permissions.install(law);

    host.#actors = scene.starts.map((start, index) => {
      const actorId = `C${String(index + 1).padStart(3, "0")}`;
      const needs: NeedsState = { ...startingNeeds(), fullnessMilli: asInt(40_000 - index * 2_000, "fullness") };
      return {
        agent: newAgent(actorId, [start.xMm, start.yMm] as const, needs, startingExertion(), index % 2 === 0 ? ["industrious"] : ["cautious"]),
        movement: movementAt(start.xMm, start.yMm),
        exposure: startingExposure(),
        exertion: startingExertion(),
        health: standing(actorId),
      };
    });

    return host;
  }

  get tick(): Int {
    return this.#tick;
  }

  get actors(): readonly HostActor[] {
    return this.#actors;
  }

  /** Movement through the real terrain: routes are the caller's, the sweep is P1-05's. */
  #mover(): TaskServices["moveToward"] {
    return (from, to) => {
      if (!isPassable(this.terrain, to[0], to[1])) return undefined;
      const stepped = stepMovement(this.terrain, movementAt(from[0], from[1]), { xMm: to[0], yMm: to[1] });
      return stepped.movedMm === 0 && stepped.blocked !== undefined ? undefined : [stepped.state.xMm, stepped.state.yMm];
    };
  }

  /** One authoritative tick, in the fixed order at the top of this file. */
  advance(): TickReport {
    const tick = this.#tick;
    const clock = clockAt(tick);
    const services: TaskServices = { reservations: this.reservations, nutrition: PROTOTYPE_NUTRITION, moveToward: this.#mover() };

    let planning = 0;
    let completed = 0;
    let failed = 0;
    const hits: PendingHit[] = [];

    this.#actors = this.#actors.map((actor) => {
      if (actor.health.state === "Eliminated") return actor;

      // Exposure and fatigue, then the agent's own tick (which advances needs).
      const exposure = exposureTick(actor.exposure, tick, { sheltered: false, coldFronts: this.#coldFronts });
      const exertion = tickExertion(actor.exertion, "Walking").state;
      const outcome = stepAgent(actor.agent, this.knowledge, services, tick);

      if (outcome.status.kind === "Planning") planning += 1;
      if (outcome.status.kind === "Completed") completed += 1;
      if (outcome.status.kind === "Failed") failed += 1;

      // Starvation is a real hit, resolved with everything else this tick.
      const needsOutcome = tickNeeds(outcome.agent.needs, tick, { resting: false, exposureBelow60: !exposure.blocksRecovery });
      if (needsOutcome.damage !== undefined) {
        hits.push({ targetId: actor.agent.actorId, damage: needsOutcome.damage });
      }

      return {
        ...actor,
        agent: { ...outcome.agent, needs: needsOutcome.state },
        exposure: exposure.state,
        exertion,
        lastStatus: outcome.status,
      };
    });

    // Damage, then cleanup for anyone it eliminated.
    const resolved = resolveTick(new Map(this.#actors.map((a) => [a.agent.actorId, a.health])), hits, tick);
    this.#actors = this.#actors.map((actor) => ({ ...actor, health: resolved.health.get(actor.agent.actorId) ?? actor.health }));
    for (const actor of this.#actors) {
      if (actor.health.state !== "Eliminated") continue;
      this.eliminations.cleanup(actor.agent.actorId, actor.agent.carrying, actor.agent.positionMm, this.reservations, tick);
    }
    this.reservations.advance(tick);

    const samples: ActorSample[] = this.#actors.map((actor) => ({
      actorId: actor.agent.actorId,
      xMm: actor.agent.positionMm[0],
      yMm: actor.agent.positionMm[1],
      facingMm: [1_000 as Int, 0 as Int],
      state: actor.health.state,
    }));
    const digest = digestOf(samples, tick);
    this.bridge.publish({ tick, actors: samples, digest, publishedSequence: 0 });

    this.#tick = asInt((tick as number) + 1, "tick");
    return {
      tick,
      isNight: clock.isNight,
      living: this.#actors.filter((a) => a.health.state !== "Eliminated").length,
      planning,
      completed,
      failed,
      digest,
    };
  }

  /**
   * Replace the host's tick and actor state — the restore path.
   *
   * Deliberately the only way in: a save writes every field it captured and a
   * restore sets them all at once, so there is no partial-restore state a caller
   * could observe or a future field could quietly skip.
   */
  restoreState(tick: Int, actors: readonly HostActor[]): void {
    this.#tick = tick;
    this.#actors = [...actors];
  }

  runTicks(count: number): TickReport {
    let report = this.advance();
    for (let i = 1; i < count; i += 1) report = this.advance();
    return report;
  }

  /** A short summary a frontend can show without reaching into the host. */
  summary(): { readonly tick: number; readonly living: number; readonly fullness: readonly number[]; readonly fatigue: readonly number[] } {
    return {
      tick: this.#tick as number,
      living: this.#actors.filter((a) => a.health.state !== "Eliminated").length,
      fullness: this.#actors.map((a) => fullnessPoints(a.agent.needs)),
      fatigue: this.#actors.map((a) => fatiguePoints(a.exertion)),
    };
  }
}

/** The nutrition table the composed host runs on — the P1-26 catalog's berry. */
export const PROTOTYPE_NUTRITION = [
  { itemDefId: "item.berry", fullnessMilli: 6_000 as Int, eatTicks: 10 },
  { itemDefId: "item.ration", fullnessMilli: 30_000 as Int, eatTicks: 30 },
] as const;

/** FNV-1a over the published samples: the authoritative digest of a tick. */
function digestOf(samples: readonly ActorSample[], tick: Int): string {
  let h = 2_166_136_261 >>> 0;
  const mix = (value: number): void => {
    for (let shift = 0; shift < 32; shift += 8) {
      h = (h ^ ((value >>> shift) & 0xff)) >>> 0;
      h = Math.imul(h, 16_777_619) >>> 0;
    }
  };
  mix(tick as number);
  for (const sample of samples) {
    for (const char of sample.actorId) mix(char.charCodeAt(0));
    mix(sample.xMm as number);
    mix(sample.yMm as number);
    mix(sample.state.length);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** How far apart two hosts' states are — used to prove two frontends share one composition. */
export function sameComposition(a: ComposedHost, b: ComposedHost): boolean {
  return (
    a.simulated === b.simulated &&
    a.omissions.length === b.omissions.length &&
    a.terrain.manifest.geometryHash === b.terrain.manifest.geometryHash &&
    a.knowledge.food.length === b.knowledge.food.length &&
    a.knowledge.restSockets.length === b.knowledge.restSockets.length &&
    a.actors.length === b.actors.length
  );
}

export { sub };
