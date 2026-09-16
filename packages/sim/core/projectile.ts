/**
 * Projectile segment collision (P1-21; TP v1.1 §11, LAW 01 geometry).
 *
 * An arrow at 18 m/s covers 1.8 m per tick — twice an actor's diameter. Testing
 * only the endpoints of that step would let it pass straight through somebody
 * on alternate ticks, which is the bug this module exists to make impossible:
 * the flight is a **segment**, and every candidate is tested against the segment
 * rather than against the two points that bound it.
 *
 * Two rules follow from TP §11 and they matter as much as the geometry:
 *
 *   - **Ordering is stable.** When a projectile could hit two things in one
 *     tick, the nearer contact wins, and a tie breaks on the target's ID. An
 *     arrow that hits a different actor in two replays of the same match is a
 *     divergence, not a detail.
 *   - **Collision applies nothing.** This module reports *where the segment
 *     first met something*. Whether that becomes damage is a question for the
 *     permission service and the damage resolver — a projectile fired before a
 *     truce and landing after it is exactly the case that must not be decided by
 *     geometry.
 */
import { add, asInt, isqrt, mul, mulDiv, sub } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";

/** GDD: an arrow travels 18 m/s. At 10 Hz that is 1,800 mm per tick. */
export const ARROW_MM_PER_SECOND = 18_000 as Int;
export const TICK_HZ = 10;
/** Actor capsule radius for projectile purposes, in millimetres. TUNE. */
export const TARGET_RADIUS_MM = 450 as Int;

export type ContactKind = "Actor" | "Obstacle" | "Terrain";

export interface ProjectileState {
  readonly id: string;
  readonly ownerActorId: string;
  readonly positionMm: readonly [Int, Int];
  /** Velocity in millimetres per tick. */
  readonly velocityMmPerTick: readonly [Int, Int];
  readonly firedAtTick: Int;
}

export interface TargetCandidate {
  readonly id: string;
  readonly kind: ContactKind;
  readonly positionMm: readonly [Int, Int];
  readonly radiusMm: Int;
}

export interface Contact {
  readonly targetId: string;
  readonly kind: ContactKind;
  /** Where the segment first met the target. */
  readonly pointMm: readonly [Int, Int];
  /** Distance along the segment, in millimetres — what "first" is measured on. */
  readonly distanceMm: Int;
  readonly atTick: Int;
  /**
   * Deliberately absent: damage. A contact is a geometric fact; whether it
   * becomes an injury is the permission service's question, asked later.
   */
  readonly appliesDamage: false;
}

export interface SweepResult {
  readonly state: ProjectileState;
  /** The first contact along the segment, if any. */
  readonly contact?: Contact;
  /** Every contact the segment met, nearest first — for diagnostics, not for damage. */
  readonly allContacts: readonly Contact[];
  readonly segmentStartMm: readonly [Int, Int];
  readonly segmentEndMm: readonly [Int, Int];
}

/** Velocity for a projectile launched toward a point at a given speed. */
export function velocityToward(from: readonly [Int, Int], to: readonly [Int, Int], mmPerSecond: Int = ARROW_MM_PER_SECOND): readonly [Int, Int] {
  const dx = sub(to[0], from[0]);
  const dy = sub(to[1], from[1]);
  const length = isqrt(add(mul(dx, dx), mul(dy, dy)));
  if (length <= 0) return [0 as Int, 0 as Int];
  const perTick = mulDiv(mmPerSecond, 1 as Int, asInt(TICK_HZ, "tickHz"));
  return [mulDiv(dx, perTick, length), mulDiv(dy, perTick, length)];
}

/**
 * Closest approach of a point to a segment, and how far along the segment it
 * happens. Integer throughout: the squared distance and the parameter are both
 * exact, so two runs agree on which target was nearer.
 */
