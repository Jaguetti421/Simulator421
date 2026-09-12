/**
 * World state for the minimal deterministic kernel (W0-07).
 *
 * This is a **synthetic** world: actors with positions and velocities, a small
 * set of laws, a command queue and counters. It has no goals, no perception, no
 * economy and no combat. Its purpose is to prove the tick transaction, the
 * determinism rules and the measurement plumbing — TP v1.1 §4 and §18, TP v2.0
 * §4 and §18 — not to play the game. Every omission is listed in
 * `WORKLOAD_OMISSIONS` and travels with every report the kernel produces.
 *
 * Everything consequential is an `Int` through `checkedMath`; the counters and
 * the draw counts are diagnostics and are excluded from the authoritative hash
 * (CONVENTIONS.md).
 */
import { asInt, add, clamp, HashAccumulator, HashDomain, mixInt53, mixWord, mul, mulDiv, RandomStream, sub } from "../primitives/index.js";
import type { Int, RandomState } from "../primitives/index.js";

/** The synthetic population from GDD §"Population with a guest": 100 contestants, 36 wildlife, one guest. */
export const SYNTHETIC_ROSTER = { contestants: 100, wildlife: 36, guest: 1 } as const;
export const CORE_ACTOR_COUNT = SYNTHETIC_ROSTER.contestants + SYNTHETIC_ROSTER.wildlife; // 136
export const GUEST_ACTOR_COUNT = CORE_ACTOR_COUNT + SYNTHETIC_ROSTER.guest; // 137

/** The island envelope used by the workload: 800 m square in millimetres (TP v2.0 §4). */
export const ENVELOPE_MM = 800_000 as Int;

/**
 * What this workload does **not** do. Printed with every counter report so no
 * number from here can be read as a production measurement (G0 contract: "the
 * full-population synthetic workload records operation counts, timings and its
 * explicit omissions. It cannot certify production FINALE 01 or complete AI
 * latency.").
 */
export const WORKLOAD_OMISSIONS: readonly string[] = [
  "no goals, planning, decisions or coordination — stage 4 runs the stage, not an AI",
  "no real navigation: 'route queries' are straight-line distance and budget checks, with no graph, portals or congestion",
  "no real perception: 'perception queries' scan a fixed neighbour stride, with no evidence records, line of sight or knowledge model",
  "no combat, damage, wildlife behaviour, crafting, inventory, reservations or economy",
  "no clans, membership, diplomacy or succession",
  "laws are installed and queried, but no action is refused by one because there are no actions",
  "no careers, no persistence, no observer state and no render snapshot",
  "cannot certify FINALE 01 or any production latency budget",
];

export type ActorKind = "Contestant" | "Wildlife" | "Guest";

export interface Actor {
  readonly id: string;
  /** Stable numeric ID for ordering and hashing (TP v1.1 §4 "stable ordering uses numeric IDs"). */
  readonly idNumber: Int;
  readonly kind: ActorKind;
  xMm: Int;
  yMm: Int;
  vxMm: Int;
  vyMm: Int;
  healthMilli: Int;
  staminaMilli: Int;
}

export interface KernelLaw {
  readonly lawId: string;
  readonly startTick: Int;
  readonly endTick: Int;
  readonly centerMm?: readonly [Int, Int];
  readonly radiusMm?: Int;
  installed: boolean;
}

export interface QueuedCommand {
  readonly sequence: Int;
  readonly atTick: Int;
  readonly expectedRulesVersion: Int;
  readonly lawId: string;
  readonly startTick: Int;
  readonly endTick: Int;
}

export interface CommandOutcome {
  readonly sequence: Int;
  readonly accepted: boolean;
  /** From the frozen v0 reason registry. Present only on a rejection. */
  readonly reasonId?: string;
  readonly tick: Int;
}

/** Diagnostics. Never hashed, never a gate measurement on its own. */
export interface Counters {
  actors: number;
  ticks: number;
  routeQueries: number;
  perceptionQueries: number;
  lawQueries: number;
  eventsCommitted: number;
  commandsApplied: number;
  commandsRejected: number;
}

export function zeroCounters(actors: number): Counters {
  return { actors, ticks: 0, routeQueries: 0, perceptionQueries: 0, lawQueries: 0, eventsCommitted: 0, commandsApplied: 0, commandsRejected: 0 };
}

/** A committed event, in the shape the `CommittedEvent` contract records (W0-04). */
export interface KernelEvent {
  readonly sequence: Int;
  readonly tick: Int;
  readonly stage: Int;
  readonly type: string;
  readonly actorId?: string;
}

export interface World {
  tick: Int;
  rulesVersion: Int;
  readonly matchSeed: Int;
  readonly actors: Actor[];
  readonly laws: KernelLaw[];
  pending: QueuedCommand[];
  outcomes: CommandOutcome[];
  lastAppliedSequence: Int;
  readonly streams: { readonly motion: RandomStream; readonly laws: RandomStream };
  readonly counters: Counters;
  /** Bounded committed-event log; `eventsDropped` records what the bound cost. */
  events: KernelEvent[];
  eventsDropped: number;
  eventLogLimit: number;
  nextSequence: Int;
  /** Chained digest over every committed event, so the hash covers events the log has dropped. */
  eventDigest: Int;
  /** The stage ordinals executed by the last completed tick; a tick boundary requires all ten. */
  stageTrace: number[];
  paused: boolean;
}

