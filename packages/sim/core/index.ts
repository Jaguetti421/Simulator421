/**
 * @lastclan/sim core — the minimal deterministic tick kernel (W0-07).
 *
 * The tick transaction, the pause barrier and a synthetic 136/137-actor
 * workload. No AI, combat, economy or spatial claims: see `WORKLOAD_OMISSIONS`.
 */
export {
  authoritativeHash,
  clampToEnvelope,
  CORE_ACTOR_COUNT,
  createWorld,
  distanceSquaredMm,
  ENVELOPE_MM,
  envelopeFractionMilli,
  GUEST_ACTOR_COUNT,
  SYNTHETIC_ROSTER,
  WORKLOAD_OMISSIONS,
  zeroCounters,
} from "./world.js";
export type { Actor, ActorKind, CommandOutcome, Counters, KernelEvent, KernelLaw, QueuedCommand, World, WorldConfig } from "./world.js";
export { MINIMUM_LAW_NOTICE_TICKS, MOTION_JITTER_INTERVAL, PERCEPTION_SAMPLE, runTick, STAGE_ORDER, STAGES } from "./tick.js";
export type { Stage } from "./tick.js";
export {
  captureInventories,
  countOf,
  emptyInventory,
  INVENTORY_SECTION_ID,
  INVENTORY_SECTION_VERSION,
  restoreInventories,
  totalItems,
  transfer,
  weightGrams,
} from "./inventory.js";
export type { Inventory, InventorySectionRecord, ItemDef, ItemDefId, TransferFailure, TransferResult } from "./inventory.js";
export { isActiveAt, PermissionService, resolveEffect, ticksForSeconds } from "./permission.js";
export type { AttemptedEffect, EffectOutcome, HardPermission, Law, LawScope, PermissionRequest, PermissionResult, PermissionVerdict } from "./permission.js";
export { BeliefStore, COARSE_THRESHOLD_MM, DEFAULT_MEMORY_LIMIT, estimatePosition, POSITION_DRIFT_MM_PER_TICK, retell, uncertaintyAt } from "./belief.js";
export type { Belief, BeliefKind, EvictionResult, PositionEstimate, Provenance } from "./belief.js";
export { LEASE_TICKS, ReservationBook } from "./reservation.js";
export type { DenialReason, GrantResult, Lease, Release, ReleaseCause, RenewResult, ReservationKind } from "./reservation.js";
export { beginEating, continueEating, FOOD, fullnessPoints, PROTOTYPE8_FOOD, startingNeeds, TICKS_PER_MINUTE, tickNeeds } from "./needs.js";
export type { DamageEvent, DamageSource, EatFailure, EatOutcome, EatProgress, ItemNutrition, NeedsState, TickOutcome } from "./needs.js";
export { applyDamage, bleedRemaining, healTo, isCovered, newBleed, resolveHarm, tickBleed } from "./sanctuary.js";
export type { BleedState, BleedTickOutcome, HarmAttempt, HarmOutcome } from "./sanctuary.js";
export { AWARENESS_RADIUS_MM, beliefFrom, BASE_SIGHT_RANGE_MM, distanceBetween, FORWARD_HALF_ANGLE_DEGREES, HEARING_RADIUS_MM, perceive, scaleMilli, sightRangeMm, SLEEP_RANGE_MILLI, THREAT_INTERRUPT_TICKS, ThreatQueue } from "./sensory.js";
export type { Channel, Evidence, Observer, QueuedThreat, SensedActor, SensoryInputs, SoundEvent } from "./sensory.js";
export { ARROW_MM_PER_SECOND, flyUntilContact, perTickMm, sweepProjectile, TARGET_RADIUS_MM, velocityToward } from "./projectile.js";
export type { Contact, ContactKind, ProjectileState, SweepResult, TargetCandidate } from "./projectile.js";
export { ACTIONS_SECTION_ID, ACTIONS_SECTION_VERSION, activeActionFields, cancelAction, captureActions, DEFAULT_REVALIDATE_TICKS, restoreActions, startAction, stepAction } from "./action.js";
export type { ActionDefinition, ActionFailureRecord, ActionMilestone, ActionState, ActionsSectionRecord, CommittedEventRecord, CompletionRecord, FailureReason, RunningAction, StepOutcome, WorldView } from "./action.js";
export { considerationsThatDiffer, decide, scoreCandidate, SWITCH_DELAY_TICKS, TRAIT_WEIGHTS } from "./decision.js";
export type { Candidate, Consideration, ConsiderationId, Decision, DecisionInput, DecisionTraceRecord, EvidenceRef, NoChoiceReason, ScoredCandidate, ScoredConsideration, TraitId } from "./decision.js";
export { canSprint, canWalk, EXERTION, fatiguePoints, staminaPoints, startingExertion, tickExertion, tickRest } from "./exertion.js";
export type { Exertion, ExertionState, ExertionTickOutcome, RestIntent, RestOutcome } from "./exertion.js";
export { ARRIVAL_MM, candidatesFor, HUNGRY_BELOW, newAgent, PLAN_TICK_BUDGET, planFor, stepAgent, straightLineMover } from "./tasks.js";
export type { ActorKnowledge, Agent, AgentOutcome, AgentStatus, GoalId, KnownFood, KnownRestSocket, Plan, PlanFailureReason, PlanStep, StepKind, TaskServices } from "./tasks.js";
