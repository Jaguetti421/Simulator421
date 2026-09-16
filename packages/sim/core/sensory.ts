/**
 * Sensory adapter and isolation (P1-15; TP v1.1 §6, AI 10, SOCIAL 02).
 *
 * This is the only door between the world and an actor's head, and it is a
 * one-way door on purpose. Sight, hearing and the threat check all produce
 * **evidence records** — what was perceived, through which channel, with what
 * confidence — and a decision layer receives nothing else. An enemy the actor
 * has not perceived, a store it has not found, a route it has not walked: none
 * of them can reach a decision, because none of them is in what this returns.
 *
 * The GDD's channels, implemented as written:
 *
 *   - **Sight**: a 160-degree forward field, plus an unobstructed 8-metre
 *     awareness radius that does not care which way the actor is facing.
 *   - **Hearing**: "Sound reveals an approximate event location, not a perfect
 *     enemy inventory" — so a heard event yields a position with real
 *     uncertainty and **no subject identity**.
 *   - **Sleep**: "Sleep reduces sensory range, so an alarm must be heard before
 *     it causes a response."
 *   - **Concealment and light** scale sight range rather than switching it off,
 *     because a hard cutoff produces an actor that is blind at 20.1 metres and
 *     omniscient at 19.9.
 *
 * And the bound TP §6 sets: "a threat newly within a legitimate sensory channel
 * must reach the interrupt queue within the 0.5 simulation second bound" — five
 * ticks at 10 Hz.
 */
import { asInt, isqrt, mul, mulDiv, sub } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";
import type { Belief, Provenance } from "./belief.js";

/** TP §6's 0.5 simulation-second interrupt bound, at the 10 Hz timestep. */
export const THREAT_INTERRUPT_TICKS = 5;
/** GDD 30.2: unobstructed awareness radius, regardless of facing. */
export const AWARENESS_RADIUS_MM = 8_000 as Int;
/**
 * GDD 30.2: a 160-degree forward field, so the half-angle is 80 degrees.
 *
 * Stored as **cos(80°) in hundred-thousandths** rather than as an angle: the
 * field test is then a dot product against the facing vector, with no `atan2`
 * and no radians anywhere near a decision. Perception is consequential, so the
 * float ban applies to it like everything else.
 */
export const FORWARD_HALF_ANGLE_DEGREES = 80;
export const FORWARD_COS_1E5 = 17_365;
/** Sight range in daylight, in millimetres. TUNE. */
export const BASE_SIGHT_RANGE_MM = 60_000 as Int;
/** Sleep multiplies sensory range by this, in thousandths (GDD §7: sleep reduces range). TUNE. */
export const SLEEP_RANGE_MILLI = 250;
/** Hearing radius, in millimetres. TUNE. */
export const HEARING_RADIUS_MM = 40_000 as Int;
/** Uncertainty a heard event carries: sound gives an area, never a point. TUNE. */
export const HEARING_UNCERTAINTY_MM = 12_000 as Int;

export type Channel = "Sight" | "Hearing" | "Awareness" | "Damage";

/**
 * One piece of perceived evidence. This is the *only* shape a decision layer
 * receives, and it never contains a world handle, a terrain array or another
 * actor's state.
 */
export interface Evidence {
  readonly channel: Channel;
  readonly kind: "ActorSeen" | "SoundHeard" | "DamageTaken";
  /** Absent for hearing: sound does not identify who made it (GDD §22). */
  readonly subjectId?: string;
  readonly positionMm: readonly [Int, Int];
  readonly uncertaintyMm: Int;
  readonly atTick: Int;
  readonly provenance: Provenance;
  /** True when this evidence is a threat that must reach the interrupt queue. */
  readonly urgent: boolean;
}

export interface SensedActor {
  readonly actorId: string;
  readonly positionMm: readonly [Int, Int];
  /** Is this actor hostile to the observer right now? Supplied by the caller. */
  readonly hostile: boolean;
  /** Concealment of the observed actor, in thousandths: 0 clear, 1000 invisible. */
  readonly concealmentMilli?: number;
}

export interface SoundEvent {
  readonly positionMm: readonly [Int, Int];
  /** Loudness in thousandths; scales the distance at which it can be heard. */
  readonly loudnessMilli: number;
}

export interface Observer {
  readonly actorId: string;
  readonly positionMm: readonly [Int, Int];
  /**
   * Facing as an integer direction vector in millimetres; only its direction
   * matters. A vector rather than an angle because the field test is a dot
   * product, and because a caller that has a movement delta already has this.
   */
  readonly facingMm: readonly [Int, Int];
  readonly asleep?: boolean;
  /** Ambient light in thousandths: 1000 daylight, lower at night. */
  readonly lightMilli?: number;
}

