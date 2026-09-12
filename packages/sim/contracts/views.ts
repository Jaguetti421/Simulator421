/**
 * Read-model and persistence boundary records (INTERFACES.md; TP v2.0 §3; TP v1.1 §12, §15).
 */
import { actorId, durableId, entityId, hash32, mm, sequence, tick, version } from "./ids.js";
import { arr, bool, enumOf, int, obj, opt, refine, str } from "./schema.js";
import type { Infer } from "./schema.js";

const schemaVersion = () => int({ min: 0, max: 0, description: "Contract schema version (0 = design version 0)" });

// ---------------------------------------------------------------------------
// RenderSnapshot
// ---------------------------------------------------------------------------

/**
 * TP v2.0 §3: transforms and action progress travel as typed arrays inside one
 * transferable `ArrayBuffer`; identity and law views are small JSON that
 * changes rarely. This record is the **envelope**: it describes the buffer the
 * Worker transferred (stride, counts, byte length) and carries the small views
 * inline. There is no mutation callback and no live array — the main thread
 * owns the buffer until it transfers it back or drops it.
 */
export const TransformLayoutShape = obj(
  "TransformLayout",
  {
    actorCount: int({ min: 0, max: 1024, description: "Number of actor records in the buffer" }),
    strideBytes: int({ min: 4, description: "Bytes per actor record" }),
    byteLength: int({ min: 0, description: "Total byte length of the transferred buffer" }),
    fields: arr(
      obj("TransformField", {
        name: durableId("Field name, e.g. positionXMm"),
        offsetBytes: int({ min: 0 }),
        type: enumOf(["int32", "uint32", "int16", "uint16", "uint8"] as const, "Integer element type; no floats cross this boundary"),
      }),
      { maxItems: 32 },
    ),
  },
  {
    refinements: [
      refine("byteLength equals actorCount × strideBytes", (v) => (v["byteLength"] as number) === (v["actorCount"] as number) * (v["strideBytes"] as number)),
      refine("every field fits inside the stride", (v) =>
        (v["fields"] as { offsetBytes: number; type: string }[]).every((f) => {
          const size = f.type === "int32" || f.type === "uint32" ? 4 : f.type === "int16" || f.type === "uint16" ? 2 : 1;
          return f.offsetBytes + size <= (v["strideBytes"] as number);
        }),
      ),
    ],
  },
);
export type TransformLayout = Infer<typeof TransformLayoutShape>;

export const IdentityViewShape = obj("IdentityView", {
  actorId: actorId(),
  entityId: entityId(),
  displayNameKey: str({ maxLength: 64, description: "Text key; never an identifier" }),
  clanId: opt(durableId("Clan the actor belongs to")),
  alive: bool("Whether the actor is still in the match"),
});
export type IdentityView = Infer<typeof IdentityViewShape>;

export const ActionViewShape = obj("ActionView", {
  entityId: entityId(),
  actionDefId: opt(durableId("Action in progress")),
  remainingTicks: opt(int({ min: 0 })),
});
export type ActionView = Infer<typeof ActionViewShape>;

export const LawViewShape = obj("LawView", {
  lawId: durableId("Law"),
  lawVersion: version("Law version"),
  announcedTick: tick("When it was announced"),
  effectiveTick: tick("When it takes effect"),
  active: bool("Whether it is in force at confirmedTick"),
});
export type LawView = Infer<typeof LawViewShape>;

export const RenderSnapshotShape = obj(
  "RenderSnapshot",
  {
    schemaVersion: schemaVersion(),
    runId: durableId("Run"),
    confirmedTick: tick("The completed tick this snapshot describes; never a partial tick"),
    bufferOwner: enumOf(["Worker", "Main"] as const, "Who owns the transferred buffer right now"),
    transformLayout: TransformLayoutShape,
    identityViews: arr(IdentityViewShape, { maxItems: 1024, description: "Small JSON; changes rarely" }),
    actionViews: arr(ActionViewShape, { maxItems: 1024 }),
    lawViews: arr(LawViewShape, { maxItems: 64 }),
    observerHash: hash32("Observer-domain hash of this snapshot"),
  },
  {
    refinements: [
      refine("a snapshot handed to the main thread is owned by the main thread", (v) => v["bufferOwner"] === "Main" || v["bufferOwner"] === "Worker"),
      refine("identity and action views do not exceed the actor count in the layout", (v) => {
        const count = (v["transformLayout"] as { actorCount: number }).actorCount;
        return (v["identityViews"] as unknown[]).length <= count && (v["actionViews"] as unknown[]).length <= count;
      }),
    ],
    description: "Read model for the renderer. No mutation callback, no live array, no float in the buffer.",
  },
);
export type RenderSnapshot = Infer<typeof RenderSnapshotShape>;

// ---------------------------------------------------------------------------
// State sections (persistence)
// ---------------------------------------------------------------------------

export const StateSectionDescriptorShape = obj(
  "StateSectionDescriptor",
  {
    schemaVersion: schemaVersion(),
    sectionId: durableId("Stable section identifier"),
    sectionVersion: version("Section format version"),
    required: bool("Whether a snapshot without this section is invalid"),
    hashDomain: enumOf(["Authoritative", "Observer"] as const, "Which hash domain this section contributes to"),
    byteLength: int({ min: 0, description: "Captured payload length" }),
    contributionHash: hash32("This section's contribution to the canonical hash"),
  },
  { description: "What a state section codec declares about itself; the codec interface is in ports.ts." },
);
export type StateSectionDescriptor = Infer<typeof StateSectionDescriptorShape>;

