# Handoff — P1-09 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `8b04c8e` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: hunger drain, ordinary recovery and starvation damage at the GDD's rates, multi-tick eating that consumes an item only on completion, and damage tagged at its source.

Changed files: `packages/sim/core/needs.ts` (new) — `tickNeeds`, `beginEating` / `continueEating`, `FOOD`, `PROTOTYPE8_FOOD`, `DamageEvent`; `packages/sim/core/index.ts`; `packages/sim/core/needs.test.ts` (14 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. GDD food rates and item nutrition match fixed-point vectors | `evidence/needs.txt`, `needs.test.ts` | **PASS** — start 85; after 1, 5 and 10 minutes: 79, 55, 25, exactly the GDD's 6/minute. Recovery stops below 25 and **not before** — the tenth minute lands on 25 with zero blocked ticks, the next tick blocks. Zero fullness costs 8 HP/minute; resting with food ≥ 25 recovers 3 HP/minute, and nothing if exposure is high, because the GDD gates on both. All rates go through the W0-02 rate primitive: one tick drains 0.01 points, which per-tick truncation would have lost entirely — an actor would never have got hungry at all |
| 2. Interrupted eating consumes no item | `evidence/needs.txt`, `needs.test.ts` | **PASS** — interrupted after 10 of a ration's 30 ticks: `Failed / Interrupted`, `itemConsumed: false`, **no state returned at all**, fullness still exactly 85. The item is consumed only by the `Finished` outcome, so there is nothing to undo — the same shape as an inventory transfer that never writes on failure. Eating never exceeds 100 fullness, and unknown food is refused without consuming anything |
| 3. Starvation damage remains distinct from hostile injury | `evidence/needs.txt`, `needs.test.ts` | **PASS** — every starvation event carries `source: "Starvation"` and `isSentientHarm: false`. That flag is not cosmetic: sanctuary and truce govern *sentient harm* (TP §10), so without it a protected actor would either be immortal inside a sanctuary or the law would look broken. Damage stops the tick the actor eats |

Commands executed: `npm run verify` → **0** (build, lint, **715/715** vitest across 45 files — 701 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Three notes.
1. **The whole-point reading truncates**, so 84.99 displays as 84. Deliberate: every GDD threshold is "below X", and a reading that rounded up would cross them a tick early. Stated in the test rather than left for someone to discover.
2. **Exposure is a parameter, not an assumption.** The GDD gates ordinary recovery on exposure < 60 and exposure does not exist yet. Taking it as an argument means the rule is implemented now and the caller supplies the truth later, rather than a TODO that quietly recovers people in a blizzard.
3. **The 14-minute figure is a consequence, not a constant**: 85 fullness at 6/minute runs out at 14 min 10 s, and the evidence shows damage beginning only after that. Nothing in the code encodes a survival time; it falls out of the two GDD rates.

Deferred and out of scope: fatigue, exposure and stamina (their rates are in the same GDD table and belong with the packets that own them), morale, the AI decisions that hunger is supposed to drive, cooking and spoilage, and any wiring into the tick kernel or into P1-07's inventory — `continueEating` names the item it consumed and leaves the actual removal to its caller, because the inventory is the other packet's to change.
