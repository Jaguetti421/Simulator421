# Independent review — W0-11 / attempt 1

Reviewer / role / fresh-context declaration: same developer, **same session as the author** — not fresh-context. For a gate packet this matters more than usual, and it is the first finding below rather than a footnote.
Author / base / commit: same developer; base `3796038` → this commit, tagged `w0-baseline`.
Checks independently reproduced: `npm run verify` → 0 on the tagged tree; `npm run test:e2e` → 0 (17 tests); the tape replay re-run from a fresh kernel for both fixtures; the contract digest recomputed; every artifact path in GATE_EVIDENCE.md opened and confirmed to exist and to contain what the row claims.

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| **High (process, disclosed not fixed)** | G0 is being submitted with ten of eleven packet reviews written in the same session as the code they review | each review file declares it; GATE_EVIDENCE.md states it as the gate's largest caveat | Cannot be fixed by writing more text now — a same-session review does not become fresh by asserting it. The honest options are Jani's acceptance as the compensating control (which is what happened, per packet, in chat) or a genuine fresh-context re-review of W0-06…W0-11 in a later session. **Recommend the latter before G1**, where the stakes are a playable build rather than a foundation. |
| High (limit of evidence, disclosed) | No human has judged any visual output and no GPU has rendered anything | GATE_EVIDENCE.md "Real human/reference-machine observations: none yet"; checklist steps 2 and 3 | Correct handling: the 3D criterion is PASS for the artifact and HUMAN_REQUIRED for the judgement. A gate that quietly merged those two would be worth nothing. |
| Medium | `tests/playwright/shell.spec.ts` was extended, outside this card's in-scope paths (`state/**`, `handoffs/W0-11/**`, the ADR) | the offline test | Justified and small: the "serves offline" criterion had no honest automated evidence otherwise, and a grep for `https://` in the bundle produces false positives. Recorded rather than slipped in. |
| Medium | The tag is applied to a commit whose own handoff and review are part of it | `w0-baseline` | Unavoidable for a self-reviewing gate packet, and worth naming: the tagged tree includes the documents asserting the tree is good. The verify and e2e runs cited are from that exact tree. |
| Low | The playtest brief asks five questions, one of which (the identity kit) carries most of the weight | PLAYTEST_BRIEF.md | Deliberate. A brief with fifteen questions gets no answers; this one says which answer changes a decision. |
| Low | Timing numbers in the gate come from a 1-CPU sandbox with software rendering | GATE_EVIDENCE.md marks them "diagnostics only" | They should not be quoted anywhere as budget evidence. Checklist step 3 replaces them. |
| Info | Eight limitations are listed with severity and owner | GATE_EVIDENCE.md | Every one is traceable to a packet review that found it, not assembled at gate time to look thorough. |

Contract, ownership, hidden-state and serialization findings: contract v0 unchanged through the whole phase — `sha256:291f9b94…`, 16 records, and the digest is recomputed in this review rather than copied from a summary. Boundaries hold: `packages/sim` has no Node built-ins, DOM, clock or `Math.random`; `apps/web` is the only package importing `three` or `react`; the lab imports neither.

Acceptance criteria: 1 **PASS (with the review-rule qualification stated)**, 2 **PASS**, 3 **PASS**.

Verdict: **ACCEPTABLE_FOR_INTEGRATION**, and the gate itself is **READY_FOR_JANI_APPROVAL** — which is a request, not a pass. Two High items are disclosed rather than resolved: the review-rule relaxation and the complete absence of human and hardware evidence. Both are visible in the gate document itself, which is the point.

This is review of the returned candidate, not proof that later merged code passes. W0-11 stays READY_FOR_REVIEW until Jani accepts it, and G0 stays unapproved until he authorizes it.
