# Handoff — P1-16 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `6b317af` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: utility scoring over weighted considerations, a decision trace matching the frozen `DecisionTrace` record, and emergency preemption of the ordinary switching delay.

Changed files: `packages/sim/core/decision.ts` (new) — `decide`, `scoreCandidate`, `TRAIT_WEIGHTS`, `considerationsThatDiffer`; `packages/sim/core/index.ts`; `packages/sim/core/decision.test.ts` (14 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. One-trait paired fixtures change only relevant considerations | `evidence/decision.txt`, `decision.test.ts` | **PASS** — the same actor with and without `cautious` differs in exactly `shelter` and `threat`, the two considerations that trait weights. A second test walks every other consideration and requires the effective weight **and** the contribution to be numerically identical, not merely close. Two stacked traits differ in the union of their own considerations and nothing more. The trait also changes the winner — `goal.forage` becomes `goal.shelter` — because a trait that never changed a choice would not be one |
| 2. Chosen and actually evaluated alternatives retain reason and evidence age | `evidence/decision.txt`, `decision.test.ts` | **PASS** — the trace lists every scored candidate and no others, each with its considerations, base weight, trait-adjusted weight and contribution, and the score is asserted to equal the sum of its parts. Evidence carries the age it had when it was used (`factId: 7, ageTicks: 240`). The trace's field names are checked against the **frozen contract record**, not against themselves. When nothing is chosen the trace says which of `NoCandidates` or `AllScoredZero` it was |
| 3. Emergency/legal invalidation bypasses ordinary switching delay | `evidence/decision.txt`, `decision.test.ts` | **PASS** — a better ordinary option mid-delay is **held**, and taken once the delay elapses. An emergency candidate switches immediately with `trigger: "Emergency"`; an invalidated current action switches immediately with `trigger: "LegalInvalidation"`. A merely tempting candidate does **not** bypass the delay — and the trace still ranks it first, because the delay is a commitment, not a blindfold |

Commands executed: `npm run verify` → **0** (build, lint, **787/787** vitest across 50 files — 773 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Three notes.
1. **Traits are a sparse table, not a multiplier.** `TRAIT_WEIGHTS` lists only the considerations each trait touches, so criterion 1 is a property of the data rather than of care taken at each call site. A trait that scaled everything would be a mood with a name.
2. **The held-by-delay trace still ranks the better option first.** I considered suppressing it, and it would have been a lie by omission: the actor *did* evaluate it and *did* prefer it, and a trace that hid the preference would make the delay look like blindness when someone eventually asks why an actor ignored food.
3. **`considerationsThatDiffer` exists for the test**, and I am naming that rather than pretending otherwise. It compares two traces and returns what moved; the paired-fixture criterion is otherwise checked by eye, which is how a global multiplier slips in.

Deferred and out of scope: nothing generates candidates — a caller supplies them, and the goal library that will produce them is later P1. The considerations are a small fixed set chosen to exercise the trait table; the real set comes from the AI packets. Also absent: the trace is shaped like `DecisionTrace` but is **not** encoded through the contract codec, so field names are checked and canonical bytes are not; mood and relationship inputs; and any wiring to P1-17, so nothing yet turns a chosen candidate into a running action.
