/**
 * Simultaneous damage and health states (P1-23; GDD §9.2, TP v1.1 §11).
 *
 * Several blows land on the same tick, and the result must not depend on which
 * actor the loop happened to reach first. That is the whole packet:
 *
 *   - **Order independence.** Every hit on a tick is collected, then applied
 *     against the health each target had **at the start of the tick**. An actor
 *     hit by three attackers is downed once, not once per attacker, and shuffling
 *     the attackers changes nothing.
 *   - **Lethal ordinary damage downs, it does not eliminate.** GDD §9.2: a
 *     downed contestant has a bleed-out timer and can be revived. Only damage
 *     that lands on someone *already* downed eliminates, and only where the laws
 *     allow it.
 *   - **Boundaries are the same ones everything else uses.** A revive completing
 *     on the tick a blow lands, and a blow landing on the tick a bleed-out
 *     expires, both resolve by the start-of-tick rule rather than by whoever ran
 *     first.
 */
import { add, asInt, sub } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";
import type { DamageEvent } from "./needs.js";

/** GDD §9.2: a TUNE 30-second bleed-out at 10 Hz. */
export const BLEED_OUT_TICKS = 300;
/** GDD §9.2: a TUNE six-second interruptible revive. */
export const REVIVE_TICKS = 60;
/** Health a revived contestant returns with, in thousandths. TUNE. */
export const REVIVED_HEALTH_MILLI = 25_000 as Int;

export type HealthState = "Standing" | "Downed" | "Eliminated";

export interface ActorHealth {
  readonly actorId: string;
  readonly healthMilli: Int;
  readonly state: HealthState;
  /** Tick the bleed-out ends, while downed. */
  readonly bleedOutAtTick?: Int;
  /** Ticks the bleed-out spent paused under protection (P1-13). */
  readonly pausedTicks: number;
}

export interface PendingHit {
  readonly targetId: string;
  readonly attackerId?: string;
  readonly damage: DamageEvent;
  /** Terminal damage bypasses the downed state entirely (GDD §9.2, minute 58). */
  readonly terminal?: boolean;
  /** Whether the laws permit eliminating an already-downed target. */
  readonly mayEliminateDowned?: boolean;
}

export interface Transition {
  readonly actorId: string;
  readonly from: HealthState;
  readonly to: HealthState;
  readonly atTick: Int;
  readonly cause: "Damage" | "BleedOut" | "Revive" | "Terminal";
  readonly byActorId?: string;
}

export interface ResolveResult {
  readonly health: ReadonlyMap<string, ActorHealth>;
  readonly transitions: readonly Transition[];
}

export function standing(actorId: string, healthMilli: Int = 100_000 as Int): ActorHealth {
  return { actorId, healthMilli, state: "Standing", pausedTicks: 0 };
}

/**
 * Apply every hit of one tick at once.
 *
 * Damage is summed per target against the health each had at the **start** of
 * the tick, so three simultaneous blows are one transition, not three. Hits are
 * sorted by target and attacker before summing, so the order a caller collected
 * them in cannot reach the result.
 */
export function resolveTick(before: ReadonlyMap<string, ActorHealth>, hits: readonly PendingHit[], tick: Int): ResolveResult {
  const health = new Map(before);
  const transitions: Transition[] = [];

  const byTarget = new Map<string, PendingHit[]>();
  for (const hit of hits) {
    const list = byTarget.get(hit.targetId) ?? [];
    list.push(hit);
    byTarget.set(hit.targetId, list);
  }

  // Targets in ID order, and each target's hits in attacker order: two runs
  // that collected the same hits in different orders produce the same result
  // and the same transition list.
  for (const targetId of [...byTarget.keys()].sort()) {
    const current = health.get(targetId);
    if (current === undefined || current.state === "Eliminated") continue;

    const targetHits = (byTarget.get(targetId) as PendingHit[]).sort((a, b) => ((a.attackerId ?? "") < (b.attackerId ?? "") ? -1 : 1));
    let total = 0 as Int;
    for (const hit of targetHits) total = add(total, hit.damage.hpMilli);

    const terminal = targetHits.some((hit) => hit.terminal === true);
    const mayEliminateDowned = targetHits.some((hit) => hit.mayEliminateDowned === true);
    const firstAttacker = targetHits.find((hit) => hit.attackerId !== undefined)?.attackerId;
    const remaining = asInt(Math.max(0, (current.healthMilli as number) - (total as number)), "health");

    if (current.state === "Downed") {
      // A downed target is only eliminated by further damage where the laws
      // allow it, or by terminal damage which bypasses everything.
      if (terminal || mayEliminateDowned) {
        health.set(targetId, { ...current, healthMilli: 0 as Int, state: "Eliminated" });
        transitions.push({ actorId: targetId, from: "Downed", to: "Eliminated", atTick: tick, cause: terminal ? "Terminal" : "Damage", ...(firstAttacker === undefined ? {} : { byActorId: firstAttacker }) });
      } else {
        health.set(targetId, { ...current, healthMilli: remaining });
      }
      continue;
    }

    if (remaining > 0) {
      health.set(targetId, { ...current, healthMilli: remaining });
      continue;
    }

    if (terminal) {
      health.set(targetId, { ...current, healthMilli: 0 as Int, state: "Eliminated" });
      transitions.push({ actorId: targetId, from: "Standing", to: "Eliminated", atTick: tick, cause: "Terminal", ...(firstAttacker === undefined ? {} : { byActorId: firstAttacker }) });
      continue;
    }

    // Lethal ordinary damage downs. Once, however many blows landed.
    health.set(targetId, { ...current, healthMilli: 0 as Int, state: "Downed", bleedOutAtTick: add(tick, asInt(BLEED_OUT_TICKS, "bleedOut")), pausedTicks: 0 });
    transitions.push({ actorId: targetId, from: "Standing", to: "Downed", atTick: tick, cause: "Damage", ...(firstAttacker === undefined ? {} : { byActorId: firstAttacker }) });
  }

  return { health, transitions };
}

