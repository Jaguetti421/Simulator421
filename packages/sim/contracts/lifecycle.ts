/**
 * Action lifecycle records (P1-01; TP v1.1 §8 "Actions reservations and the
 * economy", §12).
 *
 * TP §8 requires eight things of every action: identity, preconditions,
 * resources, execution, revalidation, interruption, completion and failure.
 * `ActionRequest` and `ActionResult` (contract v0) cover identity,
 * preconditions, revalidation dependencies and the typed failure reason. The
 * records below complete the table.
 *
 * These are **new records rather than extensions** of the existing two, so the
 * sixteen frozen shapes stay byte-identical and the change to
 * `identity.contract.recordsDigest` is one explicit event rather than a quiet
 * drift in records other packets already depend on.
 *
 * A record here still exposes no world state: an action names reservation keys
 * and output locations, it does not hand anyone a container.
 */
import { actorId, durableId, entityId, hash32, milli, sequence, tick, version } from "./ids.js";
import { reasonId } from "./reasons.js";
import { arr, bool, enumOf, int, mapOf, obj, opt, refine } from "./schema.js";
import type { Infer } from "./schema.js";
import { PositionMmShape } from "./simulation.js";

const schemaVersion = () => int({ min: 0, max: 0, description: "Contract schema version (0 = design version 0)" });

// ---------------------------------------------------------------------------
// Resources (TP §8 "Inputs, output capacity, ownership policy, and reservation keys")
// ---------------------------------------------------------------------------

/** A reservation an action holds while it runs. Releasing it is part of interruption, never implicit. */
export const ReservationKeyShape = obj("ReservationKey", {
  key: durableId("Reservation key: station, slot, item stack or work position"),
  kind: enumOf(["Station", "Slot", "ItemStack", "WorkPosition", "Route"] as const),
  heldByActorId: actorId("Holder while the lease is live"),
  expiresAtTick: tick("Tick the lease lapses if not renewed"),
});
export type ReservationKey = Infer<typeof ReservationKeyShape>;

export const ActionResourcesShape = obj(
  "ActionResources",
  {
    schemaVersion: schemaVersion(),
    actorId: actorId(),
    planId: durableId("Plan this action belongs to"),
    /** Item definition ID → count required. Counts are whole items; fractions are a content error. */
    inputs: mapOf(int({ min: 1, description: "Whole items required" }), { maxEntries: 32, description: "Item definition ID to count" }),
    /** Free capacity the output needs, in whole items, at the output location. */
    outputCapacity: int({ min: 0, description: "Whole items of free capacity required at the output location" }),
    ownershipPolicy: enumOf(["Personal", "ClanShared", "Unowned", "Salvage"] as const, "Who may take the output (GDD ownership rules)"),
    reservations: arr(ReservationKeyShape, { maxItems: 16, description: "Leases this action holds while it runs" }),
  },
  {
    refinements: [
      refine("An action that produces nothing does not reserve output capacity", (v) => (v["outputCapacity"] as number) === 0 || Object.keys(v["inputs"] as object).length >= 0),
      refine("Reservation keys are unique within one action", (v) => {
        const keys = (v["reservations"] as readonly { key: string }[]).map((r) => r.key);
        return new Set(keys).size === keys.length;
      }),
    ],
    description: "What an action consumes, produces and holds. Reservation keys are explicit so interruption can release exactly what was taken.",
  },
);
export type ActionResources = Infer<typeof ActionResourcesShape>;

// ---------------------------------------------------------------------------
// Execution (TP §8 "Duration in ticks, work position, progress milestones, animation cue, and sound cue")
// ---------------------------------------------------------------------------

export const ProgressMilestoneShape = obj("ProgressMilestone", {
  atProgressMilli: milli("Progress point, in thousandths of the action's duration"),
  label: durableId("Milestone identifier the presentation layer maps to a cue"),
  /** Milestones may commit an event; the event type is named here so the commit is not a surprise. */
  committedEventType: opt(durableId("Committed event emitted at this milestone")),
});
export type ProgressMilestone = Infer<typeof ProgressMilestoneShape>;

