/**
 * Revival, bleed and elimination cleanup (P1-24; GDD §9.2).
 *
 * The end of a life, handled so that nothing is left behind and nothing happens
 * twice:
 *
 *   - **Protection pauses only covered, sentient-origin bleed.** A wolf's wound
 *     keeps bleeding inside a sanctuary and an actor outside it is not covered
 *     at all. GDD §9.2 is explicit that protection "does not restore lost health
 *     or stabilize wildlife injuries", and the flag P1-09 put on every damage
 *     event is what makes the distinction cheap.
 *   - **A revive consumes its bandage at completion, not at the start.** An
 *     interrupted revive costs nothing but time — otherwise a rescuer who is
 *     driven off has also lost the bandage, and the third interruption in a row
 *     leaves a clan with no way to save anyone.
 *   - **Elimination cleanup runs exactly once.** Leases released, carried items
 *     dropped, and a second call produces nothing — because the tick loop will
 *     call it again, and a drop pile that doubles every tick is a duplication
 *     bug wearing a corpse.
 */
import { add, asInt, sub } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";
import type { DamageSource } from "./needs.js";
import type { ReservationBook } from "./reservation.js";
import { REVIVE_TICKS } from "./health.js";

/** GDD §9.2: the revived contestant "returns with low health and a temporary wound penalty". */
export const WOUND_PENALTY_TICKS = 1_200;
/** How much the wound penalty scales movement and work, in thousandths. TUNE. */
export const WOUND_PENALTY_MILLI = 700;
export const BANDAGE_ITEM_ID = "item.bandage";

export interface BleedSource {
  readonly id: string;
  readonly source: DamageSource;
  readonly remainingMilli: Int;
  readonly perTickMilli: Int;
  readonly pausedTicks: number;
}

/**
 * Should this bleed pause this tick?
 *
 * Two conditions, and both are required: the bearer is covered, and the bleed
 * came from another actor. Writing it as one predicate keeps the rule in one
 * place instead of in every caller that ticks a wound.
 */
export function bleedPauses(bleed: BleedSource, covered: boolean): boolean {
  return covered && bleed.source === "Hostile";
}

export interface BleedTick {
  readonly bleed: BleedSource;
  readonly appliedMilli: Int;
  readonly paused: boolean;
}

export function tickBleedSource(bleed: BleedSource, covered: boolean): BleedTick {
  if (bleed.remainingMilli <= 0) return { bleed, appliedMilli: 0 as Int, paused: false };
  if (bleedPauses(bleed, covered)) return { bleed: { ...bleed, pausedTicks: bleed.pausedTicks + 1 }, appliedMilli: 0 as Int, paused: true };
  const applied = bleed.perTickMilli > bleed.remainingMilli ? bleed.remainingMilli : bleed.perTickMilli;
  return { bleed: { ...bleed, remainingMilli: sub(bleed.remainingMilli, applied) }, appliedMilli: applied, paused: false };
}

// ---------------------------------------------------------------------------
// Revive episodes
// ---------------------------------------------------------------------------

export type ReviveEnd = "Completed" | "Interrupted" | "TargetGone";

export interface ReviveEpisode {
  readonly episodeId: string;
  readonly rescuerId: string;
  readonly targetId: string;
  readonly startedAtTick: Int;
  readonly ticksDone: number;
}

export type ReviveStep =
  | { readonly kind: "Working"; readonly episode: ReviveEpisode; readonly ticksRemaining: number }
  | { readonly kind: "Completed"; readonly targetId: string; readonly rescuerId: string; readonly consumed: typeof BANDAGE_ITEM_ID; readonly woundPenaltyUntilTick: Int }
  | { readonly kind: "Ended"; readonly reason: Exclude<ReviveEnd, "Completed">; readonly bandageConsumed: false; readonly detail: string };

export function beginRevive(episodeId: string, rescuerId: string, targetId: string, tick: Int): ReviveEpisode {
  return { episodeId, rescuerId, targetId, startedAtTick: tick, ticksDone: 0 };
}

