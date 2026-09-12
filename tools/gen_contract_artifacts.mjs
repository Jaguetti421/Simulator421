// Emits the contract artifacts from the single schema declarations (W0-04):
//   packages/sim/contracts/schemas/<Record>.schema.json   JSON Schema (draft 2020-12)
//   contracts/registry.json                               reason registry + contract version + change procedure
//   contracts/samples/*.valid.json                        canonical golden samples
// Invalid and unknown-version samples are hand-written and are NOT generated here.
// Run: node tools/gen_contract_artifacts.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { CONTRACT_RECORDS, encodeJsonPretty, MANDATORY_V0_REASON_IDS, REASONS, toJsonSchema } from "../packages/sim/dist/contracts/index.js";
import { fnv1a32, formatDigest } from "../packages/sim/dist/primitives/hash.js";

const root = new URL("../", import.meta.url);
const schemaDir = new URL("packages/sim/contracts/schemas/", root);
const sampleDir = new URL("contracts/samples/", root);
mkdirSync(schemaDir, { recursive: true });
mkdirSync(sampleDir, { recursive: true });

const hashOf = (text) => formatDigest(fnv1a32(Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff)));

// ---------------------------------------------------------------- schemas
const records = [];
for (const [name, shape] of Object.entries(CONTRACT_RECORDS)) {
  const schema = toJsonSchema(shape, name);
  const text = `${JSON.stringify(schema, null, 1)}\n`;
  writeFileSync(new URL(`${name}.schema.json`, schemaDir), text);
  records.push({ name, schemaFile: `packages/sim/contracts/schemas/${name}.schema.json`, schemaHash: hashOf(text) });
}

// ---------------------------------------------------------------- registry
const registry = {
  $comment:
    "Compiled from the implemented definitions in packages/sim/contracts. Do not edit by hand; run node tools/gen_contract_artifacts.mjs. Schema hashes are FNV-1a/32 of the emitted schema text and are reviewed deliberately: a changed hash means a changed contract.",
  contractVersion: 0,
  contractVersionName: "design version 0",
  frozenAt: "W0-04",
  changeProcedure: [
    "An incompatible change needs a reviewed contract-change record naming the records affected, the consumers affected and the migration.",
    "Bump the record's schemaVersion range; decoders reject versions they do not implement rather than guessing.",
    "Add or update the golden samples in contracts/samples and regenerate this file; a changed schema hash must be explained in the packet handoff.",
    "Adding a reason is an ordinary additive change: a new ID with player text and required debug fields, never a renumbered code.",
    "A stub reason never stands in for an unimplemented action.",
  ],
  records,
  mandatoryV0ReasonIds: [...MANDATORY_V0_REASON_IDS],
  reasons: Object.entries(REASONS).map(([id, def]) => ({
    id,
    code: def.code,
    playerTextKey: def.playerTextKey,
    playerTextEn: def.playerTextEn,
    requiredDebugFields: [...def.requiredDebugFields],
  })),
};
writeFileSync(new URL("contracts/registry.json", root), `${JSON.stringify(registry, null, 1)}\n`);

// ---------------------------------------------------------------- samples
const payload = (kind) => ({ kind, version: 0, fields: {} });

