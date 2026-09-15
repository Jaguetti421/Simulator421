/**
 * Local avoidance and passage queues (P1-06; TP v1.1 §5, AI 05).
 *
 * Three rules, and the third is the one that keeps the other two honest:
 *
 *   - **A narrow passage is owned, not contested.** One direction holds it at a
 *     time, and ownership rotates by how long each side has waited, so a low
 *     actor ID cannot starve a high one forever. Priority that never rotates is
 *     indistinguishable from a deadlock to the actor losing it.
 *   - **A wait is intentional only if it says what it is waiting for and when it
 *     gives up.** A `Wait` cannot be constructed without a trigger and a
 *     deadline, so "waiting" can never mean "stopped for reasons nobody
 *     recorded".
 *   - **Unexplained stalls are reported.** An actor that makes no progress for
 *     ten seconds with no intentional wait produces a diagnostic naming what it
 *     was last doing. This is the `NoUnexplainedStallOver100Ticks` invariant the
 *     fixture registry already names; the diagnostic is what makes it checkable.
 */
import { add, asInt, sub } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";

/** Ten seconds at the 10 Hz authoritative timestep. */
export const STALL_TICKS = 100;
/** Millimetres of movement below which a tick counts as no progress. TUNE. */
export const PROGRESS_EPSILON_MM = 50;
/** How long one grant of a passage lasts before it must be renewed. TUNE. */
export const PASSAGE_GRANT_TICKS = 40;

export type WaitReason = "PassageOwnedByOthers" | "ResourceReserved" | "YieldingToPriority";

/**
 * An intentional wait. Both fields are required: a wait without a trigger is a
 * stall with better manners, and a wait without a deadline is a deadlock that
 * has not happened yet.
 */
export interface Wait {
  readonly reason: WaitReason;
  /** What must become true for the wait to end — recorded, so a stall can say why it began. */
  readonly trigger: string;
  readonly deadlineTick: Int;
  readonly sinceTick: Int;
}

export type PassageDecision =
  | { readonly kind: "Granted"; readonly untilTick: Int }
  | { readonly kind: "Waiting"; readonly wait: Wait; readonly aheadOf: number };

interface Claim {
  readonly actorId: string;
  readonly direction: string;
  readonly sinceTick: Int;
}

/**
 * Ownership of narrow passages.
 *
 * Deterministic: ties break on the actor ID, so two runs of the same match
 * resolve the same way. Fair: the side that has waited longest wins the next
 * grant regardless of ID, which is what stops the tie-break from becoming a
 * permanent hierarchy.
 */
export class PassageQueue {
  readonly #holders = new Map<string, { claim: Claim; untilTick: Int }>();
  readonly #waiting = new Map<string, Claim[]>();
  /** Consecutive grants to each direction, per passage — the anti-starvation counter. */
  readonly #streak = new Map<string, { direction: string; count: number }>();
  /** How many grants each direction has had, for evidence rather than logic. */
  readonly grantsByDirection = new Map<string, number>();

  /** Longest run of consecutive grants any one direction has held on a passage. */
  maxStreak(passageId: string): number {
    return this.#streak.get(passageId)?.count ?? 0;
  }

  holder(passageId: string): string | undefined {
    return this.#holders.get(passageId)?.claim.actorId;
  }

  /**
   * Ask for a passage. Granted immediately when free; otherwise the caller gets
   * an intentional wait naming the holder and a deadline.
   */
  claim(passageId: string, actorId: string, direction: string, tick: Int): PassageDecision {
    const held = this.#holders.get(passageId);
    if (held !== undefined && held.claim.actorId !== actorId && tick < held.untilTick) {
      const queue = this.#waiting.get(passageId) ?? [];
      if (!queue.some((c) => c.actorId === actorId)) {
        queue.push({ actorId, direction, sinceTick: tick });
        this.#waiting.set(passageId, queue);
      }
      const ahead = queue.findIndex((c) => c.actorId === actorId);
      return {
        kind: "Waiting",
        aheadOf: ahead,
        wait: {
          reason: "PassageOwnedByOthers",
          trigger: `passage ${passageId} released by ${held.claim.actorId}`,
          deadlineTick: add(held.untilTick, asInt(PASSAGE_GRANT_TICKS, "grant")),
          sinceTick: tick,
        },
      };
    }

    if (held !== undefined && held.claim.actorId === actorId) {
      return { kind: "Granted", untilTick: held.untilTick };
    }
    return this.#grant(passageId, { actorId, direction, sinceTick: tick }, tick);
  }

  /** Release a passage the actor holds. A release by anyone else is ignored, not an error. */
  release(passageId: string, actorId: string, tick: Int): void {
    const held = this.#holders.get(passageId);
    if (held === undefined || held.claim.actorId !== actorId) return;
    this.#holders.delete(passageId);
    this.#promote(passageId, tick);
  }