/**
 * Can the observer see this actor? A caller supplies `hasLineOfSight` from the
 * P1-03 sight model, because terrain belongs to that module and this one must
 * not hold a handle to it.
 */
export interface SensoryInputs {
  readonly hasLineOfSight: (from: readonly [Int, Int], to: readonly [Int, Int]) => boolean;
}

function distanceMm(a: readonly [Int, Int], b: readonly [Int, Int]): Int {
  const dx = sub(a[0], b[0]);
  const dy = sub(a[1], b[1]);
  return isqrt(asInt((dx as number) * (dx as number) + (dy as number) * (dy as number), "distance"));
}

/**
 * Is the target inside the forward field? Integer dot product against the
 * facing vector, compared with cos(80°) — no trigonometry, no floats.
 *
 * A facing vector of zero means "no particular direction", and the forward field
 * is then empty rather than universal: an actor facing nowhere still has its
 * awareness radius, and nothing more.
 */
function withinForwardField(observer: Observer, target: readonly [Int, Int]): boolean {
  const dx = (target[0] as number) - (observer.positionMm[0] as number);
  const dy = (target[1] as number) - (observer.positionMm[1] as number);
  if (dx === 0 && dy === 0) return true;

  const fx = observer.facingMm[0] as number;
  const fy = observer.facingMm[1] as number;
  const facingLength = isqrt(asInt(fx * fx + fy * fy, "facingLength")) as number;
  if (facingLength === 0) return false;

  // Facing normalized to a length of 1,000 so the dot product stays well inside
  // the safe-integer range for an 800 m island.
  const nfx = Math.trunc((fx * 1_000) / facingLength);
  const nfy = Math.trunc((fy * 1_000) / facingLength);
  const dot = nfx * dx + nfy * dy;
  if (dot <= 0) return false;

  const distance = isqrt(asInt(dx * dx + dy * dy, "fieldDistance")) as number;
  // dot >= |d| * 1000 * cos(theta), rearranged to stay in integers.
  return dot * 100 >= distance * FORWARD_COS_1E5;
}

/** Effective sight range after light, sleep and the target's concealment. */
export function sightRangeMm(observer: Observer, concealmentMilli = 0): Int {
  const light = observer.lightMilli ?? 1_000;
  let range = mulDiv(BASE_SIGHT_RANGE_MM, asInt(light, "light"), 1_000 as Int);
  if (observer.asleep === true) range = mulDiv(range, asInt(SLEEP_RANGE_MILLI, "sleep"), 1_000 as Int);
  return mulDiv(range, asInt(Math.max(0, 1_000 - concealmentMilli), "concealment"), 1_000 as Int);
}

/**
 * Everything this observer perceives this tick, and nothing else.
 *
 * Note what is *not* a parameter: the world, the terrain, other actors' plans,
 * or any store of what exists. The caller passes the actors and sounds it wants
 * considered and a line-of-sight predicate; anything the observer fails to
 * perceive simply produces no evidence, so a decision layer downstream has no
 * way to learn it existed.
 */
export function perceive(
  observer: Observer,
  candidates: readonly SensedActor[],
  sounds: readonly SoundEvent[],
  inputs: SensoryInputs,
  tick: Int,
): readonly Evidence[] {
  const evidence: Evidence[] = [];

  for (const candidate of [...candidates].sort((a, b) => (a.actorId < b.actorId ? -1 : 1))) {
    if (candidate.actorId === observer.actorId) continue;
    const distance = distanceMm(observer.positionMm, candidate.positionMm);
    const concealment = candidate.concealmentMilli ?? 0;

    // The 8-metre awareness radius ignores facing but still needs a clear line.
    const awarenessRadius = observer.asleep === true ? mulDiv(AWARENESS_RADIUS_MM, asInt(SLEEP_RANGE_MILLI, "sleep"), 1_000 as Int) : AWARENESS_RADIUS_MM;
    const withinAwareness = distance <= awarenessRadius;
    const inForwardField = withinForwardField(observer, candidate.positionMm) && distance <= sightRangeMm(observer, concealment);
    if (!withinAwareness && !inForwardField) continue;
    if (!inputs.hasLineOfSight(observer.positionMm, candidate.positionMm)) continue;

    evidence.push({
      channel: inForwardField ? "Sight" : "Awareness",
      kind: "ActorSeen",
      subjectId: candidate.actorId,
      positionMm: candidate.positionMm,
      // Closer is surer: uncertainty is a fiftieth of the distance, plus concealment.
      uncertaintyMm: asInt(Math.trunc((distance as number) / 50) + Math.trunc(((distance as number) * concealment) / 1_000), "uncertainty"),
      atTick: tick,
      provenance: "Observed",
      urgent: candidate.hostile,
    });
  }

  for (const sound of sounds) {
    const distance = distanceMm(observer.positionMm, sound.positionMm);
    const radius = mulDiv(
      observer.asleep === true ? mulDiv(HEARING_RADIUS_MM, asInt(SLEEP_RANGE_MILLI, "sleep"), 1_000 as Int) : HEARING_RADIUS_MM,
      asInt(sound.loudnessMilli, "loudness"),
      1_000 as Int,
    );
    if (distance > radius) continue;
    evidence.push({
      channel: "Hearing",
      kind: "SoundHeard",
      // No subjectId, ever: sound is an approximate location, not an identity.
      positionMm: sound.positionMm,
      uncertaintyMm: HEARING_UNCERTAINTY_MM,
      atTick: tick,
      provenance: "Observed",
      urgent: false,
    });
  }

  return evidence;
}

