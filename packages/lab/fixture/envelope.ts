/**
 * The fixture envelope, declared with the W0-04 contract DSL (W0-05).
 *
 * `contracts/fixture.schema.json` is the supplied authority. Re-declaring it
 * here buys typed errors with paths, closed records and no runtime JSON Schema
 * dependency inside the tool — and the declaration is kept honest by
 * `tests/fixtures/conformance.test.ts`, which requires this validator and ajv
 * running the supplied schema to agree on every structural verdict.
 *
 * Semantic rules from FIXTURE_DSL.md that JSON Schema cannot express live in
 * `semantics.ts`, not here.
 */
import { contracts } from "@lastclan/sim";

const { arr, bool, enumOf, int, mapOf, obj, opt, str } = contracts;

/** Actor IDs in fixtures: contestants, wildlife and the guest (pattern from the supplied schema). */
export const FIXTURE_ACTOR_ID_PATTERN = "^(C[0-9]{3}|G001|W[0-9]{3})$";
export const FIXTURE_ID_PATTERN = "^[A-Z0-9][A-Za-z0-9_-]+$";

export const GATES = ["G0", "G1", "G2", "G3", "G4", "GS", "GR", "GL"] as const;
export const EVIDENCE_STATUSES = ["SCHEMA_EXAMPLE_UNEXECUTED", "IMPLEMENTED_UNVERIFIED", "VERIFIED"] as const;
export const PROFILE_KINDS = ["Fixture", "Prototype8", "Trial24", "Standard100"] as const;
export const LAW_IDS = ["Truce", "BuildingsProtected", "PropertyProtected", "Sanctuary", "ColdFront", "BountifulGround", "StormWarning", "Herald"] as const;
export const FACT_SOURCES = ["Self", "DirectObservation", "PublicNotice", "Report"] as const;
export const INVARIANT_NAMES = ["NoIllegalEffects", "ConserveInventory", "NoUnexplainedStallOver100Ticks", "GuestExcludedFromContestantWins"] as const;
export const HASH_VARIANTS = ["SaveReload", "ObserverToggle", "Checkpoint10sVs60s"] as const;
export const ASSERTION_KINDS = ["EventCountGte", "EventCountEq", "Invariant", "HashEqualVariant", "ToolCheck"] as const;

/**
 * Named checks a **tool** performs and reports, added in fixture DSL v2.
 *
 * Five registry fixtures — PRESENT-READ-01, INFO-ISOLATION, ROUTE-PROGRESS and
 * two others — state claims no event count, invariant or hash variant can
 * express: "these nameplates do not overlap too much", "decision code cannot
 * reach world state", "a repeated partial route advances or recovers". Before
 * v2 those fixtures either carried assertions that said something else or
 * carried none at all, and the claim lived only in a test.
 *
 * A `ToolCheck` names the check; a **provider** runs it. A check no provider
 * supplies is Blocked, naming what would supply it — never Passed.
 */
export const TOOL_CHECKS = [
  "NameplateOverlapWithinThreshold",
  "RingContrastAboveThreshold",
  "ActionIconsDistinct",
  "DecisionContextHasNoWorldHandle",
  "RouteProgressAdvancesOrRecovers",
  "SightIgnoresUnobservedTerrain",
] as const;
export type ToolCheckName = (typeof TOOL_CHECKS)[number];

const milli = () => int({ min: 0, max: 100_000, description: "Thousandths of the displayed value (85000 = 85/100)" });
const tick = (description: string) => int({ min: 0, description });

export const VitalsMilliShape = obj("VitalsMilli", {
  health: milli(),
  fullness: milli(),
  fatigue: milli(),
  exposure: milli(),
  stamina: milli(),
});

export const KnownFactShape = obj("SetupKnownFact", {
  kind: str({ maxLength: 64, description: "Authored fact kind" }),
  subject: str({ maxLength: 64, description: "Subject ID the fact is about" }),
  observedTick: tick("Tick the fact was observed"),
  source: enumOf(FACT_SOURCES, "How the actor knows it"),
  sourceActor: opt(str({ pattern: FIXTURE_ACTOR_ID_PATTERN, maxLength: 8, description: "Reporter, for Report facts" })),
});

export const SetupActorShape = obj("SetupActor", {
  id: str({ pattern: FIXTURE_ACTOR_ID_PATTERN, maxLength: 8, description: "Cxxx contestant, Wxxx wildlife or G001 guest" }),
  positionMm: arr(int({ description: "Millimetres" }), { maxItems: 3, description: "[x, y, z] in millimetres" }),
  vitalsMilli: VitalsMilliShape,
  inventory: mapOf(int({ min: 0, description: "Non-negative count" }), { keyPattern: "^[a-z][a-z0-9_.-]{0,63}$", maxEntries: 64, description: "Item ID to count; IDs are content-validated when a catalog exists" }),
  profileOverride: opt(str({ maxLength: 64 })),
  initialGoal: opt(str({ maxLength: 64 })),
  knownFacts: opt(arr(KnownFactShape, { maxItems: 256 })),
});

