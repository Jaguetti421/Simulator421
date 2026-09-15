# Handoff — P1-14 / attempt 1

Status: **READY_FOR_REVIEW**.
Base: `1ce55b5` (P1-12 ACCEPTED) → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: belief records that carry where they came from and when, uncertainty that grows with the age of the **observation**, obligations protected from ordinary eviction, and stale positions reported as areas rather than points.

Changed files: `packages/sim/core/belief.ts` (new) — `Belief`, `retell`, `uncertaintyAt`, `estimatePosition`, `BeliefStore`; `packages/sim/core/index.ts`; `packages/sim/core/belief.test.ts` (13 tests).

| Acceptance criterion | Evidence path | Executed result |
| --- | --- | --- |
| 1. Reports retain original observed time and uncertainty | `evidence/belief.txt`, `belief.test.ts` | **PASS** — a sighting at tick 200 retold at tick 900 keeps `observedAtTick: 200` and records `learnedAtTick: 900` separately. Retelling makes a belief **vaguer, never fresher**: uncertainty goes 500 → 2,500 mm, and ageing is measured from the observation, so a rumour is already old when it arrives. A three-hop chain of retellings still reports the original observation tick and pays uncertainty for each hop |
| 2. Active obligations survive ordinary belief eviction | `evidence/belief.txt`, `belief.test.ts` | **PASS** — with a memory limit of 3, one promise and six later sightings, the kept records are the promise and the two newest sightings. The promise is the **oldest record in the store** and the one age-based eviction would have taken first. Five live obligations in a three-record store evict nothing and report `protectedCount: 5`; a satisfied obligation becomes ordinary again and is evicted like anything else. Eviction ties break on ID, so two runs forget the same thing |
| 3. Stale enemy position does not become a fresh exact coordinate | `evidence/belief.txt`, `belief.test.ts` | **PASS** — at 10 ticks the estimate is `Exact ±4,000 mm`; at 60 ticks it is an `Area` of radius 21,500 mm, and **the exact coordinate is not in the result at all** — not rounded, not behind a flag. A caller cannot use what it was never given. A test asserts the radius never shrinks with age, and that a retelling an hour after the sighting reports 3,600 ticks of drift rather than the moments since the conversation |

Commands executed: `npm run verify` → **0** (build, lint, **687/687** vitest across 43 files — 674 at the packet baseline; 6 python; workboard PASS).

Design decisions within scope:
1. **Observation time and learning time are separate fields**, and only the first ages a belief. Collapsing them is what turns a rumour into evidence, and every decision downstream would then be confident for the wrong reason.
2. **A coarse estimate omits the point rather than blurring it.** Returning a rounded coordinate with an uncertainty beside it invites a caller to use the coordinate; returning a different shape makes that impossible. This is the same rule as "a budget-exhausted sight query is never visible" — do not hand out what you cannot stand behind.
3. **Protection is a property of the belief, not a flag on the store.** An unsatisfied obligation is protected; satisfying it makes it ordinary. Forgetting a promise is indistinguishable, from outside, from breaking one.
4. **Eviction is deterministic** — oldest observation first, ties by ID — because an actor that forgets different things in two replays of the same match is a divergence wearing a plausible disguise.

Contract proposals or deferred work outside scope: this is the record and its store. **Not here:** the belief-field table from TP §6 (confidence bands, evidence kinds, sleep and light modifiers), contradiction between two beliefs about the same subject, trust weighting by teller, wiring into the W0-08 save sections, and any connection to the P1-03 sight model — nothing yet turns a successful `lineOfSight` into a `Belief`. Obligations are a `BeliefKind` here; the promise, debt and favour systems that would create them are P2.

Remaining risks: `POSITION_DRIFT_MM_PER_TICK` (350) and `COARSE_THRESHOLD_MM` (20,000) are **TUNE** and decide, between them, how long an actor can act on a sighting — 57 ticks at these numbers. That is a gameplay-feel question, not a correctness one, and it will want a playtest. Reproduce with `npm run verify` and the script in `evidence/belief.txt`.

Reviewer request: reproduce the acceptance evidence and record findings in REVIEW.md.
