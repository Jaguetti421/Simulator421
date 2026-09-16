# Handoff — P1-29 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `bb66f5d` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: one pick resolver both input paths use, personal identity that survives a clan change, and a layout check that names what breaks at 150 %.

Changed files: `apps/web/src/view/selection.ts` (new) — `resolvePick`, `cycleSelection`, `changeClan` / `sameIndividual`, `checkLayout`, `stepFollow`; `apps/web/src/view/selection.test.ts` (17 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. Keyboard and pointer select the same intended entity | `selection.test.ts` | **PASS** — both paths run through `resolvePick`; the keyboard cycles in a stable order and then resolves at the actor's own position, so it cannot select something the pointer would not. Ties break by distance, then camera depth, then ID, and reversing the input list gives the same answer. Neither path can select an unselectable actor, and an empty pick says why. The pick radius scales with the interface |
| 2. Personal identity survives clan color changes | `selection.test.ts` | **PASS** — `changeClan` replaces the clan colour and nothing else; four consecutive clan changes leave `sameIndividual` true. `personalMarks` lists the five personal fields explicitly and excludes the clan colour, so a field added later must be classified as shared or personal rather than defaulting. Changing an accent, a headwear or the ID is correctly **not** the same individual |
| 3. Scaling to 150 percent preserves critical labels and controls | `selection.test.ts` | **PASS** — the seven named critical elements are present, unclipped and non-overlapping at 100 %, 125 % and 150 %. A missing element, a clipped one and an overlapping pair are each reported **by name** rather than as a single boolean, because a layout that fails should say which element and how |

Commands executed: `npm run verify` → **0** (build, lint, **923/923** vitest across 59 files — 906 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Three notes.
1. **The keyboard path calls the pointer path.** Cycling picks the next ID in order and then resolves *at that actor's screen position*, so the two cannot disagree about occlusion, radius or ties. Two independent implementations would drift, and the player would experience the drift as the game ignoring them.
2. **`personalMarks` is a whitelist, not a blacklist.** A new appearance field is absent from it until someone adds it, which means the failure mode is "a new mark is not protected" rather than "a new shared field silently became personal". Both are wrong; the first is visible in a test.
3. **The layout check reports three distinct failures.** I nearly returned a boolean. Naming the element and the kind of failure is the difference between a check that fixes a layout and a check that makes someone scale it again and hope.

Deferred and out of scope: this is the selection and layout **logic**; nothing renders it, and wiring it to the Three.js scene and to real DOM measurement belongs with the app packet that draws the inspection panel. Also absent: what an inspection panel is allowed to show — the information-isolation question of whether a player may see another clan's private knowledge is a design ruling I do not have, and P1-31's why-panel is where it has to be answered.
