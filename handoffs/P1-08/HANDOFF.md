# Handoff — P1-08 / attempt 1

Status: **ACCEPTED** (standing producer authorization, 14 Sep 2026; self-review below found no material issues).
Base: `48c1d43` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: exclusive reservation grants, fifty-tick leases renewable only with progress, and release on every exit path.

Changed files: `packages/sim/core/reservation.ts` (new) — `ReservationBook`, `Lease`, `Release`; `packages/sim/core/index.ts`; `packages/sim/core/reservation.test.ts` (14 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. One scarce item is granted once and the loser receives a reason | `evidence/reservations.txt`, `reservation.test.ts` | **PASS** — the second asker is refused with `AlreadyReserved`, the holder's ID, and the tick the lease runs to: *"stack.flint.01 is leased to C003 until tick 60"*. The holder can re-grant its own lease without losing it; the key passes to the next asker only once released; a grant on an invalidated target is refused rather than handing out a handle to nothing |
| 2. Fifty-tick leases renew only with valid progress | `evidence/reservations.txt`, `reservation.test.ts` | **PASS** — the lease runs exactly 50 ticks and expires at 150, not 149. A renewal carrying progress extends it; a renewal with no progress beyond the last renewal **releases** it rather than refusing quietly, and the key is immediately grantable to someone who will use it. A loop renewing every ten ticks with static progress loses the lease — an actor cannot hold a scarce thing by asking politely |
| 3. Cancel, death, departure and target invalidation release every owned handle | `evidence/reservations.txt`, `reservation.test.ts` | **PASS** — death releases all three of an actor's handles and leaves another actor's lease untouched; departure and cancellation behave identically; invalidating a target releases that lease and leaves the actor's others alone. Every release is recorded with its cause, and a test exercising all four routes ends with nothing held and four releases logged |

Commands executed: `npm run verify` → **0** (build, lint, **701/701** vitest across 44 files — 687 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Three notes.
1. **A stalled renewal releases rather than refusing.** I considered refusing and letting the lease expire naturally, which is gentler — and wrong: it leaves a scarce item locked for up to fifty ticks by an actor already known to be going nowhere. Releasing immediately is the behaviour a player would call fair.
2. **Every ending funnels through one private `#release`.** "Every exit path releases" is then a property of the code rather than a list of callers someone must remember to extend, which is exactly the kind of rule that rots when a fifth exit path is added in P2.
3. **`progressMilli` is supplied by the caller and not verified.** Nothing yet cross-checks a claimed progress against the action actually running, so a caller could renew forever by incrementing a number. That check belongs with the packet that runs actions — recorded rather than hidden.

Deferred and out of scope: the `ReservationKey` contract record from P1-01 is *still* not the type used here — this book keys on strings, and binding the two belongs with the action packet that emits `ActionResources`. Also absent: queueing for a held key (a loser is refused, not enqueued — P1-06's `PassageQueue` is the pattern when that is wanted), priority or pre-emption, and any wiring into the tick kernel's transaction stage.
