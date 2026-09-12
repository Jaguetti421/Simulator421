/**
 * Run hosts (W0-06).
 *
 * `clanlab run` is the harness; the events it judges have to come from
 * somewhere, and at W0-06 there is still no simulation (the tick kernel is
 * W0-07). Two hosts exist, and both are explicit about what they are:
 *
 *   - **none** — the default. It simulates nothing and produces no events, so
 *     every assertion is Blocked, never Passed and never Failed. A run with this
 *     host can only exit nonzero.
 *   - **tape** — committed events read from a declared file (`--events`). The
 *     events are validated against the frozen `CommittedEvent` contract (W0-04)
 *     and the file must say where it came from. This proves the harness, not the
 *     game: the host is watermarked FakeSim and can never be gate evidence.
 *
 * Nothing here invents an event. A tape host emits exactly what its file
 * contains; a fixture's own `expectAck` never becomes an event, because deriving
 * the expected outcome from the expectation is circular and would fake a pass.
 */
import { readFileSync, statSync } from "node:fs";
import { contracts } from "@lastclan/sim";
import type { MatchableEvent } from "../fixture/index.js";
import { sha256 } from "./identity.js";

export const TAPE_VERSION = 1;
export const TAPE_LIMITS = { inputBytes: 8 * 1024 * 1024, events: 100_000 } as const;

export type RunErrorCode =
  | "TapeUnreadable"
  | "TapeMalformedJson"
  | "TapeUnknownVersion"
  | "TapeStructureInvalid"
  | "TapeEventInvalid"
  | "TapeOutOfOrder"
  | "TapeBeyondHorizon"
  | "TapeFixtureMismatch"
  | "TapeLimitExceeded";

export interface RunError {
  readonly code: RunErrorCode;
  readonly path: string;
  readonly message: string;
}

export interface RunSkippedCheck {
  readonly code: string;
  readonly message: string;
  readonly availableFrom: string;
}

export interface HostTapeInfo {
  readonly path: string;
  readonly sha256: string;
  /** Free text the tape author had to write: where these events came from. */
  readonly declaredSource: string;
  readonly producedBy: string;
  readonly fixtureId?: string;
  readonly events: number;
  readonly firstTick: number | null;
  readonly lastTick: number | null;
}

/**
 * A field an assertion may match on that this host cannot represent. Matching on
 * it is Blocked — not Failed, because "no event carried a reason" is a statement
 * about the contract, not about the game's behaviour.
 */
export interface UnmatchableField {
  readonly field: string;
  readonly reason: string;
  readonly availableFrom: string;
}

export interface RunHost {
  readonly kind: "none" | "tape";
  readonly id: string;
  readonly watermark: "FakeSim";
  /** Always false at W0-06: no host here may stand as gate evidence (AGENTS.md). */
  readonly gateEligible: false;
  readonly simulated: false;
  readonly unsupportedSystems: readonly string[];
  readonly unmatchableFields: readonly UnmatchableField[];
  /** `undefined` means "no run happened"; an empty array means "a run happened and produced no events". */
  readonly events: readonly MatchableEvent[] | undefined;
  readonly finalTick: number;
  readonly tape?: HostTapeInfo;
  readonly note: string;
}

/** Contract v0's CommittedEvent carries no reason ID, so no host can match one yet. */
export const REASON_NOT_REPRESENTABLE: UnmatchableField = {
  field: "reasonId",
  reason:
    "CommittedEvent at contract v0 has no reasonId field and its payload fields are closed, so no run can report the reason a command was rejected",
  availableFrom: "the packet that freezes the rejection event payload (P1-12, public command validator)",
};

const NO_SIMULATION_SYSTEMS = [
  "tick loop (W0-07)",
  "actors, movement, needs, crafting, combat (P1+)",
  "runtime law validation and effects (P1-12, P2-14)",
  "snapshots, restore and canonical hashes (W0-08)",
  "careers (never written by a fixture)",
];

export function noneHost(): RunHost {
  return {
    kind: "none",
    id: "none",
    watermark: "FakeSim",
    gateEligible: false,
    simulated: false,
    unsupportedSystems: NO_SIMULATION_SYSTEMS,
    unmatchableFields: [REASON_NOT_REPRESENTABLE],
    events: undefined,
    finalTick: 0,
    note: "No simulation exists at W0-06. No world was constructed, no tick ran and no event was produced; every assertion is Blocked.",
  };
}

export type TapeLoad = { readonly ok: true; readonly host: RunHost; readonly skipped: readonly RunSkippedCheck[] } | { readonly ok: false; readonly errors: readonly RunError[] };

/**
 * Load an event tape. The document is deliberately more than a list of events:
 * it must declare `source` and `producedBy`, which is what keeps a hand-authored
 * harness tape distinguishable from a kernel-produced one in every summary and
 * bundle that cites it.
 */
