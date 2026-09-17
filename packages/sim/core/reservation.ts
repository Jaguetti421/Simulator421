/**
 * Reservations and lease lifecycle (P1-08; TP v1.1 §8, AI 06).
 *
 * A reservation is a **lease**, not a claim: it is granted once, it expires on
 * its own, and it is renewed only by an actor that is actually getting
 * somewhere. That shape is deliberate, because the two failure modes it prevents
 * are the ones that ruin an economy quietly:
 *
 *   - **Two actors given the same scarce item.** Granting is exclusive, and the
 *     actor who loses is told which reservation beat it and why — a silent
 *     failure here becomes an actor standing at an empty workbench with no
 *     explanation anyone can reconstruct.
 *   - **A lease held forever by an actor doing nothing.** Renewal requires
 *     *progress*, not merely a request. An actor that asks politely every tick
 *     while achieving nothing loses the lease to one that will use it, and the
 *     fifty-tick expiry is the backstop for the actor that stops asking at all —
 *     because it died, walked away, or was cancelled.
 *
 * Every exit path releases: cancel, death, departure and target invalidation all
 * go through one release, so there is no route out of the world that leaves a
 * handle behind.
 */
import { add, asInt, sub } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";

/** Lease length in ticks (five seconds at 10 Hz). TP §8's fifty-tick lease. */
export const LEASE_TICKS = 50;

export type ReservationKind = "Station" | "Slot" | "ItemStack" | "WorkPosition" | "Route";

export type DenialReason = "AlreadyReserved" | "TargetInvalidated" | "NotTheHolder" | "NoProgress";

export type ReleaseCause = "Completed" | "Cancelled" | "Expired" | "Death" | "Departure" | "TargetInvalidated" | "NoProgress";

export interface Lease {
  readonly key: string;
  readonly kind: ReservationKind;
  readonly holderActorId: string;
  readonly grantedAtTick: Int;
  readonly expiresAtTick: Int;
  /** Progress at the last renewal, in thousandths — renewal must beat it. */
  readonly progressMilli: Int;
  readonly renewals: number;
}

export type GrantResult =
  | { readonly ok: true; readonly lease: Lease }
  | { readonly ok: false; readonly reason: DenialReason; readonly heldBy?: string; readonly detail: string };

export type RenewResult =
  | { readonly ok: true; readonly lease: Lease }
  | { readonly ok: false; readonly reason: DenialReason; readonly detail: string; readonly released?: Release };

export interface Release {
  readonly key: string;
  readonly holderActorId: string;
  readonly cause: ReleaseCause;
  readonly atTick: Int;
}

/**
 * The reservation book.
 *
 * Holds leases by key. Every method that can end a lease funnels into
 * `#release`, so "every owned handle is released" is a property of the code
 * rather than a list of callers someone has to remember to update.
 */
export class ReservationBook {
  readonly #leases = new Map<string, Lease>();
  /** Keys whose target no longer exists; a grant on one of these is refused. */
  readonly #invalidated = new Set<string>();
  readonly releases: Release[] = [];

  /**
   * Put a lease back exactly as it was — the restore path.
   *
   * `grant` recomputes the expiry from the current tick, which is wrong on
   * restore: a lease due to lapse at tick 60 must still lapse at 60, or a save
   * changes when things expire. It did — a save at tick 50 diverged at 54 until
   * this existed.
   */
  restoreLease(lease: Lease): void {
    this.#leases.set(lease.key, lease);
  }


  holderOf(key: string): string | undefined {
    return this.#leases.get(key)?.holderActorId;
  }

  leaseFor(key: string): Lease | undefined {
    return this.#leases.get(key);
  }

