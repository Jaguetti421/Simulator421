import { describe, expect, it } from "vitest";
import { CommandAckShape, PlayerCommandShape } from "./commands.js";
import { CONTRACT_RECORDS } from "./index.js";
import { isReasonId, MANDATORY_V0_REASON_IDS, REASON_BY_CODE, REASONS } from "./reasons.js";
import type { ReasonId } from "./reasons.js";
import { encodeJson, validate } from "./schema.js";
import type { AnyShape, Infer } from "./schema.js";
import {
  ActionResultShape,
  ActorKnowledgeViewShape,
  CommittedEventShape,
  DamageProposalShape,
  DecisionTraceShape,
  EvidenceRecordShape,
  RouteResultShape,
} from "./simulation.js";
import { ContentProfileShape, FinalResultShape, RenderSnapshotShape } from "./views.js";
import registry from "../../../contracts/registry.json" with { type: "json" };

const accepts = (shape: AnyShape, value: unknown): boolean => validate(shape, value).ok;
const why = (shape: AnyShape, value: unknown): string => {
  const r = validate(shape, value);
  return r.ok ? "" : r.errors.map((e) => `${e.path} ${e.message}`).join("; ");
};

describe("acceptance 3 — the reason registry", () => {
  const MANDATORY_FROM_INTERFACES = [
    "WaitingForLaw",
    "RouteBlocked",
    "BudgetExhausted",
    "NoKnownRoute",
    "MissingProcedure",
    "ReservationLost",
    "InsufficientTime",
    "TargetUnobserved",
    "MembershipLocked",
    "StaleRules",
    "InsufficientInfluence",
    "NoticeTooShort",
    "ProfileUnsupported",
  ] as const;

  it("contains every mandatory v0 ID from INTERFACES.md", () => {
    for (const id of MANDATORY_FROM_INTERFACES) {
      expect(isReasonId(id), id).toBe(true);
    }
    expect(MANDATORY_V0_REASON_IDS).toEqual(MANDATORY_FROM_INTERFACES);
  });

  it("gives every reason player text and at least one required debug field", () => {
    for (const [id, def] of Object.entries(REASONS)) {
      expect(def.playerTextKey, id).toMatch(/^reason\.[a-z_]+$/);
      expect(def.playerTextEn.length, id).toBeGreaterThan(8);
      expect(def.requiredDebugFields.length, id).toBeGreaterThan(0);
      expect(new Set(def.requiredDebugFields).size, id).toBe(def.requiredDebugFields.length);
    }
  });

  it("uses unique, stable numeric codes", () => {
    const codes = Object.values(REASONS).map((d) => d.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(REASON_BY_CODE.size).toBe(codes.length);
    for (const [id, def] of Object.entries(REASONS)) expect(REASON_BY_CODE.get(def.code)).toBe(id);
  });

  it("rejects anything that is not a registered reason — no stub reasons", () => {
    for (const notAReason of ["", "Unknown", "TODO", "Stub", "waitingforlaw", "toString", "constructor"]) {
      expect(isReasonId(notAReason), notAReason).toBe(false);
    }
  });

  it("the checked-in contracts/registry.json matches the implemented definitions", () => {
    expect(registry.contractVersion).toBe(0);
    expect(registry.changeProcedure.length).toBeGreaterThan(2);
    expect(registry.mandatoryV0ReasonIds).toEqual([...MANDATORY_V0_REASON_IDS]);
    expect(registry.reasons.map((r) => r.id)).toEqual(Object.keys(REASONS));
    for (const entry of registry.reasons) {
      const def = REASONS[entry.id as ReasonId];
      expect(entry.code, entry.id).toBe(def.code);
      expect(entry.playerTextEn, entry.id).toBe(def.playerTextEn);
      expect(entry.requiredDebugFields, entry.id).toEqual([...def.requiredDebugFields]);
    }
    expect(registry.records.map((r) => r.name)).toEqual(Object.keys(CONTRACT_RECORDS));
  });
});

describe("PlayerCommand and CommandAck: no false successful UI state", () => {
  const command = {
    schemaVersion: 0,
    runId: "run-a",
    clientSequence: 1,
    issuedAtTick: 100,
    expectedRulesVersion: 2,
    operation: "law.propose",
    payload: { kind: "law.propose.v0", version: 0, fields: {} },
  };

  it("accepts a minimal command and rejects an unimplemented schema version", () => {
    expect(accepts(PlayerCommandShape, command), why(PlayerCommandShape, command)).toBe(true);
    expect(accepts(PlayerCommandShape, { ...command, schemaVersion: 1 })).toBe(false);
  });

  it("rejects an effective tick before the command was issued", () => {
    expect(accepts(PlayerCommandShape, { ...command, requestedEffectiveTick: 100 })).toBe(true);
    expect(accepts(PlayerCommandShape, { ...command, requestedEffectiveTick: 99 })).toBe(false);
  });

  it("rejects a client-assigned execution tick (the journal assigns it)", () => {
    expect(accepts(PlayerCommandShape, { ...command, assignedTick: 101 })).toBe(false);
  });

  const ack = { schemaVersion: 0, runId: "run-a", clientSequence: 1, resultingRulesVersion: 3 };

  it("an accepted ack carries the assigned tick and no reason", () => {
    expect(accepts(CommandAckShape, { ...ack, status: "Accepted", assignedTick: 101 })).toBe(true);
    expect(accepts(CommandAckShape, { ...ack, status: "Accepted" })).toBe(false);
    expect(accepts(CommandAckShape, { ...ack, status: "Accepted", assignedTick: 101, reasonId: "StaleRules" })).toBe(false);
  });

  it("a rejected ack carries a registered reason and no assigned tick", () => {
    expect(accepts(CommandAckShape, { ...ack, status: "Rejected", reasonId: "StaleRules" })).toBe(true);
    expect(accepts(CommandAckShape, { ...ack, status: "Rejected" })).toBe(false);
    expect(accepts(CommandAckShape, { ...ack, status: "Rejected", reasonId: "SomethingWentWrong" })).toBe(false);
    expect(accepts(CommandAckShape, { ...ack, status: "Rejected", reasonId: "StaleRules", assignedTick: 101 })).toBe(false);
  });
});

describe("RouteResult: budget exhaustion cannot masquerade as a path", () => {
  const base = { schemaVersion: 0, actorId: "C042", requestTick: 10, pathVersion: 1, unitsSpent: 5 };
  const waypoint = { xMm: 1000, yMm: 2000, zMm: 30 };

  it("Complete needs waypoints and carries no reason", () => {
    expect(accepts(RouteResultShape, { ...base, status: "Complete", waypointsMm: [waypoint] })).toBe(true);
    expect(accepts(RouteResultShape, { ...base, status: "Complete", waypointsMm: [] })).toBe(false);
    expect(accepts(RouteResultShape, { ...base, status: "Complete", waypointsMm: [waypoint], reasonId: "RouteBlocked" })).toBe(false);
  });

  it("Partial needs a certified portal and a progress measure", () => {
    expect(accepts(RouteResultShape, { ...base, status: "Partial", waypointsMm: [waypoint], certifiedPortalId: "portal.a", progressMeasureMm: 500 })).toBe(true);
    expect(accepts(RouteResultShape, { ...base, status: "Partial", waypointsMm: [waypoint], certifiedPortalId: "portal.a" })).toBe(false);
    expect(accepts(RouteResultShape, { ...base, status: "Partial", waypointsMm: [waypoint], progressMeasureMm: 500 })).toBe(false);
  });

  it("BudgetExhausted and NoKnownRoute carry a reason and no waypoints", () => {
    expect(accepts(RouteResultShape, { ...base, status: "BudgetExhausted", waypointsMm: [], reasonId: "BudgetExhausted" })).toBe(true);
    expect(accepts(RouteResultShape, { ...base, status: "BudgetExhausted", waypointsMm: [waypoint], reasonId: "BudgetExhausted" })).toBe(false);
    expect(accepts(RouteResultShape, { ...base, status: "NoKnownRoute", waypointsMm: [] })).toBe(false);
    expect(accepts(RouteResultShape, { ...base, status: "NoKnownRoute", waypointsMm: [], reasonId: "NoKnownRoute" })).toBe(true);
  });
});

describe("DamageProposal, ActionResult and DecisionTrace stay explainable", () => {
  const damage = {
    schemaVersion: 0,
    episodeId: 1,
    victimActorId: "C017",
    amountMilli: 1000,
    damageClass: "Hazard",
    contactTick: 50,
    permission: { allowed: true, ruleId: "rule.a", ruleVersion: 1 },
  };

  it("damage has exactly one source and a positive amount", () => {
    expect(accepts(DamageProposalShape, { ...damage, sourceHazardId: "hazard.exposure" })).toBe(true);
    expect(accepts(DamageProposalShape, { ...damage, sourceActorId: "C001" })).toBe(true);
    expect(accepts(DamageProposalShape, damage)).toBe(false);
    expect(accepts(DamageProposalShape, { ...damage, sourceActorId: "C001", sourceHazardId: "hazard.exposure" })).toBe(false);
    expect(accepts(DamageProposalShape, { ...damage, sourceHazardId: "hazard.exposure", amountMilli: 0 })).toBe(false);
  });

  it("a refused permission names its reason", () => {
    expect(accepts(DamageProposalShape, { ...damage, sourceHazardId: "h", permission: { allowed: false, ruleId: "r", ruleVersion: 1 } })).toBe(false);
    expect(accepts(DamageProposalShape, { ...damage, sourceHazardId: "h", permission: { allowed: false, ruleId: "r", ruleVersion: 1, reasonId: "WaitingForLaw" } })).toBe(true);
  });

  it("failed and interrupted actions name a reason; completed ones do not", () => {
    const base = { schemaVersion: 0, actorId: "C001", planId: 1, actionDefId: "action.gather", tick: 10 };
    expect(accepts(ActionResultShape, { ...base, outcome: "Failed" })).toBe(false);
    expect(accepts(ActionResultShape, { ...base, outcome: "Failed", reasonId: "ReservationLost" })).toBe(true);
    expect(accepts(ActionResultShape, { ...base, outcome: "Interrupted", reasonId: "TargetUnobserved", remainingTicks: 4 })).toBe(true);
    expect(accepts(ActionResultShape, { ...base, outcome: "Completed" })).toBe(true);
    expect(accepts(ActionResultShape, { ...base, outcome: "Completed", reasonId: "InsufficientTime" })).toBe(false);
    expect(accepts(ActionResultShape, { ...base, outcome: "Started", durationTicks: 0 })).toBe(false);
  });

  it("a decision either chooses an evaluated candidate or explains the absence", () => {
    const candidate = { candidateId: "goal.a", scoreMilli: 100, considerations: [] };
    const base = { schemaVersion: 0, actorId: "C001", tick: 10, candidates: [candidate], evidenceRefs: [] };
    expect(accepts(DecisionTraceShape, { ...base, chosenCandidateId: "goal.a" })).toBe(true);
    expect(accepts(DecisionTraceShape, { ...base, chosenCandidateId: "goal.b" })).toBe(false);
    expect(accepts(DecisionTraceShape, { ...base, noChoiceReasonId: "MissingProcedure" })).toBe(true);
    expect(accepts(DecisionTraceShape, base)).toBe(false);
    expect(accepts(DecisionTraceShape, { ...base, chosenCandidateId: "goal.a", noChoiceReasonId: "MissingProcedure" })).toBe(false);
  });
});

describe("evidence, events, snapshots, profiles and results", () => {
  it("a reported fact names the reporter; an observed one need not", () => {
    const base = { factId: 1, kind: "actor.position", observedTick: 10, uncertaintyMilli: 0 };
    expect(accepts(EvidenceRecordShape, { ...base, source: "Observed" })).toBe(true);
    expect(accepts(EvidenceRecordShape, { ...base, source: "Reported" })).toBe(false);
    expect(accepts(EvidenceRecordShape, { ...base, source: "Reported", reportedByActorId: "C002" })).toBe(true);
  });

  it("an actor knowledge view is closed: no route in for raw world state", () => {
    const view = {
      schemaVersion: 0,
      actorId: "C001",
      tick: 10,
      self: { healthMilli: 100000, staminaMilli: 100000, fullnessMilli: 85000, fatigueMilli: 10000, exposureMilli: 0, moraleMilli: 65000, carriedUnits: 2, positionMm: { xMm: 0, yMm: 0, zMm: 0 } },
      publicNotices: [],
      facts: [],
    };
    expect(accepts(ActorKnowledgeViewShape, view), why(ActorKnowledgeViewShape, view)).toBe(true);
    expect(accepts(ActorKnowledgeViewShape, { ...view, world: { entities: [] } })).toBe(false);
  });

  it("events use the ten tick stages and reported events name an actor", () => {
    const event = {
      schemaVersion: 0,
      runId: "run-a",
      branchId: "b",
      sequence: 1,
      tick: 10,
      stage: 10,
      type: "actor.eliminated",
      causalParents: [],
      status: "Factual",
      payload: { kind: "actor.eliminated.v0", version: 0, fields: {} },
    };
    expect(accepts(CommittedEventShape, event)).toBe(true);
    expect(accepts(CommittedEventShape, { ...event, stage: 0 })).toBe(false);
    expect(accepts(CommittedEventShape, { ...event, stage: 11 })).toBe(false);
    expect(accepts(CommittedEventShape, { ...event, status: "Reported" })).toBe(false);
    expect(accepts(CommittedEventShape, { ...event, status: "Reported", actorId: "C003" })).toBe(true);
  });

  it("a render snapshot's buffer description must be internally consistent", () => {
    const snapshot = {
      schemaVersion: 0,
      runId: "run-a",
      confirmedTick: 10,
      bufferOwner: "Main",
      transformLayout: { actorCount: 2, strideBytes: 8, byteLength: 16, fields: [{ name: "entityId", offsetBytes: 0, type: "uint32" }] },
      identityViews: [],
      actionViews: [],
      lawViews: [],
      observerHash: "0000abcd",
    };
    expect(accepts(RenderSnapshotShape, snapshot), why(RenderSnapshotShape, snapshot)).toBe(true);
    expect(accepts(RenderSnapshotShape, { ...snapshot, transformLayout: { ...snapshot.transformLayout, byteLength: 15 } })).toBe(false);
    expect(
      accepts(RenderSnapshotShape, {
        ...snapshot,
        transformLayout: { ...snapshot.transformLayout, fields: [{ name: "positionXMm", offsetBytes: 6, type: "int32" }] },
      }),
    ).toBe(false);
    expect(accepts(RenderSnapshotShape, { ...snapshot, observerHash: "0000ABCD" })).toBe(false);
  });

  it("content profiles declare exactly the roster their name promises", () => {
    const actors = (n: number): string[] => Array.from({ length: n }, (_, i) => `C${String(i + 1).padStart(3, "0")}`);
    const base = {
      schemaVersion: 0,
      declaredRecipeIds: [],
      capabilities: [],
      provenance: { sourceManifestHash: "00000001", catalogHash: "00000002", compilerVersion: "v0" },
    };
    expect(accepts(ContentProfileShape, { ...base, profileId: "Prototype8", declaredActorIds: actors(8) })).toBe(true);
    expect(accepts(ContentProfileShape, { ...base, profileId: "Prototype8", declaredActorIds: actors(7) })).toBe(false);
    expect(accepts(ContentProfileShape, { ...base, profileId: "Trial24", declaredActorIds: actors(24) })).toBe(true);
    expect(accepts(ContentProfileShape, { ...base, profileId: "Standard100", declaredActorIds: actors(100) })).toBe(false); // needs 28 recipes
    expect(
      accepts(ContentProfileShape, {
        ...base,
        profileId: "Standard100",
        declaredActorIds: actors(100),
        declaredRecipeIds: Array.from({ length: 28 }, (_, i) => `recipe.r${i}`),
      }),
    ).toBe(true);
    expect(accepts(ContentProfileShape, { ...base, profileId: "Fixture", declaredActorIds: ["C001", "C001"] })).toBe(false);
  });

  it("a final result has at most one winner and a fixture run can never be Standard", () => {
    const base = {
      schemaVersion: 0,
      runId: "run-a",
      branchId: "b",
      resultKey: "run-a.b.36000",
      payloadHash: "0000beef",
      finalizedTick: 36000,
      eventRange: { firstSequence: 1, lastSequence: 2, rangeHash: "0000cafe" },
      contributorFacts: [],
    };
    const roster = [{ actorId: "C001", outcome: "Winner" }, { actorId: "C002", outcome: "Eliminated", eliminatedTick: 100 }];
    expect(accepts(FinalResultShape, { ...base, mode: "Standard", profileId: "Prototype8", roster })).toBe(true);
    expect(accepts(FinalResultShape, { ...base, mode: "Standard", profileId: "Prototype8", roster: [{ actorId: "C001", outcome: "Winner" }, { actorId: "C002", outcome: "Winner" }] })).toBe(false);
    expect(accepts(FinalResultShape, { ...base, mode: "Standard", profileId: "Prototype8", roster: [{ actorId: "C001", outcome: "Eliminated" }] })).toBe(false);
    expect(accepts(FinalResultShape, { ...base, mode: "Standard", profileId: "Fixture", roster })).toBe(false);
    expect(accepts(FinalResultShape, { ...base, mode: "CustomPractice", profileId: "Fixture", roster })).toBe(true);
    expect(accepts(FinalResultShape, { ...base, mode: "Standard", profileId: "Prototype8", roster: [{ actorId: "C001", outcome: "Winner" }, { actorId: "C001", outcome: "Eliminated", eliminatedTick: 5 }] })).toBe(false);
  });
});

describe("every declared record is complete enough to encode", () => {
  it("all twenty-four records are named, closed objects", () => {
    expect(Object.keys(CONTRACT_RECORDS)).toHaveLength(24);
    for (const [name, shape] of Object.entries(CONTRACT_RECORDS)) {
      expect(shape.node.kind, name).toBe("object");
      expect(validate(shape, {}).ok, name).toBe(false); // nothing is valid by default
    }
  });

  it("encoding is stable: the same record encodes identically twice", () => {
    const ack = { schemaVersion: 0, runId: "run-a", clientSequence: 1, status: "Accepted", assignedTick: 2, resultingRulesVersion: 3 } as unknown as Infer<typeof CommandAckShape>;
    expect(encodeJson(CommandAckShape, ack)).toBe(encodeJson(CommandAckShape, { ...ack }));
  });
});
