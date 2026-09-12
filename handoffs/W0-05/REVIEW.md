# Independent review — W0-05 / attempt 1

Reviewer / role / fresh-context declaration: same developer identity, **new session, new sandbox, no memory of authoring this packet** — the repository was cloned fresh at `e14e0a6` and the only inputs were `AGENTS.md`, `state/STATUS.md`, `handoffs/W0-05/HANDOFF.md`, the `1a3d478..678fe94` diff and the code itself. This is the first review in the project that actually satisfies the fresh-context rule in AGENTS.md rather than waiving it. Honest ordering note: **Jani accepted W0-05 in chat on 12 September 2026 before this file existed** ("w0-05 has been accepted. you may continue"); the review was written afterwards, in the session that starts W0-06, and it re-verified the criteria rather than assuming them. Producer acceptance stands on its own (AGENTS.md authority order, item 1); this review is the evidence that nothing material was accepted unseen.

Author / base / commit: same developer; base `1a3d478` (W0-04 ACCEPTED) → `678fe94`, then `e14e0a6` (session prompt file only). 30 files, +2115 / −22.

Checks independently reproduced in this session (fresh clone, `npm ci`):

| Check | Command | Result |
| --- | --- | --- |
| Baseline verify | `npm run verify` | exit 0 — build, lint, **303/303** vitest across 14 files, 6/6 python unittest, workboard PASS (`/tmp/verify_baseline.log`, reproduced twice) |
| CI on the pushed head | GitHub Actions API, runs for `e14e0a6`, `678fe94`, `1a3d478` | all `completed / success` — first confirmation that the runner really executes this suite (it was BLOCKED_TOOL at W0-01) |
| Criterion 3, examples parse | `clanlab validate --fixture contracts/examples` | exit 0; 3 valid, 0 invalid, 4 skipped checks, 6 blocked assertions |
| Criterion 1, unknown assertion kind | probe fixture with `kind: "AllMatchingEventsAreValid"` | exit 1, `UnsupportedAssertion at /assertions/0/kind`, no cascade of unrelated errors |
| Criterion 1, unknown version | probe fixture with `schemaVersion: 2` | exit 1, `UnknownSchemaVersion at /schemaVersion`, and nothing else |
| Criterion 2, notice boundary | probe: runtime law with 699 ticks of notice expecting `Accepted` | exit 0 |
| Criterion 2, notice boundary | same probe with 599 ticks of notice expecting `Accepted` | exit 1, `NoticeTooShort at /schedule/0/payload/startTick` |
| Criterion 3, empty match | `evaluateAll` on an `EventCountGte` with an empty event list / no event list / one matching event | `Failed` (observed 0) / `Blocked` / `Passed` — an empty match can neither pass nor silently skip |

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| Low | `clanlab validate` exits **0** while reporting blocked assertions; FIXTURE_DSL.md's CLI line reads "nonzero means failed, blocked or invalid" | probe above: exit 0 with `blockedAssertions: 6` | Defensible for `validate` — the requested check is "is this fixture valid", and it never claims the assertions ran (the summary `note` says so). But the rule must bind the moment a command claims to *run* checks: **W0-06's `run` exits nonzero when anything is blocked**, and that is now part of W0-06's own acceptance. No change to `validate`. |
| Low | `parseFixtureText` falls back to `text.length` (UTF-16 code units) when the caller gives no byte count | `parse.ts`; self-reported in the handoff | Real but immaterial: the CLI always passes `statSync().size`, and the limit is 2 MiB against fixtures of ~2 KiB. Fix when a non-ASCII fixture appears. |
| Low | `EventCountEq: 0` (explicit absence) is accepted without requiring the paired positive observation FIXTURE_DSL.md recommends | `LAW-NOTICE-REJECTION` pairs one anyway | Not mechanically checkable — "did this fixture actually exercise its setup" is a judgement. Keep it as review discipline, not a rule that would reject honest fixtures. |
| Info | The envelope re-declares the supplied `contracts/fixture.schema.json` instead of running it | `tests/fixtures/conformance.test.ts` runs every case through ajv **and** the parser and requires agreement | This is the right trade (typed paths, no ajv at runtime) and the guard has already caught a real divergence — the invented "law must start before maxTicks" rule, deleted with a test asserting its absence. Keep the conformance test green as a release condition. |
| Info | `knownReasonIds` defaults to `contracts.MANDATORY_V0_REASON_IDS` | `parse.ts:32` | Correct: the fixture layer cannot invent reasons the frozen contract registry does not contain. |

Contract, ownership, hidden-state and serialization findings: none material. `packages/lab/fixture` constructs no world (checked by reading `parse.ts` end to end — the only outputs are typed errors, skips and a plain `Fixture` value); the sim purity boundary is untouched; the one change inside `packages/sim` (`schema.ts` gaining `mapOf`, a boolean `const` option, and unknown-field errors pointing at the field) regenerates contract v0 with no diff, so contract identity is unchanged.

Acceptance criteria: 1 **PASS**, 2 **PASS**, 3 **PASS** — each reproduced in this session by the probes above, not read from the handoff.

Verdict: **ACCEPTABLE_FOR_INTEGRATION**. Three Low findings, none blocking; one of them (blocked ⇒ nonzero) is carried into W0-06 as a requirement rather than a note.

This is review of the returned candidate, not proof that later merged code passes. Integrated acceptance is recorded in `state/workboard.json` and the STATUS session log.