const samples = [
  [
    "player-command.valid.json",
    "PlayerCommand",
    {
      schemaVersion: 0,
      runId: "run-2026-09-12-a",
      clientSequence: 41,
      issuedAtTick: 12000,
      expectedRulesVersion: 7,
      operation: "law.propose",
      payload: payload("law.propose.v0"),
      requestedEffectiveTick: 12600,
      influenceCostMilli: 4500,
    },
  ],
  [
    "command-ack.accepted.valid.json",
    "CommandAck",
    { schemaVersion: 0, runId: "run-2026-09-12-a", clientSequence: 41, status: "Accepted", assignedTick: 12001, resultingRulesVersion: 8 },
  ],
  [
    "command-ack.rejected.valid.json",
    "CommandAck",
    {
      schemaVersion: 0,
      runId: "run-2026-09-12-a",
      clientSequence: 42,
      status: "Rejected",
      reasonId: "NoticeTooShort",
      reasonDetail: {
        fields: [
          { name: "requestedEffectiveTick", value: "12010" },
          { name: "earliestAllowedTick", value: "12600" },
          { name: "minimumNoticeTicks", value: "600" },
        ],
      },
      resultingRulesVersion: 8,
    },
  ],
  [
    "committed-event.valid.json",
    "CommittedEvent",
    {
      schemaVersion: 0,
      runId: "run-2026-09-12-a",
      branchId: "branch-main",
      sequence: 90312,
      tick: 12001,
      stage: 10,
      type: "law.installed",
      actorId: "C017",
      causalParents: [90298],
      status: "Factual",
      payload: payload("law.installed.v0"),
    },
  ],
  [
    "decision-trace.valid.json",
    "DecisionTrace",
    {
      schemaVersion: 0,
      actorId: "C042",
      tick: 12003,
      candidates: [
        {
          candidateId: "goal.gather.firewood",
          scoreMilli: 620,
          considerations: [
            { id: "need.exposure", valueMilli: 480, weightMilli: 800 },
            { id: "distance.to.resource", valueMilli: 310, weightMilli: 500 },
          ],
        },
        {
          candidateId: "goal.hunt.deer",
          scoreMilli: 410,
          considerations: [{ id: "need.food", valueMilli: 350, weightMilli: 900 }],
          rejectedReasonId: "TargetUnobserved",
        },
      ],
      chosenCandidateId: "goal.gather.firewood",
      evidenceRefs: [
        { factId: 5511, ageTicks: 14 },
        { factId: 5498, ageTicks: 122 },
      ],
    },
  ],
  [
    "render-snapshot.valid.json",
    "RenderSnapshot",
    {
      schemaVersion: 0,
      runId: "run-2026-09-12-a",
      confirmedTick: 12001,
      bufferOwner: "Main",
      transformLayout: {
        actorCount: 3,
        strideBytes: 16,
        byteLength: 48,
        fields: [
          { name: "entityId", offsetBytes: 0, type: "uint32" },
          { name: "positionXMm", offsetBytes: 4, type: "int32" },
          { name: "positionYMm", offsetBytes: 8, type: "int32" },
          { name: "headingMilliturns", offsetBytes: 12, type: "uint16" },
          { name: "actionProgressMilli", offsetBytes: 14, type: "uint16" },
        ],
      },
      identityViews: [
        { actorId: "C001", entityId: 0, displayNameKey: "contestant.C001", clanId: "clan.north", alive: true },
        { actorId: "C042", entityId: 1, displayNameKey: "contestant.C042", alive: true },
        { actorId: "C017", entityId: 2, displayNameKey: "contestant.C017", clanId: "clan.north", alive: false },
      ],
      actionViews: [
        { entityId: 0, actionDefId: "action.gather", remainingTicks: 11 },
        { entityId: 1 },
      ],
      lawViews: [{ lawId: "law.truce", lawVersion: 2, announcedTick: 10800, effectiveTick: 12600, active: false }],
      observerHash: "1a47e90b",
    },
  ],
  [
    "final-result.valid.json",
    "FinalResult",
    {
      schemaVersion: 0,
      runId: "run-2026-09-12-a",
      branchId: "branch-main",
      resultKey: "run-2026-09-12-a.branch-main.36000",
      payloadHash: "bf9cf968",
      mode: "Standard",
      finalizedTick: 36000,
      profileId: "Prototype8",
      roster: [
        { actorId: "C001", outcome: "Winner" },
        { actorId: "C017", outcome: "Eliminated", eliminatedTick: 21440, eliminatedByActorId: "C001" },
        { actorId: "C042", outcome: "Withdrawn", eliminatedTick: 30000 },
      ],
      eventRange: { firstSequence: 1, lastSequence: 90312, rangeHash: "56c4abe8" },
      contributorFacts: [
        { actorId: "C001", kind: "Kill", episodeId: 88, tick: 21440, subjectActorId: "C017" },
        { actorId: "C042", kind: "Withdrawal", episodeId: 91, tick: 30000 },
      ],
    },
  ],
  [
    "route-result.partial.valid.json",
    "RouteResult",
    {
      schemaVersion: 0,
      actorId: "C042",
      requestTick: 12003,
      status: "Partial",
      pathVersion: 4,
      waypointsMm: [
        { xMm: 120000, yMm: 340000, zMm: 1200 },
        { xMm: 128000, yMm: 352000, zMm: 1180 },
      ],
      certifiedPortalId: "portal.ridge.east",
      progressMeasureMm: 14200,
      unitsSpent: 780,
    },
  ],
  [
    "route-result.budget-exhausted.valid.json",
    "RouteResult",
    { schemaVersion: 0, actorId: "C042", requestTick: 12004, status: "BudgetExhausted", pathVersion: 4, waypointsMm: [], reasonId: "BudgetExhausted", unitsSpent: 1000 },
  ],
  [
    "damage-proposal.valid.json",
    "DamageProposal",
    {
      schemaVersion: 0,
      episodeId: 88,
      victimActorId: "C017",
      sourceActorId: "C001",
      amountMilli: 12500,
      damageClass: "Melee",
      contactTick: 21440,
      permission: { allowed: true, ruleId: "law.truce", ruleVersion: 2 },
    },
  ],
  [
    "action-result.failed.valid.json",
    "ActionResult",
    { schemaVersion: 0, actorId: "C042", planId: 316, actionDefId: "action.gather", tick: 12010, outcome: "Failed", reasonId: "ReservationLost" },
  ],
  [
    "content-profile.valid.json",
    "ContentProfile",
    {
      schemaVersion: 0,
      profileId: "Prototype8",
      declaredActorIds: ["C001", "C002", "C003", "C004", "C005", "C006", "C007", "C008"],
      declaredRecipeIds: ["recipe.firewood", "recipe.shelter", "recipe.bandage"],
      capabilities: ["core.survival", "core.combat"],
      provenance: { sourceManifestHash: "811c9dc5", catalogHash: "e40c292c", compilerVersion: "content-compiler.v0" },
    },
  ],
];

for (const [file, record, value] of samples) {
  const shape = CONTRACT_RECORDS[record];
  if (shape === undefined) throw new Error(`unknown record ${record}`);
  writeFileSync(new URL(file, sampleDir), encodeJsonPretty(shape, value, `${record} sample ${file}`));
}

console.log(`schemas: ${records.length}, reasons: ${registry.reasons.length}, generated samples: ${samples.length}`);
