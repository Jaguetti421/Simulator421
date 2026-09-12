# Handoff — P1-02 / attempt 1

Status: **READY_FOR_REVIEW**.
Base ID / Git commit / contract / content: base `0d4c6f1` (P1-01 ACCEPTED) → `7f938be`. Contract v0, 23 records, digest `sha256:3fe2ced1…` (unchanged by this packet — no contract was added or edited). Geometry manifest version 1.
Goal and implemented behavior: compile the valley height field, traversal classes, camp fine cells and canonical geometry, with one manifest and one hash that the render export and the simulation both read.

Changed files and purpose:
- `packages/sim/spatial/terrain.ts` (new) — the compiler: integer value-noise height field over an 800 × 800 one-metre grid (640,000 cells), traversal classification from compiled height and slope, authoritative obstacle footprints, sparse 0.25 m detail around sockets, the geometry manifest and its hash, and the query surface (`classAt`, `heightAt`, `isPassable`, `walkSpeedMmPerSecond`, `fineClearance`).
- `packages/sim/spatial/index.ts` (new), `packages/sim/index.ts` — the `spatial` namespace.
- `packages/sim/spatial/terrain.test.ts` (new, 15 tests).

| Acceptance criterion | Evidence path | Executed result |
| --- | --- | --- |
| 1. Render and simulation exports share one geometry hash | `evidence/geometry.txt`, `terrain.test.ts` "one geometry, one hash" | **PASS** — `exportForRender()` and `exportForSimulation()` both report `b0a3a4eb` for seed 4107, and a test asserts the render export hands back the *same array objects* the simulation queries rather than copies. Recompiling the same recipe reproduces the hash; seed 4108 gives `257050da`; adding one more detailed socket changes it, so fine geometry is inside the hash and not only the coarse grid |
| 2. Shallow water and impassable water match GDD speeds | `evidence/geometry.txt`, `terrain.test.ts` "water and speeds match the GDD" | **PASS** — shallow water is the GDD's 0.8 multiplier: 3,500 → **2,800 mm/s** walking and 5,000 → **4,000 mm/s** sprinting, measured at a real compiled shallow cell. Deep water and cliffs return 0 and are impassable. A sampling test re-derives the classification from the compiled heights, so the class cannot drift from the height field that produced it |
| 3. Known start, work and obstacle coordinates match query results | `evidence/geometry.txt`, `terrain.test.ts` "known coordinates match query results" | **PASS** — both starts and the work socket query as `Ground`, passable, 3,500 mm/s; the declared boulder queries as `Obstacle` and impassable at its own coordinates and walkable again 6 m away; the manifest returns the sockets with coordinates unchanged; 0.25 m detail exists around sockets and nowhere else |

Commands actually executed: `npm run verify` → **0** (build, lint, **524/524** vitest across 32 files — 509 at the packet baseline; 6 python; workboard PASS). A full compile takes **~3.0 s** on this sandbox's single CPU — a diagnostic, not a budget.

Pre-existing baseline failures: none.

Design decisions within scope:
1. **No floating point in the output.** The height field is integer value noise — a hashed lattice with integer interpolation — so a compile is bit-identical anywhere, which is what makes "quantize all generated geometry before the run begins" (TP §5) checkable rather than aspirational.
2. **One array, two consumers.** The render export returns the same `Int32Array` and `Uint8Array` the queries read, and quotes the manifest's hash rather than computing a second one. Two hashes computed two ways would eventually disagree, and the disagreement would be discovered in a screenshot.
3. **The valley template has an authored escarpment.** My first compile produced **zero** `Cliff` cells: the noise is too smooth for a 1.4 m step and the template slope is 9 mm per cell. A traversal class with no instances is a class nothing is testing, so the rim is now authored rather than hoped for from noise, and a test asserts every class has instances.
4. **Obstacles are authoritative, decoration is absent.** Only declared obstacle sockets write footprints, matching TP §5: "A tree that blocks sight or movement must have an authoritative footprint." Nothing decorative exists here to be confused with one.
5. **Sockets are flattened onto ground.** A start or work position compiled into water or onto a cliff would be rejected by TP §5's accessibility validators anyway; doing it at compile time keeps the failure out of the run.

Contract proposals or deferred work outside scope — this packet compiles terrain and fine cells only. TP §5's ordered pipeline continues with **walkability validation, camp sockets, resources, spawn neighbourhoods, knowledge distribution and phase-escape validation**, and none of those are here. Specifically not done, and not implied by any evidence above:
- D05 strategic anchor route-time checks (240–360 s island crossing), food within 45 walking seconds, camp within 90 seconds, six-minute opening supply, separated advanced sources.
- Seed rejection and bounded retry: a compile currently always succeeds. Nothing validates that a seed is *playable*.
- The coarse route graph and the fine-motion validator that consume this geometry (P1-03 onward).

Remaining risks, reproduction and exact next action:
- `CLIFF_STEP_MM`, `WATER.deepMm` and the escarpment height are **TUNE**: they come from making the classes occur sensibly on this template, not from a playtest. The ratio of ground to water (417k / 149k / 71k cells) is a consequence of those constants and has had no design review.
- A 3-second compile is fine for a test and would not be fine on a loading screen at higher resolution; that is a P3 performance question, not evidence of one now.
- Reproduce: `npm run verify`, then the script in `evidence/geometry.txt`'s header.
- Next action: review, then P1-03 (spatial index and line of sight), which is the first consumer of this manifest.

Source archive/patch and RETURN_MANIFEST.json: not applicable — GitHub is canonical; the work is pushed to `main`.

Reviewer request: reproduce the acceptance evidence against the returned files and record findings in REVIEW.md.
