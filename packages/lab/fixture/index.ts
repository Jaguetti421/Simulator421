/**
 * Fixture DSL v1: envelope, semantics and assertion registry (W0-05).
 * Parsing never constructs a world; running fixtures arrives with W0-06.
 */
export {
  ASSERTION_KINDS,
  AssertionShape,
  EVIDENCE_STATUSES,
  FACT_SOURCES,
  FIXTURE_ACTOR_ID_PATTERN,
  FIXTURE_ID_PATTERN,
  FixtureShape,
  GATES,
  HASH_VARIANTS,
  INVARIANT_NAMES,
  LAW_IDS,
  LawSpecShape,
  PROFILE_KINDS,
  ScheduleEntryShape,
  SetupActorShape,
  VitalsMilliShape,
} from "./envelope.js";
export type { Fixture, FixtureAssertion, LawSpec, ScheduleEntry, SetupActor } from "./envelope.js";
export { FIXTURE_LIMITS, FixtureValidationError, fixtureError, MINIMUM_LAW_NOTICE_TICKS } from "./errors.js";
export type { FixtureError, FixtureErrorCode, FixtureSkipCode, FixtureSkippedCheck } from "./errors.js";
export { BLOCKED_KINDS, EVALUABLE_KINDS, evaluateAll, evaluateAssertion, registerAssertion } from "./assertions.js";
export type { AssertionOutcome, AssertionStatus, AssertionSummary, MatchableEvent } from "./assertions.js";
export { PROFILE_CONTESTANT_COUNTS, validateSemantics } from "./semantics.js";
export type { SemanticOptions, SemanticReport } from "./semantics.js";
export { FIXTURE_SCHEMA_VERSION, parseFixtureText, parseFixtureValue } from "./parse.js";
export type { ParseOptions, ParseResult } from "./parse.js";
