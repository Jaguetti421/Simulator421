# Independent review — P1-02 / attempt 1

Reviewer / role / fresh-context declaration: same developer, **same session as the author** — not fresh-context, under the producer-approved relaxation.
Author / base / commit: same developer; base `0d4c6f1` → `7f938be`.
Checks independently reproduced: `npm run verify` → 0 (**524/524** across 32 files); the compile re-run twice in a separate process and the hash compared; the render/simulation hashes compared directly; query results at the four socket coordinates re-derived outside the test suite.

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| Medium (found and fixed in-packet) | The first compile produced **zero** `Cliff` cells — the class existed in the table and in no cell of the world | `classCounts` before the change | Fixed by authoring an escarpment into the valley template rather than hoping noise would produce a 1.4 m step, plus a test asserting every traversal class has instances. Worth naming because the tests would all have passed with a class that never occurred. |
| Medium (scope, disclosed) | TP §5's pipeline continues past this packet and none of it is here | the handoff lists the six missing stages by name | No evidence in this packet implies a playable seed. A compile currently **always succeeds**; nothing validates crossing times, food distance, camp plausibility or opening supply. That is the next lane's work and must not be read into criterion 3's PASS. |
| Medium (TUNE) | `CLIFF_STEP_MM`, the deep-water line and the escarpment height decide the whole class distribution, and were set to make the classes occur sensibly | 417k ground / 149k shallow / 71k deep / 2.9k cliff | Recorded as TUNE. The distribution has had no design review, and a playtest may want far less water. |
| Low | A full compile takes ~3 s on one CPU | evidence header | Diagnostic only. Relevant if the grid gets finer or the pipeline grows, not now. |
| Low | `cellOf` had to normalize negative zero | fixed, with the reason in a comment | Caught by a structural assertion, which is the argument for asserting on the object rather than on each field. |
| Info | Obstacle footprints come only from declared sockets | compiler | Matches TP §5: nothing decorative can accidentally block movement, because nothing decorative exists here. |
| Info | The height field is integer value noise with integer interpolation | `latticeValue`, `valueNoiseMm` | This is what makes the hash reproducible anywhere, which criterion 1 rests on. |

Contract, ownership, hidden-state and serialization findings: no contract was added or edited — the digest is unchanged from P1-01, verified. `packages/sim` purity holds: no `Math.random` (the one stream is derived from the match seed with a label), no clock, no DOM, no Node built-ins. The compiler returns typed arrays the caller owns; nothing hands out a mutable world handle.

Acceptance criteria: 1 **PASS**, 2 **PASS**, 3 **PASS**.

Verdict: **ACCEPTABLE_FOR_INTEGRATION** — one Medium found and fixed in-packet, two Medium disclosed as scope and tuning limits, two Low, two Info.

This is review of the returned candidate, not proof that later merged code passes. The packet stays READY_FOR_REVIEW until Jani accepts it in chat.