export function loadTape(path: string, options: { readonly maxTicks: number; readonly fixtureId: string }): TapeLoad {
  let text: string;
  let bytes: number;
  try {
    bytes = statSync(path).size;
    text = readFileSync(path, "utf8");
  } catch (e) {
    return { ok: false, errors: [{ code: "TapeUnreadable", path: "/", message: (e as Error).message }] };
  }
  if (bytes > TAPE_LIMITS.inputBytes) {
    return { ok: false, errors: [{ code: "TapeLimitExceeded", path: "/", message: `tape is ${bytes} bytes; the tool limit is ${TAPE_LIMITS.inputBytes}` }] };
  }

  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [{ code: "TapeMalformedJson", path: "/", message: (e as Error).message }] };
  }
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    return { ok: false, errors: [{ code: "TapeStructureInvalid", path: "/", message: "tape must be a JSON object" }] };
  }
  const record = doc as Record<string, unknown>;
  if (record["tapeVersion"] !== TAPE_VERSION) {
    return {
      ok: false,
      errors: [
        {
          code: "TapeUnknownVersion",
          path: "/tapeVersion",
          message: `this build reads event tape v${TAPE_VERSION}; got ${JSON.stringify(record["tapeVersion"])}`,
        },
      ],
    };
  }

  const errors: RunError[] = [];
  const skipped: RunSkippedCheck[] = [];
  const known = new Set(["tapeVersion", "source", "producedBy", "fixtureId", "events"]);
  for (const key of Object.keys(record)) {
    if (!known.has(key)) errors.push({ code: "TapeStructureInvalid", path: `/${key}`, message: `unknown field ${key}` });
  }
  const declaredSource = record["source"];
  const producedBy = record["producedBy"];
  if (typeof declaredSource !== "string" || declaredSource.trim() === "") {
    errors.push({ code: "TapeStructureInvalid", path: "/source", message: "a tape must say where its events came from" });
  }
  if (typeof producedBy !== "string" || producedBy.trim() === "") {
    errors.push({ code: "TapeStructureInvalid", path: "/producedBy", message: "a tape must name the thing that produced it (a build, a kernel version, or a person)" });
  }
  const fixtureId = record["fixtureId"];
  if (fixtureId === undefined) {
    skipped.push({
      code: "TapeNotBoundToFixture",
      message: `the tape declares no fixtureId, so it was not checked against fixture ${options.fixtureId}`,
      availableFrom: "add \"fixtureId\" to the tape",
    });
  } else if (typeof fixtureId !== "string" || fixtureId !== options.fixtureId) {
    errors.push({ code: "TapeFixtureMismatch", path: "/fixtureId", message: `tape declares fixture ${JSON.stringify(fixtureId)}; this run is fixture ${options.fixtureId}` });
  }

  const rawEvents = record["events"];
  if (!Array.isArray(rawEvents)) {
    errors.push({ code: "TapeStructureInvalid", path: "/events", message: "events must be an array of CommittedEvent records" });
    return { ok: false, errors };
  }
  if (rawEvents.length > TAPE_LIMITS.events) {
    errors.push({ code: "TapeLimitExceeded", path: "/events", message: `at most ${TAPE_LIMITS.events} events` });
    return { ok: false, errors };
  }

  const events: MatchableEvent[] = [];
  let previousTick = -1;
  let previousSequence = -1;
  rawEvents.forEach((raw, i) => {
    const result = contracts.validate(contracts.CommittedEventShape, raw);
    if (!result.ok) {
      for (const e of result.errors) {
        errors.push({ code: "TapeEventInvalid", path: `/events/${i}${e.path}`, message: e.message });
      }
      return;
    }
    const event = result.value;
    if (event.tick < previousTick) {
      errors.push({ code: "TapeOutOfOrder", path: `/events/${i}/tick`, message: `tick ${event.tick} follows tick ${previousTick}; a committed event stream never goes backwards` });
    }
    if (event.sequence <= previousSequence) {
      errors.push({ code: "TapeOutOfOrder", path: `/events/${i}/sequence`, message: `sequence ${event.sequence} does not exceed ${previousSequence}; sequences are monotonic and never reused` });
    }
    if (event.tick > options.maxTicks) {
      errors.push({ code: "TapeBeyondHorizon", path: `/events/${i}/tick`, message: `tick ${event.tick} is beyond the fixture's maxTicks ${options.maxTicks}` });
    }
    previousTick = event.tick;
    previousSequence = event.sequence;
    events.push({
      type: event.type,
      tick: event.tick,
      ...(event.actorId === undefined ? {} : { actorId: event.actorId }),
      ...(event.targetActorId === undefined ? {} : { targetId: event.targetActorId }),
      // reasonId is deliberately absent: see REASON_NOT_REPRESENTABLE.
    });
  });

  if (errors.length > 0) return { ok: false, errors };

  const ticks = events.map((e) => e.tick);
  const tape: HostTapeInfo = {
    path,
    sha256: sha256(text),
    declaredSource: declaredSource as string,
    producedBy: producedBy as string,
    ...(typeof fixtureId === "string" ? { fixtureId } : {}),
    events: events.length,
    firstTick: ticks.length > 0 ? Math.min(...ticks) : null,
    lastTick: ticks.length > 0 ? Math.max(...ticks) : null,
  };
  return {
    ok: true,
    skipped,
    host: {
      kind: "tape",
      id: `tape:${tape.sha256.slice(7, 19)}`,
      watermark: "FakeSim",
      gateEligible: false,
      simulated: false,
      unsupportedSystems: NO_SIMULATION_SYSTEMS,
      unmatchableFields: [REASON_NOT_REPRESENTABLE],
      events,
      finalTick: tape.lastTick ?? 0,
      tape,
      note: `Events were read from a declared tape (${tape.producedBy}); nothing was simulated. A tape run proves the harness and the assertions, never the game — it can never be gate evidence.`,
    },
  };
}
