# Independent review — P1-03 / attempt 1

Reviewer / role / fresh-context declaration: same developer, **same session as the author** — not fresh-context, under the producer-approved relaxation.
Author / base / commit: same developer; base `5d0e45e` → `27e9575`.
Checks independently reproduced: `npm run verify` → 0 (**542/542** across 33 files); every line in `evidence/line-of-sight.txt` re-run in a separate process; the reported blocking cells looked up in the compiled traversal array to confirm they are what the result claims.

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| **Medium (found and fixed in-packet)** | Line of sight was **asymmetric**: A→B and B→A could disagree, because the DDA rounds by direction | the symmetry test failed on the first run | Fixed by ordering the endpoints canonically so both directions trace the identical cells; the test now covers three pairs including one across a blocking ridge, and compares `blockedAt` as well as status. |
| **Medium (found and fixed in-packet)** | My first occlusion test asserted "blocked" against the **valley**, which cannot occlude anything | a scan of the compiled valley found no terrain-blocked pair at all | The test was passing for the wrong reason until the fix — it would have gone green against a world with no occluders. Now it uses the `ridge` template with the reason in a comment, plus a companion test recording that the valley crossing is visible. Worth remembering: a negative-space test needs a world that can produce the negative. |
| Medium (scope, disclosed) | TP §6's perception model is not here — no field of view, hearing, light, sleep modifiers, belief fields or the 0.5 s threat-interrupt bound | handoff lists them | This packet is geometry-derived sight. Nothing in criterion 1's PASS should be read as a perception system. |
| Low | Cover is compiled and exposed but does not modify a sight result | `staticVisibility` | Correct to defer: the modifier curve belongs with the packet that defines concealment, not with the geometry query. |
| Low | Sight walks the 1 m grid and ignores the 0.25 m fine cells | handoff | Consistent with TP §5 (fine geometry validates clearance and motion), but a sub-metre occluder would not block sight. Revisit if content authors thin walls. |
| Low | `EYE_HEIGHT_MM`, `OBSTACLE_HEIGHT_MM` and the budget default are TUNE | constants | Eye height decides how much terrain is seen over; unreviewed. |
| Info | Lint refused `Math.sqrt` on the consequential path | replaced with `isqrt` | The float ban caught a real slip during this packet, not in review. |
| Info | `INFO-ISOLATION` could not be authored as a fixture | third packet to hit the same DSL gap | Criterion 3 is proven by tests instead. The DSL needs an assertion kind for boundary claims; scheduling that is a lab packet. |

Contract, ownership, hidden-state and serialization findings: no contract added or edited. The module has no mutable state beyond a spatial hash the caller builds and owns, and no parameter through which actor knowledge could enter — which is what makes criterion 3 structural rather than a promise. `packages/sim` purity holds.

Acceptance criteria: 1 **PASS**, 2 **PASS**, 3 **PASS**.

Verdict: **ACCEPTABLE_FOR_INTEGRATION** — two Medium found and fixed inside the packet (one of them a test that was green for the wrong reason), one Medium of disclosed scope, three Low, two Info.

This is review of the returned candidate, not proof that later merged code passes. The packet stays READY_FOR_REVIEW until Jani accepts it in chat.
