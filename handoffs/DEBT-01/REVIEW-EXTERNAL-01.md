# Independent review — DEBT-01 / candidate tag `test-build-01` (commit `199777f`)

**File:** `handoffs/DEBT-01/REVIEW-EXTERNAL-01.md` · **Date:** 14 September 2026

Reviewer / role / fresh-context declaration: Claude Fable 5.1, external reviewing agent. **This is a fresh-context review.** This session had no memory of authoring any file in this repository; I wrote the plans (Technical Plan v2.0, the web phases, the kit) and had never seen the code before cloning the tag. I read the developer's `handoffs/DEBT-01/REVIEW.md` only after forming the verdicts below.
Author / base / candidate: web-track developer; base as stated in `handoffs/DEBT-01/HANDOFF.md`; candidate = tag `test-build-01` → commit `199777f` (the request says `f42e343`, the last code commit; the tag is one documentation commit later — Low, recorded once in the summary).
Environment: Node 22.22.2, npm 10.9.7, git 2.43, Chromium via `npx playwright install chromium` (worked here), 1 CPU sandbox, software WebGL. Reproduced on the candidate before any packet review: `npm ci`; `npm run build` (ok); `npm run lint` (exit 0); `vitest run` **570 passed / 35 files** (36.7 s); `npm run test:tools` OK; `check:workboard` PASS (139 packets, 51 scenes); `playwright test` **17 passed**.

Files actually inspected and checks independently reproduced: `handoffs/DEBT-01/HANDOFF.md` closed-debt table; `clanlab run --fixture contracts/examples --host kernel` — `LAW-NOTICE-REJECTION` assertion 0 (`reasonId=NoticeTooShort`) **Passed** against acknowledgements; assertion 1 (`LawActivated`) **Blocked** with "this host cannot emit LawActivated at all, so neither its presence nor its absence is evidence"; `SAVE-BOOTSTRAP-01` `HashEqualVariant: SaveReload` **Passed** (`dfd2686e`); overall exit 4; kernel host id `kernel:w0-07-synthetic-1:seed4107:t<n>`.

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| Low | Reason matching resolves against the acknowledgement stream while the fixture still says `kind: EventCountGte` with `type: CommandRejected`. The summary detail honestly says "acknowledgements matched", but the assertion kind implies an event. A rejected command is not a committed world event (INTERFACES.md; TP v2.0 §3) | my run detail: "…1 acknowledgements matched (type=CommandRejected…)" | Either add `AckCountGte` (source explicit) or document that `EventCountGte` over `type: CommandRejected` is defined to read acks — and never let a `CommandRejected` enter the authoritative event log or hash domain |
| Info | Blocked-not-Failed for systems the kernel cannot emit is correct and precisely worded; `availableFrom` strings no longer cite shipped packets | my run | none |
| Info | Producer-directed, not a workboard packet; base and digest recorded; behaviour change to previously accepted fixtures is visible in the evidence | handoff | none |

Verdict: **ACCEPTABLE_FOR_INTEGRATION** (one Low naming question; the design answer matches the one given in REVIEW-EXTERNAL-01-PRELIMINARY §5.2).

This is review of the returned candidate, not proof that later merged code passes. **No packet is marked ACCEPTED here; acceptance is Jani's.**
