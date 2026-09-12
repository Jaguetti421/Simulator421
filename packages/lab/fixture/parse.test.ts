import { describe, expect, it } from "vitest";
import { FIXTURE_LIMITS, MINIMUM_LAW_NOTICE_TICKS } from "./errors.js";
import type { FixtureErrorCode } from "./errors.js";
import { parseFixtureText, parseFixtureValue } from "./parse.js";
import { validateSemantics } from "./semantics.js";
import type { ParseResult } from "./parse.js";
import aiWait from "../../../tests/fixtures/examples/AI-03-PATIENT-WAIT.json" with { type: "json" };
import lawNotice from "../../../tests/fixtures/examples/LAW-NOTICE-REJECTION.json" with { type: "json" };
import saveBootstrap from "../../../tests/fixtures/examples/SAVE-BOOTSTRAP-01.json" with { type: "json" };

/** A minimal valid fixture the individual tests perturb. */
function baseFixture(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: "TEST-BASE",
    gate: "G0",
    evidenceStatus: "SCHEMA_EXAMPLE_UNEXECUTED",
    profile: { kind: "Fixture", definitions: "Prototype8", contestantCount: 1, writeCareer: false },
    map: { recipeId: "bootstrap-flat", seed: 7 },
    setup: {
      actors: [
        {
          id: "C001",
          positionMm: [0, 0, 0],
          vitalsMilli: { health: 100000, fullness: 85000, fatigue: 10000, exposure: 0, stamina: 100000 },
          inventory: {},
        },
      ],
      precommittedLaws: [],
    },
    schedule: [],
    maxTicks: 1200,
    assertions: [{ kind: "EventCountGte", match: { type: "TickCompleted" }, minimum: 1 }],
  };
}

const codes = (result: ParseResult): FixtureErrorCode[] => (result.ok ? [] : result.errors.map((e) => e.code));
const paths = (result: ParseResult): string[] => (result.ok ? [] : result.errors.map((e) => e.path));

function withSchedule(entry: Record<string, unknown>): Record<string, unknown> {
  const f = baseFixture();
  (f["schedule"] as unknown[]).push(entry);
  return f;
}
const lawCommand = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  atTick: 1,
  sequence: 1,
  expectedRulesVersion: 0,
  operation: "ScheduleLaw",
  payload: { lawId: "Truce", startTick: 601, endTick: 1200 },
  expectAck: "Accepted",
  ...over,
});

describe("acceptance 3 — the three supplied example fixtures parse", () => {
  it.each([
    ["AI-03-PATIENT-WAIT", aiWait],
    ["LAW-NOTICE-REJECTION", lawNotice],
    ["SAVE-BOOTSTRAP-01", saveBootstrap],
  ])("%s", (_name, doc) => {
    const result = parseFixtureValue(doc);
    expect(result.ok ? "" : result.errors.map((e) => `${e.code} ${e.path} ${e.message}`).join("; ")).toBe("");
  });

  it("reports content checks it could not run rather than passing them silently", () => {
    const result = parseFixtureValue(aiWait);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skipped.length).toBeGreaterThan(0);
    for (const s of result.skipped) {
      expect(s.code).toBe("ContentCatalogUnavailable");
      expect(s.availableFrom).toBeTruthy();
    }
  });

  it("a supplied fixture keeps its declared evidence status — nothing here upgrades it", () => {
    for (const doc of [aiWait, lawNotice, saveBootstrap]) {
      expect(doc.evidenceStatus).toBe("SCHEMA_EXAMPLE_UNEXECUTED");
    }
  });
});

