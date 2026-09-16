# Handoff — P1-10 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `5bb70c0` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: stamina and fatigue as two separate pools at the GDD's rates and thresholds, rest that ends at 25 or hands back its intent, and walking that nothing can take away.

Changed files: `packages/sim/core/exertion.ts` (new) — `tickExertion`, `tickRest`, `canSprint`, `canWalk`, `EXERTION`; `packages/sim/core/index.ts`; `packages/sim/core/exertion.test.ts` (13 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. Thresholds and rest endpoint match the GDD | `evidence/exertion.txt`, `exertion.test.ts` | **PASS** — sprinting costs 12 stamina a second (100 → 88), walking restores 6, and attacking or working restores nothing. Rest priority above 60, work interruption above 85, rest ends at exactly 25 — from 70 that is 2,250 ticks, 3 min 45 s at 12 a minute. The per-minute fatigue rate keeps its fraction: 2 a minute is a three-hundredth of a point per tick, which truncation would lose entirely |
| 2. Emergency interruption preserves remaining fatigue and stamina | `evidence/exertion.txt`, `exertion.test.ts` | **PASS** — an interrupted rest returns fatigue and stamina **byte-identical** to the tick before (68,000 and 100,000 milli) and hands back the full `RestIntent`, so the planner keeps "the reason and target" GDD §7 asks for. Resuming continues from exactly there, and an interruption does not end the rest early — the actor can go back to it |
| 3. No actor loses ordinary walking because sprint stamina is exhausted | `evidence/exertion.txt`, `exertion.test.ts` | **PASS** — at zero stamina `canSprint` is false and `canWalk()` is true. A sprint request is **downgraded to a walk**, not refused: the actor keeps moving, the caller is told `sprintDenied`, and because walking recovers, it is better off than it was. Ten seconds of walking restores enough to sprint again. Stamina never goes below zero however long the sprint |

Commands executed: `npm run verify` → **0** (build, lint, **800/800** vitest across 51 files — 787 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Three notes.
1. **Thresholds compare thousandths, not whole points.** My first version truncated first, which made "above 60" mean "at 61" and silently moved every rule in the GDD's table by a whole point. Two tests caught it — the rest ended 49 ticks early and the priority threshold never fired at 60.003 — and the comparison now happens before truncation. Truncation is for display.
2. **`canWalk()` returns a constant and exists anyway.** Criterion 3 is a claim about the system, and a reader should be able to find the line where it is made rather than infer it from the absence of a check.
3. **A denied sprint is a downgrade, not a refusal.** Refusing would leave an exhausted actor standing still, which reads as a frozen AI and is the exact failure the criterion is written against.

Deferred and out of scope: night preference for shelter and the rule that it "never orders every actor to sleep simultaneously" — that is a scheduling property across actors, and nothing schedules yet. Also absent: guard requests, shifts and relief (GDD D11's other four points), injury or carry weight affecting either pool, and the wiring that would make movement spend stamina — P1-05 moves actors and does not yet know this module exists. Joining them is P1-18's business.
