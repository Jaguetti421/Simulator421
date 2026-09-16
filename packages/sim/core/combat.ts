/**
 * Combat preparation and contact (P1-22; GDD §12, §19; TP v1.1 §11).
 *
 * The rule this packet exists for is quoted directly by the GDD:
 *
 *   > An aggressive contestant cannot queue prohibited damage for automatic
 *   > instant release at expiry. They may approach and ready equipment, but a
 *   > legal attack must still complete its **normal wind-up** after permission
 *   > becomes active.
 *
 * So a swing has three phases — wind-up, contact, recovery — and the wind-up
 * clock **starts when the attack legally starts**, not when the actor decided it
 * wanted to swing. An actor waiting out a truce beside its victim gets no head
 * start: the moment the truce lapses it begins winding up like anyone else.
 *
 * Permission is asked twice: once to begin, once at contact. A truce installed
 * mid-swing stops the blow, and a truce that lapses mid-swing does not retroact
 * an illegal beginning into a legal hit.
 */
import { add, asInt, isqrt, sub } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";
import type { PermissionService } from "./permission.js";

export const TICK_HZ = 10;

/** GDD 30.2 / §19 timings, in ticks at 10 Hz. TUNE where the GDD gives no number. */
export const MELEE = {
  windUpTicks: 6,
  recoveryTicks: 5,
  reachMm: 1_800 as Int,
  /** 160-degree forward arc, as cos(80 deg) in hundred-thousandths. */
  facingCos1e5: 17_365,
  staminaCostMilli: 8_000 as Int,
  damageMilli: 22_000 as Int,
} as const;

export const BOW = {
  windUpTicks: 12,
  recoveryTicks: 8,
  rangeMm: 45_000 as Int,
  facingCos1e5: 17_365,
  staminaCostMilli: 5_000 as Int,
  /** An arrow is spent at release, not at impact. */
  arrowsPerShot: 1,
} as const;

export type AttackKind = "Melee" | "Bow";
export type AttackPhase = "WindUp" | "Contact" | "Recovery";

export type AttackRefusal =
  | "PermissionDenied"
  | "OutOfRange"
  | "NotFacing"
  | "NoStamina"
  | "NoArrows"
  | "AlreadySwinging";

export interface Attacker {
  readonly actorId: string;
  readonly positionMm: readonly [Int, Int];
  readonly facingMm: readonly [Int, Int];
  readonly staminaMilli: Int;
  readonly arrows: number;
}

export interface AttackTarget {
  readonly actorId: string;
  readonly positionMm: readonly [Int, Int];
}

export interface Swing {
  readonly attackerId: string;
  readonly targetId: string;
  readonly kind: AttackKind;
  /** The tick the wind-up legally began — never earlier than permission allowed. */
  readonly beganAtTick: Int;
  readonly phase: AttackPhase;
  readonly staminaSpentMilli: Int;
  readonly arrowsSpent: number;
}

export type BeginResult =
  | { readonly ok: true; readonly swing: Swing }
  | { readonly ok: false; readonly refusal: AttackRefusal; readonly detail: string };

export type ContactResult =
  | { readonly kind: "WindingUp"; readonly swing: Swing; readonly ticksRemaining: number }
  | { readonly kind: "Hit"; readonly swing: Swing; readonly damageMilli: Int }
  | { readonly kind: "Recovering"; readonly swing: Swing; readonly ticksRemaining: number }
  | { readonly kind: "Done"; readonly swing: Swing }
  | { readonly kind: "Aborted"; readonly refusal: AttackRefusal; readonly detail: string; readonly staminaSpentMilli: Int; readonly arrowsSpent: number };

function profile(kind: AttackKind): { windUpTicks: number; recoveryTicks: number; rangeMm: Int; facingCos1e5: number; staminaCostMilli: Int } {
  return kind === "Melee"
    ? { windUpTicks: MELEE.windUpTicks, recoveryTicks: MELEE.recoveryTicks, rangeMm: MELEE.reachMm, facingCos1e5: MELEE.facingCos1e5, staminaCostMilli: MELEE.staminaCostMilli }
    : { windUpTicks: BOW.windUpTicks, recoveryTicks: BOW.recoveryTicks, rangeMm: BOW.rangeMm, facingCos1e5: BOW.facingCos1e5, staminaCostMilli: BOW.staminaCostMilli };
}

function distance(a: readonly [Int, Int], b: readonly [Int, Int]): number {
  const dx = (a[0] as number) - (b[0] as number);
  const dy = (a[1] as number) - (b[1] as number);
  return isqrt(asInt(dx * dx + dy * dy, "distance")) as number;
}

/** Integer facing test — the same dot product the sensory adapter uses. */
export function isFacing(attacker: Attacker, target: readonly [Int, Int], cos1e5: number): boolean {
  const dx = (target[0] as number) - (attacker.positionMm[0] as number);
  const dy = (target[1] as number) - (attacker.positionMm[1] as number);
  if (dx === 0 && dy === 0) return true;
  const fx = attacker.facingMm[0] as number;
  const fy = attacker.facingMm[1] as number;
  const facingLength = isqrt(asInt(fx * fx + fy * fy, "facing")) as number;
  if (facingLength === 0) return false;
  const nfx = Math.trunc((fx * 1_000) / facingLength);
  const nfy = Math.trunc((fy * 1_000) / facingLength);
  const dot = nfx * dx + nfy * dy;
  if (dot <= 0) return false;
  return dot * 100 >= distance(attacker.positionMm, target) * cos1e5;
}

