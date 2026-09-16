# Handoff — P1-25 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `5c20d28` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: a threat fallback that interrupts inside TP §6's bound and bypasses the switching delay, and a prototype wildlife policy that reads only the animal and what it perceives.

Changed files: `packages/sim/core/wildlife.ts` (new) — `threatFallback`, `speciesPolicy`, `denPlacementValid`, `prototypePopulation`, `WILDLIFE`; `packages/sim/core/index.ts`; `packages/sim/core/wildlife.test.ts` (15 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. Observed stronger threat interrupts work within five ticks | `evidence/wildlife.txt`, `wildlife.test.ts` | **PASS** — a wolf sighted at tick 100 and decided at 103 reports a latency of 3 against the bound of 5. The candidate is marked `emergency`, and an end-to-end test through P1-16 shows it winning **mid switching delay** with `trigger: "Emergency"` rather than being held. A threat that does not outweigh the current task does not interrupt, and one decided late is **reported as out of bound** rather than passing quietly |
| 2. Wildlife remains dangerous during sentient Truce | `evidence/wildlife.txt`, `wildlife.test.ts` | **PASS** — under a global truce, a wolf's bite applies and a contestant's blow does not, in the same tick against the same target. The policy keeps hunting because it has **no permission input at all**: a law has nowhere to arrive, so it cannot pacify wildlife by accident. Population is the GDD's: 12 wolves in 4 packs of 3, 24 deer, 45 m leash, 35 m den clearance from starts and camps |
| 3. The species policy never reads the observer selection or hidden target state | `evidence/wildlife.txt`, `wildlife.test.ts` | **PASS, structurally** — `speciesPolicy` takes two arguments, the animal and a closed `AnimalPerception` whose four fields are asserted by name. There is no field for a selection, a camera or a target's hidden state. Swapping which actor is nearest changes only which ID is hunted, never the decision; a wolf past its leash goes home **with prey a metre away**, because the leash is checked before the prey |

Commands executed: `npm run verify` → **0** (build, lint, **892/892** vitest across 57 files — 877 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Three notes.
1. **Criterion 3 is about what the function cannot see**, so the test asserts the arity and the exact field names of the perception record. A wolf that hunts the selected actor is a wolf the player can feel watching them, and no tuning fixes that afterwards — the only real defence is having no such input.
2. **The leash is checked before the prey.** Reversing them would produce a wolf that chases to the edge of the map and then turns round, which is the endless chase the GDD explicitly rules out. The test puts prey one metre in front of a strayed wolf and requires it to go home.
3. **Wildlife's immunity to truce is an absence, not a rule.** `speciesPolicy` has no permission parameter, so there is no code path where a law could reach it. That is the same shape as P1-13's `isSentientHarm` split, and it means the two cannot drift apart.

Deferred and out of scope: nothing moves the animals — the policy says what to do and P1-05's movement is not wired to it. Also absent: pack coordination beyond counting nearby mates, den and animal placement on the compiled map (`denPlacementValid` validates a proposal, nothing generates one), deer as a hunting **resource**, Fog displacement, and the wildlife side of combat — a wolf's bite is a `DamageEvent` a caller constructs, not something this module swings.
