import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadTape, noneHost, REASON_NOT_REPRESENTABLE, TAPE_VERSION } from "./host.js";

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "clanlab-host-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function event(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 0,
    runId: "run-w0-06-harness",
    branchId: "branch-main",
    sequence: 1,
    tick: 5,
    stage: 10,
    type: "actor.moved",
    causalParents: [],
    status: "Factual",
    payload: { kind: "actor.moved.v0", version: 0, fields: {} },
    ...overrides,
  };
}

function tapeFile(doc: unknown, name = "tape.json"): string {
  const path = join(dir, name);
  writeFileSync(path, `${JSON.stringify(doc, null, 1)}\n`);
  return path;
}

const options = { maxTicks: 100, fixtureId: "W0-06-HARNESS" } as const;

describe("the none host", () => {
  it("produces no event stream at all, so nothing can be judged against it", () => {
    const host = noneHost();
    expect(host.events).toBeUndefined();
    expect(host.finalTick).toBe(0);
    expect(host.simulated).toBe(false);
  });

  it("is watermarked and can never be gate evidence", () => {
    const host = noneHost();
    expect(host.watermark).toBe("FakeSim");
    expect(host.gateEligible).toBe(false);
    expect(host.unsupportedSystems.join(" ")).toContain("tick loop (W0-07)");
  });
});

describe("the event tape host", () => {
  it("loads a declared tape and reports its provenance and hash", () => {
    const path = tapeFile({
      tapeVersion: TAPE_VERSION,
      source: "hand-authored for the W0-06 harness tests",
      producedBy: "a person writing a test, not a simulation",
      fixtureId: "W0-06-HARNESS",
      events: [event(), event({ sequence: 2, tick: 9, type: "actor.rested" })],
    });
    const loaded = loadTape(path, options);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.host.tape?.events).toBe(2);
    expect(loaded.host.tape?.sha256).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(loaded.host.tape?.producedBy).toContain("not a simulation");
    expect(loaded.host.finalTick).toBe(9);
    expect(loaded.host.gateEligible).toBe(false);
    expect(loaded.skipped).toHaveLength(0);
  });

  it("maps only the fields contract v0 actually carries, and never invents a reasonId", () => {
    const path = tapeFile({
      tapeVersion: TAPE_VERSION,
      source: "harness",
      producedBy: "test",
      fixtureId: "W0-06-HARNESS",
      events: [event({ actorId: "C003", targetActorId: "C006" })],
    });
    const loaded = loadTape(path, options);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.host.events?.[0]).toEqual({ type: "actor.moved", tick: 5, actorId: "C003", targetId: "C006" });
    expect(loaded.host.events?.[0]).not.toHaveProperty("reasonId");
    expect(loaded.host.unmatchableFields).toContainEqual(REASON_NOT_REPRESENTABLE);
  });

  it("refuses a tape that does not say where it came from", () => {
    for (const missing of ["source", "producedBy"] as const) {
      const doc: Record<string, unknown> = { tapeVersion: TAPE_VERSION, source: "s", producedBy: "p", events: [] };
      delete doc[missing];
      const loaded = loadTape(tapeFile(doc, `${missing}.json`), options);
      expect(loaded.ok).toBe(false);
      if (loaded.ok) return;
      expect(loaded.errors[0]?.code).toBe("TapeStructureInvalid");
      expect(loaded.errors[0]?.path).toBe(`/${missing}`);
    }
  });

  it("refuses an unknown tape version rather than guessing its meaning", () => {
    const loaded = loadTape(tapeFile({ tapeVersion: 2, source: "s", producedBy: "p", events: [] }), options);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.errors).toHaveLength(1);
    expect(loaded.errors[0]?.code).toBe("TapeUnknownVersion");
  });

  it("validates every event against the frozen CommittedEvent contract", () => {
    const loaded = loadTape(
      tapeFile({
        tapeVersion: TAPE_VERSION,
        source: "s",
        producedBy: "p",
        events: [event({ stage: 11 }), event({ sequence: 2, actorId: "C000" }), event({ sequence: 3, type: "9-bad-id" }), event({ sequence: 4, invented: true })],
      }),
      options,
    );
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    const paths = loaded.errors.map((e) => e.path);
    expect(paths).toContain("/events/0/stage");
    expect(paths).toContain("/events/1/actorId");
    expect(paths).toContain("/events/2/type");
    expect(paths).toContain("/events/3/invented");
    expect(new Set(loaded.errors.map((e) => e.code))).toEqual(new Set(["TapeEventInvalid"]));
  });

  it("refuses a stream that goes backwards or reuses a sequence", () => {
    const loaded = loadTape(
      tapeFile({
        tapeVersion: TAPE_VERSION,
        source: "s",
        producedBy: "p",
        events: [event({ sequence: 5, tick: 20 }), event({ sequence: 4, tick: 10 })],
      }),
      options,
    );
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.errors.map((e) => e.code)).toEqual(["TapeOutOfOrder", "TapeOutOfOrder"]);
  });

  it("refuses events past the fixture's own horizon", () => {
    const loaded = loadTape(tapeFile({ tapeVersion: TAPE_VERSION, source: "s", producedBy: "p", events: [event({ tick: 101 })] }), options);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.errors[0]?.code).toBe("TapeBeyondHorizon");
    expect(loaded.errors[0]?.message).toContain("maxTicks 100");
  });

  it("refuses a tape bound to a different fixture, and records a skipped check when it is bound to none", () => {
    const wrong = loadTape(tapeFile({ tapeVersion: TAPE_VERSION, source: "s", producedBy: "p", fixtureId: "SOME-OTHER", events: [] }, "wrong.json"), options);
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.errors[0]?.code).toBe("TapeFixtureMismatch");

    const unbound = loadTape(tapeFile({ tapeVersion: TAPE_VERSION, source: "s", producedBy: "p", events: [] }, "unbound.json"), options);
    expect(unbound.ok).toBe(true);
    if (!unbound.ok) return;
    expect(unbound.skipped[0]?.code).toBe("TapeNotBoundToFixture");
    expect(unbound.skipped[0]?.message).toContain("W0-06-HARNESS");
  });

  it("reports an unreadable or malformed tape as a typed error, not a crash", () => {
    const missing = loadTape(join(dir, "does-not-exist.json"), options);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.errors[0]?.code).toBe("TapeUnreadable");

    const path = join(dir, "broken.json");
    writeFileSync(path, "{ not json");
    const malformed = loadTape(path, options);
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.errors[0]?.code).toBe("TapeMalformedJson");
  });

  it("rejects unknown top-level fields so a typo cannot be silently ignored", () => {
    const loaded = loadTape(tapeFile({ tapeVersion: TAPE_VERSION, source: "s", producedBy: "p", events: [], producedByy: "typo" }), options);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.errors.map((e) => e.path)).toContain("/producedByy");
  });

  it("accepts an empty tape as a real run that produced nothing — distinct from no run at all", () => {
    const loaded = loadTape(tapeFile({ tapeVersion: TAPE_VERSION, source: "s", producedBy: "p", fixtureId: "W0-06-HARNESS", events: [] }), options);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.host.events).toEqual([]);
    expect(loaded.host.tape?.firstTick).toBeNull();
    expect(noneHost().events).toBeUndefined();
  });
});
