# Independent review — P1-04 / candidate tag `test-build-01` (commit `199777f`)

**File:** `handoffs/P1-04/REVIEW-EXTERNAL-01.md` · **Date:** 14 September 2026

Reviewer / role / fresh-context declaration: Claude Fable 5.1, external reviewing agent. **This is a fresh-context review.** This session had no memory of authoring any file in this repository; I wrote the plans (Technical Plan v2.0, the web phases, the kit) and had never seen the code before cloning the tag. I read the developer's `handoffs/P1-04/REVIEW.md` only after forming the verdicts below.
Author / base / candidate: web-track developer; base as stated in `handoffs/P1-04/HANDOFF.md`; candidate = tag `test-build-01` → commit `199777f` (the request says `f42e343`, the last code commit; the tag is one documentation commit later — Low, recorded once in the summary).
Environment: Node 22.22.2, npm 10.9.7, git 2.43, Chromium via `npx playwright install chromium` (worked here), 1 CPU sandbox, software WebGL. Reproduced on the candidate before any packet review: `npm ci`; `npm run build` (ok); `npm run lint` (exit 0); `vitest run` **570 passed / 35 files** (36.7 s); `npm run test:tools` OK; `check:workboard` PASS (139 packets, 51 scenes); `playwright test` **17 passed**.

Files actually inspected and checks independently reproduced: `packages/sim/spatial/route.ts` (full A* core lines 108–232, `RouteProgress` 236–282), `route.test.ts` (13 tests ran), `handoffs/P1-04/evidence/routes.txt`, `terrain.ts` speed table (for admissibility).

**Admissibility (the developer's suspicion 9): confirmed correct, on two facts I verified.** Neighbours are 4-connected (`route.ts:185–190`), so the actual cost of any path is ≥ Manhattan distance × minimum step cost; the minimum step cost is 1,000 per cell because the largest speed multiplier is 1,000 (`terrain.ts:52–58`; shallow water is 1,250 per cell). The heuristic `isqrt(dx²+dy²) × 1000` is Euclidean, which is ≤ Manhattan, and `isqrt` floors — so `h` never over-estimates. Consistency: for any edge, `|h(n) − h(n′)| ≤ 1000 ≤ c(n, n′)`. Both facts are implicit, not asserted — see M1.

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| Medium | Admissibility depends on `max(SPEED_MULTIPLIER_MILLI) ≤ 1000` and on 4-connectivity, neither of which is asserted or commented at the heuristic. A future `Road` class at 1,200 or a diagonal neighbour would silently make `h` inadmissible and routes plausibly wrong | `route.ts:117–121` | A compile-time/test assertion that no traversal class exceeds 1,000 and a comment at `heuristicMilli` stating both preconditions; if diagonals are ever added, diagonal cost = 1,415 or an octile heuristic |
| Medium | Consequential arithmetic outside `checkedMath`: `Math.trunc(1_000_000 / multiplier)` (114), `tentative = g + step` (199) on plain numbers, `dx*dx + dy*dy` before `asInt` (120). Numerically safe at these magnitudes; contrary to AGENTS.md/CONVENTIONS ("all consequential arithmetic goes through checkedMath") | code | Type `g`/`f`/costs as `Int` and use `add`/`divFloor`, or record a documented exemption for bounded search internals. The ESLint rule delivered with REVIEW-EXTERNAL-01-PRELIMINARY would flag these once typed |
| Medium | "Hierarchical in the sense TP §5 asks for" (HANDOFF design decision) rests on P1-02's regions, which are 128-cell **tiles**. A portal is an observed cell on a tile boundary closest to the goal by straight-line distance — it may not be on any path to the goal. `Partial` therefore certifies "I can reach this observed cell", which is true and useful, not "progress toward the goal's region" | `route.ts:206–209`; `terrain.ts:200` | Reword the claim and the `portal.regionFrom/regionTo` documentation; real regions before P3 (P1-02 Medium) |
| Low | `expanded > budget` breaks after incrementing, so a budget of 3 reports `expanded 4` ("4 of 3") | `route.ts:180–181`, evidence | Check the budget before counting, or report `budget` as the ceiling and `expanded` as closed nodes |
| Low | `regions` are read from the **true** terrain (static topology), not from knowledge; fine (public static topology, as TP v1.1 §5 allows), but the handoff's "there is no path from the search to an unobserved cell" should say "…to unobserved *traversability*; region IDs are public" | `route.ts:139` | Wording |
| Low | `open.sort` per pop is O(n log n); author-noted; heap when profiled | `route.ts:171` | none now |

Acceptance criteria:
1. Concealed-route changes cannot change a route before observation: **PASS** (test ran; search reads `RouteKnowledge`; the non-vacuity companion test ran).
2. Complete / Partial / BudgetExhausted / NoKnownRoute stay distinct: **PASS** (13/13; evidence consistent).
3. Repeated partials advance or trigger bounded recovery: **PASS** (`PORTAL_REPEAT_LIMIT` abandonment and `GaveUp` reproduced by the suite).

Verdict: **ACCEPTABLE_FOR_INTEGRATION** with three Medium corrections that should land before any packet depends on routes (P1-14 onward).

This is review of the returned candidate, not proof that later merged code passes. **No packet is marked ACCEPTED here; acceptance is Jani's.**
