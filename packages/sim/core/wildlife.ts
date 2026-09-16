/**
 * Immediate threat fallback and prototype wildlife (P1-25; GDD §6, §11).
 *
 * Two things, joined by one rule.
 *
 * **The fallback.** An actor that sees something more dangerous than whatever it
 * is doing drops the plan within TP §6's half-second bound — five ticks — and
 * the decision is `Emergency`, which P1-16 already lets bypass the ordinary
 * switching delay. An actor that finishes chopping wood while a wolf closes is
 * the failure everybody notices.
 *
 * **The wildlife.** Twelve wolves in four packs of three and twenty-four deer,
 * with a 45-metre den leash and dens kept 35 metres from starts and camps, as
 * the GDD's TUNE population specifies. Truce and Sanctuary block harm between
 * **sentient actors**; a wolf is not one, so protection does not touch it.
 *
 * The rule joining them, and the one criterion 3 is about: a species policy is a
 * **function of the animal's own state and what it can perceive**, and nothing
 * else. It never reads who the player has selected, what the camera is looking
 * at, or any hidden fact about its target. A wolf that hunts the selected actor
 * is a wolf the player can feel watching them, and no amount of tuning fixes it
 * afterwards.
 */
import { asInt, isqrt, sub } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";
import type { Candidate } from "./decision.js";

/** TP §6's 0.5 simulation-second bound at 10 Hz. */
export const THREAT_INTERRUPT_TICKS = 5;

/** GDD §11 TUNE population. */
export const WILDLIFE = {
  deer: 24,
  wolves: 12,
  packs: 4,
  wolvesPerPack: 3,
  /** Wolves do not pursue beyond a 45-metre den leash. */
  denLeashMm: 45_000 as Int,
  /** Dens stay at least 35 metres from contestant starts and primary camp sockets. */
  minDenClearanceMm: 35_000 as Int,
} as const;

export type Species = "Wolf" | "Deer";
export type AnimalAction = "Hunt" | "Return" | "Graze" | "Flee";

export interface Animal {
  readonly animalId: string;
  readonly species: Species;
  readonly packId?: string;
  readonly positionMm: readonly [Int, Int];
  readonly denMm: readonly [Int, Int];
  readonly healthMilli: Int;
}

/**
 * What an animal can perceive. Deliberately a small, closed record: there is no
 * field here for a selection, a camera, or a target's hidden state, so a policy
 * cannot read one even by accident.
 */
export interface AnimalPerception {
  readonly nearestActorId?: string;
  readonly nearestActorPositionMm?: readonly [Int, Int];
  readonly nearestActorDistanceMm?: Int;
  /** How many others of its pack are within supporting distance. */
  readonly packMatesNearby: number;
}

export interface AnimalPolicyResult {
  readonly action: AnimalAction;
  readonly targetActorId?: string;
  readonly reason: string;
}

function distance(a: readonly [Int, Int], b: readonly [Int, Int]): number {
  const dx = (a[0] as number) - (b[0] as number);
  const dy = (a[1] as number) - (b[1] as number);
  return isqrt(asInt(dx * dx + dy * dy, "distance")) as number;
}

/** Aggression range for a wolf, in millimetres. TUNE. */
export const WOLF_AGGRO_MM = 18_000 as Int;
/** Distance at which a deer bolts. TUNE. */
export const DEER_FLIGHT_MM = 22_000 as Int;

/**
 * The species policy.
 *
 * Takes the animal and what the animal perceives. That is the whole input: a
 * test asserts the parameter list has not grown, because criterion 3 is about
 * what this function *cannot* see.
 */
export function speciesPolicy(animal: Animal, perception: AnimalPerception): AnimalPolicyResult {
  const fromDen = distance(animal.positionMm, animal.denMm);

  if (animal.species === "Deer") {
    if (perception.nearestActorDistanceMm !== undefined && (perception.nearestActorDistanceMm as number) <= (DEER_FLIGHT_MM as number)) {
      return { action: "Flee", reason: `something is ${perception.nearestActorDistanceMm} mm away` };
    }
    return { action: "Graze", reason: "nothing is close" };
  }

  // Wolves: the leash is checked before the prey, so a wolf outside its leash
  // goes home even with a contestant in front of it. That is what stops the
  // endless chase the GDD rules out.
  if (fromDen > (WILDLIFE.denLeashMm as number)) {
    return { action: "Return", reason: `${fromDen} mm from the den, leash is ${WILDLIFE.denLeashMm} mm` };
  }
  if (perception.nearestActorId !== undefined && perception.nearestActorDistanceMm !== undefined && (perception.nearestActorDistanceMm as number) <= (WOLF_AGGRO_MM as number)) {
    return { action: "Hunt", targetActorId: perception.nearestActorId, reason: `prey ${perception.nearestActorDistanceMm} mm away, ${perception.packMatesNearby} pack mates near` };
  }
  return { action: "Return", reason: "no prey within range" };
}

/** Is a proposed den position far enough from starts and camp sockets? */
export function denPlacementValid(denMm: readonly [Int, Int], keepAway: readonly (readonly [Int, Int])[]): boolean {
  return keepAway.every((point) => distance(denMm, point) >= (WILDLIFE.minDenClearanceMm as number));
}

// ---------------------------------------------------------------------------
// Threat fallback
// ---------------------------------------------------------------------------

export interface ThreatSighting {
  readonly threatId: string;
  readonly kind: "Actor" | "Animal";
  readonly sightedAtTick: Int;
  /** Rough danger in thousandths; a caller supplies it from what it perceived. */
  readonly severityMilli: number;
}

export interface FallbackResult {
  readonly interrupt: boolean;
  readonly candidate?: Candidate;
  readonly latencyTicks: number;
  readonly detail: string;
}

/**
 * Should this actor drop what it is doing?
 *
 * The candidate produced is marked `emergency`, which is what makes P1-16
 * bypass the switching delay. The latency is reported so the five-tick bound is
 * measurable rather than assumed — the same reason `ThreatQueue.overdue` exists.
 */
export function threatFallback(sighting: ThreatSighting, currentTaskSeverityMilli: number, tick: Int): FallbackResult {
  const latencyTicks = Math.max(0, sub(tick, sighting.sightedAtTick) as number);
  if (sighting.severityMilli <= currentTaskSeverityMilli) {
    return { interrupt: false, latencyTicks, detail: `threat ${sighting.severityMilli} does not outweigh the current task ${currentTaskSeverityMilli}` };
  }
  return {
    interrupt: true,
    latencyTicks,
    detail: `threat ${sighting.threatId} (${sighting.severityMilli}) outweighs the current task (${currentTaskSeverityMilli})`,
    candidate: {
      candidateId: sighting.kind === "Animal" ? "goal.flee.animal" : "goal.flee.actor",
      emergency: true,
      considerations: [{ id: "threat", inputMilli: Math.min(1_000, sighting.severityMilli), weightMilli: 2_000 }],
    },
  };
}

/** Did the fallback happen inside TP §6's bound? */
export function withinInterruptBound(result: FallbackResult): boolean {
  return result.latencyTicks <= THREAT_INTERRUPT_TICKS;
}

/** The prototype population, as the GDD specifies it. */
export function prototypePopulation(): { readonly wolves: number; readonly deer: number; readonly packs: readonly string[] } {
  return {
    wolves: WILDLIFE.wolves,
    deer: WILDLIFE.deer,
    packs: Array.from({ length: WILDLIFE.packs }, (_, i) => `pack.${String(i + 1).padStart(2, "0")}`),
  };
}