/**
 * Advance a revive by one tick.
 *
 * The bandage is named in the `Completed` result and nowhere else, so a caller
 * cannot spend it on any other outcome. An interruption resets the episode
 * entirely — the next attempt starts from zero, which is what "interruptible"
 * means if it is to mean anything.
 */
export function stepRevive(
  episode: ReviveEpisode,
  world: { readonly targetStillDowned: boolean; readonly rescuerHasBandage: boolean; readonly interrupted?: boolean },
  tick: Int,
): ReviveStep {
  if (!world.targetStillDowned) {
    return { kind: "Ended", reason: "TargetGone", bandageConsumed: false, detail: `${episode.targetId} is no longer downed` };
  }
  if (world.interrupted === true) {
    return { kind: "Ended", reason: "Interrupted", bandageConsumed: false, detail: `${episode.rescuerId} was interrupted reviving ${episode.targetId}` };
  }
  if (!world.rescuerHasBandage) {
    return { kind: "Ended", reason: "Interrupted", bandageConsumed: false, detail: `${episode.rescuerId} has no ${BANDAGE_ITEM_ID}` };
  }

  const ticksDone = episode.ticksDone + 1;
  if (ticksDone < REVIVE_TICKS) {
    return { kind: "Working", episode: { ...episode, ticksDone }, ticksRemaining: REVIVE_TICKS - ticksDone };
  }
  return {
    kind: "Completed",
    targetId: episode.targetId,
    rescuerId: episode.rescuerId,
    consumed: BANDAGE_ITEM_ID,
    woundPenaltyUntilTick: add(tick, asInt(WOUND_PENALTY_TICKS, "woundPenalty")),
  };
}

/** Is the revived actor still carrying its wound penalty? */
export function woundPenaltyActive(untilTick: Int, tick: Int): boolean {
  return tick < untilTick;
}

/** Movement and work multiplier while wounded, in thousandths. */
export function woundMultiplierMilli(untilTick: Int, tick: Int): number {
  return woundPenaltyActive(untilTick, tick) ? WOUND_PENALTY_MILLI : 1_000;
}

// ---------------------------------------------------------------------------
// Elimination cleanup
// ---------------------------------------------------------------------------

export interface Drop {
  readonly itemDefId: string;
  readonly count: number;
  readonly positionMm: readonly [Int, Int];
  readonly fromActorId: string;
  readonly atTick: Int;
}

export interface CleanupResult {
  readonly drops: readonly Drop[];
  readonly releasedKeys: readonly string[];
  /** False when this actor had already been cleaned up. */
  readonly performed: boolean;
}

/**
 * Cleanup for an eliminated actor, idempotent by construction.
 *
 * The set of already-cleaned actors lives in the registry rather than in a flag
 * on the actor, because the tick loop will call this again next tick and the
 * actor record may well have been replaced by then. Asking "have I already done
 * this one" of a registry is reliable; asking it of a copied record is not.
 */
export class EliminationRegistry {
  readonly #done = new Set<string>();

  get cleanedCount(): number {
    return this.#done.size;
  }

  wasCleaned(actorId: string): boolean {
    return this.#done.has(actorId);
  }

  cleanup(
    actorId: string,
    carried: Readonly<Record<string, number>>,
    positionMm: readonly [Int, Int],
    reservations: ReservationBook,
    tick: Int,
  ): CleanupResult {
    if (this.#done.has(actorId)) return { drops: [], releasedKeys: [], performed: false };
    this.#done.add(actorId);

    const released = reservations.releaseAllHeldBy(actorId, "Death", tick).map((release) => release.key);
    const drops: Drop[] = Object.entries(carried)
      .filter(([, count]) => count > 0)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([itemDefId, count]) => ({ itemDefId, count, positionMm, fromActorId: actorId, atTick: tick }));

    return { drops, releasedKeys: released, performed: true };
  }
}
