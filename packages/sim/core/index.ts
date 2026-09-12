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
