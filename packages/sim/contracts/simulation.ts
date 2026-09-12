/**
 * Simulation boundary records (contracts/INTERFACES.md; TP v1.1 §3, §12).
 *
 * All immutable, all closed (an unknown field is a validation error), all
 * carrying an explicit schema version. None of them exposes mutable world
 * state: an AI module receives an `ActorKnowledgeView` and issues an
 * `ActionRequest`; it never holds a reference to the world.
 */
import { actorId, durableId, entityId, hash32, milli, mm, sequence, tick, tickStage, version } from "./ids.js";
import { reasonId } from "./reasons.js";
import { arr, bool, enumOf, int, obj, opt, refine } from "./schema.js";
import type { Infer } from "./schema.js";

const schemaVersion = () => int({ min: 0, max: 0, description: "Contract schema version (0 = design version 0)" });

/** A position in integer millimetres on the 2.5D surface (CONVENTIONS.md). */
export const PositionMmShape = obj("PositionMm", {
  xMm: mm("East–west millimetres"),
  yMm: mm("North–south millimetres"),
  zMm: mm("Height millimetres"),
});
export type PositionMm = Infer<typeof PositionMmShape>;

/** A versioned dependency an action relies on; a version change invalidates the action. */
export const DependencyRefShape = obj("DependencyRef", {
  kind: enumOf(["Law", "Content", "Route", "Reservation", "Ownership", "Membership"] as const),
  id: durableId("Dependency identifier"),
  version: version("Version observed when the action was planned"),
});
export type DependencyRef = Infer<typeof DependencyRefShape>;

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const ActionRequestShape = obj(
  "ActionRequest",
  {
    schemaVersion: schemaVersion(),
    actorId: actorId(),
    planId: sequence("Plan this request belongs to"),
    actionDefId: durableId("Action definition from the compiled catalog"),
    targetActorId: opt(actorId("Target actor, when the action has one")),
    targetEntityId: opt(entityId("Target entity slot, when the target is not an actor")),
    targetPositionMm: opt(PositionMmShape),
    requestedTick: tick("Tick at which the actor asks to begin"),
    expectedLawVersion: version("Law version the plan was built against"),
    dependencies: arr(DependencyRefShape, { maxItems: 32, description: "Everything whose change invalidates this action" }),
    leaseHandles: arr(sequence("Lease handle"), { maxItems: 16, description: "Reservations already held" }),
  },
  { description: "A request to begin an action. It grants no mutation access; Core decides." },
);
export type ActionRequest = Infer<typeof ActionRequestShape>;

export const ActionResultShape = obj(
  "ActionResult",
  {
    schemaVersion: schemaVersion(),
    actorId: actorId(),
    planId: sequence("Plan this result answers"),
    actionDefId: durableId("Action definition"),
    tick: tick("Tick at which this outcome was decided"),
    outcome: enumOf(["Started", "Progressed", "Completed", "Failed", "Interrupted"] as const),
    /** Positive durations are ceil-rounded after the single skill modifier (Addendum D02). */
    durationTicks: opt(int({ min: 1, description: "Quantized duration, present once the action has started" })),
    remainingTicks: opt(int({ min: 0, description: "Work left, for Started/Progressed/Interrupted" })),
    reasonId: opt(reasonId("Why the action failed or was interrupted")),
  },
  {
    refinements: [
      refine("Failed and Interrupted results carry a reasonId", (v) => (v["outcome"] !== "Failed" && v["outcome"] !== "Interrupted") || v["reasonId"] !== undefined),
      refine("Completed results carry no reasonId", (v) => v["outcome"] !== "Completed" || v["reasonId"] === undefined),
    ],
    description: "Typed outcome of an action request; a failure is always explainable.",
  },
);
export type ActionResult = Infer<typeof ActionResultShape>;

// ---------------------------------------------------------------------------
// Knowledge and perception
// ---------------------------------------------------------------------------

/** Vitals an actor knows about itself, in thousandths (GDD 30.2). */
export const SelfStateShape = obj("SelfState", {
  healthMilli: milli("Health, 0–100000"),
  staminaMilli: milli("Stamina, 0–100000"),
  fullnessMilli: milli("Food fullness, 0–100000"),
  fatigueMilli: milli("Fatigue, 0–100000"),
  exposureMilli: milli("Exposure, 0–100000"),
  moraleMilli: milli("Morale, 0–100000"),
  carriedUnits: int({ min: 0, description: "Carry load in game weight units" }),
  positionMm: PositionMmShape,
});
export type SelfState = Infer<typeof SelfStateShape>;

/**
 * One piece of evidence with its provenance. Decision code may use nothing
 * else: every fact says when it was observed, where it came from, how certain
 * it is and when it expires.
 */
