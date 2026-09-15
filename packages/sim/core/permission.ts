/**
 * Permission service and law intervals (P1-12; TP v1.1 §10, LAW 01, LAW 03).
 *
 * One service answers every permission question — AI planning, action start,
 * action progress and final effect resolution all call it, and none of them may
 * decide for themselves. "The AI cannot bypass it; story logic cannot bypass it;
 * visual effects cannot bypass it" is only true if there is exactly one place
 * the answer comes from, which is what this is.
 *
 * Three rules decide whether the answers are trustworthy:
 *
 *   - **Boundaries are start-inclusive and end-exclusive**, everywhere, without
 *     exception. A law active `[100, 200)` covers tick 100 and does not cover
 *     tick 200. Mixing conventions produces a one-tick window where an actor is
 *     both protected and not, and nothing downstream can tell which.
 *   - **A law installed this tick wins over an action resolving this tick.**
 *     Stage 1 installs before stage 4 decides and stage 6 resolves (TP §4), so a
 *     permission asked at any later stage sees the new law.
 *   - **A denial carries a truthful reason and produces nothing.** Not a
 *     generic refusal: the rule ID, its version, its scope, and a reason from
 *     the frozen registry, so a player can be told why and a developer can find
 *     the law that did it.
 */
import { asInt } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";

export type PermissionVerdict = "Allowed" | "Denied";

/** The permission categories TP §10 calls hard: they cannot be overridden by social rules. */
export type HardPermission = "SentientHarm" | "HostileStructureDamage" | "PropertyWithdrawal" | "ProtectedSpatialScope";

export interface LawScope {
  /** Absent means the whole island. */
  readonly centreMm?: readonly [Int, Int];
  readonly radiusMm?: Int;
}

export interface Law {
  readonly lawId: string;
  /** Amendments keep the ID and increment the version (TP §10). */
  readonly version: Int;
  readonly permission: HardPermission;
  /** Start-inclusive. */
  readonly activationTick: Int;
  /** End-exclusive. */
  readonly endTick: Int;
  readonly scope: LawScope;
  /** Reason ID from the frozen v0 registry, used when this law denies. */
  readonly reasonId: string;
}

export interface PermissionRequest {
  readonly permission: HardPermission;
  readonly tick: Int;
  readonly actorPositionMm: readonly [Int, Int];
  /** Present for interactions with a second party — Sanctuary tests both points. */
  readonly targetPositionMm?: readonly [Int, Int];
}

export interface PermissionResult {
  readonly verdict: PermissionVerdict;
  /** Present on a denial: which law, which version, what scope, and why. */
  readonly ruleId?: string;
  readonly ruleVersion?: number;
  readonly scope?: "Island" | "Region";
  readonly reasonId?: string;
  readonly detail?: string;
}

/** Start-inclusive, end-exclusive. The whole point is that there is one answer. */
export function isActiveAt(law: Law, tick: Int): boolean {
  return tick >= law.activationTick && tick < law.endTick;
}

function withinScope(law: Law, pointMm: readonly [Int, Int]): boolean {
  if (law.scope.centreMm === undefined || law.scope.radiusMm === undefined) return true;
  const dx = (pointMm[0] as number) - (law.scope.centreMm[0] as number);
  const dy = (pointMm[1] as number) - (law.scope.centreMm[1] as number);
  const radius = law.scope.radiusMm as number;
  // Boundaries inclusive (TP §10: "Sanctuary tests both attacker and target
  // centre points, with boundaries inclusive").
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * The single permission service.
 *
 * Laws are data; this interprets them. It holds no opinion of its own: every
 * denial names the law that produced it, so there is no such thing as a refusal
 * this service invented.
 */
export class PermissionService {
  readonly #laws: Law[] = [];

  /** Install or amend. An amendment keeps the ID and must increment the version. */
  install(law: Law): void {
    const existing = this.#laws.findIndex((l) => l.lawId === law.lawId);
    if (existing >= 0) {
      const previous = this.#laws[existing] as Law;
      if (law.version <= previous.version) {
        throw new Error(`law ${law.lawId} amended to version ${law.version}, which does not exceed ${previous.version}: an amendment increments the version (TP v1.1 §10)`);
      }
      this.#laws[existing] = law;
      return;
    }
    this.#laws.push(law);
  }

  lawsAt(tick: Int): readonly Law[] {
    return this.#laws.filter((law) => isActiveAt(law, tick));
  }

  /**
   * Ask. Deterministic: laws are considered in ID order, so the same request
   * always names the same law when several would deny.
   */
  check(request: PermissionRequest): PermissionResult {
    const candidates = this.#laws
      .filter((law) => law.permission === request.permission && isActiveAt(law, request.tick))
      .sort((a, b) => (a.lawId < b.lawId ? -1 : a.lawId > b.lawId ? 1 : 0));

    for (const law of candidates) {
      // Both points are tested: standing outside a sanctuary does not license
      // reaching into it, and standing inside does not license reaching out.
      const points: readonly (readonly [Int, Int])[] = request.targetPositionMm === undefined ? [request.actorPositionMm] : [request.actorPositionMm, request.targetPositionMm];
      const hit = points.some((point) => withinScope(law, point));
      if (!hit) continue;

      const scope = law.scope.centreMm === undefined ? "Island" : "Region";
      return {
        verdict: "Denied",
        ruleId: law.lawId,
        ruleVersion: law.version as number,
        scope,
        reasonId: law.reasonId,
        detail: `${law.lawId} v${law.version} forbids ${request.permission} at tick ${request.tick} (${scope.toLowerCase()} scope, active [${law.activationTick}, ${law.endTick}))`,
      };
    }

    return { verdict: "Allowed" };
  }
}

export interface AttemptedEffect {
  readonly kind: string;
  readonly magnitude: Int;
}

export interface EffectOutcome {
  readonly applied: boolean;
  readonly effect?: AttemptedEffect;
  readonly denial?: PermissionResult;
}

/**
 * Resolve an effect through the service.
 *
 * A denied effect produces **nothing** — no reduced magnitude, no partial
 * application, no "it still counted a bit". The denial travels with the truthful
 * reason so the caller can tell a player why and a developer can find the law.
 */
export function resolveEffect(service: PermissionService, request: PermissionRequest, effect: AttemptedEffect): EffectOutcome {
  const permission = service.check(request);
  if (permission.verdict === "Denied") return { applied: false, denial: permission };
  return { applied: true, effect };
}

/** Milliseconds per tick, for stating law windows in seconds where the GDD does. */
export function ticksForSeconds(seconds: number): Int {
  return asInt(Math.trunc(seconds * 10), "ticks");
}
