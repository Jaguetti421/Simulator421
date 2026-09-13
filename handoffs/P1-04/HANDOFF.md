# Handoff — P1-04 / attempt 1

Status: **READY_FOR_REVIEW**.
Base ID / Git commit: base `16bfd23` (P1-03 ACCEPTED, DEBT-01 accepted) → this commit. Contract v0, 23 records, digest unchanged — no contract touched.
Goal and implemented behavior: hierarchical routes over **known** terrain, with atomic bounded searches and certified partial progress.

Changed files: `packages/sim/spatial/route.ts` (new) — `RouteKnowledge` (per-actor overlay, one byte per cell, `UNKNOWN` by default), `findRoute` (integer A* over known cells with a node budget and portal certification), `RouteProgress` (repeated partials with bounded recovery), `stepDurationTicks`; `packages/sim/spatial/index.ts` — exports; `packages/sim/spatial/route.test.ts` (new, 13 tests).

| Acceptance criterion | Evidence path | Executed result |
| --- | --- | --- |
| 1. Concealed-route changes cannot change a route before observation | `evidence/routes.txt`, `route.test.ts` "routes are searched over knowledge" | **PASS, structurally** — the search reads `RouteKnowledge` and never the compiled terrain, so an unobserved change has no path into it. Demonstrated: walling off 40 cells 120 cells away from anything observed leaves the route **byte-identical**. The companion test proves that is not vacuous — changing a cell the actor *does* believe in changes the path, and the route then avoids the cells it believes are blocked. Stale belief beats current truth, which is the point |
| 2. Complete, Partial, BudgetExhausted and NoKnownRoute remain distinct | `evidence/routes.txt`, `route.test.ts` "the four outcomes stay distinct" | **PASS** — Complete: 11-cell path, 10 expansions. Partial: 43-cell path certified to observed portal (225,383) crossing region 22 → 15. BudgetExhausted: no path, 4 of 3 nodes spent, reported. NoKnownRoute: a single known cell, everything explored, nothing reaches the goal. A dedicated test asks the same question twice with different budgets and requires BudgetExhausted and Complete — exhaustion is never allowed to read as impossibility |
| 3. Repeated partial requests either advance toward a certified portal or trigger bounded recovery | `evidence/routes.txt` "repeated partials", `route.test.ts` | **PASS** — observing from the certified portal and re-asking produces a portal measurably closer to the goal. Without new observation the same portal returns, and after `PORTAL_REPEAT_LIMIT` attempts `RouteProgress` abandons it (`PortalAbandoned`) and then gives up in a bounded way (`GaveUp`, empty path) rather than certifying the same segment forever |

Commands actually executed: `npm run verify` → **0** (build, lint, **567/567** vitest across 35 files — 554 at the packet baseline; 6 python; workboard PASS).

Design decisions within scope:
1. **Knowledge is the only input.** `findRoute` takes terrain solely to be handed to `observe`; the search itself reads the overlay. That makes criterion 1 a property of the call graph rather than a promise — there is no path from the search to an unobserved cell.
2. **A portal must have been observed.** "Certified" means the actor has seen the boundary cell it is being sent to. An unobserved boundary is not a portal, so a partial never certifies progress toward something imagined.
3. **Four statuses, never three.** `BudgetExhausted` and `NoKnownRoute` are separate because the recovery differs: one wants more budget or a smaller question, the other wants exploration. Collapsing them is how an actor ends up standing still for reasons no one can explain.
4. **Recovery is bounded and visible.** The tracker abandons a repeatedly useless portal and says so in the result, rather than silently varying its answer.
5. **Integer costs.** Step cost is derived from the P1-02 speed multipliers as `1_000_000 / multiplier`; the heuristic uses `isqrt`. No floats on the path.

Contract proposals or deferred work outside scope:
- **`ROUTE-PROGRESS` is a named registry fixture and fixture DSL v1 cannot express it** — its claim is about successive requests, which no `EventCount*`, `Invariant` or `HashEqualVariant` assertion states. This is the **fifth** packet to hit that gap. Criterion 3 is proven by tests instead.
- Knowledge is populated here by `observe`/`observeArea`, a stand-in for perception. Wiring real sight (P1-03) into knowledge belongs to the perception packet; nothing here claims an actor knows what it could actually see.
- No route caching, no re-planning on invalidation, no multi-actor congestion, and no fine-motion validation against the 0.25 m cells — TP §5's later concerns.

Remaining risks, reproduction and exact next action:
- `DEFAULT_ROUTE_BUDGET` (4,000 expansions) and `PORTAL_REPEAT_LIMIT` (2) are **TUNE**. The Partial above spent 2,494 expansions on a 25-cell knowledge radius; a fuller map will spend more, and the budget has had no playtest.
- The open set is an array sorted per pop — correct and deterministic, but O(n log n) per expansion. If profiling at full population shows it, a binary heap is the fix; measuring that belongs to P3, not to a guess now.
- Reproduce: `npm run verify`, then the script whose output is `evidence/routes.txt`.
- Next action: review, then the next ready P1 packet.

Reviewer request: reproduce the acceptance evidence against the returned files and record findings in REVIEW.md.