/**
 * Begin a swing.
 *
 * Every check happens now, and the wind-up clock starts **now** — this is the
 * function that makes precharging impossible, because there is no way to record
 * an intention earlier and have it count.
 */
export function beginAttack(
  attacker: Attacker,
  target: AttackTarget,
  kind: AttackKind,
  service: PermissionService,
  tick: Int,
  existing?: Swing,
): BeginResult {
  if (existing !== undefined) return { ok: false, refusal: "AlreadySwinging", detail: `${attacker.actorId} is already in ${existing.phase}` };

  const spec = profile(kind);
  if (attacker.staminaMilli < spec.staminaCostMilli) {
    return { ok: false, refusal: "NoStamina", detail: `${attacker.actorId} has ${attacker.staminaMilli} stamina, needs ${spec.staminaCostMilli}` };
  }
  if (kind === "Bow" && attacker.arrows < BOW.arrowsPerShot) {
    return { ok: false, refusal: "NoArrows", detail: `${attacker.actorId} has no arrows` };
  }
  const range = distance(attacker.positionMm, target.positionMm);
  if (range > (spec.rangeMm as number)) {
    return { ok: false, refusal: "OutOfRange", detail: `${range} mm away, ${kind} reaches ${spec.rangeMm} mm` };
  }
  if (!isFacing(attacker, target.positionMm, spec.facingCos1e5)) {
    return { ok: false, refusal: "NotFacing", detail: `${attacker.actorId} is not facing ${target.actorId}` };
  }

  const permission = service.check({ permission: "SentientHarm", tick, actorPositionMm: attacker.positionMm, targetPositionMm: target.positionMm });
  if (permission.verdict === "Denied") {
    return { ok: false, refusal: "PermissionDenied", detail: permission.detail ?? "forbidden" };
  }

  return {
    ok: true,
    swing: {
      attackerId: attacker.actorId,
      targetId: target.actorId,
      kind,
      beganAtTick: tick,
      phase: "WindUp",
      staminaSpentMilli: spec.staminaCostMilli,
      arrowsSpent: kind === "Bow" ? BOW.arrowsPerShot : 0,
    },
  };
}

/**
 * Advance a swing one tick.
 *
 * Permission is checked **again at contact**. A truce installed during the
 * wind-up aborts the swing; the stamina and the arrow are still spent, because
 * the actor really did swing and really did loose.
 */
export function advanceSwing(
  swing: Swing,
  attacker: Attacker,
  target: AttackTarget,
  service: PermissionService,
  tick: Int,
): ContactResult {
  const spec = profile(swing.kind);
  const elapsed = sub(tick, swing.beganAtTick) as number;

  if (elapsed < spec.windUpTicks) {
    return { kind: "WindingUp", swing, ticksRemaining: spec.windUpTicks - elapsed };
  }

  if (elapsed === spec.windUpTicks) {
    // Contact: everything is rechecked, because everything can have changed.
    const range = distance(attacker.positionMm, target.positionMm);
    if (range > (spec.rangeMm as number)) {
      return { kind: "Aborted", refusal: "OutOfRange", detail: `${range} mm at contact, ${swing.kind} reaches ${spec.rangeMm} mm`, staminaSpentMilli: swing.staminaSpentMilli, arrowsSpent: swing.arrowsSpent };
    }
    const permission = service.check({ permission: "SentientHarm", tick, actorPositionMm: attacker.positionMm, targetPositionMm: target.positionMm });
    if (permission.verdict === "Denied") {
      return { kind: "Aborted", refusal: "PermissionDenied", detail: permission.detail ?? "forbidden", staminaSpentMilli: swing.staminaSpentMilli, arrowsSpent: swing.arrowsSpent };
    }
    return { kind: "Hit", swing: { ...swing, phase: "Contact" }, damageMilli: swing.kind === "Melee" ? MELEE.damageMilli : (0 as Int) };
  }

  if (elapsed < spec.windUpTicks + spec.recoveryTicks) {
    return { kind: "Recovering", swing: { ...swing, phase: "Recovery" }, ticksRemaining: spec.windUpTicks + spec.recoveryTicks - elapsed };
  }
  return { kind: "Done", swing: { ...swing, phase: "Recovery" } };
}

/** Total ticks from beginning a swing to being able to act again. */
export function swingTotalTicks(kind: AttackKind): number {
  const spec = profile(kind);
  return spec.windUpTicks + spec.recoveryTicks;
}

/** The earliest tick a blow can land if the attack begins now — never earlier. */
export function earliestContactTick(kind: AttackKind, beginsAtTick: Int): Int {
  return add(beginsAtTick, asInt(profile(kind).windUpTicks, "windUp"));
}
