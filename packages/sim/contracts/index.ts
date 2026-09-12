/**
 * @lastclan/sim contracts — design version 0 (W0-04).
 *
 * Every record is declared once with the schema DSL, which yields the
 * TypeScript type, the runtime validator, the JSON Schema and the canonical
 * codec from that one declaration. Records are immutable and closed; ports
 * expose queries, never mutable world access.
 */
export {
  arr,
  bool,
  ContractError,
  decodeJson,
  encodeJson,
  encodeJsonPretty,
  enumOf,
  int,
  mapOf,
  obj,
  opt,
  parse,
  refine,
  str,
  toJsonSchema,
  union,
  validate,
} from "./schema.js";
export type { AnyShape, Infer, JsonSchema, SchemaNode, Shape, ValidationError, ValidationResult } from "./schema.js";

export { ACTOR_ID_PATTERN, actorId, DURABLE_ID_PATTERN, durableId, entityId, HEX32_PATTERN, hash32, milli, mm, sequence, tick, TICK_STAGES, tickStage, version } from "./ids.js";
export type { ActorId, DurableId } from "./ids.js";

export { isReasonId, MANDATORY_V0_REASON_IDS, REASON_BY_CODE, reasonDefinition, reasonId, REASONS } from "./reasons.js";
export type { ReasonDefinition, ReasonId } from "./reasons.js";

export { CommandAckShape, CONTRACT_SCHEMA_VERSION, JournaledCommandShape, OperationPayloadShape, PlayerCommandShape } from "./commands.js";
export type { CommandAck, JournaledCommand, OperationPayload, PlayerCommand } from "./commands.js";

export {
  ActionRequestShape,
  ActionResultShape,
  ActorKnowledgeViewShape,
  CandidateTraceShape,
  CommittedEventShape,
  ConsiderationShape,
  DamageProposalShape,
  DecisionTraceShape,
  DependencyRefShape,
  EventRangeShape,
  EvidenceRecordShape,
  PermissionEvidenceShape,
  PositionMmShape,
  PublicNoticeShape,
  RouteRequestShape,
  RouteResultShape,
  SelfStateShape,
} from "./simulation.js";
export type {
  ActionRequest,
  ActionResult,
  ActorKnowledgeView,
  CandidateTrace,
  CommittedEvent,
  Consideration,
  DamageProposal,
  DecisionTrace,
  DependencyRef,
  EventRange,
  EvidenceRecord,
  PermissionEvidence,
  PositionMm,
  PublicNotice,
  RouteRequest,
  RouteResult,
  SelfState,
} from "./simulation.js";

export {
  ActionViewShape,
  CONTENT_PROFILE_IDS,
  ContentProfileShape,
  FinalResultShape,
  IdentityViewShape,
  LawViewShape,
  RenderSnapshotShape,
  RosterEntryShape,
  StateSectionDescriptorShape,
  TransformLayoutShape,
} from "./views.js";
export type {
  ActionView,
  ContentProfile,
  FinalResult,
  IdentityView,
  LawView,
  RenderSnapshot,
  RosterEntry,
  StateSectionDescriptor,
  TransformLayout,
} from "./views.js";

export type { IPerceptionQuery, IRouteQuery, IStateSectionCodec, PerceptionQuery } from "./ports.js";

import { CommandAckShape, JournaledCommandShape, PlayerCommandShape } from "./commands.js";
import {
  ActionRequestShape,
  ActionResultShape,
  ActorKnowledgeViewShape,
  CommittedEventShape,
  DamageProposalShape,
  DecisionTraceShape,
  EventRangeShape,
  RouteRequestShape,
  RouteResultShape,
} from "./simulation.js";
import type { AnyShape } from "./schema.js";
import { ContentProfileShape, FinalResultShape, RenderSnapshotShape, StateSectionDescriptorShape } from "./views.js";

/**
 * Every top-level contract record by name. The schema emitter, the sample
 * manifest and the round-trip tests all walk this map, so a new record cannot
 * be added without gaining a schema and a sample.
 */
export const CONTRACT_RECORDS: Readonly<Record<string, AnyShape>> = {
  PlayerCommand: PlayerCommandShape,
  CommandAck: CommandAckShape,
  JournaledCommand: JournaledCommandShape,
  ActionRequest: ActionRequestShape,
  ActionResult: ActionResultShape,
  ActorKnowledgeView: ActorKnowledgeViewShape,
  RouteRequest: RouteRequestShape,
  RouteResult: RouteResultShape,
  DamageProposal: DamageProposalShape,
  DecisionTrace: DecisionTraceShape,
  CommittedEvent: CommittedEventShape,
  EventRange: EventRangeShape,
  RenderSnapshot: RenderSnapshotShape,
  StateSectionDescriptor: StateSectionDescriptorShape,
  ContentProfile: ContentProfileShape,
  FinalResult: FinalResultShape,
};
