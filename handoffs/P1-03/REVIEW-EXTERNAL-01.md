# Independent review — P1-03 / candidate tag `test-build-01` (commit `199777f`)

**File:** `handoffs/P1-03/REVIEW-EXTERNAL-01.md` · **Date:** 14 September 2026

Reviewer / role / fresh-context declaration: Claude Fable 5.1, external reviewing agent. **This is a fresh-context review.** This session had no memory of authoring any file in this repository; I wrote the plans (Technical Plan v2.0, the web phases, the kit) and had never seen the code before cloning the tag. I read the developer's `handoffs/P1-03/REVIEW.md` only after forming the verdicts below.
Author / base / candidate: web-track developer; base as stated in `handoffs/P1-03/HANDOFF.md`; candidate = tag `test-build-01` → commit `199777f` (the request says `f42e343`, the last code commit; the tag is one documentation commit later — Low, recorded once in the summary).
Environment: Node 22.22.2, npm 10.9.7, git 2.43, Chromium via `npx playwright install chromium` (worked here), 1 CPU sandbox, software WebGL. Reproduced on the candidate before any packet review: `npm ci`; `npm run build` (ok); `npm run lint` (exit 0); `vitest run` **570 passed / 35 files** (36.7 s); `npm run test:tools` OK; `check:workboard` PASS (139 packets, 51 scenes); `playwright test` **17 passed**.

Files actually inspected and checks independently reproduced: `packages/sim/spatial/visibility.ts` (`lineOfSight` lines 155–203, `visibleFrom` 235–256, bucket math 50–85), `visibility.test.ts` (18 tests ran, including symmetry across a blocking ridge and budget semantics).

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| Low | Ray sampling uses `Math.trunc(((to.c - from.c) * step) / steps)`; with the canonical direction `dx ≥ 0` but `dy` may be negative, so `trunc` rounds toward zero for negative `dy` and floors for positive — a mirror bias in which cells a ray samples. A↔B symmetry holds (same canonical pair), mirror symmetry (north-going vs south-going rays) does not | `visibility.ts:193–194` | Use `divFloor` (or `mulDiv`) for both axes |
| Low | `visibleFrom` spends the shared budget in broad-phase order (bucket order), not by distance, so the **nearest** candidates can be the ones returned as `BudgetExhausted` — the opposite of TP §7's urgent nearby-threat priority | `visibility.ts:244–252` | Sort candidates by squared distance before spending the shared budget |
| Low | Bucket index `Math.trunc(xMm / BUCKET_MM) | 0` is plain float division on a consequential path; safe at these magnitudes, contrary to the convention | `visibility.ts:50–51, 84–85` | `divFloor` |
| Medium (cross-packet) | The suite proves occlusion on `ridge`; the valley test asserts only that nothing occludes. The shipping template has never been under a positive sight test | `visibility.test.ts` "sees across the valley…" | Covered by DESIGN-RULINGS-01 R4 and the summary: valley fixtures for LOS at range limit, shallow crossings and coast |
| Info | Budget exhaustion is explicit and never visible; canonical direction gives symmetric results; static factors are terrain-only — all reproduced by the suite | tests | none |

Acceptance criteria:
1. Occlusion, distance and boundary cases match geometry fixtures: **PASS** (18/18; obstacle footprint reported as `Obstacle`; zero, at-range and one-mm-past cases).
2. Budget exhaustion explicit, never visible: **PASS**.
3. Static visibility is terrain-only: **PASS**.

Verdict: **ACCEPTABLE_FOR_INTEGRATION** (three Low; one Medium shared with P1-02/P1-04 about testing the shipping map).

This is review of the returned candidate, not proof that later merged code passes. **No packet is marked ACCEPTED here; acceptance is Jani's.**
