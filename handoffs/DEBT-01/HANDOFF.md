# Handoff — DEBT-01 (producer-directed debt pass) / attempt 1

Status: **READY_FOR_REVIEW**. Not a workboard packet: Jani directed it in chat on 12 September 2026 — "fix everything you can in the past. Let's not leave anything there that would have belonged to past phases."
Base ID / Git commit: base `77def1f` (P1-03 ACCEPTED) → this commit. Contract v0, 23 records, digest unchanged — no contract was touched.
Goal: close the gaps earlier packets recorded and deferred, rather than carrying them forward as permanent footnotes.

## What was closed

| Debt | Recorded in | Now |
| --- | --- | --- |
| An assertion matching on `reasonId` was always **Blocked** — a committed event cannot carry a reason | W0-06 finding; restated in W0-07; "resolved as a design answer" in G0 evidence | **Closed.** Reason matches resolve against the **acknowledgement** stream, which is where contract v0 puts them. `LAW-NOTICE-REJECTION`'s first assertion — Blocked since W0-06 — now **Passes** against the real kernel |
| No real host: `clanlab run` could only read a hand-authored tape | W0-06 design limit | **Closed.** `clanlab run --host kernel` runs the W0-07 kernel from each fixture's own map seed, **submits the fixture's schedule**, and supplies events, acknowledgements and snapshots. `PERF-OPS-BASE` now runs 13/13 with no tape at all |
| `HashEqualVariant: SaveReload` was Blocked | W0-06, W0-08 | **Closed.** The kernel host saves at `startTick`, restores, advances `advanceTicks` and compares against an uninterrupted run. `ObserverToggle` and `Checkpoint10sVs60s` stay Blocked, now naming observer state (P2) and checkpoint cadence (P3) |
| `availableFrom` cited **W0-07** and **W0-08** long after both shipped | W0-06 strings | **Closed.** Every message names what is actually missing; a test asserts neither packet ID appears in them again |
| An assertion about a system that does not exist was **Failed** | found during this pass | **Closed.** The kernel declares the event types it can emit; an assertion about any other type is **Blocked** with "this host cannot emit … at all, so neither its presence nor its absence is evidence". `AI-03-PATIENT-WAIT` went from a misleading Failed to an honest Blocked |

## What was **not** closed, and why

- **Fixture DSL v1 still cannot express a readability, boundary or information-isolation assertion.** Four packets have now hit it (W0-09, P1-01, P1-03, and `INFO-ISOLATION` again here). Closing it means a new assertion kind in a supplied kit contract plus its registry, validator, samples and runner support — a packet, not a debt-pass patch. **This is the largest remaining piece of past-phase debt and it should be scheduled.**
- **The typed lint rule for bare arithmetic on branded `Int`** (deferred W0-02 → W0-07 → "first P1 packet with comparison-heavy arithmetic", which P1-02 and P1-03 were). Still not delivered. Measured again: `const x: Int = a + b` already fails to compile, so the gap is only expressions consumed as a plain `number`, and closing it needs a type-aware custom ESLint rule. Left undone deliberately rather than half-done.
- **Ten of eleven W0 reviews were same-session.** A fresh-context re-review cannot be produced from inside this session by definition; it needs a new one. The recommendation before G1 stands.
- **The two G0 human checks** (visual judgement of the identities, GPU frame timing) remain deferred to G1 — they need Jani and real hardware.

## Evidence

`evidence/verify.txt` — `npm run verify` → **0**: build, lint, **554/554** vitest across 34 files, 6 python, workboard PASS. `npm run test:e2e` → 0, 17 Playwright tests. `evidence/closed-gaps.txt` — the CLI transcript: LAW-NOTICE-REJECTION passing its reason assertion, the three supplied examples against the kernel, and PERF-OPS-BASE with no tape.

Changed files: `packages/lab/fixture/assertions.ts` (ack matching, accurate blocked reasons), `packages/lab/cli/host.ts` (kernel host, schedule submission, emittable-type declaration), `packages/lab/cli/runner.ts` (host wiring, SaveReload evaluation, unemittable-type rule), `packages/lab/cli/run.ts` (`--host kernel`), `packages/lab/fixture/index.ts`, plus tests: `packages/lab/cli/kernel-host.test.ts` (11 new) and three earlier tests updated where they asserted the behaviour this pass corrected.

Risks: the kernel host implements `ScheduleLaw` only; any other scheduled operation is reported as unsubmitted in the summary and the log rather than ignored. A fixture whose expectations rest on systems that do not exist will now be Blocked rather than Failed, which is the right verdict but does mean a fixture can look "not failing" for a long time — the counts always show it.

Reviewer request: reproduce the evidence and record findings in REVIEW.md.
