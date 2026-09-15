# Handoff — P1-06 / attempt 1

Status: **READY_FOR_REVIEW**.
Base: `8ad3c70` (P1-05 ACCEPTED) → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: deterministic passage ownership with anti-starvation, intentional waits that carry a trigger and a deadline, and the ten-second unexplained-stall diagnostic.

Changed files: `packages/sim/spatial/avoidance.ts` (new) — `PassageQueue`, `Wait` / `isIntentionalWait`, `ProgressMonitor`, `StallDiagnostic`; `packages/sim/spatial/index.ts`; `packages/sim/spatial/avoidance.test.ts` (11 tests).

| Acceptance criterion | Evidence path | Executed result |
| --- | --- | --- |
| 1. Opposing actors clear a narrow passage without overlap or permanent priority starvation | `evidence/avoidance.txt`, `avoidance.test.ts` | **PASS** — one actor is granted, the other gets an intentional wait naming the holder; a test drives the whole grant window asserting the holder never changes, so two actors cannot hold a passage at once. **Starvation is tested by constructing it**: C003 asks first in all twelve contests, the shape that produces permanent priority when ties break on ID alone — north took 7 grants, south 6, longest streak 1. Ties still break on actor ID, so two runs agree |
| 2. Intentional waits have triggers and deadlines | `evidence/avoidance.txt`, `avoidance.test.ts` | **PASS** — every wait the queue issues carries both (`trigger: "passage gap.01 released by C003"`, `deadlineTick: 80`), and `isIntentionalWait` rejects a wait with an empty trigger or a deadline that never arrives. A wait without a trigger is a stall with better manners; a wait without a deadline is a deadlock that has not happened yet |
| 3. Unexplained lack of progress produces the ten-second diagnostic | `evidence/avoidance.txt`, `avoidance.test.ts` | **PASS** — 100 ticks without movement and with no wait on file produces a diagnostic at exactly 10.0 s carrying the last position and **the intent the actor was last pursuing**. The identical stillness *with* an intentional wait produces nothing, because that lack of progress is explained. It reports once rather than every tick, re-arms after the actor moves, and an actor crawling at 200 mm/tick is never reported |

Commands executed: `npm run verify` → **0** (build, lint, **650/650** vitest across 40 files — 639 at the packet baseline; 6 python; workboard PASS).

Design decisions within scope:
1. **Ownership beats contention.** A passage has a holder and a queue rather than actors negotiating per tick. Negotiation is where non-determinism and oscillation live: two actors politely yielding to each other forever is a real failure mode and it looks exactly like a deadlock.
2. **Longest wait wins; the ID only breaks a genuine tie.** Determinism and fairness are both required, and an ID tie-break alone gives determinism at the cost of a permanent hierarchy. The test constructs that hierarchy deliberately and requires it not to appear.
3. **A `Wait` cannot be built without both fields**, so the type carries the rule rather than a convention in a comment.
4. **An intentional wait suppresses the stall diagnostic**, and its own deadline is what catches it if the trigger never comes. Otherwise every queued actor would generate a diagnostic every ten seconds and the signal would be filtered away within a day.
5. **The diagnostic names the last intent.** A report saying "C003 has not moved for ten seconds" is a ticket; one saying it was walking to `camp.01` is a lead.

Contract proposals or deferred work outside scope: narrow passages are identified by a caller-supplied `passageId`. **Detecting which cells constitute a passage from the compiled geometry is not in this packet** — nothing yet scans the terrain for one-cell-wide gaps and names them, so until that lands a caller could queue on a passage that is not narrow, or miss one that is. Also absent: actor-to-actor collision (they still pass through each other, from P1-05), local steering around a moving neighbour, and any wiring into the tick kernel — this is the mechanism, not yet a behaviour anyone exhibits.

Remaining risks: `PASSAGE_GRANT_TICKS` (40), `PROGRESS_EPSILON_MM` (50) and `STALL_TICKS` (100) are **TUNE**. Only the last is anchored in anything — it is the ten seconds the criterion and the `NoUnexplainedStallOver100Ticks` invariant both name. Reproduce with `npm run verify` and the script in `evidence/avoidance.txt`.

Reviewer request: reproduce the acceptance evidence and record findings in REVIEW.md.