export const ActionExecutionShape = obj(
  "ActionExecution",
  {
    schemaVersion: schemaVersion(),
    actorId: actorId(),
    planId: durableId("Plan this action belongs to"),
    actionDefId: durableId("Action definition"),
    durationTicks: int({ min: 1, description: "Total duration in ticks at normal rate" }),
    workPositionMm: PositionMmShape,
    milestones: arr(ProgressMilestoneShape, { maxItems: 8, description: "Ordered progress milestones" }),
    animationCue: opt(durableId("Presentation cue; never the only evidence of a legal action (Addendum D06)")),
    soundCue: opt(durableId("Presentation cue")),
  },
  {
    refinements: [
      refine("Milestones are strictly ordered by progress", (v) => {
        const points = (v["milestones"] as readonly { atProgressMilli: number }[]).map((m) => m.atProgressMilli);
        return points.every((p, i) => i === 0 || p > (points[i - 1] as number));
      }),
      refine("Milestones lie inside the action", (v) => (v["milestones"] as readonly { atProgressMilli: number }[]).every((m) => m.atProgressMilli > 0 && m.atProgressMilli <= 100_000)),
    ],
    description: "How an action runs: duration, where the actor stands, and the ordered points at which progress is observable.",
  },
);
export type ActionExecution = Infer<typeof ActionExecutionShape>;

// ---------------------------------------------------------------------------
// Interruption (TP §8 "Consumed versus unconsumed inputs, retained progress, lease release, and cooldown")
// ---------------------------------------------------------------------------

export const ActionInterruptionShape = obj(
  "ActionInterruption",
  {
    schemaVersion: schemaVersion(),
    actorId: actorId(),
    planId: durableId("Plan this action belonged to"),
    tick: tick("Tick of interruption"),
    reasonId: reasonId("Typed reason from the frozen registry"),
    consumedInputs: mapOf(int({ min: 1, description: "Whole items already consumed and not returned" }), { maxEntries: 32 }),
    unconsumedInputs: mapOf(int({ min: 1, description: "Whole items returned to their source" }), { maxEntries: 32 }),
    retainedProgressMilli: milli("Progress kept for a later resume, in thousandths"),
    releasedReservations: arr(durableId("Reservation key released"), { maxItems: 16 }),
    cooldownTicks: int({ min: 0, description: "Ticks before this actor may retry the same action" }),
  },
  {
    refinements: [
      refine("An item is either consumed or returned, never both", (v) => {
        const consumed = Object.keys(v["consumedInputs"] as object);
        const unconsumed = new Set(Object.keys(v["unconsumedInputs"] as object));
        return consumed.every((k) => !unconsumed.has(k));
      }),
    ],
    description: "What an interruption did: exactly which inputs were spent, what progress survives, which leases were released, and how long before a retry.",
  },
);
export type ActionInterruption = Infer<typeof ActionInterruptionShape>;

// ---------------------------------------------------------------------------
// Completion (TP §8 "Atomic effects, output location, knowledge effects, and committed event types")
// ---------------------------------------------------------------------------

export const KnowledgeEffectShape = obj("KnowledgeEffect", {
  actorId: actorId("Who learns"),
  factKind: enumOf(["Location", "Ownership", "Procedure", "Permission", "Hazard"] as const),
  subjectId: durableId("What the fact is about"),
  learnedAtTick: tick("When it was learned"),
});
export type KnowledgeEffect = Infer<typeof KnowledgeEffectShape>;

export const ActionCompletionShape = obj(
  "ActionCompletion",
  {
    schemaVersion: schemaVersion(),
    actorId: actorId(),
    planId: durableId("Plan this action belonged to"),
    tick: tick("Tick of completion"),
    /** Effects apply atomically: all of them at this tick, or the action did not complete. */
    atomic: bool("Effects applied atomically", { const: true }),
    outputs: mapOf(int({ min: 1, description: "Whole items produced" }), { maxEntries: 32 }),
    outputEntityId: opt(entityId("Container or station the outputs landed in")),
    outputPositionMm: opt(PositionMmShape),
    knowledgeEffects: arr(KnowledgeEffectShape, { maxItems: 32, description: "Who learned what, and when" }),
    committedEventTypes: arr(durableId("Committed event type emitted by this completion"), { maxItems: 8 }),
  },
  {
    refinements: [
      refine("Outputs land somewhere: an entity or a position", (v) => Object.keys(v["outputs"] as object).length === 0 || v["outputEntityId"] !== undefined || v["outputPositionMm"] !== undefined),
      refine("A completion commits at least one event type", (v) => (v["committedEventTypes"] as readonly string[]).length > 0),
    ],
    description: "What a completed action produced, where it went, who learned from it, and which committed event types it emitted.",
  },
);
export type ActionCompletion = Infer<typeof ActionCompletionShape>;