describe("acceptance 1 — unknown versions, fields, units, IDs and assertion kinds are rejected before any world exists", () => {
  it("an unknown schema version is refused with its own code, not a field error", () => {
    for (const version of [0, 2, "1", undefined, null]) {
      const f = baseFixture();
      f["schemaVersion"] = version;
      const result = parseFixtureValue(f);
      expect(codes(result)).toEqual(["UnknownSchemaVersion"]);
    }
  });

  it("an unknown top-level or nested field is refused", () => {
    const top = baseFixture();
    top["extra"] = 1;
    expect(codes(parseFixtureValue(top))).toContain("StructureInvalid");

    const nested = baseFixture();
    ((nested["setup"] as Record<string, unknown>)["actors"] as Record<string, unknown>[])[0]!["luck"] = 5;
    const result = parseFixtureValue(nested);
    expect(codes(result)).toContain("StructureInvalid");
    expect(paths(result)[0]).toContain("/setup/actors/0/luck");
  });

  it("units out of range are refused: vitals are thousandths of 0–100", () => {
    for (const bad of [-1, 100001, 1.5]) {
      const f = baseFixture();
      ((f["setup"] as Record<string, unknown>)["actors"] as Record<string, Record<string, unknown>>[])[0]!["vitalsMilli"] = {
        health: bad,
        fullness: 85000,
        fatigue: 10000,
        exposure: 0,
        stamina: 100000,
      };
      expect(codes(parseFixtureValue(f)), String(bad)).toContain("StructureInvalid");
    }
  });

  it("malformed actor IDs, fixture IDs, seeds and tick counts are refused", () => {
    const badActor = baseFixture();
    ((badActor["setup"] as Record<string, unknown>)["actors"] as Record<string, unknown>[])[0]!["id"] = "Cx01";
    expect(paths(parseFixtureValue(badActor))).toContain("/setup/actors/0/id");

    const badId = baseFixture();
    badId["id"] = "lower-case";
    expect(paths(parseFixtureValue(badId))).toContain("/id");

    const badSeed = baseFixture();
    (badSeed["map"] as Record<string, unknown>)["seed"] = 4294967296;
    expect(paths(parseFixtureValue(badSeed))).toContain("/map/seed");

    const badTicks = baseFixture();
    badTicks["maxTicks"] = 360001;
    expect(paths(parseFixtureValue(badTicks))).toContain("/maxTicks");
  });

  it("an unknown assertion kind, invariant or hash variant is UnsupportedAssertion — never a silent skip", () => {
    for (const [assertion, path] of [
      [{ kind: "AllMatchingEventsAreValid", match: { type: "X" } }, "/assertions/0/kind"],
      [{ kind: "Invariant", name: "EverythingIsFine" }, "/assertions/0/name"],
      [{ kind: "HashEqualVariant", variant: "TimeTravel", startTick: 0, advanceTicks: 1 }, "/assertions/0/variant"],
      [{ kind: 42 }, "/assertions/0/kind"],
      ["EventCountGte", "/assertions/0"],
    ] as const) {
      const f = baseFixture();
      f["assertions"] = [assertion];
      const result = parseFixtureValue(f);
      expect(codes(result), JSON.stringify(assertion)).toEqual(["UnsupportedAssertion"]);
      expect(paths(result)[0]).toBe(path);
    }
  });

  it("malformed JSON and oversized input are typed errors, not exceptions", () => {
    expect(codes(parseFixtureText("{not json"))).toEqual(["MalformedJson"]);
    expect(codes(parseFixtureText("{}", { inputBytes: FIXTURE_LIMITS.inputBytes + 1 }))).toEqual(["InputTooLarge"]);
  });

  it("an EventCountGte minimum below 1 is refused: a vacuous match may not prove a behaviour", () => {
    const f = baseFixture();
    f["assertions"] = [{ kind: "EventCountGte", match: { type: "X" }, minimum: 0 }];
    expect(paths(parseFixtureValue(f))).toContain("/assertions/0/minimum");
  });
});

