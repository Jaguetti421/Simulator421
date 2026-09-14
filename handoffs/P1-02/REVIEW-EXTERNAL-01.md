# Independent review — P1-02 / candidate tag `test-build-01` (commit `199777f`)

**File:** `handoffs/P1-02/REVIEW-EXTERNAL-01.md` · **Date:** 14 September 2026

Reviewer / role / fresh-context declaration: Claude Fable 5.1, external reviewing agent. **This is a fresh-context review.** This session had no memory of authoring any file in this repository; I wrote the plans (Technical Plan v2.0, the web phases, the kit) and had never seen the code before cloning the tag. I read the developer's `handoffs/P1-02/REVIEW.md` only after forming the verdicts below.
Author / base / candidate: web-track developer; base as stated in `handoffs/P1-02/HANDOFF.md`; candidate = tag `test-build-01` → commit `199777f` (the request says `f42e343`, the last code commit; the tag is one documentation commit later — Low, recorded once in the summary).
Environment: Node 22.22.2, npm 10.9.7, git 2.43, Chromium via `npx playwright install chromium` (worked here), 1 CPU sandbox, software WebGL. Reproduced on the candidate before any packet review: `npm ci`; `npm run build` (ok); `npm run lint` (exit 0); `vitest run` **570 passed / 35 files** (36.7 s); `npm run test:tools` OK; `check:workboard` PASS (139 packets, 51 scenes); `playwright test` **17 passed**.

Files actually inspected and checks independently reproduced: `packages/sim/spatial/terrain.ts` (templates lines 157–171, compile 183–291, `hashArrays` 293–312, `buildManifest`), `terrain.test.ts` (15 tests ran, 5.3 s for the recompile test), constants (`WATER`, `CLIFF_STEP_MM`, `SPEED_MULTIPLIER_MILLI`).

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| Medium | **Regions are a fixed square tiling, not connectivity.** `region[i] = ((cx >> 7) + (cy >> 7) * 7) & 0xff` — 128-cell tiles. A tile can contain disconnected land, so anything built on "region" (P1-04's portals and its "hierarchical in the sense TP §5 asks for") certifies progress toward a **tile boundary**, not toward a reachable region | `terrain.ts:200` | Document regions as tiles now (RouteResult wording, handoffs). Before P3-05/P3-06, a packet computes regions by flood-fill over passable cells (size-capped) with portals as passable boundary cells |
| Medium | **Geometry hash is not canonical.** `hashArrays` combines per-array hashes with XOR — order-independent (swapping the contents of two same-length arrays hashes identically) — and hashes `heightMm` through a platform-endian byte view of the `Int32Array`. TP v2.0 §4 / CONVENTIONS require one hash over canonical little-endian serialization | `terrain.ts:301–310` | One running hash over a fixed-order, length-prefixed LE byte stream (explicit `DataView` writes for Int32). Do this before any geometry hash is recorded as a golden anywhere |
| Low | Classification (lines 205–232) runs **before** socket flattening (256–269) changes heights; cells around a flattened socket keep classes computed against stale heights | code order | Apply all height edits, then classify |
| Low | Socket flattening stamps a 3×3 `Ground` and can overwrite an `Obstacle` footprint if a socket is adjacent to an obstacle | `terrain.ts:266` vs 248 | Validate non-overlap at compile; fail the recipe rather than silently un-obstructing |
| Info | Noise amplitudes (2,400 mm over 64 cells; 300 over 8) cannot produce accidental cliffs at the 1,400 mm step — only the authored escarpment does. Speed multipliers max 1,000 (matters for P1-04) | constants | none |
| Design | The three templates are not islands (`basin` is a central lake with land at the corners; `ridge` drops into shallow water at the edges; `valley` is a north–south flooded trough: deep for ~34 cells either side of the axis, shallow to ~166, land to the escarpment at 250, plateau beyond). The GDD's premise is an island with a coast. See DESIGN-RULINGS-01 R1–R3; the water fraction the developer flagged is a consequence of the template shape, not of the water constants | `templateHeightMm` | Rulings, not engineering findings |

Acceptance criteria:
1. Render and simulation exports share one geometry hash: **PASS** (test ran; both exports derive from the same arrays) — with the Medium that the hash's *construction* must be made canonical.
2. Shallow water and impassable water match GDD speeds: **PASS** (0.8 multiplier → 2,800 mm/s walking; deep and cliff impassable; asserted at real compiled cells).
3. Known start, work and obstacle coordinates match query results: **PASS** (tests ran).

Verdict: **CHANGES_REQUESTED** (two Medium). The compiler is deterministic and the criteria hold; the hash construction and the meaning of "region" must be fixed before anything is built on them.

This is review of the returned candidate, not proof that later merged code passes. **No packet is marked ACCEPTED here; acceptance is Jani's.**
