# Handoff — P1-11 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `4ef6b65` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: the published day/night schedule, exposure from night and cold fronts, and a hard separation between visual light and mechanical fact.

Changed files: `packages/sim/core/daynight.ts` (new) — `clockAt`, `visualLightMilli`, `mechanicalSightMilli`, `exposureTick`, `NIGHT_INTERVALS`; `packages/sim/core/index.ts`; `packages/sim/core/daynight.test.ts` (15 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. Night boundaries and twilight authority match TIME 01 | `evidence/daynight.txt`, `daynight.test.ts` | **PASS** — the five published intervals are reproduced exactly, and a test checks **all four edges of all five** (minute before, first minute, last minute, minute after). Mechanical night starts at the published tick: `t4799` is day, `t4800` is night, and the sight multiplier steps there rather than easing into it |
| 2. Ordinary four-minute night and two-minute cold overlap match exposure vectors | `evidence/daynight.txt`, `daynight.test.ts` | **PASS** — four minutes of night outdoors gives 36 exposure at 9 a minute; the same night with a two-minute cold front gives 60, which is two minutes at 21 plus two at 9. Ten minutes sheltered returns it to exactly 0, never below. A cold front during **daylight** still costs exposure, because cold is not night |
| 3. Visual light settings cannot change exposure or illumination facts | `evidence/daynight.txt`, `daynight.test.ts` | **PASS, structurally** — the mechanical functions take a tick (and shelter and cold fronts) and **have no light parameter to receive one through**; a test pins their arity so adding one stops compiling. At mid-twilight the visual light has already fallen below daylight while `exposureTick` still reports day and gains nothing, and `mechanicalSightMilli` still reads 1,000 |

Commands executed: `npm run verify` → **0** (build, lint, **831/831** vitest across 53 files — 816 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Three notes.
1. **Two functions, not one with a flag.** `visualLightMilli` blends; `mechanicalSightMilli` steps. A single function with a "use twilight" argument would make criterion 3 a matter of every caller passing the right value, which is exactly how a lighting change ends up moving a sight range.
2. **The boundary test checks all four edges of all five intervals**, not one boundary. An off-by-one that only appears on day 3 is the kind of thing a single spot-check misses, and the GDD lists the intervals explicitly so there is no excuse for checking one.
3. **`exposureTick` refuses to grow a light parameter** and I want that recorded as the reason for the odd-looking arity test: it is the only way to state "a visual setting cannot reach this" in a way that fails when someone breaks it.

Deferred and out of scope: exposure does not yet feed P1-09's recovery gate — `tickNeeds` takes `exposureBelow60` as a parameter and nothing passes this module's answer to it; joining them belongs where an actor's tick is composed. Also absent: cold-front scheduling (fronts are supplied, nothing creates them), shelter quality, fire warmth, clothing, and the night preference for shelter that GDD §7 mentions — that is a scheduling property across actors, not a per-actor rate.
