import { describe, expect, it } from "vitest";
import { BLOCKED_KINDS, EVALUABLE_KINDS, evaluateAll, evaluateAssertion, registerAssertion } from "./assertions.js";
import type { FixtureAssertion, MatchableEvent } from "./index.js";

const events: MatchableEvent[] = [
  { type: "CommandRejected", tick: 1, actorId: "C003", reasonId: "NoticeTooShort" },
  { type: "CommandRejected", tick: 40, actorId: "C004", reasonId: "StaleRules" },
  { type: "ActorWaited", tick: 12, actorId: "C001" },
  { type: "ActorWaited", tick: 44, actorId: "C001" },
  { type: "ActorWaited", tick: 90, actorId: "C002" },
];

const gte = (match: Record<string, unknown>, minimum: number): FixtureAssertion => ({ kind: "EventCountGte", match, minimum }) as FixtureAssertion;
const eq = (match: Record<string, unknown>, count: number): FixtureAssertion => ({ kind: "EventCountEq", match, count }) as FixtureAssertion;

describe("acceptance 3 — an EventCountGte with no matching events fails rather than passing empty", () => {
  it("zero matches is a failure, and the message says so", () => {
    const outcome = evaluateAssertion(gte({ type: "ActorBuiltShelter" }, 1), events);
    expect(outcome.status).toBe("Failed");
    expect(outcome.observed).toBe(0);
    expect(outcome.expected).toBe(">= 1");
    expect(outcome.detail).toContain("no assertion passes on an empty match");
  });

  it("a match that is right in kind but wrong in actor, reason or tick range still fails", () => {
    expect(evaluateAssertion(gte({ type: "ActorWaited", actorId: "C009" }, 1), events).status).toBe("Failed");
    expect(evaluateAssertion(gte({ type: "CommandRejected", reasonId: "MembershipLocked" }, 1), events).status).toBe("Failed");
    expect(evaluateAssertion(gte({ type: "ActorWaited", fromTick: 100 }, 1), events).status).toBe("Failed");
  });

  it("a genuine match passes and reports the count it saw", () => {
    const outcome = evaluateAssertion(gte({ type: "ActorWaited", actorId: "C001" }, 2), events);
    expect(outcome.status).toBe("Passed");
    expect(outcome.observed).toBe(2);
    expect(evaluateAssertion(gte({ type: "ActorWaited", actorId: "C001" }, 3), events).status).toBe("Failed");
  });

  it("tick bounds are inclusive at both ends", () => {
    expect(evaluateAssertion(eq({ type: "ActorWaited", fromTick: 12, throughTick: 44 }, 2), events).status).toBe("Passed");
    expect(evaluateAssertion(eq({ type: "ActorWaited", fromTick: 13, throughTick: 43 }, 0), events).status).toBe("Passed");
  });

  it("EventCountEq can assert an explicit absence — and fails when the thing happened", () => {
    expect(evaluateAssertion(eq({ type: "LawActivated" }, 0), events).status).toBe("Passed");
    const wrong = evaluateAssertion(eq({ type: "ActorWaited" }, 0), events);
    expect(wrong.status).toBe("Failed");
    expect(wrong.observed).toBe(3);
  });
});

describe("assertions that need a simulation are Blocked, never Passed", () => {
  it.each([
    [{ kind: "Invariant", name: "NoIllegalEffects" }, BLOCKED_KINDS.Invariant],
    [{ kind: "HashEqualVariant", variant: "SaveReload", startTick: 0, advanceTicks: 10 }, BLOCKED_KINDS.HashEqualVariant],
  ])("%o", (assertion, availableFrom) => {
    const outcome = evaluateAssertion(assertion as FixtureAssertion, events);
    expect(outcome.status).toBe("Blocked");
    expect(outcome.availableFrom).toBe(availableFrom);
    expect(outcome.status).not.toBe("Passed");
  });

  it("with no event list at all, even the countable kinds are Blocked rather than trivially satisfied", () => {
    const outcome = evaluateAssertion(eq({ type: "Anything" }, 0), undefined);
    expect(outcome.status).toBe("Blocked");
    expect(outcome.detail).toContain("validated, not run");
  });

  it("only the event-count kinds are claimed to be evaluable here", () => {
    expect(EVALUABLE_KINDS).toEqual(["EventCountGte", "EventCountEq"]);
    expect(Object.keys(BLOCKED_KINDS)).toEqual(["Invariant", "HashEqualVariant"]);
  });
});

describe("registration refuses what it does not know", () => {
  it("accepts the four registered kinds", () => {
    for (const assertion of [
      { kind: "EventCountGte", match: { type: "X" }, minimum: 1 },
      { kind: "EventCountEq", match: { type: "X" }, count: 0 },
      { kind: "Invariant", name: "ConserveInventory" },
      { kind: "HashEqualVariant", variant: "ObserverToggle", startTick: 0, advanceTicks: 1 },
    ]) {
      expect(registerAssertion(assertion, "/assertions/0")).toEqual([]);
    }
  });

  it("rejects unknown kinds, invariants and variants with UnsupportedAssertion", () => {
    for (const bad of [
      { kind: "AllMatchingEventsAreValid" },
      { kind: "Invariant", name: "NothingBadHappened" },
      { kind: "HashEqualVariant", variant: "Rewind", startTick: 0, advanceTicks: 1 },
      { kind: null },
      null,
      [],
      "EventCountGte",
    ]) {
      const errors = registerAssertion(bad, "/assertions/0");
      expect(errors.length, JSON.stringify(bad)).toBe(1);
      expect(errors[0]?.code).toBe("UnsupportedAssertion");
    }
  });
});

describe("summaries separate passed, failed and blocked", () => {
  it("counts each status without folding blocked into either side", () => {
    const summary = evaluateAll(
      [gte({ type: "ActorWaited" }, 1), gte({ type: "NeverHappens" }, 1), { kind: "Invariant", name: "NoIllegalEffects" } as FixtureAssertion],
      events,
    );
    expect(summary).toMatchObject({ requested: 3, passed: 1, failed: 1, blocked: 1 });
    expect(summary.passed + summary.failed + summary.blocked).toBe(summary.requested);
  });
});
