/**
 * Assertion registry (W0-05; contracts/FIXTURE_DSL.md "Assertion semantics").
 *
 * Two separate jobs:
 *
 *   1. **Registration** — is this assertion kind known and well formed? An
 *      unknown kind is an `UnsupportedAssertion` failure, never a silent skip.
 *   2. **Evaluation** — the event-count kinds can be evaluated against a list
 *      of committed events, which exists as data. `Invariant` and
 *      `HashEqualVariant` need a running simulation, which does not exist until
 *      W0-07/W0-08; they evaluate to **Blocked**, never to Passed.
 *
 * `EventCountGte` with no matching events fails. That is the whole point of the
 * minimum being at least one: a vacuous match may not prove a behaviour.
 */
import type { FixtureAssertion } from "./envelope.js";
import { ASSERTION_KINDS, HASH_VARIANTS, INVARIANT_NAMES } from "./envelope.js";
import { fixtureError } from "./errors.js";
import type { FixtureError } from "./errors.js";

/** The committed-event fields an assertion may match on (a subset of CommittedEvent). */
export interface MatchableEvent {
  readonly type: string;
  readonly tick: number;
  readonly actorId?: string;
  readonly targetId?: string;
  readonly reasonId?: string;
}

export type AssertionStatus = "Passed" | "Failed" | "Blocked";

export interface AssertionOutcome {
  readonly kind: string;
  readonly status: AssertionStatus;
  /** Why it failed, or why it could not be evaluated. Always present unless Passed. */
  readonly detail?: string;
  /** For Blocked: the packet that will make this evaluable. */
  readonly availableFrom?: string;
  /** Observed value for the count kinds, so a failure shows the number it saw. */
  readonly observed?: number;
  readonly expected?: string;
}

/** Kinds this build can actually evaluate from data. */
export const EVALUABLE_KINDS: readonly string[] = ["EventCountGte", "EventCountEq"];
/** Kinds that are known and valid but need a running simulation. */
export const BLOCKED_KINDS = {
  Invariant: "W0-07 (tick loop and production invariants)",
  HashEqualVariant: "W0-08 (snapshot, restore and canonical hashes)",
} as const satisfies Record<string, string>;

/**
 * Registration check for a value that has already passed the envelope. Returns
 * errors for anything the registry does not know — an unknown kind, invariant
 * name or hash variant never degrades into a skip.
 */
export function registerAssertion(value: unknown, path: string): readonly FixtureError[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [fixtureError("UnsupportedAssertion", path, "assertion must be an object with a kind")];
  }
  const record = value as Record<string, unknown>;
  const kind = record["kind"];
  if (typeof kind !== "string" || !ASSERTION_KINDS.includes(kind as (typeof ASSERTION_KINDS)[number])) {
    return [
      fixtureError(
        "UnsupportedAssertion",
        `${path}/kind`,
        `unknown assertion kind ${JSON.stringify(kind)}; registered kinds are ${ASSERTION_KINDS.join(", ")}`,
      ),
    ];
  }
  if (kind === "Invariant") {
    const name = record["name"];
    if (typeof name !== "string" || !INVARIANT_NAMES.includes(name as (typeof INVARIANT_NAMES)[number])) {
      return [fixtureError("UnsupportedAssertion", `${path}/name`, `unknown invariant ${JSON.stringify(name)}; registered invariants are ${INVARIANT_NAMES.join(", ")}`)];
    }
  }
  if (kind === "HashEqualVariant") {
    const variant = record["variant"];
    if (typeof variant !== "string" || !HASH_VARIANTS.includes(variant as (typeof HASH_VARIANTS)[number])) {
      return [fixtureError("UnsupportedAssertion", `${path}/variant`, `unknown hash variant ${JSON.stringify(variant)}; registered variants are ${HASH_VARIANTS.join(", ")}`)];
    }
  }
  return [];
}

function matches(event: MatchableEvent, match: { type: string; actorId?: string; targetId?: string; reasonId?: string; fromTick?: number; throughTick?: number }): boolean {
  if (event.type !== match.type) return false;
  if (match.actorId !== undefined && event.actorId !== match.actorId) return false;
  if (match.targetId !== undefined && event.targetId !== match.targetId) return false;
  if (match.reasonId !== undefined && event.reasonId !== match.reasonId) return false;
  if (match.fromTick !== undefined && event.tick < match.fromTick) return false;
  if (match.throughTick !== undefined && event.tick > match.throughTick) return false;
  return true;
}

function describeMatch(match: { type: string; actorId?: string; targetId?: string; reasonId?: string; fromTick?: number; throughTick?: number }): string {
  const parts = [`type=${match.type}`];
  if (match.actorId !== undefined) parts.push(`actorId=${match.actorId}`);
  if (match.targetId !== undefined) parts.push(`targetId=${match.targetId}`);
  if (match.reasonId !== undefined) parts.push(`reasonId=${match.reasonId}`);
  if (match.fromTick !== undefined || match.throughTick !== undefined) parts.push(`ticks ${match.fromTick ?? 0}..${match.throughTick ?? "end"}`);
  return parts.join(", ");
}

/**
 * Evaluate one assertion. `events` is the committed-event list from a run; pass
 * `undefined` when no run happened — every assertion is then Blocked rather
 * than trivially satisfied.
 */
export function evaluateAssertion(assertion: FixtureAssertion, events: readonly MatchableEvent[] | undefined): AssertionOutcome {
  if (assertion.kind === "Invariant") {
    return { kind: assertion.kind, status: "Blocked", detail: `invariant ${assertion.name} needs a running simulation`, availableFrom: BLOCKED_KINDS.Invariant };
  }
  if (assertion.kind === "HashEqualVariant") {
    return {
      kind: assertion.kind,
      status: "Blocked",
      detail: `hash variant ${assertion.variant} needs snapshot, restore and canonical hashes`,
      availableFrom: BLOCKED_KINDS.HashEqualVariant,
    };
  }
  if (events === undefined) {
    return { kind: assertion.kind, status: "Blocked", detail: "no committed events: the fixture was validated, not run", availableFrom: "W0-06 (clanlab run)" };
  }

  const count = events.filter((e) => matches(e, assertion.match)).length;
  if (assertion.kind === "EventCountGte") {
    const ok = count >= assertion.minimum;
    return {
      kind: assertion.kind,
      status: ok ? "Passed" : "Failed",
      observed: count,
      expected: `>= ${assertion.minimum}`,
      ...(ok ? {} : { detail: `no assertion passes on an empty match: ${count} events matched (${describeMatch(assertion.match)}), needed at least ${assertion.minimum}` }),
    };
  }
  const ok = count === assertion.count;
  return {
    kind: assertion.kind,
    status: ok ? "Passed" : "Failed",
    observed: count,
    expected: `== ${assertion.count}`,
    ...(ok ? {} : { detail: `${count} events matched (${describeMatch(assertion.match)}), expected exactly ${assertion.count}` }),
  };
}

export interface AssertionSummary {
  readonly requested: number;
  readonly passed: number;
  readonly failed: number;
  readonly blocked: number;
  readonly outcomes: readonly AssertionOutcome[];
}

export function evaluateAll(assertions: readonly FixtureAssertion[], events: readonly MatchableEvent[] | undefined): AssertionSummary {
  const outcomes = assertions.map((a) => evaluateAssertion(a, events));
  return {
    requested: outcomes.length,
    passed: outcomes.filter((o) => o.status === "Passed").length,
    failed: outcomes.filter((o) => o.status === "Failed").length,
    blocked: outcomes.filter((o) => o.status === "Blocked").length,
    outcomes,
  };
}