export interface WorldConfig {
  readonly matchSeed: Int;
  /** 136 core actors, or 137 with the guest (TP v1.1 §18). */
  readonly withGuest?: boolean;
  readonly eventLogLimit?: number;
}

function actorId(kind: ActorKind, index: number): string {
  if (kind === "Guest") return "G001";
  const n = String(index + 1).padStart(3, "0");
  return kind === "Contestant" ? `C${n}` : `W${n}`;
}

/**
 * Build the synthetic roster. Positions and velocities come from the labelled
 * `world.motion` stream, so the same seed rebuilds the same world and no other
 * stream is advanced (TP v2.0 §4 "adding an unused stream does not advance any
 * other stream").
 */
export function createWorld(config: WorldConfig): World {
  const motion = RandomStream.derive(config.matchSeed, "world.motion");
  const laws = RandomStream.derive(config.matchSeed, "world.laws");
  const actors: Actor[] = [];

  const push = (kind: ActorKind, index: number, idNumber: number): void => {
    actors.push({
      id: actorId(kind, index),
      idNumber: asInt(idNumber, "actorIdNumber"),
      kind,
      xMm: motion.nextRange(0 as Int, ENVELOPE_MM),
      yMm: motion.nextRange(0 as Int, ENVELOPE_MM),
      vxMm: motion.nextRange(-500 as Int, 500 as Int),
      vyMm: motion.nextRange(-500 as Int, 500 as Int),
      healthMilli: 100_000 as Int,
      staminaMilli: 100_000 as Int,
    });
  };

  for (let i = 0; i < SYNTHETIC_ROSTER.contestants; i += 1) push("Contestant", i, 1000 + i);
  for (let i = 0; i < SYNTHETIC_ROSTER.wildlife; i += 1) push("Wildlife", i, 2000 + i);
  if (config.withGuest === true) push("Guest", 0, 3000);

  return {
    tick: 0 as Int,
    rulesVersion: 0 as Int,
    matchSeed: config.matchSeed,
    actors,
    laws: [
      { lawId: "Truce", startTick: 200 as Int, endTick: 1400 as Int, installed: false },
      { lawId: "Sanctuary", startTick: 50 as Int, endTick: 2000 as Int, centerMm: [400_000 as Int, 400_000 as Int], radiusMm: 120_000 as Int, installed: false },
    ],
    pending: [],
    outcomes: [],
    lastAppliedSequence: 0 as Int,
    streams: { motion, laws },
    counters: zeroCounters(actors.length),
    events: [],
    eventsDropped: 0,
    eventLogLimit: config.eventLogLimit ?? 20_000,
    nextSequence: 1 as Int,
    eventDigest: 0 as Int,
    stageTrace: [],
    paused: false,
  };
}

/** Squared distance in millimetres, kept inside the safe range with `mulDiv` where needed. */
export function distanceSquaredMm(ax: Int, ay: Int, bx: Int, by: Int): Int {
  const dx = sub(ax, bx);
  const dy = sub(ay, by);
  return add(mul(dx, dx), mul(dy, dy));
}

/** Keep a coordinate inside the envelope; the caller flips the velocity when it clamps. */
export function clampToEnvelope(value: Int): Int {
  return clamp(value, 0 as Int, ENVELOPE_MM);
}

/** Thousandths of the envelope a position sits at — a cheap integer derived value the hash covers. */
export function envelopeFractionMilli(value: Int): Int {
  return mulDiv(value, 1000 as Int, ENVELOPE_MM);
}

/**
 * The authoritative hash: tick, rules version, every actor's consequential
 * fields, the installed laws, the command frontier, both stream states and the
 * chained event digest. Counters, draw counts and the bounded event log are
 * diagnostics and stay out (CONVENTIONS.md).
 */
export function authoritativeHash(world: World): Int {
  const acc = new HashAccumulator(HashDomain.Authoritative);

  for (const actor of world.actors) {
    let h = mixInt53(0 as Int, actor.xMm);
    h = mixInt53(h, actor.yMm);
    h = mixInt53(h, actor.vxMm);
    h = mixInt53(h, actor.vyMm);
    h = mixInt53(h, actor.healthMilli);
    h = mixInt53(h, actor.staminaMilli);
    acc.add(actor.idNumber, h);
  }

  world.laws.forEach((law, i) => {
    let h = mixInt53(0 as Int, law.startTick);
    h = mixInt53(h, law.endTick);
    h = mixInt53(h, asInt(law.installed ? 1 : 0, "installed"));
    h = mixInt53(h, law.radiusMm ?? (0 as Int));
    acc.add(asInt(4_000_000 + i, "lawKey"), h);
  });

  const stream = (state: RandomState): Int => mixWord(mixWord(mixWord(mixWord(0 as Int, state.a), state.b), state.c), state.counter);
  acc.add(5_000_001 as Int, stream(world.streams.motion.snapshot()));
  acc.add(5_000_002 as Int, stream(world.streams.laws.snapshot()));

  let frontier = mixInt53(0 as Int, world.tick);
  frontier = mixInt53(frontier, world.rulesVersion);
  frontier = mixInt53(frontier, world.lastAppliedSequence);
  frontier = mixInt53(frontier, asInt(world.pending.length, "pending"));
  acc.add(6_000_001 as Int, frontier);
  acc.add(6_000_002 as Int, world.eventDigest);

  return acc.finalize();
}
