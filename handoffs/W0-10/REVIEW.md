# Independent review — W0-10 / attempt 1

Reviewer / role / fresh-context declaration: same developer, **same session as the author** — not a fresh-context review; the relaxed one-window rule applies and Jani accepts in chat.
Author / base / commit: same developer; base `827fd2a` → `0393f22` (runtime half, checkpointed with SESSION_RESUME) → `122ff28`.
Checks independently reproduced: `npm run verify` → 0 (**461/461** across 28 files, site build included); `npm run test:e2e` → 0 (16 tests, run repeatedly); both capture PNGs reopened and their `tEXt` metadata read back; browser digests compared against freshly computed Node digests.

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| Medium (contract gap, named not filled) | `AppearanceRecipe` is cited by TP v2.0 as an existing contract but is absent from contract v0's sixteen records | `apps/web/src/kit/recipe.ts` header; `contracts.CONTRACT_RECORDS` | Kept app-level and versioned. Adding a seventeenth record from an app packet would change the contract digest in every summary this build emits, so it is proposed work for a contracts packet — not something to slip in here. |
| Medium (deviation, small) | One `InstancedMesh` per primitive **shape**, where TP v2.0 says per kit part | `scene.ts` header | Accepted and documented. Revisit when the kit becomes rigged meshes, which is where the grouping decision actually bites. |
| Medium (limit of the evidence) | Criterion 2's visual half cannot be certified here | `evidence/identity-kit-prototype8.png`, and the PNG note says so | The automated check is structural — slot differences, bounds, attachment points, instance counts. Whether eight identities read as distinct to a person is HUMAN_REQUIRED and is recorded as such, not quietly folded into a PASS. |
| Low | The card expected criterion 3 to be BLOCKED_RENDER in the sandbox; it ran | `evidence/playwright.txt` | Second time a card's environment assumption was stale (W0-08 was the first). The habit to keep: try it, then record. |
| Low | A 1280×720 capture exceeded a 30 s Playwright timeout under software WebGL; the spec captures at 960×540 with a long timeout | comment in `capture.spec.ts` | Honest about what it is — a SwiftShader fact. It is also the clearest argument for GPU timing staying on Jani's PC. |
| Low | CI's `screens` job is enabled but has never executed on the GitHub runner | `.github/workflows/ci.yml` | Its first run is the next push. If Chromium installation fails there, the job fails loudly rather than being skipped — which is the point of enabling it. |
| Info | The shell and the capture route both carry a FakeSim watermark, and the capture's is inside the image | shell test, capture test | Matches AGENTS.md: FakeSim is watermarked and never passes a production gate. |

Contract, ownership, hidden-state and serialization findings: contract v0 untouched; the lab and sim boundaries hold (`apps/web` is the only place importing `three` and `react`). The capture route reads the kernel's own W0-08 snapshot rather than a parallel view, so image and state cannot diverge. `packages/sim` still contains no clock: the Worker owns the pump.

Acceptance criteria: 1 **PASS**, 2 **PASS (structural) / HUMAN_REQUIRED (visual)**, 3 **PASS**, 4 **PASS**.

Verdict: **ACCEPTABLE_FOR_INTEGRATION** — three Medium (one contract gap named and left to the right owner, one documented deviation, one honest limit on what the evidence proves), three Low, one Info.

This is review of the returned candidate, not proof that later merged code passes. The packet stays READY_FOR_REVIEW until Jani accepts it in chat.
