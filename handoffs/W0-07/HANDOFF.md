# Handoff — W0-07 / attempt 1

Status: **READY_FOR_REVIEW**.
Base ID / Git commit / contract / content: base `f587b88` (W0-06 ACCEPTED) → `bde23c4` + this commit. Contract version 0 (unchanged); fixture DSL v1; event tape v1; no content catalog.
Goal and implemented behavior: the ten-stage tick transaction, an explicit pause barrier, an authoritative command queue, and a synthetic 136/137-actor motion and query workload, with operation counters, per-tick timing and canonical authoritative hashes — running identically in Node's main thread and in a `worker_threads` worker.

Changed files and purpose:
- `packages/sim/core/world.ts` (new) — world state, the synthetic roster (100 contestants + 36 wildlife + optional guest, GDD §Population), counters, `WORKLOAD_OMISSIONS`, and the authoritative hash over actors, laws, stream states, the command frontier and a chained event digest.
- `packages/sim/core/tick.ts` (new) — the ten stages with their TP v1.1 §4 guarantees, the synthetic workload bodies, stage-2 command validation, bounded event log and the tick boundary check.
- `packages/sim/core/index.ts` (new), `packages/sim/index.ts` — `core` and `host` namespaces on the package entry.
- `packages/sim/host/index.ts` (new) — `SimHost`: pause/resume, `runTicks`, `submit`, `outcomes`, `authoritativeDigest`, `report()` and `eventTape()`. No clock, no timers, no Node built-ins: the same object is what W0-10 will run in a browser Worker.
- `packages/sim/core/tick.test.ts`, `packages/sim/host/host.test.ts` (new, 25 tests) — transaction, determinism, workload, pause barrier, command queue, tape export.
- `tests/kernel/kernel.test.ts` + `tests/kernel/kernel-worker.mjs` (new, 7 tests) — cross-runtime digests and the end-to-end fixture run. These live outside `packages/sim` because they need `worker_threads` and the filesystem, which the kernel may not import by design.
- `tests/fixtures/PERF-OPS-BASE.json` (new) + `tools/gen_perf_ops_base.mjs` — the operation-count and stage-order baseline, generated **from the kernel's own initial world** so the fixture cannot drift from the workload; a test asserts they still agree.

| Acceptance criterion | Evidence path | Executed result |
| --- | --- | --- |
| 1. Same input tape produces equal authoritative hashes across repeated Node runs and between Node (`worker_threads`) and the browser Worker path (browser half BLOCKED until W0-10) | `evidence/digests.txt`, `evidence/timing.json` (`digestsIdentical`), `tests/kernel/kernel.test.ts` | **PASS (Node) / BLOCKED_RENDER (browser)** — 136 actors/600 ticks `bf299b16`, 137/600 `4d0bd28a`, 137/200 `317d9cff`; each identical across two main-thread runs and a `worker_threads` run, and identical again across the three timing runs. The browser half is recorded as BLOCKED_RENDER naming W0-10, in the evidence and as a test, not assumed |
| 2. Pause and tick boundaries are explicit; stage order matches TP v1.1 §4 and is asserted by a fixture | `tests/fixtures/PERF-OPS-BASE.json`, `evidence/perf-ops-base-run.json`, `core/tick.test.ts`, `host/host.test.ts` | **PASS** — `clanlab run` on PERF-OPS-BASE against a kernel tape: **exit 0, 13 requested / 13 executed / 13 passed / 0 blocked**. Ten of those assertions name the ordinal each stage *executed* at (`stage.05.advance`, …), and a test that swaps two markers makes the fixture fail with 2 failures. Pause: a paused host runs 0 ticks and says why; pausing at tick 30 and resuming produces the same digest as running 60 straight; driving the kernel while paused throws instead of half-running a tick |
| 3. Counters and wall-time per tick are reported with the workload's omissions listed; labelled synthetic and cannot satisfy FINALE 01 | `evidence/timing.json`, `SimHost.report()` | **PASS** — over 600 ticks at 137 actors: 82,200 route-like queries (137/tick), 657,600 perception-like (1,096/tick), 130,424 law queries (217.4/tick), 612 events. Per-tick wall time across three runs: P50 0.193–0.227 ms, P95 0.300–0.416 ms, P99 0.348–4.695 ms, max 9.15 ms, against the TP v2.0 §18 **proposed** ≤20 ms Node target. Eight omissions and `cannotCertify` travel inside the same object as the numbers |

