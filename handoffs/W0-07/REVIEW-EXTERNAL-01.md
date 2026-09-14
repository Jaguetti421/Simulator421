# Independent review — W0-07 / candidate tag `test-build-01` (commit `199777f`)

**File:** `handoffs/W0-07/REVIEW-EXTERNAL-01.md` · **Date:** 14 September 2026

Reviewer / role / fresh-context declaration: Claude Fable 5.1, external reviewing agent. **This is a fresh-context review.** This session had no memory of authoring any file in this repository; I wrote the plans (Technical Plan v2.0, the web phases, the kit) and had never seen the code before cloning the tag. I read the developer's `handoffs/W0-07/REVIEW.md` only after forming the verdicts below.
Author / base / candidate: web-track developer; base as stated in `handoffs/W0-07/HANDOFF.md`; candidate = tag `test-build-01` → commit `199777f` (the request says `f42e343`, the last code commit; the tag is one documentation commit later — Low, recorded once in the summary).
Environment: Node 22.22.2, npm 10.9.7, git 2.43, Chromium via `npx playwright install chromium` (worked here), 1 CPU sandbox, software WebGL. Reproduced on the candidate before any packet review: `npm ci`; `npm run build` (ok); `npm run lint` (exit 0); `vitest run` **570 passed / 35 files** (36.7 s); `npm run test:tools` OK; `check:workboard` PASS (139 packets, 51 scenes); `playwright test` **17 passed**.

Files actually inspected and checks independently reproduced: `packages/sim/core/tick.ts` (`STAGES` list, install stage, `STAGES.forEach` ordinal commit), `packages/sim/core/world.ts` (sampled), `tests/playwright/worker-hash.spec.ts` (ran: browser Worker digest equals Node at 137 actors; 136-actor workload at a different tick count; the two workloads' digests differ), `tests/fixtures/PERF-OPS-BASE.json` via `clanlab run --host kernel` (runs, 700 ticks in my SaveReload check; kernel id `w0-07-synthetic-1`), grep of `packages/sim` for `Math.random`, `Date`, `performance.now`, `Math.sin/cos/sqrt` (none outside comments). Not exhaustively audited: every arithmetic expression in `tick.ts`/`world.ts` for checkedMath use (sampled only).

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| Low | Criterion 1's browser half was BLOCKED when the packet was accepted and was closed by W0-10; the record says so honestly | HANDOFF criterion 1 text; W0-10 criterion 4 | None beyond what the record already states; the acceptance was taken with one half open, which is allowed by the kit's rules only if visible — it is |
| Low | `expanded`/counter magnitudes (657,600 perception-like queries over 600 ticks ≈ 1,096 per tick at 137 actors) are synthetic and cannot inform the §18 budgets | `handoffs/W0-11/GATE_EVIDENCE.md`, timing.json | Keep labelled synthetic; do not let these numbers migrate into TP v2.0 §18 as measured targets |
| Info | Stage order matches TP v1.1 §4's ten rows (install → commands → observations → decisions → advance → transactions → damage → cleanup → result → commit); ordinal-stamped commits | `tick.ts` `STAGES`; TP v1.1 §4 table | none |

Acceptance criteria:
1. Equal authoritative hashes across Node runs and the browser Worker: **PASS** (worker-hash.spec 3/3 ran here; Node digests in `evidence/digests.txt` consistent with the kernel host's reported digest `dfd2686e` at t700 in my run).
2. Explicit pause/tick boundaries; stage order asserted by a fixture: **PASS** (PERF-OPS-BASE runs under `--host kernel`; `tick.test.ts` in the 570).
3. Counters and wall-time reported with omissions, labelled synthetic: **PASS** (kernel summary declares `simulated: false`, watermark `FakeSim`, `gateEligible: false`).

Verdict: **ACCEPTABLE_FOR_INTEGRATION**.

This is review of the returned candidate, not proof that later merged code passes. **No packet is marked ACCEPTED here; acceptance is Jani's.**
