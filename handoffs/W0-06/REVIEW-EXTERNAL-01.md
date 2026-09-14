# Independent review — W0-06 / candidate tag `test-build-01` (commit `199777f`)

**File:** `handoffs/W0-06/REVIEW-EXTERNAL-01.md` · **Date:** 14 September 2026

Reviewer / role / fresh-context declaration: Claude Fable 5.1, external reviewing agent. **This is a fresh-context review.** This session had no memory of authoring any file in this repository; I wrote the plans (Technical Plan v2.0, the web phases, the kit) and had never seen the code before cloning the tag. I read the developer's `handoffs/W0-06/REVIEW.md` only after forming the verdicts below.
Author / base / candidate: web-track developer; base as stated in `handoffs/W0-06/HANDOFF.md`; candidate = tag `test-build-01` → commit `199777f` (the request says `f42e343`, the last code commit; the tag is one documentation commit later — Low, recorded once in the summary).
Environment: Node 22.22.2, npm 10.9.7, git 2.43, Chromium via `npx playwright install chromium` (worked here), 1 CPU sandbox, software WebGL. Reproduced on the candidate before any packet review: `npm ci`; `npm run build` (ok); `npm run lint` (exit 0); `vitest run` **570 passed / 35 files** (36.7 s); `npm run test:tools` OK; `check:workboard` PASS (139 packets, 51 scenes); `playwright test` **17 passed**.

Files actually inspected and checks independently reproduced: `packages/lab/cli/run.ts`, `packages/lab/cli/run.test.ts` (read); `clanlab validate --fixture contracts/examples` (3 valid, 6 blocked assertions, summary JSON); `clanlab run --fixture contracts/examples` with host `none` (exit **4**, counts `executed 0 / blocked 6`, every assertion carries a `detail` and `availableFrom`); a forced failure — `LAW-NOTICE-REJECTION` with `minimum: 99` — with `--host kernel` (exit **1**, status `Failed`, bundle written to `clanlab-out/<id>/bundle/` containing `bundle.json`, `run-summary.json`, `run.log`, `fixture.json`); `clanlab inspect clanlab-out/<id>/bundle` (status `FAILED_RUN_REOPENED`, `verdictDigest`, `runStatus: Failed`); a mistyped fixture (fields `expected`, `min`, `window`) rejected with four typed `StructureInvalid` errors before any run.

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| Low | `clanlab inspect` accepts only the bundle **directory**; given the `bundle.json` path that every run summary's `artifacts.bundle` field points at, it reports `BUNDLE_UNUSABLE (ENOTDIR)` | my run: `inspect clanlab-out/fail2/bundle/bundle.json` → unusable; `inspect clanlab-out/fail2/bundle` → reopened | Accept either the directory or the `bundle.json` path, since the summary hands users the file |
| Low | `clanlab run --help` prints `unknown option --help` (usage is only printed with no arguments) | my run | Treat `--help` as usage on every subcommand |
| Info | Blocked assertions keep exit nonzero (4) and never count as passes; failure bundles reopen with digest; unknown fields fail loudly | reproduced above | none — this is the behaviour the plan asked for |

Acceptance criteria:
1. Failing fixture → nonzero + reopenable bundle: **PASS** (exit 1; `clanlab-out/fail2/bundle` reopened with the failing assertion, tick window and artifact paths).
2. Machine JSON with identity, counts and artifact paths; logs in files: **PASS** (summary carries build/contract/content identity, profile, seed, executed/failed/blocked/skipped; `run.log` on disk).
3. Exit 0 only when every supported check passed; blocked visible: **PASS** (host `none` → exit 4 with `blocked: 6`; a passing SaveReload with other assertions blocked still exits 4).

Verdict: **ACCEPTABLE_FOR_INTEGRATION** (two Low ergonomics findings).

This is review of the returned candidate, not proof that later merged code passes. **No packet is marked ACCEPTED here; acceptance is Jani's.**