Commands actually executed: `npm run verify` → **0** (build, lint, **383/383** vitest across 21 files — 350 at baseline, **+33** here — 6/6 python, workboard PASS; `evidence/verify.txt`). `node tools/gen_perf_ops_base.mjs` → 137 actors, 13 assertions. `clanlab validate --fixture tests/fixtures/PERF-OPS-BASE.json` → 0. `clanlab run` against the kernel tape → 0.

**A red push, recorded rather than hidden:** commit `dc0f944` was pushed while `npm run lint` was failing — my shell chain reported the failure but did not stop, so the push ran anyway. The error was real and useful: `packages/sim/core` may not import `packages/sim/host`, and my first test file did. Fixed in `bde23c4` by moving the host-level tests into `packages/sim/host/host.test.ts`. CI would have caught it; I should have let the exit code gate the push, and the chain is the thing to fix, not the lint rule.

Pre-existing baseline failures: none (350/350 at `f587b88`).

Design decisions within scope:
1. **The stage ordinal is executed position, not a label.** Stage markers commit as `stage.NN.name` where `NN` is the index the stage actually ran at, so reordering the loop changes the event types and PERF-OPS-BASE fails. That is how a fixture can assert order rather than mere presence.
2. **The rejection reason stays out of the committed event.** Contract v0's `CommittedEvent` carries no `reasonId` (the W0-06 finding), so stage 2 emits `command.rejected` with the reason available only from `SimHost.outcomes()`. Encoding it in the event type would have smuggled it past the contract and quietly invalidated W0-06's blocked-assertion rule. A test asserts the reason is absent from the event.
3. **Diagnostics are outside the hash.** Counters, draw counts and the bounded event log do not change the authoritative digest; a test runs the same world with a 5-event log limit and a 100,000-event limit and requires the digests to match.
4. **The fixture is generated from the kernel's initial world** and a test re-derives it, so a change to the roster or the seed cannot leave a stale baseline behind claiming to describe it.
5. **The host owns no platform.** No clock inside `packages/sim`; wall-time is measured by the caller around `runTicks`, which is why `evidence/timing.json` is produced by a script and not by the kernel.

Contract proposals or deferred work outside scope:
- **The deferred typed lint rule (bare arithmetic on branded `Int`) is partly unnecessary and partly still open — it is not done.** Measured, not assumed: `const x: Int = a + b` already **fails to compile** (TS2322, "Type 'number' is not assignable to type 'Int'"), because the brand is lost by arithmetic — so every consequential value that flows into state is already protected by the type system. What the type system does *not* catch is a bare expression consumed as a plain `number`: `a + b > 0`, an array index, or an argument typed `number`. Closing that needs a type-aware custom ESLint rule; I did not write one in this packet. Proposed home: the first packet that does comparison-heavy consequential arithmetic (P1 combat or route scoring), with this finding recorded so the remaining gap is the narrow one and not the whole rule.
- `clanlab` does not yet take the kernel as a host directly — `packages/lab` is out of this card's scope — so the end-to-end path is kernel → tape → `clanlab run`. Wiring a kernel host into the CLI belongs with W0-10 or the first P1 packet that needs it.
- The event tape for 600 ticks is ~196 KB; it is deterministic and regenerated in one command, so it is not committed. `tests/kernel/kernel.test.ts` rebuilds it byte-identically on every run.

Remaining risks, reproduction and exact next action:
- The workload is synthetic in every stage body. Its counters are honest counts of work this kernel did, and nothing more; P1 fixtures replace them.
- Sandbox timing is 1 CPU and single-run noise is visible (P99 4.7 ms in one run, 0.35 ms in another) — diagnostics only, as STATUS records. Reference-hardware timing stays HUMAN_REQUIRED on Jani's PC.
- Reproduce: `npm run verify`, then `node tools/gen_perf_ops_base.mjs` (expect no diff) and the commands in this handoff.
- Next action: review, then W0-08 (persistence smoke: section container, IndexedDB adapter, exactly-once finalization), which is what makes `HashEqualVariant` assertions evaluable.

Source archive/patch and RETURN_MANIFEST.json: not applicable — GitHub is canonical; the work is pushed to `main`.

Reviewer request: reproduce the acceptance evidence against the returned files and record findings in REVIEW.md.
