# Handoff — P1-05 / attempt 1

Status: **READY_FOR_REVIEW**.
Base: `b4b161a` (P1-04 ACCEPTED) → this commit. Contract v0, 24 records, digest unchanged — no contract touched.
Goal and implemented behavior: kinematic movement with a swept obstacle test and saved remainders.

Changed files: `packages/sim/spatial/movement.ts` (new) — `movementRate`, `stepMovement`, `movementDigest`, `movementAt`; `packages/sim/spatial/index.ts`; `packages/sim/spatial/movement.test.ts` (10 tests); `tests/kernel/movement-parity.test.ts` (2 tests).

| Acceptance criterion | Evidence path | Executed result |
| --- | --- | --- |
| 1. No teleport, corner cutting or obstacle tunnelling occurs | `evidence/movement.txt`, `movement.test.ts` | **PASS** — per-tick displacement is checked against the budget the rate released, every tick, rather than assumed. The sweep stops on the near side of a declared obstacle (x=416,950 at walking pace). **Tunnelling is tested at 3.5, 20 and 120 m/s** — at 120 m/s an actor covers twelve cells in one tick, and it still stops at the same cell. A diagonal between two obstacles meeting at a corner is refused with `CornerCut`, and the actor does not end up in the cell beyond |
| 2. Speed and carry/shallow multipliers use saved remainders | `evidence/movement.txt`, `movement.test.ts` | **PASS** — the rate's numerator is `speed × terrain × carry` over `tickHz × 1000 × 1000`, so nothing divides until the W0-02 rate primitive does it and keeps the remainder. Ten ticks at 0.93 carry on ground travel **3,255 mm** with remainder 0; truncating each tick would have lost 5 mm. Shallow water at 0.8 gives exactly 280 mm/tick, ground 350 |
| 3. Headless and rendered inputs produce identical movement hashes | `tests/kernel/movement-parity.test.ts` | **PASS** — the same movement runs twice, once headless and once with a scene built from a real snapshot and its readability assessed **after every tick**, and the digests match. Asserting "rendering is not an input" from inside the movement code would be circular; this is the test that would catch it if it ever became one |

Commands executed: `npm run verify` → **0** (build, lint, **639/639** vitest across 39 files — 627 at the packet baseline; 6 python; workboard PASS).

Design decisions within scope:
1. **The sweep is bounded by geometry, not by speed.** Sub-steps are capped at a quarter cell, and the number of sub-steps grows with the distance, so no speed can skip a one-cell obstacle. The alternative — a single displacement test per tick — is correct at walking pace and silently wrong the first time something is fast.
2. **Corner cutting is its own refusal**, reported as `CornerCut` rather than as terrain. An actor slipping diagonally between two blocked cells is a distinct bug with a distinct cause, and a player sees it as walking through a wall.
3. **Nothing divides before the rate primitive does.** Multiplying speed by two thousandths-multipliers and handing the whole thing to `advance` is what keeps 260.4 mm/tick exact over ten ticks. Rounding at any earlier step would lose the fraction and no test of a single tick would notice.
4. **The digest covers positions and remainders**, not positions alone: two runs can agree on where an actor is and disagree about what it has banked, and the second divergence surfaces a tick later.

Contract proposals or deferred work outside scope: movement is not yet wired into the tick kernel's stage 5 — the kernel still runs its synthetic drift. Connecting them is the packet that gives actors somewhere to go. No collision between actors (they pass through each other), no push-out from an overlapping start, and no fine-cell (0.25 m) clearance in the sweep — it tests the coarse grid, so a sub-metre gap is not yet modelled.

Remaining risks and next action: `ACTOR_RADIUS_MM` is declared and used only as documentation — the sweep tests cell occupancy, not the actor's circle, so an actor can stand with its radius overlapping a blocked cell's edge. That is honest for the coarse grid and wrong for doorways; the fine-cell sweep is where it gets fixed. Reproduce with `npm run verify` and the script in `evidence/movement.txt`.

Reviewer request: reproduce the acceptance evidence and record findings in REVIEW.md.
