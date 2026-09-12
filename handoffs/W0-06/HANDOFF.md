# Handoff — W0-06 / attempt 1

Status: **READY_FOR_REVIEW**.
Base ID / Git commit / contract / content: base `cf900fe` (W0-05 ACCEPTED, review recorded). Contract version 0 (16 records, unchanged by this packet); fixture DSL version 1; no content catalog yet.
Goal and implemented behavior: `clanlab run` and `clanlab inspect` — the fixture **harness**. A run parses and validates the fixture, takes committed events from a declared host, judges every assertion, counts passed/failed/blocked/skipped separately, writes a machine summary with build, contract, content and geometry identity, keeps all detail in bounded files, and writes a reproducible failure bundle that `clanlab inspect` reopens and checks against its own recorded hashes.

What this packet does **not** ship is a simulation. With the default host nothing runs: every assertion is Blocked and the run exits 4. That is the honest state of the build until W0-07, and the summary says so in words as well as in counts.

Changed files and purpose:
- `packages/lab/cli/runner.ts` (new) — the run engine: per-fixture execution, assertion judging, counts, artifacts, bundle hand-off, exit-code policy.
- `packages/lab/cli/host.ts` (new) — the two hosts. `none` (no run at all) and `tape` (`--events`), which validates every event against the frozen `CommittedEvent` contract and requires the tape to declare its provenance.
- `packages/lab/cli/identity.ts` (new) — build identity (sha256 over the executing code), contract identity (sha256 over the 16 emitted record schemas), content and map-geometry identity marked `Unavailable` with the packet that will supply them.
- `packages/lab/cli/inspect.ts` (new) — reopen a bundle, check it against itself, print failures, ticks, evidence paths and the reproduce command.
- `packages/lab/cli/logfile.ts` (new) — the bounded log buffer, which admits its own truncation in the file.
- `packages/lab/bundle/index.ts` (new) — bundle writer, reader and the `verdictDigest`.
- `packages/lab/cli/run.ts` — `run` and `inspect` argument parsing, the exit-code table in `--help`, an injectable clock, version `0.1.0-w0-06`, and `batch`/`replay` added to the planned-command table naming their packets.
- Tests (new): `packages/lab/cli/{runner,host,logfile}.test.ts`, `packages/lab/bundle/bundle.test.ts`; `packages/lab/cli/run.test.ts` updated because `run` and `inspect` no longer report NOT_IMPLEMENTED.
- `packages/lab/README.md`, `packages/lab/index.ts`, `.gitignore` (`/clanlab-out/`).

| Acceptance criterion | Evidence path | Executed result |
| --- | --- | --- |
| 1. A deliberately failing fixture returns nonzero and writes a bundle that `clanlab inspect` reopens with the failing assertion, tick and evidence paths | `evidence/cli-transcript.txt` §2–§4, `evidence/run-failing.json`, `evidence/inspect.json`, `evidence/bundle-sample/` (the real bundle, committed), `bundle/bundle.test.ts` (12 tests) | **PASS** — `run` on `evidence/demo/W0-06-DEMO-FAIL.json` exits 1 with 1 passed / 1 failed; the bundle holds `bundle.json`, `fixture.json`, `events.json`, `run.log`, `run-summary.json`; `inspect` exits 0 with `FAILED_RUN_REOPENED`, the failing `EventCountGte` at index 1, `evaluatedAtTick 31`, `matchWindow {1..50}`, four absolute evidence paths and the reproduce command |
| 2. Machine output is valid JSON with build/contract/content identity, profile, seed, executed/failed/skipped/blocked counts and artifact paths; detailed logs stay in files | `evidence/run-none-host.json`, `evidence/run-failing.json`, `evidence/cli-transcript.txt` §7, `cli/runner.test.ts` "the machine summary" (6 tests) | **PASS** — every summary carries `identity.build.sourceDigest`, `identity.contract.recordsDigest` (16 records, version 0), `identity.content: Unavailable (content packets P1+)`, per-run `geometry.compiled: Unavailable (map compiler P1)`, profile, seed, `maxTicks`, `finalTick`, the six counts and the artifact paths. A test parses stdout as JSON and asserts it equals the `--summary` file; the assertion detail and the per-type event histogram appear in `run.log` and **not** on stdout |
| 3. Exit 0 only when every requested supported check passed; BLOCKED and skipped counts are visible | `evidence/cli-transcript.txt` §1 and §6, `evidence/mutation-checks.txt` #1, `cli/runner.test.ts` "exit codes" (3 tests) | **PASS** — the three supplied examples with the default host: exit **4**, 6 requested / 0 executed / 6 blocked / 4 skipped checks, no `"Passed"` anywhere in the output. Exit 0 was reached only by a fixture whose two assertions the tape genuinely satisfies. A mixed run (one failing, one blocked) exits 1, not 4 |

