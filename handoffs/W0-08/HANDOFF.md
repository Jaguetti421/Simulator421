# Handoff — W0-08 / attempt 1

Status: **READY_FOR_REVIEW**.
Base ID / Git commit / contract / content: base `3675db8` (W0-07 ACCEPTED) → `2ef8517` + this commit. Contract v0 unchanged; container format v1; world snapshot format v1; event tape v1.
Goal and implemented behavior: the versioned state-section container, an asynchronous storage interface with in-memory, fake-indexeddb and **real browser** IndexedDB adapters, two-generation durable saves, a world snapshot codec with `SimHost.save()/restore()`, and a results store with unique-key add semantics.

Changed files and purpose:
- `packages/sim/persistence/index.ts` — container (magic, schema version, name-ordered length-prefixed sections, per-section FNV-1a checksum), `StorageAdapter` (async), `MemoryStorage`, two-generation saves, exactly-once results.
- `packages/sim/persistence/snapshot.ts` — the world snapshot as **plain data**, because persistence may not import `core` (dependency direction, INTERFACES.md).
- `packages/sim/persistence/indexeddb.ts` — one adapter for both runtimes, with the IndexedDB surface it needs declared structurally so `packages/sim` never touches the DOM lib or a global.
- `packages/sim/persistence/all.ts` — public barrel (container + snapshot + adapter) without a cycle.
- `packages/sim/host/snapshot.ts` — `World` ↔ snapshot mapping; `SimHost.save()` / `SimHost.restore()`.
- Tests: `persistence/index.test.ts` (17), `persistence/adapter-contract.test.ts` (16 — one suite, both Node adapters), `host/snapshot.test.ts` (8), `tests/kernel/kernel.test.ts` (+2 for SAVE-ROUNDTRIP), `tests/playwright/persistence.spec.ts` (3).
- `tests/fixtures/SAVE-ROUNDTRIP.json` + `tools/gen_save_roundtrip.mjs`; `playwright.config.ts`, `tools/static_server.mjs`, `tests/playwright/blank.html`; `fake-indexeddb@6.2.2` and `@playwright/test@1.56.1` pinned exactly.

| Acceptance criterion | Evidence path | Executed result |
| --- | --- | --- |
| 1. Snapshot load plus continuation matches the uninterrupted run's hashes (Node adapters); corrupt or truncated generation leaves the previous valid generation intact | `host/snapshot.test.ts`, `persistence/index.test.ts`, `tests/kernel/kernel.test.ts`, `tests/fixtures/SAVE-ROUNDTRIP.json` | **PASS** — saved at tick 300, restored, continued to 600: identical authoritative digest to an uninterrupted run; six save/restore cycles do not drift; pending commands and the rules version survive; a corrupt or truncated newest generation falls back to the previous one, reports `fellBackFrom`, and the fallback still continues to the right tick-600 state. SAVE-ROUNDTRIP runs green through `clanlab` on a restored-run tape (4/4) and **fails** on a restarted-run tape |
| 2. Applying the same FinalResult twice increments once; a conflicting payload for the same key fails explicitly; a failed write is never acknowledged | `persistence/index.test.ts`, `persistence/adapter-contract.test.ts` | **PASS** — repeat apply reports `alreadyPresent` with count unchanged; a different payload under the same key throws `ResultConflict` and the stored record is untouched; an injected write failure throws and leaves the count at 0 and the previous generation authoritative |
| 3. The browser IndexedDB adapter passes the same suite under Playwright | `evidence/playwright.txt` | **PASS — executed here, not BLOCKED.** Chromium 1194 with `@playwright/test` 1.56.1: the browser's own IndexedDB satisfies the storage contract, generations and fallback and exactly-once behave as in Node, and a kernel save round-trips through browser storage and continues to the identical digest |

Commands actually executed: `npm run verify` → **0** (build, lint, **426/426** vitest across 24 files — 408 at the start of this slice, 400 before it, 350 at the packet's baseline; 6/6 python; workboard PASS). `npm run test:e2e` → **0**, 3 passed. `node tools/gen_save_roundtrip.mjs`; `clanlab validate` on the new fixture → 0.

Pre-existing baseline failures: none.

Design decisions within scope:
1. **The storage interface is asynchronous.** The first version of it was synchronous, and I found while writing the adapter that IndexedDB cannot implement it. Rather than bolt an async variant alongside, the interface, `saveCheckpoint`, `loadLatest` and `applyResult` are all Promise-returning and `MemoryStorage` is held to the same contract — no adapter gets an easier one.
2. **One contract suite, every adapter.** `adapter-contract.test.ts` runs memory and fake-indexeddb through identical assertions, and the Playwright spec runs the third implementation through the same behaviours. "It works in memory" cannot stand in for "it works in the browser".
3. **The save format is plain data.** Persistence may not import `core`, so the snapshot is numbers, strings and arrays, and `host` owns the mapping. A test JSON-round-trips the snapshot to prove no live object leaked into the format.
4. **Diagnostics are not restored.** Counters and the event log start at zero after a restore, because this process did not do that work. The digest is unaffected — they were never in it.
5. **Playwright is not in `npm run verify`.** Verify must pass wherever `npm ci` runs, and the GitHub runner has no browsers. `npm run test:e2e` is the separate gate; CI wiring can come with W0-10.

Contract proposals or deferred work outside scope:
- **The card's expectation that criterion 3 would be BLOCKED in the sandbox is wrong for this environment**, and the environment note Jani approved at W0-01 already said so. It ran. The kit's assumption should not be re-copied into later cards without checking.
- `apps/web/src/persistence/**` is in the card's in-scope paths but has no content: there is no app shell until W0-10, and the adapter it would hold already lives in `packages/sim/persistence` where both runtimes reach it. W0-10 wires it to the Worker.
- Export/import JSON remains a stub per the card's note (P1-33).

Remaining risks, reproduction and exact next action:
- Browser storage eviction and quota are untested (TP v2.0 §15 names both); a quota check on start belongs with the app shell.
- `tests/playwright/**` and `tools/static_server.mjs` sit outside the card's listed in-scope paths; both are needed to execute criterion 3 at all, and the card names the spec file itself.
- Reproduce: `npm run verify`, then `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npm run test:e2e`.
- Next action: review, then W0-09 (2D readability renderer and capture).

Source archive/patch and RETURN_MANIFEST.json: not applicable — GitHub is canonical; the work is pushed to `main`.

Reviewer request: reproduce the acceptance evidence against the returned files and record findings in REVIEW.md.
