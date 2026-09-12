/**
 * Typed fixture errors (W0-05; contracts/FIXTURE_DSL.md).
 *
 * Every rejection names a code, a JSON path and a message. Nothing is thrown
 * as a bare string and nothing is reported as "invalid fixture"; a fixture
 * author must be able to see which field failed which rule.
 *
 * FIXTURE_DSL.md requires that unknown versions, fields, units, IDs and
 * assertion kinds are rejected **before any world is constructed**, so parsing
 * is strictly separate from execution: `parseFixture` never builds state.
 */

export type FixtureErrorCode =
  // envelope / structure
  | "UnknownSchemaVersion"
  | "MalformedJson"
  | "StructureInvalid" // a field failed the envelope declaration (unknown field, wrong type, bad ID, out-of-range unit)
  | "InputTooLarge"
  | "LimitExceeded"
  // semantics
  | "DuplicateActor"
  | "DuplicateSequence"
  | "ProfileCountMismatch"
  | "CareerWriteForbidden"
  | "SetupOnlyInSchedule"
  | "NoticeTooShort"
  | "LawIntervalInvalid"
  | "RegionGeometryInvalid"
  | "MatchIntervalInvalid"
  | "HashVariantOutOfRange"
  | "ExpectedReasonMissing"
  | "ExpectedReasonUnknown"
  | "UnknownFactSubject"
  | "FactSourceInvalid"
  // assertions
  | "UnsupportedAssertion";

export interface FixtureError {
  readonly code: FixtureErrorCode;
  /** JSON-pointer-ish path into the fixture document, e.g. `/schedule/0/payload/startTick`. */
  readonly path: string;
  readonly message: string;
}

/**
 * A check the validator could not perform here, recorded rather than assumed.
 * FIXTURE_DSL.md requires content validation of item, goal and profile-override
 * IDs; there is no compiled catalog before the content packets, so those checks
 * are reported as skipped with a reason. A skipped check is never a pass.
 */
export type FixtureSkipCode = "ContentCatalogUnavailable" | "RequiresRunningSimulation";

export interface FixtureSkippedCheck {
  readonly code: FixtureSkipCode;
  readonly path: string;
  readonly message: string;
  /** The packet expected to make this check runnable. */
  readonly availableFrom: string;
}

export function fixtureError(code: FixtureErrorCode, path: string, message: string): FixtureError {
  return { code, path, message };
}

export class FixtureValidationError extends Error {
  readonly errors: readonly FixtureError[];
  constructor(what: string, errors: readonly FixtureError[]) {
    super(`${what}: ${errors.map((e) => `${e.code} at ${e.path} — ${e.message}`).join("; ")}`);
    this.name = "FixtureValidationError";
    this.errors = errors;
  }
}

/** Tool limits from FIXTURE_DSL.md. Profile limits are stricter and checked separately. */
export const FIXTURE_LIMITS = {
  inputBytes: 2 * 1024 * 1024,
  setupActors: 200,
  scheduledCommands: 10_000,
  assertions: 1_000,
} as const;

/** A runtime (non-precommitted) law needs at least this much notice (FIXTURE_DSL.md). */
export const MINIMUM_LAW_NOTICE_TICKS = 600;
