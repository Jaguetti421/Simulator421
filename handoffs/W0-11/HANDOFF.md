# Handoff — W0-11 / attempt 1

Status: **READY_FOR_REVIEW**. The phase stops here and waits for Jani (card note: do not start P1-01 until Jani responds).
Base ID / Git commit / contract / content: base `3796038` (W0-10 ACCEPTED) → this commit, tagged `w0-baseline`. Contract v0, 16 records, `sha256:291f9b94…`. No content catalog, no compiled geometry.
Goal and implemented behavior: verify the integrated baseline, fill G0 gate evidence with real artifacts, write the playtest brief and the checklist of what only Jani can run, record ADR 001, tag the baseline and stop.

Changed files and purpose:
- `handoffs/W0-11/GATE_EVIDENCE.md` — every G0 criterion with its artifact, the environment it ran in, and a result.
- `handoffs/W0-11/PLAYTEST_BRIEF.md` — what the build is and is not, how to run it, a ten-minute viewing script, five questions.
- `handoffs/W0-11/JANI_PC_CHECKLIST.md` — the two genuinely blocked checks (visual judgement, GPU timing) plus three confirmations.
- `docs/production/adr/001-web-runtime.md` — web now, wrapper later, with what would reverse it.
- `tests/playwright/shell.spec.ts` — an offline test (see decision 2).
- `state/STATUS.md`, `state/workboard.json` — W0 metrics and status.

| Acceptance criterion | Evidence path | Executed result |
| --- | --- | --- |
| 1. All W0 packets ACCEPTED after fresh-context self-review; `npm test`, fixtures, replay of the synthetic tape and the workboard check are green on the tagged baseline | `evidence/verify.txt`, `evidence/g0-evidence.txt`, `evidence/playwright.txt` | **PASS with one honest qualification.** Verify exit 0: 461 vitest across 28 files, 6 python, workboard PASS, 10 accepted. Fixtures: 3 supplied + 3 authored validate at exit 0. Tape replay: PERF-OPS-BASE 13/13 and SAVE-ROUNDTRIP 4/4 against kernel-produced tapes, both exit 0. Browser suite: 17 tests, exit 0. **The qualification:** only W0-05's review was genuinely fresh-context; the rest were same-session under the producer-approved relaxation, each declaring it. Stated in GATE_EVIDENCE.md as the largest caveat on the gate rather than left for a reader to discover |
| 2. GATE_EVIDENCE.md lists each G0 criterion with PASS/FAIL/BLOCKED/HUMAN_REQUIRED and artifact paths; blocked items name what Jani must run | `handoffs/W0-11/GATE_EVIDENCE.md`, `JANI_PC_CHECKLIST.md` | **PASS** — six criteria, each with an artifact path and the actual environment. Five PASS; the 3D screenshot criterion is PASS for the artifact and HUMAN_REQUIRED for the judgement, pointing at checklist step 2. Eight known limitations with severity and owner. Nothing closed by a plan or an unexecuted command |
| 3. STATUS contains the W0 metrics (sessions per packet, rework, blocked checks, time to first runnable slice); the developer stops and waits | `state/STATUS.md` W0 metrics section and session log | **PASS** — per-packet rows plus a phase summary: 11 packets, 3 sessions, 303→461 tests, rework and blocked checks per packet, and the time to the first runnable slice. The packet ends with the stop |

Commands actually executed: `npm run verify` → 0 (461/461, 28 files). `npm run test:e2e` → 0 (17 tests). `clanlab validate` on six fixtures → 0. Kernel → tape → `clanlab run` for PERF-OPS-BASE and SAVE-ROUNDTRIP → 0. `clanlab render` → 0. `git tag w0-baseline` and pushed.

Pre-existing baseline failures: none.

Design decisions within scope:
1. **The gate says what it cannot prove.** No human has looked at this build and no GPU has rendered it. Rather than let five green rows imply otherwise, GATE_EVIDENCE.md says so in its own row ("Real human/reference-machine observations: none yet") and the checklist marks exactly two checks as the ones only Jani can supply.
2. **"Serves offline" needed a real test, not a grep.** Grepping the bundle for `https://` finds React error URLs and XML namespace strings — text, not fetches. The Playwright test blocks every non-local origin and requires the site to boot and advance ticks with zero external requests attempted. That is a small addition to `tests/playwright/**`, outside this card's in-scope paths, and the alternative was a criterion closed by a misleading grep.
3. **The checklist distinguishes blocked from confirmable.** Three of its five steps ran here; they are listed as confirmations, with the automated equivalent named, so Jani can spend his attention on the two that genuinely need him.

Contract proposals or deferred work outside scope: the eight limitations in GATE_EVIDENCE.md, each with an owner. The two that most affect P1 sequencing are `AppearanceRecipe` not being a frozen contract record, and fixture assertions on `reasonId` staying Blocked until the lab reads acknowledgements as a second matchable source (P1-12).

Remaining risks, reproduction and exact next action:
- The gate rests on automated evidence only. If the visual judgement in checklist step 2 comes back negative, the procedural kit path is the thing to revisit, and that is a G1 question worth answering now rather than at P4.
- Reproduce everything from the tag: `git checkout w0-baseline && npm ci && npm run verify && PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npm run test:e2e`.
- Next action: **stop.** Jani reviews the images, runs the checklist, and either approves G0 or returns findings. P1-01 does not start until he responds or explicitly says to continue without feedback.

Source archive/patch and RETURN_MANIFEST.json: not applicable — GitHub is canonical; `main` is pushed and tagged `w0-baseline`.

Reviewer request: reproduce the acceptance evidence against the returned files and record findings in REVIEW.md.