export const EvidenceRecordShape = obj(
  "EvidenceRecord",
  {
    factId: sequence("Stable fact identifier within the run"),
    kind: durableId("Fact kind, e.g. actor.position or resource.seen"),
    subjectActorId: opt(actorId("Actor the fact is about")),
    subjectEntityId: opt(entityId("Entity the fact is about")),
    observedTick: tick("Tick at which this was observed or reported"),
    source: enumOf(["Observed", "Heard", "Reported", "PublicNotice"] as const, "How the actor came to believe this"),
    reportedByActorId: opt(actorId("Who reported it, for Reported facts")),
    uncertaintyMilli: milli("Uncertainty in thousandths; 0 = certain"),
    expiryTick: opt(tick("Tick after which the fact is stale")),
    positionMm: opt(PositionMmShape),
  },
  {
    refinements: [refine("Reported facts name the reporter", (v) => v["source"] !== "Reported" || v["reportedByActorId"] !== undefined)],
  },
);
export type EvidenceRecord = Infer<typeof EvidenceRecordShape>;

export const PublicNoticeShape = obj("PublicNotice", {
  noticeId: sequence("Notice identifier"),
  kind: durableId("Notice kind, e.g. law.announced"),
  announcedTick: tick("Tick the notice was announced"),
  effectiveTick: opt(tick("Tick the announced effect begins")),
  lawId: opt(durableId("Law the notice concerns")),
  lawVersion: opt(version("Law version")),
});
export type PublicNotice = Infer<typeof PublicNoticeShape>;

export const ActorKnowledgeViewShape = obj(
  "ActorKnowledgeView",
  {
    schemaVersion: schemaVersion(),
    actorId: actorId(),
    tick: tick("Tick this view describes"),
    self: SelfStateShape,
    publicNotices: arr(PublicNoticeShape, { maxItems: 64 }),
    facts: arr(EvidenceRecordShape, { maxItems: 512 }),
  },
  { description: "Everything an actor may reason from. There is no other door to world state." },
);
export type ActorKnowledgeView = Infer<typeof ActorKnowledgeViewShape>;

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

export const RouteRequestShape = obj("RouteRequest", {
  schemaVersion: schemaVersion(),
  actorId: actorId(),
  requestTick: tick("Tick the request was made"),
  fromMm: PositionMmShape,
  toMm: PositionMmShape,
  graphScope: enumOf(["ActorKnown", "Public"] as const, "Which graph the search may consult"),
  budgetUnits: int({ min: 1, description: "Deterministic per-tick search budget" }),
});
export type RouteRequest = Infer<typeof RouteRequestShape>;

/**
 * INTERFACES.md: "Mere budget exhaustion is BudgetExhausted and cannot
 * masquerade as a useful Partial path." The refinements enforce exactly that.
 */
export const RouteResultShape = obj(
  "RouteResult",
  {
    schemaVersion: schemaVersion(),
    actorId: actorId(),
    requestTick: tick("Tick of the originating request"),
    status: enumOf(["Complete", "Partial", "BudgetExhausted", "NoKnownRoute"] as const),
    pathVersion: version("Version of the graph the path was computed against"),
    waypointsMm: arr(PositionMmShape, { maxItems: 256, description: "Empty unless Complete or Partial" }),
    certifiedPortalId: opt(durableId("Portal certified as nearer, required for Partial")),
    progressMeasureMm: opt(mm("Stable progress measure toward the destination, required for Partial")),
    reasonId: opt(reasonId("Why no usable path was returned")),
    unitsSpent: int({ min: 0, description: "Search budget consumed" }),
  },
  {
    refinements: [
      refine("Complete and Partial results carry waypoints", (v) => (v["status"] !== "Complete" && v["status"] !== "Partial") || (v["waypointsMm"] as unknown[]).length > 0),
      refine("Partial results certify a nearer portal and a progress measure", (v) => v["status"] !== "Partial" || (v["certifiedPortalId"] !== undefined && v["progressMeasureMm"] !== undefined)),
      refine("BudgetExhausted and NoKnownRoute carry a reasonId and no waypoints", (v) => {
        const s = v["status"];
        return (s !== "BudgetExhausted" && s !== "NoKnownRoute") || (v["reasonId"] !== undefined && (v["waypointsMm"] as unknown[]).length === 0);
      }),
      refine("Complete results carry no reasonId", (v) => v["status"] !== "Complete" || v["reasonId"] === undefined),
    ],
  },
);
export type RouteResult = Infer<typeof RouteResultShape>;

// ---------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------

export const PermissionEvidenceShape = obj(
  "PermissionEvidence",
  {
    allowed: bool("Whether the rule permitted this at the contact tick"),
    ruleId: durableId("Rule consulted"),
    ruleVersion: version("Rule version consulted"),
    reasonId: opt(reasonId("Why permission was refused")),
  },
  { refinements: [refine("A refusal names its reason", (v) => v["allowed"] === true || v["reasonId"] !== undefined)] },
);
export type PermissionEvidence = Infer<typeof PermissionEvidenceShape>;

