/**
 * Sanctuary and protected injury state (P1-13; GDD §10, LAW 02).
 *
 * Sanctuary blocks **harm between sentient actors**, and that phrase does all
 * the work. GDD §10 is explicit: "Truce and Sanctuary block harm between
 * sentient actors; they do not stop hunting or animal attacks. A protected
 * contestant seeing a wolf must still choose fight, flee, or seek nearby
 * allies."
 *
 * So protection is narrow on purpose:
 *
 *   - a hostile blow from another actor is refused, wherever either party stands
 *     at the boundary;
 *   - a wolf still bites, hunger still drains, starvation still kills;
 *   - an existing **hostile** bleed pauses while covered and resumes on exactly
 *     the damage it had left, so stepping into a sanctuary is shelter and never
 *     a cure.
 *
 * The distinction rides on P1-09's `isSentientHarm` flag rather than on a list
 * of sources maintained here: a new damage source declares what it is once, and
 * every law that ever cares reads the same field.
 */
import { add, asInt, min, sub } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";
import type { DamageEvent, DamageSource } from "./needs.js";
import type { PermissionResult, PermissionService } from "./permission.js";

export interface HarmAttempt {
  readonly source: DamageSource;
  readonly hpMilli: Int;
  readonly attackerId?: string;
  readonly attackerPositionMm?: readonly [Int, Int];
  readonly targetId: string;
  readonly targetPositionMm: readonly [Int, Int];
  readonly tick: Int;
}

export type HarmOutcome =
  | { readonly applied: true; readonly damage: DamageEvent }
  | { readonly applied: false; readonly denial: PermissionResult };

/**
 * Resolve an attempt to hurt someone.
 *
 * Only an attempt that is **sentient harm** is put to the permission service.
 * A wolf's bite and an empty stomach are not something an actor does to another
 * actor, so no law about sentient harm speaks to them, and asking would be the
 * bug: a sanctuary that stopped wildlife would make the safest place on the
 * island the one where nothing can ever happen.
 */
export function resolveHarm(service: PermissionService, attempt: HarmAttempt): HarmOutcome {
  const isSentientHarm = attempt.source === "Hostile" && attempt.attackerId !== undefined;
  const damage: DamageEvent = { source: attempt.source, hpMilli: attempt.hpMilli, atTick: attempt.tick, isSentientHarm };
  if (!isSentientHarm) return { applied: true, damage };

  const permission = service.check({
    permission: "SentientHarm",
    tick: attempt.tick,
    // Both points, because standing outside does not license reaching in.
    actorPositionMm: attempt.attackerPositionMm ?? attempt.targetPositionMm,
    targetPositionMm: attempt.targetPositionMm,
  });
  return permission.verdict === "Denied" ? { applied: false, denial: permission } : { applied: true, damage };
}

/**
 * An ongoing injury: bleeding, in thousandths of an HP per tick, with a total
 * still to be paid.
 */
export interface BleedState {
  readonly id: string;
  readonly source: DamageSource;
  /** Damage still owed, in thousandths of an HP. */
  readonly remainingMilli: Int;
  readonly perTickMilli: Int;
  /** Ticks this bleed spent paused under protection — evidence, not logic. */
  readonly pausedTicks: number;
}

export interface BleedTickOutcome {
  readonly state: BleedState;
  readonly damage?: DamageEvent;
  readonly paused: boolean;
}

/**
 * Advance one tick of a bleed.
 *
 * A **hostile** bleed pauses while its bearer is covered: the remaining damage
 * is untouched, and the pause is counted. Any other bleed — an animal's wound,
 * exposure — keeps running, because protection is about what actors do to each
 * other.
 */
export function tickBleed(bleed: BleedState, tick: Int, covered: boolean): BleedTickOutcome {
  if (bleed.remainingMilli <= 0) return { state: bleed, paused: false };

  const isHostile = bleed.source === "Hostile";
  if (isHostile && covered) {
    // Paused, not healed: remainingMilli is deliberately unchanged.
    return { state: { ...bleed, pausedTicks: bleed.pausedTicks + 1 }, paused: true };
  }

  const amount = min(bleed.perTickMilli, bleed.remainingMilli);
  return {
    state: { ...bleed, remainingMilli: sub(bleed.remainingMilli, amount) },
    paused: false,
    damage: { source: bleed.source, hpMilli: amount, atTick: tick, isSentientHarm: isHostile },
  };
}

/** Is this point inside any sanctuary active now? Boundaries are inclusive (TP §10). */
export function isCovered(service: PermissionService, pointMm: readonly [Int, Int], tick: Int): boolean {
  return service.check({ permission: "SentientHarm", tick, actorPositionMm: pointMm }).verdict === "Denied";
}

export function newBleed(id: string, source: DamageSource, totalMilli: Int, perTickMilli: Int): BleedState {
  return { id, source, remainingMilli: totalMilli, perTickMilli, pausedTicks: 0 };
}

/** Total damage a bleed has left to pay — what "paused, not cured" is measured on. */
export function bleedRemaining(bleed: BleedState): Int {
  return bleed.remainingMilli;
}

/** Sum of damage actually applied, for a caller reconciling a tick's effects. */
export function applyDamage(healthMilli: Int, events: readonly DamageEvent[]): Int {
  let health = healthMilli;
  for (const event of events) health = asInt(Math.max(0, sub(health, event.hpMilli) as number), "health");
  return health;
}

/** Health after a heal, capped at full — a convenience so callers do not re-derive the cap. */
export function healTo(healthMilli: Int, amountMilli: Int, maxMilli: Int = 100_000 as Int): Int {
  return min(add(healthMilli, amountMilli), maxMilli);
}
