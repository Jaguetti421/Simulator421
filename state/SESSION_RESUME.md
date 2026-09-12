# Session resume — W0-08, after slice 1

Written 12 September 2026 at the end of session 2. **W0-08 is IN_PROGRESS, not complete.** The session ran out of working context, not out of work; nothing here is marked done that was not executed.

## Baseline
`3675db8` (W0-07 ACCEPTED) → this commit. `npm run verify` → 0: 400/400 vitest across 22 files, 6/6 python, workboard PASS.

## What slice 1 delivered (green, pushed)
`packages/sim/persistence/index.ts` + `index.test.ts` (17 tests):
- **Versioned section container** — magic, schema version, name-ordered length-prefixed sections, per-section FNV-1a checksum. Detects a flipped byte, truncation, an unknown version, foreign bytes and duplicate names, each as a typed `PersistenceError`.
- **Two-generation durable saves** — the payload is written first and the generation pointer advances last; a failed write throws and is never reported as saved; a corrupt or truncated newest generation falls back to the previous valid one and reports `fellBackFrom` rather than swallowing it; two generations are retained.
- **Exactly-once results** — `applyResult` increments once for a repeat, throws `ResultConflict` when a different payload claims the same key, and uses `add` semantics underneath. `resultKeyFor(runId, finalTick, digest)`.
- `StorageAdapter` interface + `MemoryStorage` (with an injectable write failure).

This covers **acceptance criterion 2 in full** and the storage half of criterion 1.

## What is left (next session, in this order)
0. **Fix the storage interface before adding an adapter — found while writing slice 2, not yet fixed.** `StorageAdapter` is synchronous, and IndexedDB is not. The browser adapter cannot implement this interface, so `saveCheckpoint`, `loadLatest` and `applyResult` must become Promise-returning against an async adapter, with `MemoryStorage` implementing the async contract too. Do this refactor **first**, then write the fake-indexeddb and browser adapters against the fixed interface and run one shared contract suite over all three. Doing it in the other order would mean writing the adapters twice.

1. ~~**Kernel snapshot codec**~~ — **done (slice 2).** `packages/sim/persistence/snapshot.ts` holds the plain-data format (persistence may not import `core`); `packages/sim/host/snapshot.ts` maps `World` onto it; `SimHost.save()/restore()`. Continuation equality, six save/restore cycles, pending commands across a restore, altered bytes refused, and a corrupt newest generation falling back to a usable older one are all tested. Old note kept for context:
   **Kernel snapshot codec** — encode the W0-07 `World` into container sections (actors, laws, both random states, command frontier, event digest, counters excluded) and restore it. Then criterion 1's real claim: snapshot at tick N, restore, continue to tick M, and require the authoritative digest to equal the uninterrupted run's. Watch the dependency direction: check `eslint.config.js` before importing `core` from `persistence` — if the direction forbids it, the world↔sections mapping belongs in `packages/sim/host`, not in persistence.
2. **fake-indexeddb adapter** — `npm i -D fake-indexeddb@6.x` (pin it in STATUS's toolchain table), implement `IndexedDbStorage` against the same `StorageAdapter` contract, and run the *same* suite through it. Factor the existing tests into a shared suite first so both adapters are held to one contract rather than two similar ones.
3. **`tests/fixtures/SAVE-ROUNDTRIP.json`** — the regression-registry fixture; generate it the way `tools/gen_perf_ops_base.mjs` generates PERF-OPS-BASE, and run it through `clanlab run` against a kernel tape.
4. **`apps/web/src/persistence/**` + `tests/playwright/persistence.spec.ts`** — criterion 3. Note the card says "recorded BLOCKED in the sandbox", but the environment note Jani approved at W0-01 supersedes that: Playwright 1.56.x browsers *are* installed here and headless Chromium works, so this may actually be runnable in the sandbox. Try it before recording BLOCKED. It needs `@playwright/test` pinned to 1.56.x (matching browser build 1194) and some page to load — coordinate with W0-10, which builds the app shell; a blank page plus injected module may be enough for a persistence-only spec.
5. Then handoff, review, STATUS, workboard, and the acceptance request.

## Answered without Jani (12 Sep)
The W0-06 "reasonId" open question is **resolved from the repository's own authorities** — see state/STATUS.md. Short form: `CommandAck` already carries `reasonId`; INTERFACES.md and TP v2.0 §3 make acks a separate channel from committed events; so no packet freezes a rejection event payload. The lab needs acks as a second matchable source (tape v2 + matcher), proposed home P1-12. No external agent needed.

## Carried notes
- Push must be gated on the verify exit code (the W0-07 red push, `dc0f944`).
- Open question still unanswered for Jani: which packet freezes the rejection event payload so `CommittedEvent` can carry a `reasonId` (W0-06 finding, restated in W0-07).
