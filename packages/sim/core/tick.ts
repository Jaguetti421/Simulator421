/**
 * The tick transaction (W0-07; TP v1.1 §4, TP v2.0 §4).
 *
 * Ten stages run in a fixed order on every tick, and the order is the contract:
 * scheduled transitions install before the actions that resolve on the same
 * boundary, commands are applied in authoritative sequence, and events commit
 * last so downstream consumers see one coherent tick.
 *
 * The ordinal each stage reports is its **executed** position, not a constant
 * written next to its name — so a scrambled order changes the committed event
 * types and the fixture that counts them fails. The stage bodies are synthetic
 * (see `WORKLOAD_OMISSIONS`); the transaction around them is not.
 */
import { add, asInt, isqrt, mixInt53, mixWord, mul, sub } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";
import { clampToEnvelope, distanceSquaredMm, ENVELOPE_MM } from "./world.js";
import type { KernelEvent, QueuedCommand, World } from "./world.js";

/** A runtime law needs 600 ticks of notice (GDD; the same rule the fixture DSL enforces). */
export const MINIMUM_LAW_NOTICE_TICKS = 600 as Int;
/** Neighbours each actor samples per tick in the synthetic perception workload. */
export const PERCEPTION_SAMPLE = 8;
/** How often an actor's velocity is re-drawn, in ticks. */
export const MOTION_JITTER_INTERVAL = 10;

export interface Stage {
  readonly name: string;
  readonly guarantee: string;
  readonly run: (world: World, ordinal: number) => void;
}

function commit(world: World, stage: number, type: string, actorId?: string): void {
  const event: KernelEvent = {
    sequence: world.nextSequence,
    tick: world.tick,
    stage: asInt(stage, "stage"),
    type,
    ...(actorId === undefined ? {} : { actorId }),
  };
  world.nextSequence = add(world.nextSequence, 1 as Int);
  world.counters.eventsCommitted += 1;

  let digest = mixInt53(world.eventDigest, event.sequence);
  digest = mixInt53(digest, event.tick);
  digest = mixInt53(digest, event.stage);
  for (let i = 0; i < type.length; i += 1) digest = mixWord(digest, asInt(type.charCodeAt(i), "typeChar"));
  world.eventDigest = digest;

  if (world.events.length < world.eventLogLimit) world.events.push(event);
  else world.eventsDropped += 1;
}

/** Stage 2 validation: the real rules this kernel can actually check at W0-07. */
function validateCommand(world: World, command: QueuedCommand): string | null {
  if (command.expectedRulesVersion !== world.rulesVersion) return "StaleRules";
  if (command.sequence <= world.lastAppliedSequence) return "StaleRules";
  if (sub(command.startTick, command.atTick) < MINIMUM_LAW_NOTICE_TICKS) return "NoticeTooShort";
  if (command.endTick <= command.startTick) return "NoticeTooShort";
  if (!world.laws.some((l) => l.lawId === command.lawId)) return "ProfileUnsupported";
  return null;
}

/**
 * The ten stages, in the order TP v1.1 §4 fixes. Stages with no synthetic work
 * still run and still commit their marker on the first tick: a stage that does
 * nothing yet is not a stage that may be skipped.
 */
