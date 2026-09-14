# Independent review — W0-09 / candidate tag `test-build-01` (commit `199777f`)

**File:** `handoffs/W0-09/REVIEW-EXTERNAL-01.md` · **Date:** 14 September 2026

Reviewer / role / fresh-context declaration: Claude Fable 5.1, external reviewing agent. **This is a fresh-context review.** This session had no memory of authoring any file in this repository; I wrote the plans (Technical Plan v2.0, the web phases, the kit) and had never seen the code before cloning the tag. I read the developer's `handoffs/W0-09/REVIEW.md` only after forming the verdicts below.
Author / base / candidate: web-track developer; base as stated in `handoffs/W0-09/HANDOFF.md`; candidate = tag `test-build-01` → commit `199777f` (the request says `f42e343`, the last code commit; the tag is one documentation commit later — Low, recorded once in the summary).
Environment: Node 22.22.2, npm 10.9.7, git 2.43, Chromium via `npx playwright install chromium` (worked here), 1 CPU sandbox, software WebGL. Reproduced on the candidate before any packet review: `npm ci`; `npm run build` (ok); `npm run lint` (exit 0); `vitest run` **570 passed / 35 files** (36.7 s); `npm run test:tools` OK; `check:workboard` PASS (139 packets, 51 scenes); `playwright test` **17 passed**.

Files actually inspected and checks independently reproduced: `clanlab render --fixture contracts/examples/SAVE-BOOTSTRAP-01.json --tick 300 --out /tmp/labout/render.png` (PNG 194,544 bytes, `pngSha256 0d1ec7ee…`, 136 actors, one law circle; readability: nameplates 136 / overlapping 29 / ratio 0.2132 < 0.35; ring contrast min 6.24 > 3; 12 distinct action icons; `thresholdStatus: TUNE`); **I viewed the PNG**; `packages/lab/render/*` (sampled).

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| Medium | The readability checks are evaluated at whole-island scale: 800 m into 900 px ≈ 1.1 px per metre. Actor discs are ~8 px; nameplates are legible only because they are drawn at a fixed screen size. Overlap and contrast thresholds therefore measure a view the player never sees (the GDD camera is a 45° tabletop at 60 m default, with a close-follow preset) | my render; `clanlab render` has no viewport/extent option | Parameterize the render by viewport (centre + extent in metres) and run the PRESENT-READ fixtures at the two GDD camera presets; keep the island-scale render as the overview map, not as readability evidence |
| Low | Terrain classes render as `unavailable` ("no map compiler exists yet") although P1-02 now compiles terrain; the two DEBT passes did not wire it | render summary `scene.terrain.status` | Wire compiled classes into the 2D render (one small packet); until then the readability picture has no ground truth behind the discs |
| Info | Render is pure over the snapshot (same bytes twice) — the handoff's claim; consistent with my single run's determinism note | handoff `sha256 6229a6b8…` twice | none |

Acceptance criteria:
1. `clanlab render` produces a PNG with metadata for the synthetic workload: **PASS** (produced here; summary carries fixture, tick, build/contract digests, png sha).
2. Readability assertions exist and run, thresholds TUNE: **PASS** as stated — but see Medium: they run at the wrong scale to mean anything for the game.
3. Renderer is pure over the snapshot: **PASS** (handoff evidence; consistent with the deterministic pipeline; not re-run twice by me).

Verdict: **ACCEPTABLE_FOR_INTEGRATION**, with the Medium to be fixed before PRESENT 01 is claimed at G1.

This is review of the returned candidate, not proof that later merged code passes. **No packet is marked ACCEPTED here; acceptance is Jani's.**
