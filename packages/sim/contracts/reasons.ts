/**
 * Reason registry, design version 0 (contracts/INTERFACES.md).
 *
 * Every rejection, failure and refusal in the simulation names a reason from
 * this registry. A reason has player-facing text and the debug fields its
 * emitter must supply; a reason with missing debug fields is a defect, not a
 * cosmetic issue, because it is what makes a refusal explainable.
 *
 * The thirteen IDs below are the mandatory v0 minimum from INTERFACES.md.
 * Adding one is an ordinary contract change (see `contracts/registry.json`);
 * a stub reason never silently stands in for an unimplemented action.
 */
import { enumOf } from "./schema.js";
import type { Shape } from "./schema.js";

export interface ReasonDefinition {
  /** Stable numeric code for hot state and byte encodings; never renumbered. */
  readonly code: number;
  /** Localizable player-facing text key plus the English v0 text. */
  readonly playerTextKey: string;
  readonly playerTextEn: string;
  /** Fields the emitter must attach for the refusal to be explainable. */
  readonly requiredDebugFields: readonly string[];
}

export const REASONS = {
  WaitingForLaw: {
    code: 1,
    playerTextKey: "reason.waiting_for_law",
    playerTextEn: "Waiting for the announced law to take effect.",
    requiredDebugFields: ["lawId", "lawVersion", "effectiveTick"],
  },
  RouteBlocked: {
    code: 2,
    playerTextKey: "reason.route_blocked",
    playerTextEn: "The way is blocked.",
    requiredDebugFields: ["actorId", "fromMm", "toMm", "blockingEdgeId", "pathVersion"],
  },
  BudgetExhausted: {
    code: 3,
    playerTextKey: "reason.budget_exhausted",
    playerTextEn: "Could not finish looking for a way in time.",
    requiredDebugFields: ["actorId", "budgetUnits", "unitsSpent", "requestTick"],
  },
  NoKnownRoute: {
    code: 4,
    playerTextKey: "reason.no_known_route",
    playerTextEn: "No known way there.",
    requiredDebugFields: ["actorId", "destinationMm", "knownGraphHash"],
  },
  MissingProcedure: {
    code: 5,
    playerTextKey: "reason.missing_procedure",
    playerTextEn: "Does not know how to do that yet.",
    requiredDebugFields: ["actorId", "procedureId", "recipeId"],
  },
  ReservationLost: {
    code: 6,
    playerTextKey: "reason.reservation_lost",
    playerTextEn: "Someone else took it first.",
    requiredDebugFields: ["actorId", "reservationId", "resourceId", "winnerActorId"],
  },
  InsufficientTime: {
    code: 7,
    playerTextKey: "reason.insufficient_time",
    playerTextEn: "Not enough time left to finish.",
    requiredDebugFields: ["actorId", "requiredTicks", "remainingTicks"],
  },
  TargetUnobserved: {
    code: 8,
    playerTextKey: "reason.target_unobserved",
    playerTextEn: "Cannot act on something not currently seen.",
    requiredDebugFields: ["actorId", "targetId", "lastObservedTick"],
  },
  MembershipLocked: {
    code: 9,
    playerTextKey: "reason.membership_locked",
    playerTextEn: "Clan membership is locked for the rest of the match.",
    requiredDebugFields: ["actorId", "clanId", "lockTick"],
  },
  StaleRules: {
    code: 10,
    playerTextKey: "reason.stale_rules",
    playerTextEn: "The rules changed before this could be applied.",
    requiredDebugFields: ["expectedRulesVersion", "actualRulesVersion"],
  },
  InsufficientInfluence: {
    code: 11,
    playerTextKey: "reason.insufficient_influence",
    playerTextEn: "Not enough Influence for that.",
    requiredDebugFields: ["requiredInfluence", "availableInfluence"],
  },
  NoticeTooShort: {
    code: 12,
    playerTextKey: "reason.notice_too_short",
    playerTextEn: "The announcement does not give enough notice.",
    requiredDebugFields: ["requestedEffectiveTick", "earliestAllowedTick", "minimumNoticeTicks"],
  },
  ProfileUnsupported: {
    code: 13,
    playerTextKey: "reason.profile_unsupported",
    playerTextEn: "Not available in this content profile.",
    requiredDebugFields: ["profileId", "requestedCapability"],
  },
} as const satisfies Record<string, ReasonDefinition>;

export type ReasonId = keyof typeof REASONS;

/** The mandatory v0 minimum from INTERFACES.md, in registry order. */
export const MANDATORY_V0_REASON_IDS: readonly ReasonId[] = Object.keys(REASONS) as ReasonId[];

export function isReasonId(value: unknown): value is ReasonId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(REASONS, value);
}

export function reasonDefinition(id: ReasonId): ReasonDefinition {
  return REASONS[id];
}

/** Numeric code → ID, for byte encodings and hot state. */
export const REASON_BY_CODE: ReadonlyMap<number, ReasonId> = new Map(
  (Object.keys(REASONS) as ReasonId[]).map((id) => [REASONS[id].code, id]),
);

export const reasonId = (description = "Reason registry ID"): Shape<ReasonId> =>
  enumOf(Object.keys(REASONS) as readonly ReasonId[], description) as Shape<ReasonId>;