export const DamageProposalShape = obj(
  "DamageProposal",
  {
    schemaVersion: schemaVersion(),
    episodeId: sequence("Combat or hazard episode"),
    victimActorId: actorId("Who would take the damage"),
    sourceActorId: opt(actorId("Attacking actor, when there is one")),
    sourceHazardId: opt(durableId("Hazard source, e.g. exposure or storm")),
    amountMilli: milli("Proposed damage in thousandths of an HP"),
    damageClass: enumOf(["Melee", "Ranged", "Fall", "Hazard", "Starvation", "Exposure", "Storm"] as const),
    contactTick: tick("Tick of contact"),
    permission: PermissionEvidenceShape,
  },
  {
    refinements: [
      refine("Damage has exactly one source: an actor or a hazard", (v) => (v["sourceActorId"] === undefined) !== (v["sourceHazardId"] === undefined)),
      refine("Proposed damage is positive", (v) => typeof v["amountMilli"] === "number" && (v["amountMilli"] as number) > 0),
    ],
    description: "A proposal, not an application: stage 7 resolves support first, then damage (Addendum D01).",
  },
);
export type DamageProposal = Infer<typeof DamageProposalShape>;

// ---------------------------------------------------------------------------
// Decision trace
// ---------------------------------------------------------------------------

export const ConsiderationShape = obj("Consideration", {
  id: durableId("Consideration identifier"),
  valueMilli: milli("Normalized input value in thousandths"),
  weightMilli: milli("Weight applied, in thousandths"),
});
export type Consideration = Infer<typeof ConsiderationShape>;

export const CandidateTraceShape = obj(
  "CandidateTrace",
  {
    candidateId: durableId("Candidate goal or action"),
    scoreMilli: milli("Final score in thousandths"),
    considerations: arr(ConsiderationShape, { maxItems: 32 }),
    rejectedReasonId: opt(reasonId("Why this candidate was not eligible")),
  },
  { description: "Only candidates actually evaluated appear here." },
);
export type CandidateTrace = Infer<typeof CandidateTraceShape>;

export const DecisionTraceShape = obj(
  "DecisionTrace",
  {
    schemaVersion: schemaVersion(),
    actorId: actorId(),
    tick: tick("Tick of the decision"),
    candidates: arr(CandidateTraceShape, { maxItems: 64 }),
    chosenCandidateId: opt(durableId("Chosen candidate; absent when nothing was eligible")),
    noChoiceReasonId: opt(reasonId("Why nothing was chosen")),
    evidenceRefs: arr(obj("EvidenceRef", { factId: sequence("Fact used"), ageTicks: int({ min: 0, description: "How old the fact was when used" })}), { maxItems: 64 }),
  },
  {
    refinements: [
      refine("Either a candidate was chosen or the absence has a reason", (v) => (v["chosenCandidateId"] === undefined) !== (v["noChoiceReasonId"] === undefined)),
      refine("The chosen candidate is among the evaluated candidates", (v) => {
        const chosen = v["chosenCandidateId"];
        if (chosen === undefined) return true;
        return (v["candidates"] as { candidateId: string }[]).some((c) => c.candidateId === chosen);
      }),
    ],
    description: "Why an actor did what it did — the evidence the observer UI and clanlab explain from.",
  },
);
export type DecisionTrace = Infer<typeof DecisionTraceShape>;

// ---------------------------------------------------------------------------
// Committed events
// ---------------------------------------------------------------------------

export const CommittedEventShape = obj(
  "CommittedEvent",
  {
    schemaVersion: schemaVersion(),
    runId: durableId("Run"),
    branchId: durableId("Branch within the run"),
    sequence: sequence("Monotonic event sequence, never reused"),
    tick: tick("Tick at which the event committed"),
    stage: tickStage(),
    type: durableId("Event type, e.g. actor.eliminated"),
    actorId: opt(actorId("Primary actor")),
    targetActorId: opt(actorId("Target actor")),
    causalParents: arr(sequence("Parent event sequence"), { maxItems: 8, description: "Events this one followed from" }),
    status: enumOf(["Factual", "Reported"] as const, "Factual = the simulation did it; Reported = someone claims it"),
    payload: obj("EventPayload", {
      kind: durableId("Payload kind"),
      version: version("Payload schema version"),
      fields: obj("EventPayloadFields", {}, { description: "Frozen per event type by the packet that emits it" }),
    }),
  },
  {
    refinements: [refine("Reported events name the actor who reported them", (v) => v["status"] !== "Reported" || v["actorId"] !== undefined)],
    description: "The append-only record of what happened. Typed payloads; meaning never lives only in prose.",
  },
);
export type CommittedEvent = Infer<typeof CommittedEventShape>;

/** Hash of an event range, used by replay comparison (TP v1.1 §15). */
export const EventRangeShape = obj(
  "EventRange",
  {
    firstSequence: sequence("First event in the range, inclusive"),
    lastSequence: sequence("Last event in the range, inclusive"),
    rangeHash: hash32("Canonical hash of the range"),
  },
  { refinements: [refine("lastSequence is not before firstSequence", (v) => (v["lastSequence"] as number) >= (v["firstSequence"] as number))] },
);
export type EventRange = Infer<typeof EventRangeShape>;
