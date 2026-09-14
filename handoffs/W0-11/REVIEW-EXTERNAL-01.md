# Independent review — W0-11 / candidate tag `test-build-01` (commit `199777f`)

**File:** `handoffs/W0-11/REVIEW-EXTERNAL-01.md` · **Date:** 14 September 2026

Reviewer / role / fresh-context declaration: Claude Fable 5.1, external reviewing agent. **This is a fresh-context review.** This session had no memory of authoring any file in this repository; I wrote the plans (Technical Plan v2.0, the web phases, the kit) and had never seen the code before cloning the tag. I read the developer's `handoffs/W0-11/REVIEW.md` only after forming the verdicts below.
Author / base / candidate: web-track developer; base as stated in `handoffs/W0-11/HANDOFF.md`; candidate = tag `test-build-01` → commit `199777f` (the request says `f42e343`, the last code commit; the tag is one documentation commit later — Low, recorded once in the summary).
Environment: Node 22.22.2, npm 10.9.7, git 2.43, Chromium via `npx playwright install chromium` (worked here), 1 CPU sandbox, software WebGL. Reproduced on the candidate before any packet review: `npm ci`; `npm run build` (ok); `npm run lint` (exit 0); `vitest run` **570 passed / 35 files** (36.7 s); `npm run test:tools` OK; `check:workboard` PASS (139 packets, 51 scenes); `playwright test` **17 passed**.

Files actually inspected and checks independently reproduced: `handoffs/W0-11/GATE_EVIDENCE.md`, `JANI_PC_CHECKLIST.md`, `state/STATUS.md` W0 metrics, `docs/production/adr/001-web-runtime.md` (exists), tag `w0-baseline` → `13be015`; the full verification set (build, lint, 570 tests, 17 Playwright including the offline-boot test, workboard check) on the candidate; the G0 screenshot criterion against the actual PNGs (see W0-10).

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| **High (record)** | G0 criterion "A real 3D screenshot of eight procedural identities is produced through /capture…" is recorded as **PASS (artifact) / HUMAN_REQUIRED (judgement)**. The artifact half is not satisfied: the image is a real render, but not of the eight identities (W0-10 High). The judgement half was correctly left to a human — who would have found the image empty | `GATE_EVIDENCE.md` line 22; the PNG | Re-mark the line **FAIL** (artifact) until W0-10's fix lands and the regenerated image is attached; G0 remains approved at Jani's discretion — the other five criteria reproduced here — but the gate record must say what the artifact shows |
| Low | REVIEW-REQUEST-01 states the tag equals `f42e343`; `git rev-parse test-build-01^{commit}` = `199777f` (one documentation commit later). Harmless, but a base/candidate identity claim should be exact | git | State tag→commit from `rev-parse` in requests and handoffs |
| Info | The gate's largest caveat (same-session reviews) is declared in the record itself; this document set is the fresh-context review that caveat asked for | `GATE_EVIDENCE.md` line 14 | none |

Acceptance criteria:
1. All W0 packets ACCEPTED after fresh-context self-review; verification green on the tagged baseline: **PASS (green) / FAIL (fresh-context)** as the record itself declares; W0-06…W0-11 now have external fresh-context reviews in this set.
2. GATE_EVIDENCE lists each criterion with a status and artifact paths; blocked items name what Jani runs: **PASS** — with the screenshot line's status wrong (High above).
3. STATUS contains W0 metrics; developer stopped and waited: **PASS**.

Verdict: **CHANGES_REQUESTED** — for the gate record, not the code.

This is review of the returned candidate, not proof that later merged code passes. **No packet is marked ACCEPTED here; acceptance is Jani's.**
