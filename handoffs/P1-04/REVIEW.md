# Independent review — P1-04 / attempt 1

Reviewer / role / fresh-context declaration: same developer, **same session as the author** — not fresh-context, under the producer-approved relaxation.
Author / base / commit: same developer; base `16bfd23` → this commit.
Checks independently reproduced: `npm run verify` → 0 (**567/567** across 35 files); every line of `evidence/routes.txt` re-run in a separate process; the unobserved-change experiment repeated by mutating a different corridor.

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| Medium (test design, deliberate) | The suite uses the `ridge` world, not the accepted `valley` | the valley's floor is mostly water, so a route failure there would be a fact about water rather than about knowledge or budget | Correct choice, and stated. A reviewer should not read "routes work" as "routes work on the shipping map" — the valley currently has 149k shallow and 71k deep cells and no one has tuned that. |
| Medium (scope, disclosed) | Knowledge is populated by `observe`/`observeArea`, not by the P1-03 sight model | handoff | Nothing here claims an actor knows what it could see. Wiring perception into knowledge is the perception packet's job, and until then a caller could grant knowledge an actor has not earned. |
| Medium (recurring) | `ROUTE-PROGRESS` cannot be expressed in fixture DSL v1 — the **fifth** packet to hit this | criterion 3 proven by tests | The DSL gap is no longer a footnote: five registry fixtures now have no home. It needs a scheduled packet. |
| Low | `DEFAULT_ROUTE_BUDGET` and `PORTAL_REPEAT_LIMIT` are TUNE | 2,494 expansions for one Partial at a 25-cell knowledge radius | Unreviewed. A full-map search will cost more. |
| Low | The open set sorts on every pop | `findRoute` | Deterministic and correct; a heap is the fix if profiling asks for one. Not a guess to make now. |
| Info | The "unobserved change" test has a companion proving it is not vacuous | belief change does alter the path | Worth keeping: an isolation test that would pass against a search that ignores its inputs entirely is not evidence. |

Contract, ownership, hidden-state and serialization findings: no contract added or edited. `RouteKnowledge` is per-actor state the caller owns; the search holds none between calls, and `RouteProgress` holds only attempt counts, which is the state criterion 3 requires. `packages/sim` purity holds — integer costs, `isqrt` heuristic, no clock, no `Math.random`.

Acceptance criteria: 1 **PASS**, 2 **PASS**, 3 **PASS**.

Verdict: **ACCEPTABLE_FOR_INTEGRATION** — three Medium (a deliberate test-world choice, a disclosed scope limit, and the recurring DSL gap), two Low, one Info.

This is review of the returned candidate, not proof that later merged code passes. The packet stays READY_FOR_REVIEW until Jani accepts it in chat.
