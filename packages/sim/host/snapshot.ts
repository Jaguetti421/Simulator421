/**
 * World ↔ snapshot mapping (W0-08, slice 2).
 *
 * `packages/sim/persistence` may not import `core` (dependency direction,
 * INTERFACES.md), so the save format is plain data and this module — in `host`,
 * which may import both — is the only place that knows how a live `World` maps
 * onto it. Restoring rebuilds the random streams from their saved words, which
 * is what makes a continued run identical to an uninterrupted one.
 */
import { RandomStream } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";
import { createWorld, zeroCounters } from "../core/index.js";
import type { Actor, KernelLaw, QueuedCommand, World } from "../core/index.js";
import { decodeWorldSnapshot, encodeWorldSnapshot } from "../persistence/snapshot.js";
import type { WorldSnapshot } from "../persistence/snapshot.js";

export function toSnapshot(world: World): WorldSnapshot {
  return {
    tick: world.tick,
    rulesVersion: world.rulesVersion,
    matchSeed: world.matchSeed,
    lastAppliedSequence: world.lastAppliedSequence,
    nextSequence: world.nextSequence,
    eventDigest: world.eventDigest,
    actors: world.actors.map((a) => ({
      id: a.id,
      idNumber: a.idNumber,
      kind: a.kind,
      xMm: a.xMm,
      yMm: a.yMm,
      vxMm: a.vxMm,
      vyMm: a.vyMm,
      healthMilli: a.healthMilli,
      staminaMilli: a.staminaMilli,
    })),
    laws: world.laws.map((l) => ({
      lawId: l.lawId,
      startTick: l.startTick,
      endTick: l.endTick,
      installed: l.installed,
      centerXMm: l.centerMm?.[0] ?? null,
      centerYMm: l.centerMm?.[1] ?? null,
      radiusMm: l.radiusMm ?? null,
    })),
    pending: world.pending.map((c) => ({
      sequence: c.sequence,
      atTick: c.atTick,
      expectedRulesVersion: c.expectedRulesVersion,
      lawId: c.lawId,
      startTick: c.startTick,
      endTick: c.endTick,
    })),
    streams: { motion: world.streams.motion.snapshot(), laws: world.streams.laws.snapshot() },
  };
}

/**
 * Rebuild a world from a snapshot. Counters and the event log are **not**
 * restored: they are diagnostics, they are excluded from the authoritative hash,
 * and pretending a restored run had already counted them would be a lie about
 * work this process never did.
 */
export function fromSnapshot(snapshot: WorldSnapshot): World {
  const seeded = createWorld({ matchSeed: snapshot.matchSeed as Int, withGuest: snapshot.actors.some((a) => a.kind === "Guest") });
  const actors: Actor[] = snapshot.actors.map((a) => ({
    id: a.id,
    idNumber: a.idNumber as Int,
    kind: a.kind as Actor["kind"],
    xMm: a.xMm as Int,
    yMm: a.yMm as Int,
    vxMm: a.vxMm as Int,
    vyMm: a.vyMm as Int,
    healthMilli: a.healthMilli as Int,
    staminaMilli: a.staminaMilli as Int,
  }));
  const laws: KernelLaw[] = snapshot.laws.map((l) => ({
    lawId: l.lawId,
    startTick: l.startTick as Int,
    endTick: l.endTick as Int,
    installed: l.installed,
    ...(l.centerXMm === null || l.centerYMm === null ? {} : { centerMm: [l.centerXMm as Int, l.centerYMm as Int] as const }),
    ...(l.radiusMm === null ? {} : { radiusMm: l.radiusMm as Int }),
  }));
  const pending: QueuedCommand[] = snapshot.pending.map((c) => ({
    sequence: c.sequence as Int,
    atTick: c.atTick as Int,
    expectedRulesVersion: c.expectedRulesVersion as Int,
    lawId: c.lawId,
    startTick: c.startTick as Int,
    endTick: c.endTick as Int,
  }));

  return {
    ...seeded,
    tick: snapshot.tick as Int,
    rulesVersion: snapshot.rulesVersion as Int,
    actors,
    laws,
    pending,
    outcomes: [],
    lastAppliedSequence: snapshot.lastAppliedSequence as Int,
    streams: {
      motion: new RandomStream({ a: snapshot.streams.motion.a as Int, b: snapshot.streams.motion.b as Int, c: snapshot.streams.motion.c as Int, counter: snapshot.streams.motion.counter as Int }),
      laws: new RandomStream({ a: snapshot.streams.laws.a as Int, b: snapshot.streams.laws.b as Int, c: snapshot.streams.laws.c as Int, counter: snapshot.streams.laws.counter as Int }),
    },
    counters: zeroCounters(actors.length),
    events: [],
    eventsDropped: 0,
    nextSequence: snapshot.nextSequence as Int,
    eventDigest: snapshot.eventDigest as Int,
    stageTrace: [],
    paused: false,
  };
}

export function encodeWorld(world: World): Uint8Array {
  return encodeWorldSnapshot(toSnapshot(world));
}

export function decodeWorld(bytes: Uint8Array): World {
  return fromSnapshot(decodeWorldSnapshot(bytes));
}