export interface BleedOutOptions {
  /** Actors whose bleed-out is paused this tick — protection covers them (P1-13). */
  readonly protectedActorIds?: ReadonlySet<string>;
}

/**
 * Advance bleed-out timers.
 *
 * A protected actor's timer **pauses**: its end tick moves forward by one so the
 * remaining time is unchanged, exactly as GDD §9.2 requires — "expiration
 * resumes the remaining paused timer, without accumulating missed damage".
 */
export function tickBleedOut(health: ReadonlyMap<string, ActorHealth>, tick: Int, options: BleedOutOptions = {}): ResolveResult {
  const next = new Map(health);
  const transitions: Transition[] = [];

  for (const actorId of [...health.keys()].sort()) {
    const actor = health.get(actorId) as ActorHealth;
    if (actor.state !== "Downed" || actor.bleedOutAtTick === undefined) continue;

    if (options.protectedActorIds?.has(actorId) === true) {
      next.set(actorId, { ...actor, bleedOutAtTick: add(actor.bleedOutAtTick, 1 as Int), pausedTicks: actor.pausedTicks + 1 });
      continue;
    }
    if (tick >= actor.bleedOutAtTick) {
      next.set(actorId, { ...actor, state: "Eliminated", healthMilli: 0 as Int });
      transitions.push({ actorId, from: "Downed", to: "Eliminated", atTick: tick, cause: "BleedOut" });
    }
  }

  return { health: next, transitions };
}

export interface Revive {
  readonly targetId: string;
  readonly byActorId: string;
  readonly startedAtTick: Int;
}

/** Ticks remaining on a revive, or zero when it is due. */
export function reviveRemaining(revive: Revive, tick: Int): number {
  return Math.max(0, REVIVE_TICKS - (sub(tick, revive.startedAtTick) as number));
}

/**
 * Apply revives that complete this tick, **before** the tick's damage.
 *
 * The boundary rule, stated once: a revive completing on tick N takes effect at
 * the start of N, and damage landing on N applies to the revived actor. The
 * alternative — damage first — means a rescuer who arrived in time watches the
 * revive succeed on a corpse. Whichever order is chosen it must be *fixed*, and
 * this is the fixed one.
 */
export function applyRevives(health: ReadonlyMap<string, ActorHealth>, revives: readonly Revive[], tick: Int): ResolveResult {
  const next = new Map(health);
  const transitions: Transition[] = [];

  for (const revive of [...revives].sort((a, b) => (a.targetId < b.targetId ? -1 : 1))) {
    if (reviveRemaining(revive, tick) > 0) continue;
    const actor = next.get(revive.targetId);
    if (actor === undefined || actor.state !== "Downed") continue;
    const { bleedOutAtTick: _ended, ...rest } = actor;
    next.set(revive.targetId, { ...rest, healthMilli: REVIVED_HEALTH_MILLI, state: "Standing", pausedTicks: 0 });
    transitions.push({ actorId: revive.targetId, from: "Downed", to: "Standing", atTick: tick, cause: "Revive", byActorId: revive.byActorId });
  }

  return { health: next, transitions };
}

/**
 * One tick of health, in the fixed order: revives, then damage, then bleed-out.
 *
 * Every caller gets the same sequence, which is what makes "the agreed boundary
 * semantics" a property of the build rather than of each call site.
 */
export function healthTick(
  before: ReadonlyMap<string, ActorHealth>,
  input: { readonly revives?: readonly Revive[]; readonly hits?: readonly PendingHit[]; readonly protectedActorIds?: ReadonlySet<string> },
  tick: Int,
): ResolveResult {
  const revived = applyRevives(before, input.revives ?? [], tick);
  const damaged = resolveTick(revived.health, input.hits ?? [], tick);
  const bled = tickBleedOut(damaged.health, tick, { ...(input.protectedActorIds === undefined ? {} : { protectedActorIds: input.protectedActorIds }) });
  return { health: bled.health, transitions: [...revived.transitions, ...damaged.transitions, ...bled.transitions] };
}
