/**
 * Utility scoring and decision traces (P1-16; GDD 6.5, AI 11 foundation).
 *
 * An actor chooses by scoring candidates against **considerations**, and the
 * trace it leaves is the contract's `DecisionTrace` — candidates, their scores,
 * the considerations that produced them, and the evidence with its age. The
 * trace is not a debug log: it is the only way anyone can answer "why did it do
 * that", and GDD 6.5 asks for a reason a player could be told.
 *
 * Three rules shape it:
 *
 *   - **A trait moves only what it touches.** Two actors differing in one trait
 *     must produce traces differing in the considerations that trait weights and
 *     nowhere else. Otherwise a personality is not a personality, it is a
 *     global multiplier with a name.
 *   - **Only what was really evaluated is traced.** A candidate that was never
 *     scored is not listed with a fabricated score; a trace that invents its own
 *     alternatives is worse than no trace, because it reads as evidence.
 *   - **An emergency does not wait for the switching delay.** Ordinary
 *     commitment keeps an actor from dithering; a threat, or an action that has
 *     become illegal, preempts immediately and says which it was.
 */
import { asInt, mulDiv } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";

/** Ticks an actor stays with a choice before ordinary re-evaluation. TUNE. */
export const SWITCH_DELAY_TICKS = 30;

export type ConsiderationId =
  | "hunger"
  | "threat"
  | "fatigue"
  | "socialDebt"
  | "curiosity"
  | "shelter"
  | "opportunity";

/** Traits scale considerations. A trait that scaled everything would be a mood, not a trait. */
export type TraitId = "cautious" | "greedy" | "sociable" | "industrious";

export const TRAIT_WEIGHTS: Readonly<Record<TraitId, Partial<Record<ConsiderationId, number>>>> = {
  // Thousandths. 1,000 is neutral; only the listed considerations move.
  cautious: { threat: 1_600, shelter: 1_300 },
  greedy: { opportunity: 1_500, socialDebt: 700 },
  sociable: { socialDebt: 1_500, curiosity: 1_200 },
  industrious: { opportunity: 1_200, fatigue: 700 },
};

export interface Consideration {
  readonly id: ConsiderationId;
  /** Raw input in thousandths, before traits. */
  readonly inputMilli: number;
  /** Weight in thousandths, before traits. */
  readonly weightMilli: number;
}

export interface Candidate {
  readonly candidateId: string;
  readonly considerations: readonly Consideration[];
  /** True for candidates that answer an emergency — a threat, or a forced change. */
  readonly emergency?: boolean;
}

export interface EvidenceRef {
  readonly factId: number;
  readonly ageTicks: number;
}

export interface ScoredConsideration {
  readonly id: ConsiderationId;
  readonly inputMilli: number;
  readonly weightMilli: number;
  /** Weight after the actor's traits — what makes two actors differ. */
  readonly effectiveWeightMilli: number;
  readonly contributionMilli: number;
}

export interface ScoredCandidate {
  readonly candidateId: string;
  readonly scoreMilli: number;
  readonly considerations: readonly ScoredConsideration[];
}

export type NoChoiceReason = "NoCandidates" | "AllScoredZero";

export interface DecisionTraceRecord {
  readonly schemaVersion: 0;
  readonly actorId: string;
  readonly tick: Int;
  /** Only candidates that were actually scored. */
  readonly candidates: readonly ScoredCandidate[];
  readonly chosenCandidateId?: string;
  readonly noChoiceReasonId?: NoChoiceReason;
  readonly evidenceRefs: readonly EvidenceRef[];
  /** Why this decision happened now: routine, or preempted. */
  readonly trigger: "Routine" | "Emergency" | "LegalInvalidation";
}

