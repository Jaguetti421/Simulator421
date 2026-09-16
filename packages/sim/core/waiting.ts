/**
 * Timed waiting and law amendment response (P1-19; TP v1.1 §7, AI 03–04, LAW 03).
 *
 * An actor waiting for a law to lapse is making a **prediction**, and the thing
 * that makes it a good design rather than a trap is that the prediction is
 * allowed to be wrong:
 *
 *   - **Waiting is a choice, not the only one.** A patient actor may stand and
 *     watch the clock; an actor with an immediate need must not. The same
 *     situation produces different behaviour from different profiles, which is
 *     what makes patience a trait rather than a bug.
 *   - **An amendment invalidates a wait within ten ticks.** A law's end tick can
 *     move; an actor still waiting on the old one is waiting for a moment that
 *     will never arrive, and TP §7 gives it one second to notice.
 *   - **Permission opening is not a head start.** When the wait ends, the attack
 *     still serves its full wind-up. This is the same rule P1-22 enforces from
 *     the other side, checked here through the waiting path so the two cannot
 *     disagree.
 */
import { add, asInt, sub } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";
import { beginAttack, earliestContactTick } from "./combat.js";
import type { AttackKind, Attacker, AttackTarget } from "./combat.js";
import { isActiveAt } from "./permission.js";
import type { Law, PermissionService } from "./permission.js";

/** TP §7: an amended expiry must invalidate a dependent wait within this many ticks. */
export const AMENDMENT_NOTICE_TICKS = 10;

export type WaitOutcome = "Waiting" | "Ready" | "Invalidated" | "Abandoned";

export interface TimedWait {
  readonly waitId: string;
  readonly actorId: string;
  /** What the actor is waiting for. */
  readonly lawId: string;
  /** The end tick it believed when it began — a belief, not a fact. */
  readonly expectedEndTick: Int;
  /** The law version that belief came from; an amendment changes it. */
  readonly onLawVersion: number;
  readonly startedAtTick: Int;
  /** When the actor gives up regardless of the law (TP §7: waits have deadlines). */
  readonly deadlineTick: Int;
  readonly lastCheckedTick: Int;
}

export interface WaitStep {
  readonly outcome: WaitOutcome;
  readonly wait: TimedWait;
  readonly detail: string;
  /** Ticks between the amendment and this actor noticing. */
  readonly noticeLatencyTicks?: number;
}

/**
 * Has this wait gone too long without re-reading its law?
 *
 * The ten-tick bound is a **cadence** requirement: an actor that checks at least
 * that often notices an amendment within ten ticks, and one that does not is
 * overdue. Reporting it is the same idea as `ThreatQueue.overdue` — the bound is
 * measurable rather than assumed, and a caller that drifts is told.
 */
export function checkOverdue(wait: TimedWait, tick: Int): boolean {
  return (sub(tick, wait.lastCheckedTick) as number) > AMENDMENT_NOTICE_TICKS;
}

export function beginWait(waitId: string, actorId: string, law: Law, tick: Int, patienceTicks: number): TimedWait {
  return {
    waitId,
    actorId,
    lawId: law.lawId,
    expectedEndTick: law.endTick,
    onLawVersion: law.version as unknown as number,
    startedAtTick: tick,
    deadlineTick: add(tick, asInt(patienceTicks, "patience")),
    lastCheckedTick: tick,
  };
}

/**
 * Advance a wait by one tick.
 *
 * The law is re-read every tick rather than trusted from when the wait began.
 * An amendment that moves the end tick, or replaces the law entirely, shows up
 * as a version or expiry mismatch and the wait is **invalidated** — with the
 * latency reported so the ten-tick bound is measurable rather than assumed.
 */
export function stepWait(wait: TimedWait, service: PermissionService, tick: Int): WaitStep {
  const current = service.lawsAt(tick).find((law) => law.lawId === wait.lawId)
    ?? service.lawsAt(wait.expectedEndTick).find((law) => law.lawId === wait.lawId);

  const checked: TimedWait = { ...wait, lastCheckedTick: tick };

  if (current !== undefined && ((current.version as unknown as number) !== wait.onLawVersion || current.endTick !== wait.expectedEndTick)) {
    return {
      outcome: "Invalidated",
      wait: checked,
      detail: `${wait.lawId} was amended: expiry ${wait.expectedEndTick} is now ${current.endTick} (v${wait.onLawVersion} → v${current.version})`,
      noticeLatencyTicks: Math.max(0, sub(tick, wait.lastCheckedTick) as number),
    };
  }

  if (tick >= wait.deadlineTick) {
    return { outcome: "Abandoned", wait: checked, detail: `${wait.actorId} ran out of patience at tick ${tick}` };
  }

  const stillBlocked = current !== undefined && isActiveAt(current, tick);
  if (!stillBlocked) {
    return { outcome: "Ready", wait: checked, detail: `${wait.lawId} is no longer in force at tick ${tick}` };
  }

  return { outcome: "Waiting", wait: checked, detail: `${wait.lawId} holds until ${current.endTick}` };
}

// ---------------------------------------------------------------------------
// Who may wait
// ---------------------------------------------------------------------------

export interface NeedProfile {
  /** Fullness in whole points; below the urgent threshold, waiting is not an option. */
  readonly fullnessPoints: number;
  readonly urgentBelow: number;
  /** Whether this actor's traits make patience available at all. */
  readonly patient: boolean;
}

export type WaitDecision =
  | { readonly kind: "MayWait"; readonly patienceTicks: number; readonly reason: string }
  | { readonly kind: "MustAct"; readonly reason: string };

/**
 * May this actor wait?
 *
 * An immediate need overrides patience — an actor starving in front of a truce
 * does not stand and watch the clock. The two profiles are asked the same
 * question and give different answers, which is criterion 1.
 */
export function mayWait(profile: NeedProfile, patienceTicks = 600): WaitDecision {
  if (profile.fullnessPoints < profile.urgentBelow) {
    return { kind: "MustAct", reason: `fullness ${profile.fullnessPoints} is below the urgent threshold ${profile.urgentBelow}` };
  }
  if (!profile.patient) {
    return { kind: "MustAct", reason: "this actor has no patience trait" };
  }
  return { kind: "MayWait", patienceTicks, reason: `fullness ${profile.fullnessPoints} leaves room to wait` };
}

// ---------------------------------------------------------------------------
// Acting when the wait ends
// ---------------------------------------------------------------------------

export interface ReadyToAct {
  readonly began: boolean;
  readonly beganAtTick?: Int;
  readonly earliestContactTick?: Int;
  readonly refusal?: string;
}

/**
 * Attack as soon as the wait reports Ready.
 *
 * Deliberately routed through P1-22's `beginAttack` rather than reimplemented:
 * the wind-up clock starts when the attack legally starts, and an actor that
 * waited out a truce gets no head start. Calling the same function is what stops
 * the waiting path and the combat path from drifting apart.
 */
export function actOnPermissionOpening(
  attacker: Attacker,
  target: AttackTarget,
  kind: AttackKind,
  service: PermissionService,
  tick: Int,
): ReadyToAct {
  const result = beginAttack(attacker, target, kind, service, tick);
  if (!result.ok) return { began: false, refusal: `${result.refusal}: ${result.detail}` };
  return { began: true, beganAtTick: result.swing.beganAtTick, earliestContactTick: earliestContactTick(kind, result.swing.beganAtTick) };
}
