/**
 * Fixture parsing (W0-05).
 *
 * Order matters and is part of the contract: size limit → JSON → schema version
 * → envelope structure → assertion registration → semantics. Nothing downstream
 * runs once an earlier stage has failed, and **no world is ever constructed
 * here** (FIXTURE_DSL.md).
 */
import { contracts } from "@lastclan/sim";
import type { Fixture } from "./envelope.js";
import { FixtureShape } from "./envelope.js";
import { FIXTURE_LIMITS, fixtureError } from "./errors.js";
import type { FixtureError, FixtureSkippedCheck } from "./errors.js";
import { registerAssertion } from "./assertions.js";
import { validateSemantics } from "./semantics.js";
import type { SemanticOptions } from "./semantics.js";

export const FIXTURE_SCHEMA_VERSION = 1;

export type ParseResult =
  | { readonly ok: true; readonly fixture: Fixture; readonly skipped: readonly FixtureSkippedCheck[] }
  | { readonly ok: false; readonly errors: readonly FixtureError[]; readonly skipped: readonly FixtureSkippedCheck[] };

export interface ParseOptions {
  /** Reason IDs a fixture may name; defaults to the frozen v0 contract registry. */
  readonly knownReasonIds?: ReadonlySet<string>;
  readonly catalog?: SemanticOptions["catalog"];
  /** Byte length of the source text, when the caller read it from disk. */
  readonly inputBytes?: number;
}

const DEFAULT_REASON_IDS: ReadonlySet<string> = new Set(contracts.MANDATORY_V0_REASON_IDS);

/** Parse and validate a fixture document that is already JSON-decoded. */
export function parseFixtureValue(value: unknown, options: ParseOptions = {}): ParseResult {
  const skipped: FixtureSkippedCheck[] = [];

  if (options.inputBytes !== undefined && options.inputBytes > FIXTURE_LIMITS.inputBytes) {
    return {
      ok: false,
      skipped,
      errors: [fixtureError("InputTooLarge", "/", `fixture is ${options.inputBytes} bytes; the tool limit is ${FIXTURE_LIMITS.inputBytes}`)],
    };
  }

  // Schema version first: an unknown version must not be interpreted with this
  // build's field rules, which would report misleading structural errors.
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, skipped, errors: [fixtureError("StructureInvalid", "/", "fixture must be a JSON object")] };
  }
  const declaredVersion = (value as Record<string, unknown>)["schemaVersion"];
  if (declaredVersion !== FIXTURE_SCHEMA_VERSION) {
    return {
      ok: false,
      skipped,
      errors: [
        fixtureError(
          "UnknownSchemaVersion",
          "/schemaVersion",
          `this build implements fixture DSL v${FIXTURE_SCHEMA_VERSION}; got ${JSON.stringify(declaredVersion)}. A decoder refuses an unknown version rather than guessing.`,
        ),
      ],
    };
  }

  // Assertion kinds are registered before the envelope is interpreted, so an
  // unknown kind reports UnsupportedAssertion rather than a union mismatch.
  const rawAssertions = (value as Record<string, unknown>)["assertions"];
  if (Array.isArray(rawAssertions)) {
    const registrationErrors = rawAssertions.flatMap((a, i) => registerAssertion(a, `/assertions/${i}`));
    if (registrationErrors.length > 0) return { ok: false, skipped, errors: registrationErrors };
  }

  const structural = contracts.validate(FixtureShape, value);
  if (!structural.ok) {
    return {
      ok: false,
      skipped,
      errors: structural.errors.map((e) => fixtureError("StructureInvalid", e.path, e.message)),
    };
  }

  const fixture = structural.value as Fixture;
  const semantic = validateSemantics(fixture, {
    knownReasonIds: options.knownReasonIds ?? DEFAULT_REASON_IDS,
    ...(options.catalog === undefined ? {} : { catalog: options.catalog }),
  });
  skipped.push(...semantic.skipped);
  if (semantic.errors.length > 0) return { ok: false, skipped, errors: semantic.errors };
  return { ok: true, fixture, skipped };
}

/** Parse fixture JSON text. Malformed JSON is a typed error, not an exception. */
export function parseFixtureText(text: string, options: ParseOptions = {}): ParseResult {
  const bytes = options.inputBytes ?? text.length;
  if (bytes > FIXTURE_LIMITS.inputBytes) {
    return { ok: false, skipped: [], errors: [fixtureError("InputTooLarge", "/", `fixture is ${bytes} bytes; the tool limit is ${FIXTURE_LIMITS.inputBytes}`)] };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return { ok: false, skipped: [], errors: [fixtureError("MalformedJson", "/", (e as Error).message)] };
  }
  return parseFixtureValue(value, { ...options, inputBytes: bytes });
}