  heldBy(actorId: string): readonly Lease[] {
    return [...this.#leases.values()].filter((lease) => lease.holderActorId === actorId).sort((a, b) => (a.key < b.key ? -1 : 1));
  }

  /** Grant a lease. Exclusive: a held key is refused, and the loser is told who holds it. */
  grant(key: string, kind: ReservationKind, actorId: string, tick: Int): GrantResult {
    if (this.#invalidated.has(key)) {
      return { ok: false, reason: "TargetInvalidated", detail: `${key} no longer exists` };
    }
    const held = this.#leases.get(key);
    if (held !== undefined && held.holderActorId !== actorId) {
      return {
        ok: false,
        reason: "AlreadyReserved",
        heldBy: held.holderActorId,
        detail: `${key} is leased to ${held.holderActorId} until tick ${held.expiresAtTick}`,
      };
    }

    const lease: Lease = {
      key,
      kind,
      holderActorId: actorId,
      grantedAtTick: tick,
      expiresAtTick: add(tick, asInt(LEASE_TICKS, "lease")),
      progressMilli: 0 as Int,
      renewals: 0,
    };
    this.#leases.set(key, lease);
    return { ok: true, lease };
  }

  /**
   * Renew a lease. Only the holder may renew, and only with progress that beats
   * the progress recorded at the last renewal. A renewal without progress
   * **releases** the lease rather than refusing quietly: an actor that is not
   * getting anywhere should not be holding a scarce thing.
   */
  renew(key: string, actorId: string, progressMilli: Int, tick: Int): RenewResult {
    const lease = this.#leases.get(key);
    if (lease === undefined) return { ok: false, reason: "NotTheHolder", detail: `${key} is not leased` };
    if (lease.holderActorId !== actorId) return { ok: false, reason: "NotTheHolder", detail: `${key} is leased to ${lease.holderActorId}, not ${actorId}` };

    if (progressMilli <= lease.progressMilli) {
      const released = this.#release(key, "NoProgress", tick);
      return {
        ok: false,
        reason: "NoProgress",
        detail: `${actorId} renewed ${key} at progress ${progressMilli}, no better than ${lease.progressMilli}; the lease was released`,
        ...(released === undefined ? {} : { released }),
      };
    }

    const renewed: Lease = {
      ...lease,
      expiresAtTick: add(tick, asInt(LEASE_TICKS, "lease")),
      progressMilli,
      renewals: lease.renewals + 1,
    };
    this.#leases.set(key, renewed);
    return { ok: true, lease: renewed };
  }

  /** Expire every lease whose time is up. The backstop for an actor that stopped asking. */
  advance(tick: Int): readonly Release[] {
    const expired: Release[] = [];
    for (const [key, lease] of [...this.#leases]) {
      if (tick >= lease.expiresAtTick) {
        const release = this.#release(key, "Expired", tick);
        if (release !== undefined) expired.push(release);
      }
    }
    return expired;
  }

  /** The holder finished with it. */
  complete(key: string, actorId: string, tick: Int): Release | undefined {
    return this.#leases.get(key)?.holderActorId === actorId ? this.#release(key, "Completed", tick) : undefined;
  }

  cancel(key: string, actorId: string, tick: Int): Release | undefined {
    return this.#leases.get(key)?.holderActorId === actorId ? this.#release(key, "Cancelled", tick) : undefined;
  }

  /** An actor died or left the match: everything it holds goes back. */
  releaseAllHeldBy(actorId: string, cause: Extract<ReleaseCause, "Death" | "Departure" | "Cancelled">, tick: Int): readonly Release[] {
    return this.heldBy(actorId)
      .map((lease) => this.#release(lease.key, cause, tick))
      .filter((release): release is Release => release !== undefined);
  }

  /**
   * The thing behind the key stopped existing — the stack was consumed, the
   * station burned down. The lease goes, and further grants are refused rather
   * than handing out a handle to nothing.
   */
  invalidateTarget(key: string, tick: Int): Release | undefined {
    this.#invalidated.add(key);
    return this.#leases.has(key) ? this.#release(key, "TargetInvalidated", tick) : undefined;
  }

  /** Has this key's target been invalidated? */
  isInvalidated(key: string): boolean {
    return this.#invalidated.has(key);
  }

  #release(key: string, cause: ReleaseCause, tick: Int): Release | undefined {
    const lease = this.#leases.get(key);
    if (lease === undefined) return undefined;
    this.#leases.delete(key);
    const release: Release = { key, holderActorId: lease.holderActorId, cause, atTick: tick };
    this.releases.push(release);
    return release;
  }

  /** Ticks left on a lease, or zero if it is gone. */
  remainingTicks(key: string, tick: Int): number {
    const lease = this.#leases.get(key);
    return lease === undefined ? 0 : Math.max(0, sub(lease.expiresAtTick, tick) as number);
  }
}
