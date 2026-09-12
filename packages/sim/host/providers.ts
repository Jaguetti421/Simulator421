/**
 * Provider composition (P1-01; TP v1.1 §3, contracts/INTERFACES.md).
 *
 * `packages/sim/host` is the only place that constructs providers and wires them
 * together. The rule this module exists to enforce is narrow and load-bearing:
 * **decision code never receives a handle to world state.** It gets a
 * `DecisionContext` whose every member is a function returning a contract
 * record — a knowledge view, a route result, evidence — and there is no path
 * from that object to a mutable entity list, a live array, or the `World`.
 *
 * That is not a convention here; `decisionContext` builds a frozen object with
 * no captured world reference, and a test walks the object graph to prove it.
 */
import type { contracts } from "../index.js";
import type { Int } from "../primitives/index.js";

export interface Providers {
  readonly perception: contracts.IPerceptionQuery;
  readonly routes: contracts.IRouteQuery;
  readonly sections: readonly contracts.IStateSectionCodec[];
}

export type ProviderErrorCode = "DuplicateSection" | "MissingProvider" | "UnknownSection";

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  constructor(code: ProviderErrorCode, detail: string) {
    super(`${code}: ${detail}`);
    this.name = "ProviderError";
    this.code = code;
  }
}

/**
 * What decision code (AI, planners, anything choosing an action) is allowed to
 * see. Every member returns a record. There is deliberately no `world`, no
 * `actors`, no `entityAt`, and no escape hatch — adding one is the change a
 * reviewer should refuse.
 */
export interface DecisionContext {
  readonly tick: Int;
  readonly actorId: string;
  /** The actor's own knowledge view for this tick. */
  knowledge: () => contracts.ActorKnowledgeView;
  /** Evidence this actor is authorized to perceive — never a global entity list. */
  perceive: (kind: "Sight" | "Hearing" | "Notice", rangeMm: Int) => readonly contracts.EvidenceRecord[];
  /** A completed route search, inside its deterministic budget. */
  route: (request: contracts.RouteRequest) => contracts.RouteResult;
}

export interface ComposedProviders {
  /** Build the per-actor, per-tick surface decision code is given. */
  decisionContext: (actorId: string, tick: Int) => DecisionContext;
  /** Section codecs by id, for the persistence layer — not reachable from a DecisionContext. */
  section: (sectionId: string) => contracts.IStateSectionCodec;
  sectionIds: () => readonly string[];
  describeSections: () => readonly contracts.StateSectionDescriptor[];
}

/**
 * Compose the providers a host will use. Validates the set once, at
 * construction, so a duplicate or missing section is a startup failure rather
 * than a mystery mid-match.
 */
export function composeProviders(providers: Providers): ComposedProviders {
  if (providers.perception === undefined) throw new ProviderError("MissingProvider", "perception");
  if (providers.routes === undefined) throw new ProviderError("MissingProvider", "routes");

  const byId = new Map<string, contracts.IStateSectionCodec>();
  for (const codec of providers.sections) {
    if (byId.has(codec.sectionId)) throw new ProviderError("DuplicateSection", codec.sectionId);
    byId.set(codec.sectionId, codec);
  }

  return {
    decisionContext(actorId: string, tick: Int): DecisionContext {
      // Only the two query ports are captured. Nothing in this closure can
      // reach world state, and the returned object is frozen so a caller cannot
      // graft a handle onto it after the fact.
      const perception = providers.perception;
      const routes = providers.routes;
      return Object.freeze({
        tick,
        actorId,
        knowledge: (): contracts.ActorKnowledgeView => perception.knowledgeView(actorId, tick),
        perceive: (kind: "Sight" | "Hearing" | "Notice", rangeMm: Int): readonly contracts.EvidenceRecord[] =>
          perception.query({ observerActorId: actorId, tick, kind, rangeMm }),
        route: (request: contracts.RouteRequest): contracts.RouteResult => routes.route(request),
      });
    },
    section(sectionId: string): contracts.IStateSectionCodec {
      const codec = byId.get(sectionId);
      if (codec === undefined) throw new ProviderError("UnknownSection", `${sectionId}; registered: ${[...byId.keys()].sort().join(", ")}`);
      return codec;
    },
    sectionIds: (): readonly string[] => [...byId.keys()].sort(),
    describeSections: (): readonly contracts.StateSectionDescriptor[] =>
      [...byId.keys()].sort().map((id) => {
        const codec = byId.get(id) as contracts.IStateSectionCodec;
        return codec.describe(codec.capture());
      }),
  };
}

/**
 * The members a `DecisionContext` may expose. A test asserts the real object has
 * exactly these — so adding a world handle later fails a check rather than
 * passing review by looking plausible.
 */
export const DECISION_CONTEXT_MEMBERS: readonly string[] = ["actorId", "knowledge", "perceive", "route", "tick"];
