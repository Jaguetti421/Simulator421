# Handoff — P1-18 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `9c2e8f4` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: the first end-to-end actor loop — a need becomes a scored goal, a goal becomes a plan, a plan becomes walking and eating, and every plan ends.

Changed files: `packages/sim/core/tasks.ts` (new) — `candidatesFor`, `planFor`, `stepAgent`, `straightLineMover`; `packages/sim/core/index.ts`; `packages/sim/core/tasks.test.ts` (16 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. Hungry actor gathers and eats reachable food without unrelated detours | `evidence/tasks.txt`, `tasks.test.ts` | **PASS** — the trace reads plan → reserve → walk → pick up → eat → completed, fullness 30 → 35, in 21 ticks. Two decoy sources exist and the actor visits neither: a test walks **every position on its path** requiring it never strays toward the decoy or past the near bush, and a second requires the remaining distance to **never increase on any tick**. The plan contains exactly `Reserve, GoTo, PickUp, Eat` against one source and nothing else |
| 2. Missing or reserved source yields an alternative or exploration | `evidence/tasks.txt`, `tasks.test.ts` | **PASS** — with the nearest bush reserved by C009 the plan targets the next one by distance; with every source reserved it produces `goal.explore` with the reason "every known food source is reserved by someone else"; with nothing known, "no food is known". A source taken **between planning and arriving** fails with `SourceGone` quoting the lease, and the actor is free to plan again next tick holding nothing |
| 3. Plans finish or report a meaningful failure; no generic idle loop | `evidence/tasks.txt`, `tasks.test.ts` | **PASS** — four worlds (food nearby, nothing known, starving, not hungry) all terminate in `Completed` or `Failed`; none runs out of ticks. A failure always carries a typed reason and a sentence. An actor that cannot move fails with `NoRouteToTarget`; one that can move but never arrives is abandoned at the plan budget with `BudgetExhausted` rather than walking forever. Fullness keeps falling during a long walk, so the world does not pause for the plan |

Commands executed: `npm run verify` → **0** (build, lint, **816/816** vitest across 52 files — 800 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Four notes.
1. **There is no idle branch.** Every path through `stepAgent` returns Planning, Running, Completed or Failed; "nothing is wanted" is a **Completed** state rather than an idle one, and exploring is a plan that ends rather than a place to park an actor. That is the shape criterion 3 asks for, and it is why an unexplained standstill cannot occur here — it has nowhere to live.
2. **Reservation happens before walking, not on arrival.** Planning to a bush and discovering on arrival that someone took it is the same wasted trip a player would call stupid. Reserving first turns the race into a plan-time decision, and the mid-flight loss is still handled by re-planning rather than waiting.
3. **`exactOptionalPropertyTypes` caught a real sloppiness.** Clearing a plan with `plan: undefined` is not the same as not having a plan, and a saved agent should not carry a key whose value is nothing. There is now one `withoutPlan` helper instead of five spellings of it.
4. **`moveToward` is injected, not imported.** The agent does not hold terrain; a caller supplies a stepper. That keeps this module free of the world and lets the tests construct "cannot move" and "never arrives" as ordinary inputs rather than as elaborate fakes.

Deferred and out of scope: `moveToward` is a straight line in the tests — joining it to P1-04 routing and P1-05 swept movement is real work and belongs where terrain enters. The actor's knowledge is supplied rather than perceived, so P1-15 is not yet wired in. Inventory is a local count rather than P1-07's `Inventory`, and actions run inside this loop rather than through P1-17's executor: both joins are the tick's transaction stage, not this packet's. Rest is planned and executed but its fatigue path is not yet driven by movement cost.
