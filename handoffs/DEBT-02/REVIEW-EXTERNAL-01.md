# Independent review — DEBT-02 / candidate tag `test-build-01` (commit `199777f`)

**File:** `handoffs/DEBT-02/REVIEW-EXTERNAL-01.md` · **Date:** 14 September 2026

Reviewer / role / fresh-context declaration: Claude Fable 5.1, external reviewing agent. **This is a fresh-context review.** This session had no memory of authoring any file in this repository; I wrote the plans (Technical Plan v2.0, the web phases, the kit) and had never seen the code before cloning the tag. I read the developer's `handoffs/DEBT-02/REVIEW.md` only after forming the verdicts below.
Author / base / candidate: web-track developer; base as stated in `handoffs/DEBT-02/HANDOFF.md`; candidate = tag `test-build-01` → commit `199777f` (the request says `f42e343`, the last code commit; the tag is one documentation commit later — Low, recorded once in the summary).
Environment: Node 22.22.2, npm 10.9.7, git 2.43, Chromium via `npx playwright install chromium` (worked here), 1 CPU sandbox, software WebGL. Reproduced on the candidate before any packet review: `npm ci`; `npm run build` (ok); `npm run lint` (exit 0); `vitest run` **570 passed / 35 files** (36.7 s); `npm run test:tools` OK; `check:workboard` PASS (139 packets, 51 scenes); `playwright test` **17 passed**.

Files actually inspected and checks independently reproduced: `contracts/FIXTURE_DSL.md` v2 addendum (schemaVersion 1 or 2; `ToolCheck` kind), `contracts/fixture.schema.json` (kind present), `clanlab render` summary (`toolChecks: []` for a fixture that declares none; the three readability checks reported), `clanlab validate` summary header.

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| Low | `clanlab validate` and `run` summaries report `fixtureDslVersion: 1` in the identity block while the DSL is v2 and accepts `schemaVersion` 1 or 2. Readers cannot tell which DSL the tool supports vs which version the fixture declared | my validate/run summaries | Report `supportedDslVersions: [1, 2]` and each fixture's own `schemaVersion` |
| Low | The schema is shared with the Godot track; `ToolCheck` (and any `AckCountGte`) now diverge between tracks | request §3.7 | Log both as cross-track design clarifications (RESEARCH_PROTOCOL: shared clarifications are allowed, code is not) |
| Info | `ToolCheck` is the right answer to "a claim only a tool can make": provider named, `Blocked` under `run`, `Passed/Failed` under `render`; the kit is versioned, not immutable, so a dated addendum is the correct change procedure | handoff; summaries | none |

Verdict: **ACCEPTABLE_FOR_INTEGRATION**.

This is review of the returned candidate, not proof that later merged code passes. **No packet is marked ACCEPTED here; acceptance is Jani's.**