describe("acceptance 2 — setup state is separated from validated player commands", () => {
  it("a precommitted law may begin at tick 0; a scheduled command may not", () => {
    const precommitted = baseFixture();
    (precommitted["setup"] as Record<string, unknown>)["precommittedLaws"] = [{ lawId: "Truce", startTick: 0, endTick: 600 }];
    expect(parseFixtureValue(precommitted).ok).toBe(true);

    // The envelope pins atTick >= 1, exactly as the supplied schema does, so the
    // parser refuses it structurally; validateSemantics carries the same rule with
    // the SetupOnlyInSchedule code for callers that bypass the envelope.
    const scheduledAtZero = withSchedule(lawCommand({ atTick: 0, payload: { lawId: "Truce", startTick: 600, endTick: 1200 } }));
    const result = parseFixtureValue(scheduledAtZero);
    expect(codes(result)).toContain("StructureInvalid");
    expect(paths(result)).toContain("/schedule/0/atTick");

    const bypassed = baseFixture();
    bypassed["schedule"] = [lawCommand({ atTick: 0 })];
    const bypassing = validateSemantics(bypassed as never, { knownReasonIds: new Set(["NoticeTooShort"]) });
    expect(bypassing.errors.map((e) => e.code)).toContain("SetupOnlyInSchedule");
  });

  it("a runtime law with less than 600 ticks of notice is rejected when the fixture expects it to be accepted", () => {
    const short = withSchedule(lawCommand({ atTick: 1, payload: { lawId: "Truce", startTick: 600, endTick: 1200 } }));
    expect(codes(parseFixtureValue(short))).toContain("NoticeTooShort");

    const exact = withSchedule(lawCommand({ atTick: 1, payload: { lawId: "Truce", startTick: 1 + MINIMUM_LAW_NOTICE_TICKS, endTick: 1200 } }));
    expect(parseFixtureValue(exact).ok).toBe(true);
  });

  it("the same short notice is allowed when the fixture expects a rejection and names the reason", () => {
    const expected = withSchedule(
      lawCommand({ atTick: 1, payload: { lawId: "Truce", startTick: 101, endTick: 1301 }, expectAck: "Rejected", expectedReasonId: "NoticeTooShort" }),
    );
    expect(parseFixtureValue(expected).ok).toBe(true);
  });

  it("an expected rejection must name a registered reason", () => {
    const missing = withSchedule(lawCommand({ expectAck: "Rejected" }));
    expect(codes(parseFixtureValue(missing))).toContain("ExpectedReasonMissing");

    const unknown = withSchedule(lawCommand({ expectAck: "Rejected", expectedReasonId: "ItJustFailed" }));
    expect(codes(parseFixtureValue(unknown))).toContain("ExpectedReasonUnknown");

    const pointless = withSchedule(lawCommand({ expectAck: "Accepted", expectedReasonId: "StaleRules" }));
    expect(codes(parseFixtureValue(pointless))).toContain("ExpectedReasonMissing");
  });

  it("duplicate sequences and duplicate actors are refused", () => {
    const dupSeq = baseFixture();
    dupSeq["schedule"] = [lawCommand({ sequence: 1 }), lawCommand({ sequence: 1, atTick: 2, payload: { lawId: "Sanctuary", startTick: 700, endTick: 1200 } })];
    expect(codes(parseFixtureValue(dupSeq))).toContain("DuplicateSequence");

    const dupActor = baseFixture();
    const actors = (dupActor["setup"] as Record<string, unknown>)["actors"] as Record<string, unknown>[];
    actors.push({ ...actors[0] });
    (dupActor["profile"] as Record<string, unknown>)["contestantCount"] = 2;
    expect(codes(parseFixtureValue(dupActor))).toContain("DuplicateActor");
  });

  it("law intervals and region geometry are checked in both setup and schedule", () => {
    const badInterval = baseFixture();
    (badInterval["setup"] as Record<string, unknown>)["precommittedLaws"] = [{ lawId: "Truce", startTick: 500, endTick: 500 }];
    expect(codes(parseFixtureValue(badInterval))).toContain("LawIntervalInvalid");

    const halfRegion = withSchedule(lawCommand({ payload: { lawId: "Sanctuary", startTick: 601, endTick: 1200, centerMm: [0, 0] } }));
    expect(codes(parseFixtureValue(halfRegion))).toContain("RegionGeometryInvalid");

    const fullRegion = withSchedule(lawCommand({ payload: { lawId: "Sanctuary", startTick: 601, endTick: 1200, centerMm: [0, 0], radiusMm: 5000 } }));
    expect(parseFixtureValue(fullRegion).ok).toBe(true);
  });
});

describe("profiles: Fixture is flexible, the named profiles are not (Addendum D07)", () => {
  function withActors(kind: string, contestantCount: number, ids: readonly string[]): Record<string, unknown> {
    const f = baseFixture();
    f["profile"] = { kind, definitions: "Prototype8", contestantCount, writeCareer: false };
    (f["setup"] as Record<string, unknown>)["actors"] = ids.map((id) => ({
      id,
      positionMm: [0, 0, 0],
      vitalsMilli: { health: 100000, fullness: 85000, fatigue: 10000, exposure: 0, stamina: 100000 },
      inventory: {},
    }));
    return f;
  }
  const contestants = (n: number): string[] => Array.from({ length: n }, (_, i) => `C${String(i + 1).padStart(3, "0")}`);

  it("Prototype8 needs exactly 8 contestants", () => {
    expect(parseFixtureValue(withActors("Prototype8", 8, contestants(8))).ok).toBe(true);
    expect(codes(parseFixtureValue(withActors("Prototype8", 7, contestants(7))))).toContain("ProfileCountMismatch");
    expect(codes(parseFixtureValue(withActors("Prototype8", 8, contestants(7))))).toContain("ProfileCountMismatch");
  });

  it("Trial24 and Standard100 need exactly 24 and 100", () => {
    expect(parseFixtureValue(withActors("Trial24", 24, contestants(24))).ok).toBe(true);
    expect(codes(parseFixtureValue(withActors("Trial24", 23, contestants(23))))).toContain("ProfileCountMismatch");
    expect(parseFixtureValue(withActors("Standard100", 100, contestants(100))).ok).toBe(true);
    expect(codes(parseFixtureValue(withActors("Standard100", 99, contestants(99))))).toContain("ProfileCountMismatch");
  });

  it("wildlife and the guest do not count toward the contestant count", () => {
    expect(parseFixtureValue(withActors("Prototype8", 8, [...contestants(8), "W001", "G001"])).ok).toBe(true);
    expect(codes(parseFixtureValue(withActors("Prototype8", 8, [...contestants(7), "W001", "G001"])))).toContain("ProfileCountMismatch");
  });

  it("Fixture allows an arbitrary declared subset but must still match its own count", () => {
    expect(parseFixtureValue(withActors("Fixture", 3, contestants(3))).ok).toBe(true);
    expect(codes(parseFixtureValue(withActors("Fixture", 3, contestants(2))))).toContain("ProfileCountMismatch");
  });

  it("writeCareer true is refused — a fixture never writes a production career", () => {
    const f = baseFixture();
    (f["profile"] as Record<string, unknown>)["writeCareer"] = true;
    // The envelope pins it to false (as the supplied schema does), so this is
    // structural; validateSemantics carries the same rule for callers that build
    // a fixture object directly (semantics.test.ts covers that path).
    expect(codes(parseFixtureValue(f))).toContain("StructureInvalid");
    expect(paths(parseFixtureValue(f))).toContain("/profile/writeCareer");
  });
});