/** Score one candidate for one actor. Integer throughout. */
export function scoreCandidate(candidate: Candidate, traits: readonly TraitId[]): ScoredCandidate {
  const considerations = candidate.considerations.map((consideration) => {
    let effective = consideration.weightMilli;
    for (const trait of traits) {
      const factor = TRAIT_WEIGHTS[trait][consideration.id];
      if (factor !== undefined) effective = mulDiv(asInt(effective, "weight"), asInt(factor, "trait"), 1_000 as Int) as number;
    }
    return {
      id: consideration.id,
      inputMilli: consideration.inputMilli,
      weightMilli: consideration.weightMilli,
      effectiveWeightMilli: effective,
      contributionMilli: mulDiv(asInt(consideration.inputMilli, "input"), asInt(effective, "effective"), 1_000 as Int) as number,
    };
  });

  return {
    candidateId: candidate.candidateId,
    scoreMilli: considerations.reduce((sum, c) => sum + c.contributionMilli, 0),
    considerations,
  };
}

export interface DecisionInput {
  readonly actorId: string;
  readonly traits: readonly TraitId[];
  readonly candidates: readonly Candidate[];
  readonly evidence: readonly EvidenceRef[];
  /** The choice currently held, and when it was made. */
  readonly current?: { readonly candidateId: string; readonly chosenAtTick: Int };
  /** Set when the current action has become illegal — preempts like an emergency. */
  readonly currentInvalidated?: boolean;
}

export interface Decision {
  readonly trace: DecisionTraceRecord;
  readonly chosenCandidateId?: string;
  /** True when the actor kept its current choice because the delay had not elapsed. */
  readonly heldByDelay: boolean;
}

/**
 * Decide.
 *
 * Every candidate offered is scored and traced — the trace lists what was
 * evaluated and nothing else. Ordinary switching waits out `SWITCH_DELAY_TICKS`,
 * and an emergency candidate or an invalidated current action bypasses it.
 */
export function decide(input: DecisionInput, tick: Int): Decision {
  const scored = input.candidates
    .map((candidate) => scoreCandidate(candidate, input.traits))
    .sort((a, b) => (a.scoreMilli !== b.scoreMilli ? b.scoreMilli - a.scoreMilli : a.candidateId < b.candidateId ? -1 : 1));

  const emergencyIds = new Set(input.candidates.filter((c) => c.emergency === true).map((c) => c.candidateId));
  const best = scored[0];
  const trigger: DecisionTraceRecord["trigger"] =
    input.currentInvalidated === true ? "LegalInvalidation" : best !== undefined && emergencyIds.has(best.candidateId) ? "Emergency" : "Routine";

  const base = {
    schemaVersion: 0 as const,
    actorId: input.actorId,
    tick,
    candidates: scored,
    evidenceRefs: input.evidence,
    trigger,
  };

  if (best === undefined) {
    return { trace: { ...base, noChoiceReasonId: "NoCandidates" }, heldByDelay: false };
  }
  if (best.scoreMilli <= 0) {
    return { trace: { ...base, noChoiceReasonId: "AllScoredZero" }, heldByDelay: false };
  }

  // Ordinary commitment: keep the current choice until the delay elapses. An
  // emergency or a legal invalidation does not wait — that is the whole point of
  // marking them.
  if (input.current !== undefined && trigger === "Routine") {
    const held = (tick as number) - (input.current.chosenAtTick as number);
    if (held < SWITCH_DELAY_TICKS && best.candidateId !== input.current.candidateId) {
      return { trace: { ...base, chosenCandidateId: input.current.candidateId }, chosenCandidateId: input.current.candidateId, heldByDelay: true };
    }
  }

  return { trace: { ...base, chosenCandidateId: best.candidateId }, chosenCandidateId: best.candidateId, heldByDelay: false };
}

/**
 * The considerations whose effective weight differs between two traces — used by
 * the paired-fixture check that a trait moves only what it touches.
 */
export function considerationsThatDiffer(a: DecisionTraceRecord, b: DecisionTraceRecord): readonly ConsiderationId[] {
  const differing = new Set<ConsiderationId>();
  for (const candidateA of a.candidates) {
    const candidateB = b.candidates.find((c) => c.candidateId === candidateA.candidateId);
    if (candidateB === undefined) continue;
    for (const consideration of candidateA.considerations) {
      const other = candidateB.considerations.find((c) => c.id === consideration.id);
      if (other === undefined || other.effectiveWeightMilli !== consideration.effectiveWeightMilli) differing.add(consideration.id);
    }
  }
  return [...differing].sort();
}