export const STAGES: readonly Stage[] = [
  {
    name: "install",
    guarantee: "New permissions apply to every action that resolves on this boundary",
    run: (world, ordinal) => {
      for (const law of world.laws) {
        if (!law.installed && world.tick >= law.startTick && world.tick < law.endTick) {
          law.installed = true;
          commit(world, ordinal, "law.installed");
        } else if (law.installed && world.tick >= law.endTick) {
          law.installed = false;
          commit(world, ordinal, "law.ended");
        }
      }
    },
  },
  {
    name: "commands",
    guarantee: "Queued player commands apply in authoritative sequence with acknowledgements",
    run: (world, ordinal) => {
      const due = world.pending.filter((c) => c.atTick <= world.tick).sort((a, b) => a.sequence - b.sequence);
      if (due.length === 0) return;
      world.pending = world.pending.filter((c) => c.atTick > world.tick);
      for (const command of due) {
        const reasonId = validateCommand(world, command);
        if (reasonId === null) {
          world.laws.push({ lawId: command.lawId, startTick: command.startTick, endTick: command.endTick, installed: false });
          world.lastAppliedSequence = command.sequence;
          world.rulesVersion = add(world.rulesVersion, 1 as Int);
          world.counters.commandsApplied += 1;
          world.outcomes.push({ sequence: command.sequence, accepted: true, tick: world.tick });
          // The committed event carries no reason field: CommittedEvent v0 has
          // none, and encoding one in the type would smuggle it past the contract.
          commit(world, ordinal, "command.accepted");
        } else {
          world.counters.commandsRejected += 1;
          world.outcomes.push({ sequence: command.sequence, accepted: false, reasonId, tick: world.tick });
          commit(world, ordinal, "command.rejected");
        }
      }
    },
  },
  {
    name: "observations",
    guarantee: "Evidence has a source and a tick; hidden world data stays unavailable",
    run: (world) => {
      // Synthetic perception: a bounded neighbour stride per actor. No evidence
      // records exist yet, so this counts work without claiming knowledge.
      const n = world.actors.length;
      for (let i = 0; i < n; i += 1) {
        const self = world.actors[i] as { xMm: Int; yMm: Int };
        for (let k = 1; k <= PERCEPTION_SAMPLE; k += 1) {
          const other = world.actors[(i + k * 7) % n] as { xMm: Int; yMm: Int };
          distanceSquaredMm(self.xMm, self.yMm, other.xMm, other.yMm);
          world.counters.perceptionQueries += 1;
        }
      }
    },
  },
  {
    name: "decisions",
    guarantee: "Illegal or unsafe plans stop; newly selected actions are scheduled for future progress",
    run: () => {
      // No AI at W0-07. The stage exists, runs and is measured; it decides nothing.
    },
  },
  {
    name: "advance",
    guarantee: "Needs, timers, movement and running actions advance with rechecked legality",
    run: (world) => {
      const jitter = world.tick % MOTION_JITTER_INTERVAL === 0;
      for (const actor of world.actors) {
        if (jitter) {
          actor.vxMm = world.streams.motion.nextRange(-500 as Int, 500 as Int);
          actor.vyMm = world.streams.motion.nextRange(-500 as Int, 500 as Int);
        }
        const nextX = add(actor.xMm, actor.vxMm);
        const nextY = add(actor.yMm, actor.vyMm);
        const clampedX = clampToEnvelope(nextX);
        const clampedY = clampToEnvelope(nextY);
        if (clampedX !== nextX) actor.vxMm = sub(0 as Int, actor.vxMm);
        if (clampedY !== nextY) actor.vyMm = sub(0 as Int, actor.vyMm);
        actor.xMm = clampedX;
        actor.yMm = clampedY;

        // Synthetic route query: straight-line distance to the island centre and
        // a budget check. No graph, no portals, no congestion.
        const centre = asInt(ENVELOPE_MM / 2, "centre");
        const distance = isqrt(distanceSquaredMm(actor.xMm, actor.yMm, centre, centre));
        world.counters.routeQueries += 1;
        if (distance > mul(centre, 2 as Int)) throw new Error("route budget invariant violated: distance exceeds the envelope diagonal");

        // Synthetic law query: is this position inside each installed region law?
        for (const law of world.laws) {
          if (!law.installed) continue;
          world.counters.lawQueries += 1;
          if (law.centerMm === undefined || law.radiusMm === undefined) continue;
          distanceSquaredMm(actor.xMm, actor.yMm, law.centerMm[0], law.centerMm[1]);
        }
      }
    },
  },
  { name: "transactions", guarantee: "Atomic resource and support transfers", run: () => {} },
  { name: "damage", guarantee: "Support applies before same-tick damage; terminal policy holds", run: () => {} },
  { name: "cleanup", guarantee: "Elimination cleanup leaves no duplicate items or held slots", run: () => {} },
  { name: "result", guarantee: "Match result is evaluated after the whole tick", run: () => {} },
  {
    name: "commit",
    guarantee: "Events, checksum and the observer feed commit once, at the end of the tick",
    run: (world, ordinal) => {
      commit(world, ordinal, "tick.committed");
    },
  },
];

export const STAGE_ORDER: readonly string[] = STAGES.map((s) => s.name);

function stageMarker(ordinal: number, name: string): string {
  return `stage.${String(ordinal).padStart(2, "0")}.${name}`;
}

/**
 * Advance exactly one tick. The tick boundary is explicit: the tick number
 * increments first (step t advances state to boundary t), every stage runs in
 * order, and `stageTrace` records what actually ran so a caller can assert the
 * boundary rather than trust it.
 */
export function runTick(world: World): void {
  if (world.paused) throw new Error("runTick called while paused: the pause barrier only releases at a tick boundary");
  world.tick = add(world.tick, 1 as Int);
  world.stageTrace = [];

  const markStages = world.tick === 1;
  STAGES.forEach((stage, index) => {
    const ordinal = index + 1;
    // The marker is committed before the stage body so its sequence number
    // records the order stages were entered, not the order they emitted work.
    if (markStages) commit(world, ordinal, stageMarker(ordinal, stage.name));
    stage.run(world, ordinal);
    world.stageTrace.push(ordinal);
  });

  world.counters.ticks += 1;
  if (world.stageTrace.length !== STAGES.length) {
    throw new Error(`tick ${world.tick} ran ${world.stageTrace.length} stages, not ${STAGES.length}`);
  }
}
