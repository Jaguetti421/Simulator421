/**
 * Query ports (contracts/INTERFACES.md).
 *
 * A port is a narrow function surface a provider registers and Core invokes.
 * Ports return **records**, never a handle to world state: an AI module cannot
 * reach a mutable entity list, a global service locator or a live array through
 * any of these. Providers are constructed and injected by `packages/sim/host`
 * (W0-07); nothing here constructs anything.
 */
import type { ActorKnowledgeView, EvidenceRecord, RouteRequest, RouteResult } from "./simulation.js";
import type { StateSectionDescriptor } from "./views.js";
import type { Int } from "../primitives/index.js";

/** What an observer is authorized to ask about. Evaluated physically in Spatial. */
export interface PerceptionQuery {
  readonly observerActorId: string;
  readonly tick: Int;
  readonly kind: "Sight" | "Hearing" | "Notice";
  /** Maximum range the observer may ask about, in millimetres. */
  readonly rangeMm: Int;
}

/**
 * Returns evidence records for one authorized observer — never a global entity
 * list, and never anything the observer could not lawfully perceive.
 */
export interface IPerceptionQuery {
  query(request: PerceptionQuery): readonly EvidenceRecord[];
  /** The knowledge view Core hands to decision code for this actor and tick. */
  knowledgeView(actorId: string, tick: Int): ActorKnowledgeView;
}

/**
 * Route search. Completes atomically inside its deterministic budget; the
 * scheduler saves queued requests and retry history, never a live A* frontier
 * (INTERFACES.md "Search, snapshot and information rules").
 */
export interface IRouteQuery {
  route(request: RouteRequest): RouteResult;
}

/**
 * A persistence section. `capture` returns bytes the caller owns; `restore`
 * takes bytes and rebuilds the section; `hashContribution` is what the
 * canonical hash folds in; `validate` reports whether bytes are acceptable
 * before any state is touched.
 */
export interface IStateSectionCodec {
  readonly sectionId: string;
  readonly sectionVersion: Int;
  readonly required: boolean;
  readonly hashDomain: "Authoritative" | "Observer";
  capture(): Uint8Array;
  restore(bytes: Uint8Array): void;
  hashContribution(bytes: Uint8Array): Int;
  validate(bytes: Uint8Array): { readonly ok: true } | { readonly ok: false; readonly errors: readonly string[] };
  describe(bytes: Uint8Array): StateSectionDescriptor;
}