  /** Expire grants whose time is up, and hand the passage to whoever has waited longest. */
  advance(tick: Int): void {
    for (const [passageId, held] of [...this.#holders]) {
      if (tick >= held.untilTick) {
        this.#holders.delete(passageId);
        this.#promote(passageId, tick);
      }
    }
  }

  #promote(passageId: string, tick: Int): void {
    const queue = this.#waiting.get(passageId);
    if (queue === undefined || queue.length === 0) return;

    // Longest wait first; the actor ID only breaks a genuine tie. This is the
    // anti-starvation rule: without it the lowest ID wins every contest forever.
    const sorted = [...queue].sort((a, b) => (a.sinceTick !== b.sinceTick ? (a.sinceTick as number) - (b.sinceTick as number) : a.actorId < b.actorId ? -1 : 1));
    const next = sorted[0] as Claim;
    this.#waiting.set(
      passageId,
      queue.filter((c) => c.actorId !== next.actorId),
    );
    this.#grant(passageId, next, tick);
  }

  #grant(passageId: string, claim: Claim, tick: Int): PassageDecision {
    const untilTick = add(tick, asInt(PASSAGE_GRANT_TICKS, "grant"));
    this.#holders.set(passageId, { claim, untilTick });

    const streak = this.#streak.get(passageId);
    this.#streak.set(passageId, streak !== undefined && streak.direction === claim.direction ? { direction: claim.direction, count: streak.count + 1 } : { direction: claim.direction, count: 1 });
    this.grantsByDirection.set(claim.direction, (this.grantsByDirection.get(claim.direction) ?? 0) + 1);

    return { kind: "Granted", untilTick };
  }
}

export interface StallDiagnostic {
  readonly actorId: string;
  readonly sinceTick: Int;
  readonly atTick: Int;
  readonly ticks: number;
  readonly seconds: number;
  readonly lastPositionMm: { readonly xMm: Int; readonly yMm: Int };
  /** What the actor was last known to be doing — the point of the diagnostic. */
  readonly lastIntent: string;
}

/**
 * Watches for unexplained lack of progress.
 *
 * An actor that is intentionally waiting is **not** stalled: it has a trigger
 * and a deadline, and both are recorded. An actor that simply stops moving with
 * no wait on file is the case this exists for, and after ten seconds it produces
 * a diagnostic rather than continuing to stand there quietly.
 */
export class ProgressMonitor {
  readonly #last = new Map<string, { xMm: Int; yMm: Int; sinceTick: Int; intent: string }>();
  readonly #reported = new Set<string>();

  /**
   * Record one tick for one actor. Returns a diagnostic the first time an
   * unexplained stall reaches ten seconds, and nothing on later ticks — a
   * diagnostic repeated every tick is noise, and noise gets filtered.
   */
  observe(actorId: string, tick: Int, position: { readonly xMm: Int; readonly yMm: Int }, intent: string, wait?: Wait): StallDiagnostic | undefined {
    const previous = this.#last.get(actorId);
    const moved =
      previous === undefined ||
      Math.abs(sub(position.xMm, previous.xMm) as number) > PROGRESS_EPSILON_MM ||
      Math.abs(sub(position.yMm, previous.yMm) as number) > PROGRESS_EPSILON_MM;

    if (moved) {
      this.#last.set(actorId, { xMm: position.xMm, yMm: position.yMm, sinceTick: tick, intent });
      this.#reported.delete(actorId);
      return undefined;
    }

    // An intentional wait explains the lack of progress; its own deadline is what
    // catches it if the trigger never comes.
    if (wait !== undefined) {
      this.#last.set(actorId, { ...(previous as { xMm: Int; yMm: Int; sinceTick: Int; intent: string }), intent });
      return undefined;
    }

    const stalledFor = (sub(tick, (previous as { sinceTick: Int }).sinceTick) as number);
    if (stalledFor < STALL_TICKS || this.#reported.has(actorId)) return undefined;

    this.#reported.add(actorId);
    return {
      actorId,
      sinceTick: (previous as { sinceTick: Int }).sinceTick,
      atTick: tick,
      ticks: stalledFor,
      seconds: stalledFor / 10,
      lastPositionMm: { xMm: position.xMm, yMm: position.yMm },
      lastIntent: (previous as { intent: string }).intent,
    };
  }

  /** Has this actor already been reported as stalled, and not moved since? */
  isReported(actorId: string): boolean {
    return this.#reported.has(actorId);
  }
}

/** A wait is only a wait if it carries both a trigger and a deadline. */
export function isIntentionalWait(wait: Wait | undefined): wait is Wait {
  return wait !== undefined && wait.trigger.length > 0 && wait.deadlineTick > wait.sinceTick;
}
