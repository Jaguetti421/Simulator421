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