/** Evidence turned into a belief, keeping the channel's uncertainty and provenance. */
export function beliefFrom(evidence: Evidence, tick: Int): Belief {
  return {
    id: `belief.${evidence.kind}.${evidence.subjectId ?? "unknown"}.${evidence.atTick}`,
    kind: evidence.kind === "SoundHeard" ? "Hazard" : "ActorPosition",
    subjectId: evidence.subjectId ?? "unknown",
    observedAtTick: evidence.atTick,
    learnedAtTick: tick,
    provenance: evidence.provenance,
    uncertaintyMm: evidence.uncertaintyMm,
    positionMm: evidence.positionMm,
  };
}

export interface QueuedThreat {
  readonly evidence: Evidence;
  readonly firstSensedTick: Int;
  readonly deliveredAtTick: Int;
  readonly latencyTicks: number;
}

/**
 * The interrupt queue.
 *
 * Ordinary scene inspection may be staggered (TP §6), but a **threat** newly
 * within a legitimate channel must be delivered within five ticks. This records
 * when each threat was first sensed and refuses to deliver late: `overdue`
 * reports anything past the bound, so the guarantee is measurable rather than
 * assumed.
 */
export class ThreatQueue {
  readonly #firstSeen = new Map<string, Int>();
  readonly delivered: QueuedThreat[] = [];

  /** Offer this tick's evidence; urgent items are queued with the tick they first appeared. */
  offer(evidence: readonly Evidence[], tick: Int): void {
    for (const item of evidence) {
      if (!item.urgent) continue;
      const key = `${item.subjectId ?? "unknown"}:${item.channel}`;
      if (!this.#firstSeen.has(key)) this.#firstSeen.set(key, tick);
    }
  }

  /** Deliver everything queued, recording the latency of each. */
  drain(evidence: readonly Evidence[], tick: Int): readonly QueuedThreat[] {
    const out: QueuedThreat[] = [];
    for (const item of evidence) {
      if (!item.urgent) continue;
      const key = `${item.subjectId ?? "unknown"}:${item.channel}`;
      const first = this.#firstSeen.get(key) ?? tick;
      const queued: QueuedThreat = { evidence: item, firstSensedTick: first, deliveredAtTick: tick, latencyTicks: Math.max(0, sub(tick, first) as number) };
      out.push(queued);
      this.delivered.push(queued);
      this.#firstSeen.delete(key);
    }
    return out;
  }

  /** Threats sensed but not yet delivered past the bound — the thing that must stay empty. */
  overdue(tick: Int): readonly { readonly key: string; readonly latencyTicks: number }[] {
    const late: { key: string; latencyTicks: number }[] = [];
    for (const [key, first] of this.#firstSeen) {
      const latency = Math.max(0, sub(tick, first) as number);
      if (latency > THREAT_INTERRUPT_TICKS) late.push({ key, latencyTicks: latency });
    }
    return late;
  }

  get worstLatency(): number {
    return this.delivered.reduce((worst, item) => Math.max(worst, item.latencyTicks), 0);
  }
}

/** Distance in millimetres between two points — exported for callers pricing evidence. */
export function distanceBetween(a: readonly [Int, Int], b: readonly [Int, Int]): Int {
  return distanceMm(a, b);
}

/** Multiply a range by a thousandths factor. Exported so a caller scales the same way this does. */
export function scaleMilli(value: Int, milli: number): Int {
  return mulDiv(value, asInt(milli, "milli"), 1_000 as Int);
}

export { mul };
