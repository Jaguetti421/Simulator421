# Handoff — P1-30 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `49c3a4e` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: a law timeline built from acknowledged state only, a command list that keeps pending commands visible, and a speed readout that reports what is delivered.

Changed files: `apps/web/src/view/timeline.ts` (new) — `buildLawTimeline`, `buildCommandList`, `pendingCommands`, `readSpeed`; `apps/web/src/view/timeline.test.ts` (16 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. UI never displays a rejected law as active | `timeline.test.ts` | **PASS** — a refused law whose interval covers the current tick still shows `Rejected`, carries its reason, and `isDisplayedAsInForce` is false for it. Only acknowledged laws move through Scheduled → Active → Ended, on the same end-exclusive boundaries P1-12 enforces. A law the player submitted and the core has **not answered** appears in the timeline not at all — it is a pending command until the core says otherwise |
| 2. Pending paused commands remain visibly pending | `timeline.test.ts` | **PASS** — unanswered commands show `PendingPaused` while the world is paused and `Pending` while it runs; neither is ever dropped from the list, and a list with one acknowledged and one outstanding command shows both. No unanswered command can display as accepted, paused or not. Rejections carry their reason; acceptances carry the acknowledging tick |
| 3. Actual delivered speed is shown when requested acceleration is unsustainable | `timeline.test.ts` | **PASS** — 40 ticks in a second at a 4× request reads `4x`; 17 ticks reads **`1.7x (requested 4x)`**. Delivery is *measured* from committed ticks against elapsed time rather than echoing the setting. A rounding wobble does not trigger the notice, a paused world says `paused` rather than reporting zero times a request, and a zero elapsed time does not divide by zero |

Commands executed: `npm run verify` → **0** (build, lint, **952/952** vitest across 61 files — 936 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Three notes.
1. **The timeline takes acknowledged and rejected laws as separate inputs**, with no third bucket for "submitted". That makes optimistic display impossible by shape: there is no list a not-yet-answered law could sit in and be rendered as live. Optimistic display is the standing temptation in a UI like this, and a rule against it would not survive the first "it feels laggy" review.
2. **Delivered speed is a measurement.** `readSpeed` counts committed ticks against elapsed milliseconds; it cannot report the request by accident because the request is not one of the numbers it computes from.
3. **A paused world says `paused`.** Reporting `0x` of a 4× request is technically true and useless — it invites the reading that the game is broken rather than stopped.

Deferred and out of scope: nothing renders these rows, and the submit path — how a click becomes a `PlayerCommand` with a sequence — belongs with the app packet that builds the control. Also absent: TP §10's intervention scheduling rules (the Influence budget, the 60-second notice, the three-modifier cap, category overlap), which the **core** must enforce before a UI can display them; showing them here without the core rejecting them would be the optimistic display this packet exists to prevent.
