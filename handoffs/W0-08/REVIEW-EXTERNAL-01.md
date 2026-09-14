# Independent review — W0-08 / candidate tag `test-build-01` (commit `199777f`)

**File:** `handoffs/W0-08/REVIEW-EXTERNAL-01.md` · **Date:** 14 September 2026

Reviewer / role / fresh-context declaration: Claude Fable 5.1, external reviewing agent. **This is a fresh-context review.** This session had no memory of authoring any file in this repository; I wrote the plans (Technical Plan v2.0, the web phases, the kit) and had never seen the code before cloning the tag. I read the developer's `handoffs/W0-08/REVIEW.md` only after forming the verdicts below.
Author / base / candidate: web-track developer; base as stated in `handoffs/W0-08/HANDOFF.md`; candidate = tag `test-build-01` → commit `199777f` (the request says `f42e343`, the last code commit; the tag is one documentation commit later — Low, recorded once in the summary).
Environment: Node 22.22.2, npm 10.9.7, git 2.43, Chromium via `npx playwright install chromium` (worked here), 1 CPU sandbox, software WebGL. Reproduced on the candidate before any packet review: `npm ci`; `npm run build` (ok); `npm run lint` (exit 0); `vitest run` **570 passed / 35 files** (36.7 s); `npm run test:tools` OK; `check:workboard` PASS (139 packets, 51 scenes); `playwright test` **17 passed**.

Files actually inspected and checks independently reproduced: `packages/sim/persistence/index.ts` (two-generation write `writeCheckpoint`/pointer-last, fallback load loop, `applyResult`), `packages/sim/persistence/indexeddb.ts` (`add` via IDB `add`, `keys` sorted), `tests/playwright/persistence.spec.ts` (ran: browser IndexedDB adapter suite passed), `clanlab run --host kernel` on `SAVE-BOOTSTRAP-01` (SaveReload: saved at tick 100, restored, advanced 600, digest `dfd2686e` equals the uninterrupted run), persistence unit tests within the 570.

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| Low | `applyResult` is read-then-`add` (`index.ts:328–344`). Exactly-once still holds because the store's `add` rejects duplicates, but a concurrent duplicate (a second tab, a retried Worker) surfaces as the adapter's constraint error rather than as `alreadyPresent` / `ResultConflict` | code read; single-writer today | Catch the constraint error from `add`, re-read, and return `alreadyPresent` or throw `ResultConflict` — so the API's promise holds under concurrency, not only under one writer |
| Low | The snapshot `put` and the pointer `put` are two IndexedDB transactions | `index.ts:246–249` | Correct as designed (a crash between them leaves the old generation authoritative). Add the two-step rule to the adapter contract test if it is not already asserted with an injected failure between the two puts |
| Info | Codec keeps plain data in persistence and mapping in host, as the plan asked | `snapshot.ts`, handoff | none |

Acceptance criteria:
1. Load + continuation equals uninterrupted hashes; corrupt/truncated newest generation falls back: **PASS** (SaveReload reproduced through the lab; fallback tests in the suite; `fellBackFrom` in the load result).
2. Same result twice increments once; conflicting payload fails; failed write never acknowledged: **PASS** (suite; code read confirms `add` semantics) — with the Low above for the concurrent path.
3. Browser IndexedDB adapter passes under Playwright: **PASS** (executed here).

Verdict: **ACCEPTABLE_FOR_INTEGRATION**.

This is review of the returned candidate, not proof that later merged code passes. **No packet is marked ACCEPTED here; acceptance is Jani's.**