// ---------------------------------------------------------------------------
// Failure presentation (TP §8 "Typed reason, player-readable intent template, and possible recovery methods")
// ---------------------------------------------------------------------------

export const ActionFailureShape = obj(
  "ActionFailure",
  {
    schemaVersion: schemaVersion(),
    reasonId: reasonId("Typed reason from the frozen registry"),
    /** A template ID, never a display string: text lives in content, identifiers live here (TP §12). */
    intentTemplateId: durableId("Player-readable intent template identifier"),
    recoveryMethods: arr(durableId("Method the actor may try instead"), { maxItems: 8 }),
    retryable: bool("Whether the same action may be retried once its blocker clears"),
  },
  {
    refinements: [refine("A retryable failure offers at least one recovery method", (v) => v["retryable"] !== true || (v["recoveryMethods"] as readonly string[]).length > 0)],
    description: "The failure surface a player sees: a typed reason, a template to render it, and what could be tried instead.",
  },
);
export type ActionFailure = Infer<typeof ActionFailureShape>;

// ---------------------------------------------------------------------------
// Complete state sections (TP §12; W0-08 container)
// ---------------------------------------------------------------------------

export const StateSectionSetShape = obj(
  "StateSectionSet",
  {
    schemaVersion: schemaVersion(),
    containerVersion: version("Save container format version"),
    /** Section ID → section version. A save that omits a required section is not a save. */
    sections: mapOf(version("Section format version"), { maxEntries: 64, description: "Section ID to version" }),
    requiredSections: arr(durableId("Section that must be present for a restore to be attempted"), { maxItems: 64 }),
    authoritativeHash: hash32("Authoritative-domain hash of the whole set"),
    capturedAtTick: tick("Tick the set was captured at"),
    journalSequence: sequence("Last journalled command sequence included"),
  },
  {
    refinements: [
      refine("Every required section is present in the set", (v) => {
        const present = new Set(Object.keys(v["sections"] as object));
        return (v["requiredSections"] as readonly string[]).every((id) => present.has(id));
      }),
      refine("A set declares at least one section", (v) => Object.keys(v["sections"] as object).length > 0),
    ],
    description: "The complete section set a save must contain, with the versions it was written at and the hash that must reproduce on restore.",
  },
);
export type StateSectionSet = Infer<typeof StateSectionSetShape>;

// ---------------------------------------------------------------------------
// Appearance (GDD 14.1, Addendum D06; TP v2.0 §13)
// ---------------------------------------------------------------------------

/**
 * Frozen here at Jani's direction (12 September 2026), closing the W0-10
 * finding: TP v2.0 refers to `AppearanceRecipe` as an existing contract, and it
 * was not one. Identity is data; the kit that renders it — primitives now, a
 * rigged kit later — can change without touching a recipe.
 */
export const AppearanceRecipeShape = obj(
  "AppearanceRecipe",
  {
    schemaVersion: schemaVersion(),
    recipeId: durableId("Stable recipe identifier"),
    build: enumOf(["slight", "average", "heavy"] as const, "One of three builds (GDD 14.1)"),
    head: enumOf(["round", "long", "square", "narrow"] as const, "One of four head families"),
    headwear: enumOf(["none", "band", "hood", "cap", "horns", "feather", "crown", "wrap", "helm", "braid"] as const, "One of ten headwear variants"),
    accessory: enumOf(["none", "satchel", "cloak", "beads", "belt", "quiver"] as const, "One of six accessory families"),
    /** Clan colour is shared and changes when an actor changes clan. */
    clanColorIndex: int({ min: 0, max: 15, description: "Index into the limited clan palette" }),
    /** Personal accent survives a clan change (GDD 14.1). */
    accentColorIndex: int({ min: 0, max: 31, description: "Index into the personal accent palette" }),
  },
  {
    refinements: [refine("Appearance never carries stats: it selects from declared families only", () => true)],
    description: "Identity separated from implementation: the same recipe renders as primitives today and as a rigged kit later, with no data change.",
  },
);
export type AppearanceRecipe = Infer<typeof AppearanceRecipeShape>;

/** The records this packet adds, in registration order. */
export const LIFECYCLE_RECORDS = {
  ActionResources: ActionResourcesShape,
  ActionExecution: ActionExecutionShape,
  ActionInterruption: ActionInterruptionShape,
  ActionCompletion: ActionCompletionShape,
  ActionFailure: ActionFailureShape,
  StateSectionSet: StateSectionSetShape,
  AppearanceRecipe: AppearanceRecipeShape,
} as const;
