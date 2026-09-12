# Handoff — P1-03 / attempt 1

Status: **READY_FOR_REVIEW**.
Base ID / Git commit / contract / content: base `5d0e45e` (P1-02 ACCEPTED) → `27e9575`. Contract v0, 23 records, digest unchanged — this packet adds no contract. Geometry manifest v1 (P1-02), consumed unchanged.
Goal and implemented behavior: the broad-phase spatial index and exact height-field line of sight over the compiled terrain, with an explicit query budget.

Changed files and purpose:
- `packages/sim/spatial/visibility.ts` (new) — `SpatialHash` (uniform 16 m buckets, rebuilt per tick, no history), `lineOfSight` (integer DDA over the coarse grid), `staticVisibility` (terrain factors only), and `visibleFrom` (broad phase then exact, under one shared budget).
- `packages/sim/spatial/index.ts` — export.
- `packages/sim/spatial/visibility.test.ts` (new, 18 tests).

| Acceptance criterion | Evidence path | Executed result |
| --- | --- | --- |
| 1. Occlusion, distance and boundary cases match geometry fixtures | `evidence/line-of-sight.txt`, `visibility.test.ts` | **PASS** — open ground at 8 m Visible; a declared obstacle blocks with `reason: "Obstacle"` at cell (298,300), which is an `Obstacle` cell in the compiled traversal array; a ridge blocks with `reason: "Terrain"` at (227,400); beyond range returns `OutOfRange` with zero work done; boundary cases covered — zero distance, exactly at range, one millimetre past it, and the envelope edges in the broad phase |
| 2. A budget exhaustion result is explicit and never means visible by default | `evidence/line-of-sight.txt`, `visibility.test.ts` "budget exhaustion" | **PASS** — a 10-cell budget on a 100-cell line returns `BudgetExhausted` with `{allowedCells: 10, neededCells: 100}` and `visible: false`. A test asserts no status other than `Visible` ever carries `visible: true`. In the two-phase query, an exhausted candidate stays **in** the results as `BudgetExhausted` rather than being dropped — a dropped candidate would look exactly like an empty world |
| 3. Static visibility means height/openness/cover, not hidden precomputed actor knowledge | `visibility.test.ts` "static visibility is terrain only" | **PASS** — `staticVisibility` returns height, cover and openness and names those three inputs, which a test asserts has not grown. The sight query takes terrain and two positions; there is no parameter through which an actor ID, belief or knowledge view could arrive, and the module holds no per-actor state between calls. The result object's keys are asserted exactly, so a future field cannot smuggle one in |

Commands actually executed: `npm run verify` → **0** (build, lint, **542/542** vitest across 33 files — 524 at the packet baseline; 6 python; workboard PASS).

Pre-existing baseline failures: none.

Design decisions within scope:
1. **Sight is symmetric by construction.** My first implementation traced from observer to target, and A→B disagreed with B→A on a marginal cell because the interpolation rounds by direction. The query now orders the endpoints canonically and traces the identical cell sequence either way. A build that shipped the asymmetry would have surfaced it as "he can see me but I cannot see him", which is exactly the kind of bug that gets blamed on the AI.
2. **Budget exhaustion is a status, not a silence.** It is reported with what the query would have needed, it is never `visible`, and exhausted candidates remain in the result set.
3. **The broad phase is deliberately generous and deterministic** — a superset sorted by ID, so two runs order candidates identically and the exact query decides.
4. **Integer distance.** Lint caught `Math.sqrt` on the consequential path; it now uses `isqrt`. The rule did its job.
5. **The valley cannot occlude, and the test says so.** I scanned the compiled valley for a terrain-blocked pair and found none — its height rises monotonically outward from the floor, so nothing in it blocks a sight line. The occlusion test therefore uses the `ridge` template, with a comment explaining why, and a second test records that the valley crossing *is* visible. Writing a "blocked" test against a world that cannot block would have been a test that passed for the wrong reason.

Contract proposals or deferred work outside scope:
- **`INFO-ISOLATION` is named in the fixture registry, and fixture DSL v1 cannot express it.** Its assertion kinds are `EventCount*`, four registered `Invariant` names (none about information isolation) and `HashEqualVariant`. Rather than author a fixture whose assertions do not say what the fixture is named for, criterion 3 is proven by the tests above. **This is the third packet to hit the same gap** (W0-09 readability, P1-01's reason matching, now this): the DSL needs an assertion kind for module-boundary and presentation claims, and that is a lab packet someone should schedule.
- TP §6's perception detail — field of view, hearing, light, sleep modifiers, the belief-field table, the 0.5 s threat-interrupt bound — is **not** here. This packet ships geometry-derived sight only.
- Concealment from cover is compiled and exposed but does not yet modify a sight result; the modifier belongs with the perception packet that defines its curve.

Remaining risks, reproduction and exact next action:
- `EYE_HEIGHT_MM`, `OBSTACLE_HEIGHT_MM` and the default budget are **TUNE**. Eye height in particular decides how much small terrain is seen over, and no playtest has looked at it.
- The exact query walks the coarse 1 m grid; the 0.25 m fine cells are not consulted for sight. That is correct for now (fine geometry validates clearance and motion, per TP §5) but a thin obstacle narrower than a metre would not block sight.
- Reproduce: `npm run verify`, then the script whose output is `evidence/line-of-sight.txt`.
- Next action: review, then the next ready P1 packet.

Source archive/patch and RETURN_MANIFEST.json: not applicable — GitHub is canonical; the work is pushed to `main`.

Reviewer request: reproduce the acceptance evidence against the returned files and record findings in REVIEW.md.