describe("known facts cannot become a backdoor to omniscience", () => {
  function withFact(fact: Record<string, unknown>, extraActors: readonly string[] = []): Record<string, unknown> {
    const f = baseFixture();
    const actors = (f["setup"] as Record<string, unknown>)["actors"] as Record<string, unknown>[];
    actors[0]!["knownFacts"] = [fact];
    for (const id of extraActors) {
      actors.push({ id, positionMm: [0, 0, 0], vitalsMilli: { health: 100000, fullness: 85000, fatigue: 10000, exposure: 0, stamina: 100000 }, inventory: {} });
    }
    (f["profile"] as Record<string, unknown>)["contestantCount"] = 1 + extraActors.filter((a) => a.startsWith("C")).length;
    return f;
  }

  it("a fact about an undeclared actor is refused", () => {
    expect(codes(parseFixtureValue(withFact({ kind: "actor.position", subject: "C099", observedTick: 0, source: "DirectObservation" })))).toContain("UnknownFactSubject");
    expect(parseFixtureValue(withFact({ kind: "actor.position", subject: "C002", observedTick: 0, source: "DirectObservation" }, ["C002"])).ok).toBe(true);
  });

  it("a Report fact must name a declared reporter; other sources must not name one", () => {
    expect(codes(parseFixtureValue(withFact({ kind: "k", subject: "C001", observedTick: 0, source: "Report" })))).toContain("FactSourceInvalid");
    expect(codes(parseFixtureValue(withFact({ kind: "k", subject: "C001", observedTick: 0, source: "Report", sourceActor: "C002" })))).toContain("UnknownFactSubject");
    expect(parseFixtureValue(withFact({ kind: "k", subject: "C001", observedTick: 0, source: "Report", sourceActor: "C002" }, ["C002"])).ok).toBe(true);
    expect(codes(parseFixtureValue(withFact({ kind: "k", subject: "C001", observedTick: 0, source: "PublicNotice", sourceActor: "C001" })))).toContain("FactSourceInvalid");
  });

  it("a Self fact must be about its own actor, and setup facts are tick-zero state", () => {
    expect(codes(parseFixtureValue(withFact({ kind: "k", subject: "C002", observedTick: 0, source: "Self" }, ["C002"])))).toContain("FactSourceInvalid");
    expect(codes(parseFixtureValue(withFact({ kind: "k", subject: "C001", observedTick: 5, source: "Self" })))).toContain("StructureInvalid");
  });
});

describe("assertion intervals and hash variant range", () => {
  it("an inverted match interval is refused", () => {
    const f = baseFixture();
    f["assertions"] = [{ kind: "EventCountEq", match: { type: "X", fromTick: 500, throughTick: 100 }, count: 0 }];
    expect(codes(parseFixtureValue(f))).toContain("MatchIntervalInvalid");
  });

  it("a match naming an unregistered reason is refused", () => {
    const f = baseFixture();
    f["assertions"] = [{ kind: "EventCountGte", match: { type: "CommandRejected", reasonId: "Whatever" }, minimum: 1 }];
    expect(codes(parseFixtureValue(f))).toContain("ExpectedReasonUnknown");
  });

  it("a hash variant must fit inside maxTicks", () => {
    const f = baseFixture();
    f["maxTicks"] = 1000;
    f["assertions"] = [{ kind: "HashEqualVariant", variant: "SaveReload", startTick: 900, advanceTicks: 200 }];
    expect(codes(parseFixtureValue(f))).toContain("HashVariantOutOfRange");

    f["assertions"] = [{ kind: "HashEqualVariant", variant: "SaveReload", startTick: 800, advanceTicks: 200 }];
    expect(parseFixtureValue(f).ok).toBe(true);
  });
});