Commands actually executed: `npm ci` → 0; `npm run verify` → **0** (build, lint, **350/350** vitest across 18 files — 303 at baseline, **+47** here — 6/6 python, workboard PASS; `evidence/verify.txt`). `clanlab run --fixture contracts/examples` → **4**. `clanlab run --fixture <demo> --events <tape>` → **1**. `clanlab inspect --failure <bundle>` → **0**. `clanlab run` on the passing variant → **0**. Seven mutation checks (`evidence/mutation-checks.txt`), each producing failures and each restored green: blocked no longer forcing nonzero → 5 failures; evaluating `reasonId` matches anyway → 1; the `none` host reporting an empty stream instead of no run → 5; `inspect` trusting the recorded digest → 1; dropping the tape's monotonic-sequence rule → 1; dropping contract validation of tape events → 2; the summary claiming every fixture used the requested host → 1.

Pre-existing baseline failures and observed environment: none — the baseline at `cf900fe` was verified green in this session before any change (303/303). Node v22.22.2, npm 10.9.7, git 2.43.0, Python 3.12.3, 1 CPU / 3.9 GiB, as recorded in STATUS. GitHub Actions was confirmed green for the three most recent pushes, which clears the W0-01 `BLOCKED_TOOL` on CI execution.

Design decisions within scope:
1. **The events have to come from somewhere, and it must be visible where.** A fixture's own `expectAck` is never turned into an event: deriving the expected outcome from the expectation would confirm it with itself and manufacture a pass. So `run` takes events only from a declared tape, and the tape must state `source` and `producedBy` in the file; both appear in the summary, the log and the bundle. Both hosts are watermarked `FakeSim` with `gateEligible: false`.
2. **Blocked is nonzero.** `FIXTURE_DSL.md` says nonzero means failed, blocked or invalid; the W0-05 review carried that in as a requirement for this packet. Exit 4 is reserved for "nothing failed, but something could not be evaluated", and 1 takes precedence over 4.
3. **Four outcomes stay four.** Passed, Failed, Blocked and skipped checks are counted separately at every level, and a Blocked assertion always names the packet that will make it evaluable.
4. **The reproducibility claim is checkable.** `verdictDigest` covers the inputs by hash, the host kind and the failures, and excludes the timestamp and the operator's paths — so two runs of the same failure produce the same digest (demonstrated in `evidence/cli-transcript.txt` §5), and `inspect` recomputes it rather than trusting it.
5. **Bundles are written for invalid fixtures and unusable tapes too**, not only for failed assertions: the same reproducibility question applies.
6. **The requested host and the effective host are reported separately** (found and fixed inside the packet). The first version kept one top-level host block, assigned per fixture, so a multi-fixture run reported whichever host the *last* fixture happened to use — and a tape that binds to one fixture but not another leaves the others on `none`. The summary's `host` block now describes what was **requested** (`requested`, `eventsPath`, `kindsUsed`), and each run carries the host it actually ran on with that tape's hash. Mutation check 7 is the regression test.

Contract proposals or deferred work outside scope:
- **Contract gap found while implementing.** `CommittedEvent` at contract v0 has no `reasonId`, and its `payload.fields` is a closed empty object, so no host can report *why* a command was rejected. The supplied example `LAW-NOTICE-REJECTION` asserts exactly that. The runner therefore reports such an assertion **Blocked**, naming P1-12 — never Failed, because a failure would blame the game for a gap in the contract. **This needs a decision: which packet freezes the rejection event payload, and does `CommandAck` enter the committed-event stream as a typed event?** Recorded as an open question for Jani rather than resolved here.
- `clanlab batch` (seed batches, P3) and `clanlab replay --compare-hashes` (W0-08) remain stubs that exit 3 naming their packets.
- The tape format is the obvious thing for W0-07's kernel to emit; it is versioned (`tapeVersion: 1`) so that can happen without guessing.

Remaining risks, reproduction and exact next action:
- A tape is hand-authored evidence. Nothing in the tool can tell a truthful tape from a wishful one, which is why provenance is mandatory, the watermark is unconditional and `gateEligible` is hard-coded false. When W0-07 produces tapes from the kernel, `producedBy` becomes the thing that distinguishes them.
- `identity.build.sourceDigest` differs between the compiled package and the TypeScript sources under vitest; `sourceKind` records which was executed, so the two are never confused, but they are not comparable to each other.
- Reproduce any of the above from the repository root with the commands in `evidence/cli-transcript.txt`; the demo fixture and tape are committed under `evidence/demo/`.
- Next action: review, then W0-07 (minimal deterministic tick kernel and the 137-actor synthetic workload) — the packet that makes Invariant assertions evaluable and gives `run` a real host.

Source archive/patch and RETURN_MANIFEST.json: not applicable — GitHub is canonical this session; the work is pushed to `main` and the commit is named in `state/STATUS.md`.

Reviewer request: reproduce the acceptance evidence against the returned files and record findings in REVIEW.md.
