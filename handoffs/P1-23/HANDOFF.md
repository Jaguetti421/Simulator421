# Handoff — P1-23 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `da32604` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: all of a tick's damage resolved at once against start-of-tick health, lethal ordinary damage downing rather than eliminating, and one fixed order for revives, damage and bleed-out.

Changed files: `packages/sim/core/health.ts` (new) — `resolveTick`, `tickBleedOut`, `applyRevives`, `healthTick`; `packages/sim/core/index.ts`; `packages/sim/core/health.test.ts` (16 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. Entity iteration order does not alter health results | `evidence/health.txt`, `health.test.ts` | **PASS** — three hits across two targets, presented forward, reversed and shuffled, produce identical health **and identical transition lists**. A mutual kill downs both rather than letting whoever ran first survive. Damage is summed against the health each target had at the **start** of the tick, so two 20-point blows on 30 health are one downing, not an intermediate state someone could read |
| 2. Multiple same-tick hits down a standing target once, without also eliminating it | `evidence/health.txt`, `health.test.ts` | **PASS** — three simultaneous killing blows produce **one** `Downed` transition and start the GDD's 30-second bleed-out. 900,000 points of overkill still downs rather than eliminates. A downed target is eliminated by further damage **only where the laws permit it**, and terminal damage bypasses the downed state entirely, per GDD §9.2's minute-58 rule |
| 3. Eligible aid completion and later damage use the agreed boundary semantics | `evidence/health.txt`, `health.test.ts` | **PASS** — a revive completes after exactly six seconds and takes effect **before** the same tick's damage: revived to 25 and hit for 10 leaves the actor standing at 15. Lethal same-tick damage downs the just-revived actor again, with both transitions recorded in order. `healthTick` runs revives → damage → bleed-out for every caller, and a test presenting the same inputs in two orders gets identical results |

Commands executed: `npm run verify` → **0** (build, lint, **860/860** vitest across 55 files — 844 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Three notes.
1. **Order independence is enforced by collecting first.** Hits are grouped by target, targets are walked in ID order and each target's hits summed before anything is written. Nothing observes a half-updated world, so there is no iteration order that could matter.
2. **Revive-before-damage is a choice, and I have written down why.** Damage first means a rescuer who arrived in time watches the revive land on a corpse. Either order is defensible; what is not defensible is leaving it to whichever system happens to run first, so `healthTick` fixes it in one place.
3. **A paused bleed-out moves its end tick forward** rather than counting down slowly. That makes "expiration resumes the remaining paused timer, without accumulating missed damage" exact: fifty covered ticks move the deadline by exactly fifty, and the test asserts the number rather than the direction.

Deferred and out of scope: nothing creates the hits — P1-22 produces a `Hit` result and the join belongs in the tick's transaction stage. Also absent: the wound penalty a revived contestant carries, bandage consumption and the interruptible revive **action** (this exposes the timing; P1-24 owns the rest), armour and damage types, the terminal pulse schedule from minute 58, and elimination cleanup — that is P1-24 by name.