export const LawSpecShape = obj("LawSpec", {
  lawId: enumOf(LAW_IDS),
  startTick: tick("First tick the law is in force"),
  endTick: int({ min: 1, description: "Tick the law ends; must exceed startTick" }),
  centerMm: opt(arr(int(), { maxItems: 2, description: "[x, y] centre for a region law" })),
  radiusMm: opt(int({ min: 1, description: "Region radius in millimetres" })),
  targetId: opt(str({ maxLength: 64 })),
});

export const ScheduleEntryShape = obj("ScheduleEntry", {
  atTick: int({ min: 1, description: "Tick the command is submitted; tick 0 is setup state, so runtime commands start at 1 (matches the supplied schema)" }),
  sequence: int({ min: 1, description: "Client sequence, unique within the fixture" }),
  expectedRulesVersion: int({ min: 0 }),
  operation: enumOf(["ScheduleLaw"] as const, "Only ScheduleLaw is defined at fixture DSL v1"),
  payload: LawSpecShape,
  expectAck: enumOf(["Accepted", "Rejected"] as const),
  expectedReasonId: opt(str({ maxLength: 64, description: "Required when a rejection is intended" })),
});

export const AssertionShape = contracts.union("kind", [
  obj("EventCountGteAssertion", {
    kind: enumOf(["EventCountGte"] as const),
    match: obj("EventMatch", {
      type: str({ maxLength: 64 }),
      actorId: opt(str({ maxLength: 64 })),
      targetId: opt(str({ maxLength: 64 })),
      reasonId: opt(str({ maxLength: 64 })),
      fromTick: opt(tick("Inclusive lower bound")),
      throughTick: opt(tick("Inclusive upper bound")),
    }),
    minimum: int({ min: 1, description: "At least one: a vacuous proof of behaviour is not allowed" }),
  }),
  obj("EventCountEqAssertion", {
    kind: enumOf(["EventCountEq"] as const),
    match: obj("EventMatchEq", {
      type: str({ maxLength: 64 }),
      actorId: opt(str({ maxLength: 64 })),
      targetId: opt(str({ maxLength: 64 })),
      reasonId: opt(str({ maxLength: 64 })),
      fromTick: opt(tick("Inclusive lower bound")),
      throughTick: opt(tick("Inclusive upper bound")),
    }),
    count: int({ min: 0, description: "Exact count; 0 asserts an explicit absence" }),
  }),
  obj("InvariantAssertion", { kind: enumOf(["Invariant"] as const), name: enumOf(INVARIANT_NAMES) }),
  obj("ToolCheckAssertion", {
    kind: enumOf(["ToolCheck"] as const),
    check: enumOf(TOOL_CHECKS),
    expect: enumOf(["Pass", "Fail"] as const, "What the fixture claims the check reports; Fail states a defect the fixture exists to pin"),
  }),
  obj("HashEqualVariantAssertion", {
    kind: enumOf(["HashEqualVariant"] as const),
    variant: enumOf(HASH_VARIANTS),
    startTick: tick("Tick the variant branches from"),
    advanceTicks: int({ min: 1, description: "Ticks to advance both branches" }),
  }),
]);

export const FixtureShape = obj(
  "Fixture",
  {
    schemaVersion: int({ min: 1, max: 2, description: "Fixture DSL version: 1, or 2 for fixtures using ToolCheck assertions" }),
    id: str({ pattern: FIXTURE_ID_PATTERN, maxLength: 64 }),
    gate: enumOf(GATES),
    evidenceStatus: enumOf(EVIDENCE_STATUSES),
    profile: obj("FixtureProfile", {
      kind: enumOf(PROFILE_KINDS),
      definitions: str({ maxLength: 64, description: "Definition set the fixture draws from" }),
      contestantCount: int({ min: 1, max: 100 }),
      writeCareer: bool("Always false: a fixture never writes a production career", { const: false }),
    }),
    map: obj("MapSpec", { recipeId: str({ maxLength: 64 }), seed: int({ min: 0, max: 4294967295 }) }),
    setup: obj("FixtureSetup", {
      actors: arr(SetupActorShape, { maxItems: 200, description: "Tick-zero state, not player commands" }),
      precommittedLaws: arr(LawSpecShape, { maxItems: 64, description: "Already-announced scenario rules; may start at tick 0" }),
    }),
    schedule: arr(ScheduleEntryShape, { maxItems: 10_000, description: "Commands submitted through the real validator" }),
    maxTicks: int({ min: 1, max: 360_000 }),
    assertions: arr(AssertionShape, { maxItems: 1_000 }),
    notes: opt(str({ maxLength: 2048 })),
  },
  { description: "Fixture DSL v1 envelope; mirrors contracts/fixture.schema.json." },
);

export type Fixture = contracts.Infer<typeof FixtureShape>;
export type SetupActor = contracts.Infer<typeof SetupActorShape>;
export type ScheduleEntry = contracts.Infer<typeof ScheduleEntryShape>;
export type LawSpec = contracts.Infer<typeof LawSpecShape>;
export type FixtureAssertion = contracts.Infer<typeof AssertionShape>;
