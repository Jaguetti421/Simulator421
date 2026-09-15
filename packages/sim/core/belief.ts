/**
 * Belief records and provenance (P1-14; TP v1.1 §6, GDD 7.1 and 7.5).
 *
 * A belief is not a fact. Every record carries **where it came from and when**,
 * and the three rules here all follow from refusing to lose that:
 *
 *   - **A report keeps the observer's time, not the teller's.** If C003 saw the
 *     boar at tick 200 and tells C009 at tick 900, C009 believes something
 *     observed at 200. Stamping the retelling time would make a rumour look
 *     like fresh evidence, and every downstream decision would be confident for
 *     the wrong reason.
 *   - **An obligation survives ordinary eviction.** Memory is bounded and old
 *     beliefs are dropped, but a promise the actor made is not an old belief —
 *     forgetting it is indistinguishable, from outside, from breaking it.
 *   - **A stale position stays a region, never a point.** Uncertainty grows with
 *     age, and a coordinate that was exact an hour ago is reported as an area.
 *     Handing a planner a precise number for a thing that has surely moved is
 *     how an AI acquires knowledge nobody gave it.
 */
import { add, asInt, mul, sub } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";

/** How a belief entered the actor's head. */
export type Provenance = "Observed" | "Reported" | "Inferred" | "Told";

export type BeliefKind = "ActorPosition" | "ResourceLocation" | "Procedure" | "Permission" | "Obligation" | "Hazard";

/** Millimetres the uncertainty of a moving subject grows per tick. TUNE. */
export const POSITION_DRIFT_MM_PER_TICK = 350;
/** Uncertainty at or beyond which a position is no longer reported as a point at all. TUNE. */
export const COARSE_THRESHOLD_MM = 20_000;
/** Default memory budget per actor, in records. TUNE. */
export const DEFAULT_MEMORY_LIMIT = 64;

export interface Belief {
  readonly id: string;
  readonly kind: BeliefKind;
  readonly subjectId: string;
  /** The tick the **original observation** happened — never the tick it was retold. */
  readonly observedAtTick: Int;
  /** The tick this actor learned it, which may be much later for a report. */
  readonly learnedAtTick: Int;
  readonly provenance: Provenance;
  /** Who this actor got it from, when it did not see it itself. */
  readonly sourceActorId?: string;
  /** Uncertainty at the moment of observation, in millimetres. */
  readonly uncertaintyMm: Int;
  readonly positionMm?: readonly [Int, Int];
  /** Obligations are never evicted by age (GDD 7.5). */
  readonly obligation?: { readonly to: string; readonly dueTick: Int; readonly satisfied: boolean };
}

export type PositionEstimate =
  | { readonly precision: "Exact"; readonly positionMm: readonly [Int, Int]; readonly uncertaintyMm: Int; readonly observedAtTick: Int }
  | { readonly precision: "Area"; readonly centreMm: readonly [Int, Int]; readonly radiusMm: Int; readonly observedAtTick: Int; readonly ageTicks: number };

/**
 * Uncertainty now: what it was when observed, plus drift for every tick since
 * **the observation**, not since the retelling.
 */
export function uncertaintyAt(belief: Belief, tick: Int): Int {
  const age = Math.max(0, sub(tick, belief.observedAtTick) as number);
  return add(belief.uncertaintyMm, mul(asInt(age, "age"), asInt(POSITION_DRIFT_MM_PER_TICK, "drift")));
}

/**
 * What the actor can honestly say about a position now.
 *
 * Past the coarse threshold the answer is an area, and the exact coordinate is
 * **not included in the result at all** — not rounded, not hidden behind a flag.
 * A caller cannot use what it is not given.
 */
