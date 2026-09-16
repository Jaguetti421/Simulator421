/**
 * Why panel and event feed (P1-31; TP v1.1 §14, WHY-TRACE; GDD §13.4, §16).
 *
 * The GDD settles the question I had been carrying as an open design ruling:
 *
 *   > The player has an omniscient observer view, but inspecting it never
 *   > updates a contestant's knowledge.
 *
 * So the panel may show anything the simulation knows. What it may **not** do is
 * make something up, and that is what this module is built around:
 *
 *   > The Why panel shows the chosen plan and up to two considered alternatives,
 *   > each with one actual reason for rejection or lower priority. If an
 *   > alternative was not evaluated this cycle, say so; do not invent a
 *   > counterfactual.
 *
 * Every alternative shown is drawn from the decision trace's own candidate list.
 * There is no path in this module that can produce a candidate the decider did
 * not score, because the only source of candidates is the trace.
 *
 * The feed runs the other way: committed events flow to the view, and nothing
 * flows back. An off-camera event appears in the feed exactly as an on-camera
 * one does, because the camera is not an input to it — and it cannot reach an
 * actor's beliefs, because the feed has no path into the simulation at all.
 */
import type { core } from "@lastclan/sim";

type DecisionTraceRecord = core.DecisionTraceRecord;
type ScoredCandidate = core.ScoredCandidate;

/** GDD §13.4: "up to two considered alternatives". */
export const MAX_ALTERNATIVES = 2;

export interface WhyAlternative {
  readonly candidateId: string;
  readonly scoreMilli: number;
  /** One actual reason, taken from the consideration that cost it the most. */
  readonly reason: string;
}

export interface WhyPanel {
  readonly actorId: string;
  readonly decisionTick: number;
  readonly chosenCandidateId?: string;
  /** Always a subset of the trace's evaluated candidates. Never invented. */
  readonly alternatives: readonly WhyAlternative[];
  /** Set when there were no evaluated alternatives to show. */
  readonly unavailable?: string;
  /** How stale this explanation is, in ticks. */
  readonly ageTicks: number;
  /** Developer view only (GDD §13.4): scores, input facts and the decision tick. */
  readonly developer?: {
    readonly scores: readonly { readonly candidateId: string; readonly scoreMilli: number }[];
    readonly evidence: readonly { readonly factId: number; readonly ageTicks: number }[];
    readonly trigger: string;
  };
}

/**
 * The single reason an alternative lost.
 *
 * Chosen as the consideration where it fell furthest behind the winner — one
 * reason, as the GDD asks, and a real one rather than a summary. When there is
 * no winner to compare against, the alternative's own weakest consideration is
 * used and the phrasing says so.
 */
function reasonAgainst(alternative: ScoredCandidate, chosen: ScoredCandidate | undefined): string {
  if (chosen === undefined) {
    const weakest = [...alternative.considerations].sort((a, b) => a.contributionMilli - b.contributionMilli)[0];
    return weakest === undefined ? "scored nothing" : `weak on ${weakest.id}`;
  }

  let worstId: string | undefined;
  let worstGap = -1;
  for (const consideration of chosen.considerations) {
    const mine = alternative.considerations.find((c) => c.id === consideration.id);
    const gap = consideration.contributionMilli - (mine?.contributionMilli ?? 0);
    if (gap > worstGap) {
      worstGap = gap;
      worstId = consideration.id;
    }
  }
  if (worstId === undefined || worstGap <= 0) {
    return `scored ${chosen.scoreMilli - alternative.scoreMilli} lower overall`;
  }
  return `${worstId} favoured ${chosen.candidateId} by ${worstGap}`;
}

export interface WhyOptions {
  /** The tick the panel is being shown at, for the cached-reason age. */
  readonly nowTick: number;
  readonly developerView?: boolean;
}

/**
 * Build the panel from a decision trace.
 *
 * The trace is the **only** input. A panel cannot show an alternative the
 * decider did not evaluate, because there is nowhere else for one to come from —
 * which is what makes "do not invent a counterfactual" structural rather than a
 * rule someone has to keep.
 */
export function buildWhyPanel(trace: DecisionTraceRecord, options: WhyOptions): WhyPanel {
  const chosen = trace.candidates.find((c) => c.candidateId === trace.chosenCandidateId);
  const alternatives = trace.candidates
    .filter((candidate) => candidate.candidateId !== trace.chosenCandidateId)
    .slice(0, MAX_ALTERNATIVES)
    .map((candidate) => ({ candidateId: candidate.candidateId, scoreMilli: candidate.scoreMilli, reason: reasonAgainst(candidate, chosen) }));

  const base: WhyPanel = {
    actorId: trace.actorId,
    decisionTick: trace.tick as unknown as number,
    ...(trace.chosenCandidateId === undefined ? {} : { chosenCandidateId: trace.chosenCandidateId }),
    alternatives,
    ageTicks: Math.max(0, options.nowTick - (trace.tick as unknown as number)),
    ...(alternatives.length === 0
      ? {
          unavailable:
            trace.candidates.length === 0
              ? "no alternatives were evaluated this cycle"
              : "no alternative was evaluated this cycle: the only candidate was the one chosen",
        }
      : {}),
  };

  if (options.developerView !== true) return base;
  return {
    ...base,
    developer: {
      scores: trace.candidates.map((c) => ({ candidateId: c.candidateId, scoreMilli: c.scoreMilli })),
      evidence: trace.evidenceRefs.map((e) => ({ factId: e.factId, ageTicks: e.ageTicks })),
      trigger: trace.trigger,
    },
  };
}

/** Does this panel refresh? GDD: "cached reasons … refresh when a meaningful decision changes". */
export function shouldRefresh(shown: WhyPanel, latest: DecisionTraceRecord): boolean {
  return shown.decisionTick !== (latest.tick as unknown as number) || shown.chosenCandidateId !== latest.chosenCandidateId;
}

// ---------------------------------------------------------------------------
// Event feed
// ---------------------------------------------------------------------------

export interface FeedEvent {
  readonly type: string;
  readonly tick: number;
  readonly actorId?: string;
  readonly text: string;
  /** Whether the camera happened to be looking. Recorded, never consulted. */
  readonly onCamera: boolean;
}

/**
 * The view's event feed.
 *
 * Append-only, capped, and **one-way**: it takes committed events and exposes
 * them for display. There is no method that returns anything a simulation could
 * consume, so an entry appearing here cannot become a belief. The `onCamera`
 * flag is recorded for presentation and is never read when deciding whether to
 * admit an event, which is what criterion 3 asks.
 */
export class EventFeed {
  readonly #entries: FeedEvent[] = [];
  readonly limit: number;

  constructor(limit = 200) {
    this.limit = limit;
  }

  get size(): number {
    return this.#entries.length;
  }

  /** Admit an event. The camera state is stored, never used to filter. */
  append(event: FeedEvent): void {
    this.#entries.push(event);
    while (this.#entries.length > this.limit) this.#entries.shift();
  }

  /** Newest first, for display. Returns copies. */
  recent(count = 20): readonly FeedEvent[] {
    return this.#entries.slice(-count).reverse().map((entry) => ({ ...entry }));
  }

  /** How many admitted events happened off camera — evidence, not a filter. */
  get offCameraCount(): number {
    return this.#entries.filter((entry) => !entry.onCamera).length;
  }
}