function closestApproach(
  start: readonly [Int, Int],
  end: readonly [Int, Int],
  point: readonly [Int, Int],
): { readonly distanceSquared: number; readonly alongMm: number; readonly pointMm: readonly [Int, Int] } {
  const sx = start[0] as number;
  const sy = start[1] as number;
  const ex = end[0] as number;
  const ey = end[1] as number;
  const px = point[0] as number;
  const py = point[1] as number;

  const dx = ex - sx;
  const dy = ey - sy;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    const ddx = px - sx;
    const ddy = py - sy;
    return { distanceSquared: ddx * ddx + ddy * ddy, alongMm: 0, pointMm: start };
  }

  // t = clamp(((p - s) · d) / |d|², 0, 1), kept as a numerator over lengthSquared.
  const dot = (px - sx) * dx + (py - sy) * dy;
  const numerator = Math.max(0, Math.min(lengthSquared, dot));
  const cx = sx + Math.trunc((dx * numerator) / lengthSquared);
  const cy = sy + Math.trunc((dy * numerator) / lengthSquared);
  const ddx = px - cx;
  const ddy = py - cy;
  const along = Math.trunc((isqrt(asInt(lengthSquared, "segment")) as number) * numerator) / lengthSquared;

  return { distanceSquared: ddx * ddx + ddy * ddy, alongMm: Math.trunc(along), pointMm: [cx as Int, cy as Int] };
}

/**
 * Advance a projectile one tick and report what its flight path met.
 *
 * The segment runs from where the projectile was to where it would be. Every
 * candidate whose radius the segment enters is a contact; they are returned
 * nearest-first, and the nearest is `contact`. **Nothing is applied** — the
 * projectile's own position is advanced to the end of the segment regardless,
 * because whether it should stop at the contact is the caller's decision once
 * permission has been asked.
 */
export function sweepProjectile(projectile: ProjectileState, candidates: readonly TargetCandidate[], tick: Int): SweepResult {
  const start = projectile.positionMm;
  const end: readonly [Int, Int] = [add(start[0], projectile.velocityMmPerTick[0]), add(start[1], projectile.velocityMmPerTick[1])];

  const contacts: Contact[] = [];
  for (const candidate of candidates) {
    if (candidate.id === projectile.ownerActorId) continue;
    const approach = closestApproach(start, end, candidate.positionMm);
    const reach = (candidate.radiusMm as number) + 0;
    if (approach.distanceSquared > reach * reach) continue;
    contacts.push({
      targetId: candidate.id,
      kind: candidate.kind,
      pointMm: approach.pointMm,
      distanceMm: asInt(approach.alongMm, "alongMm"),
      atTick: tick,
      appliesDamage: false,
    });
  }

  // Nearest first; ties break on ID so two replays agree on who was hit.
  contacts.sort((a, b) => ((a.distanceMm as number) !== (b.distanceMm as number) ? (a.distanceMm as number) - (b.distanceMm as number) : a.targetId < b.targetId ? -1 : 1));

  return {
    state: { ...projectile, positionMm: end },
    allContacts: contacts,
    segmentStartMm: start,
    segmentEndMm: end,
    ...(contacts[0] === undefined ? {} : { contact: contacts[0] }),
  };
}

/**
 * Fly a projectile until it meets something or runs out of ticks.
 *
 * Returns the first contact and the tick it happened on. The projectile is
 * **not** stopped or resolved here: a caller that wants it to stop does so after
 * asking whether the hit is permitted.
 */
export function flyUntilContact(
  projectile: ProjectileState,
  candidates: readonly TargetCandidate[],
  fromTick: Int,
  maxTicks: number,
): { readonly contact?: Contact; readonly state: ProjectileState; readonly ticksFlown: number } {
  let state = projectile;
  for (let step = 0; step < maxTicks; step += 1) {
    const tick = add(fromTick, asInt(step, "step"));
    const swept = sweepProjectile(state, candidates, tick);
    state = swept.state;
    if (swept.contact !== undefined) return { contact: swept.contact, state, ticksFlown: step + 1 };
  }
  return { state, ticksFlown: maxTicks };
}

/** Millimetres a projectile covers in one tick, for a caller sizing a sweep. */
export function perTickMm(mmPerSecond: Int): Int {
  return mulDiv(mmPerSecond, 1 as Int, asInt(TICK_HZ, "tickHz"));
}