export function estimatePosition(belief: Belief, tick: Int): PositionEstimate | undefined {
  if (belief.positionMm === undefined) return undefined;
  const uncertainty = uncertaintyAt(belief, tick);
  if (uncertainty < COARSE_THRESHOLD_MM) {
    return { precision: "Exact", positionMm: belief.positionMm, uncertaintyMm: uncertainty, observedAtTick: belief.observedAtTick };
  }
  return {
    precision: "Area",
    centreMm: belief.positionMm,
    radiusMm: uncertainty,
    observedAtTick: belief.observedAtTick,
    ageTicks: Math.max(0, sub(tick, belief.observedAtTick) as number),
  };
}

/**
 * Retell a belief to another actor.
 *
 * The retelling keeps `observedAtTick` and adds to the uncertainty rather than
 * resetting it: a story told at second hand is older and vaguer than what was
 * seen, and the record has to say so.
 */
export function retell(belief: Belief, toActorId: string, atTick: Int, extraUncertaintyMm: Int = 2_000 as Int): Belief {
  return {
    ...belief,
    id: `${belief.id}@${toActorId}`,
    provenance: "Reported",
    sourceActorId: belief.sourceActorId ?? "unknown",
    learnedAtTick: atTick,
    // Unchanged on purpose: the observation happened when it happened.
    observedAtTick: belief.observedAtTick,
    uncertaintyMm: add(belief.uncertaintyMm, extraUncertaintyMm),
  };
}

export interface EvictionResult {
  readonly kept: readonly Belief[];
  readonly evicted: readonly Belief[];
  readonly protectedCount: number;
}

/**
 * One actor's bounded memory.
 *
 * Eviction drops the oldest **ordinary** beliefs. An unsatisfied obligation is
 * never ordinary: it is protected however old it gets, and the protected count
 * is reported so a caller can see when memory is full of promises.
 */
export class BeliefStore {
  readonly #beliefs: Belief[] = [];
  readonly limit: number;

  constructor(limit: number = DEFAULT_MEMORY_LIMIT) {
    this.limit = limit;
  }

  get size(): number {
    return this.#beliefs.length;
  }

  all(): readonly Belief[] {
    return this.#beliefs;
  }

  get(id: string): Belief | undefined {
    return this.#beliefs.find((b) => b.id === id);
  }

  /** Is this belief exempt from age-based eviction? */
  static isProtected(belief: Belief): boolean {
    return belief.kind === "Obligation" && belief.obligation !== undefined && !belief.obligation.satisfied;
  }

  /** Add a belief and evict down to the limit, protecting live obligations. */
  learn(belief: Belief): EvictionResult {
    const existing = this.#beliefs.findIndex((b) => b.id === belief.id);
    if (existing >= 0) this.#beliefs.splice(existing, 1);
    this.#beliefs.push(belief);
    return this.evict();
  }

  evict(): EvictionResult {
    const evicted: Belief[] = [];
    const isProtected = (b: Belief): boolean => BeliefStore.isProtected(b);
    while (this.#beliefs.length > this.limit) {
      // Oldest by observation, ties by ID so two runs evict the same record.
      const candidates = this.#beliefs
        .map((belief, index) => ({ belief, index }))
        .filter(({ belief }) => !isProtected(belief))
        .sort((a, b) => (a.belief.observedAtTick !== b.belief.observedAtTick ? (a.belief.observedAtTick as number) - (b.belief.observedAtTick as number) : a.belief.id < b.belief.id ? -1 : 1));
      const oldest = candidates[0];
      if (oldest === undefined) break; // every remaining belief is protected
      this.#beliefs.splice(oldest.index, 1);
      evicted.push(oldest.belief);
    }
    return { kept: [...this.#beliefs], evicted, protectedCount: this.#beliefs.filter(isProtected).length };
  }

  /** Mark an obligation satisfied, which also makes it ordinary again. */
  satisfy(id: string): boolean {
    const index = this.#beliefs.findIndex((b) => b.id === id);
    const belief = this.#beliefs[index];
    if (belief === undefined || belief.obligation === undefined) return false;
    this.#beliefs[index] = { ...belief, obligation: { ...belief.obligation, satisfied: true } };
    return true;
  }
}