// ---------------------------------------------------------------------------
// Content profile
// ---------------------------------------------------------------------------

export const CONTENT_PROFILE_IDS = ["Fixture", "Prototype8", "Trial24", "Standard100"] as const;

export const ContentProfileShape = obj(
  "ContentProfile",
  {
    schemaVersion: schemaVersion(),
    profileId: enumOf(CONTENT_PROFILE_IDS, "Declared content profile (TP v1.1 §12)"),
    declaredActorIds: arr(actorId(), { maxItems: 128, description: "Exactly the actors this profile runs" }),
    declaredRecipeIds: arr(durableId("Recipe"), { maxItems: 64 }),
    capabilities: arr(durableId("Capability, e.g. social.treaty or story.guest"), { maxItems: 64 }),
    provenance: obj("ContentProvenance", {
      sourceManifestHash: hash32("Hash of the authored definition set"),
      catalogHash: hash32("Hash of the compiled catalog"),
      compilerVersion: durableId("Content compiler version"),
    }),
  },
  {
    refinements: [
      refine("Standard100 declares exactly 100 contestants", (v) => v["profileId"] !== "Standard100" || (v["declaredActorIds"] as string[]).filter((a) => a.startsWith("C")).length === 100),
      refine("Trial24 declares exactly 24 contestants", (v) => v["profileId"] !== "Trial24" || (v["declaredActorIds"] as string[]).filter((a) => a.startsWith("C")).length === 24),
      refine("Prototype8 declares exactly 8 contestants", (v) => v["profileId"] !== "Prototype8" || (v["declaredActorIds"] as string[]).filter((a) => a.startsWith("C")).length === 8),
      refine("Standard100 declares exactly the 28 GDD recipes", (v) => v["profileId"] !== "Standard100" || (v["declaredRecipeIds"] as string[]).length === 28),
      refine("declared actor IDs are unique", (v) => new Set(v["declaredActorIds"] as string[]).size === (v["declaredActorIds"] as string[]).length),
    ],
    description: "Which game is being run. A fixture profile can never certify a full-game gate.",
  },
);
export type ContentProfile = Infer<typeof ContentProfileShape>;

// ---------------------------------------------------------------------------
// Final result
// ---------------------------------------------------------------------------

export const RosterEntryShape = obj(
  "RosterEntry",
  {
    actorId: actorId(),
    outcome: enumOf(["Winner", "Eliminated", "Withdrawn", "Survived"] as const),
    eliminatedTick: opt(tick("Tick of elimination or withdrawal")),
    eliminatedByActorId: opt(actorId("Who eliminated them, when an actor did")),
    lastPositionMm: opt(obj("LastPosition", { xMm: mm("East–west"), yMm: mm("North–south"), zMm: mm("Height") })),
  },
  {
    refinements: [
      refine("Eliminated and Withdrawn entries carry the tick", (v) => (v["outcome"] !== "Eliminated" && v["outcome"] !== "Withdrawn") || v["eliminatedTick"] !== undefined),
      refine("Winners and survivors are not eliminated", (v) => (v["outcome"] !== "Winner" && v["outcome"] !== "Survived") || v["eliminatedTick"] === undefined),
    ],
  },
);
export type RosterEntry = Infer<typeof RosterEntryShape>;

export const FinalResultShape = obj(
  "FinalResult",
  {
    schemaVersion: schemaVersion(),
    runId: durableId("Run"),
    branchId: durableId("Branch"),
    resultKey: durableId("Unique key making career finalization idempotent (TP v1.1 §15)"),
    payloadHash: hash32("Canonical hash of this result payload"),
    mode: enumOf(["Standard", "CustomPractice"] as const, "Mode provenance; sticky once set"),
    finalizedTick: tick("Tick at which the match ended"),
    profileId: enumOf(CONTENT_PROFILE_IDS, "Content profile the run used"),
    roster: arr(RosterEntryShape, { maxItems: 128 }),
    eventRange: obj("FinalEventRange", {
      firstSequence: sequence("First event of the run"),
      lastSequence: sequence("Last event of the run"),
      rangeHash: hash32("Canonical hash of the event range"),
    }),
    contributorFacts: arr(
      obj("ContributorFact", {
        actorId: actorId(),
        kind: enumOf(["Kill", "Assist", "Rescue", "Withdrawal", "Notable"] as const),
        episodeId: sequence("Life or combat episode"),
        tick: tick("When it happened"),
        subjectActorId: opt(actorId("The other actor involved")),
      }),
      { maxItems: 1024 },
    ),
  },
  {
    refinements: [
      refine("a match has at most one winner", (v) => (v["roster"] as { outcome: string }[]).filter((r) => r.outcome === "Winner").length <= 1),
      refine("roster actor IDs are unique", (v) => {
        const ids = (v["roster"] as { actorId: string }[]).map((r) => r.actorId);
        return new Set(ids).size === ids.length;
      }),
      refine("a Fixture profile cannot produce a Standard result", (v) => v["profileId"] !== "Fixture" || v["mode"] === "CustomPractice"),
    ],
    description: "The immutable package career finalization consumes exactly once.",
  },
);
export type FinalResult = Infer<typeof FinalResultShape>;
