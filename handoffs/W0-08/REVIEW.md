# Independent review — W0-08 / attempt 1

Reviewer / role / fresh-context declaration: same developer, **same session as the author** — not a fresh-context review; the relaxed one-window rule applies and Jani accepts in chat. W0-05's review was genuinely fresh-context; this one is not.
Author / base / commit: same developer; base `3675db8` (W0-07 ACCEPTED) through `d8b28b8`, `aa684f8`, `376fff7`, `2ef8517` and this commit — the packet was built in four green slices across two working stretches, with `state/SESSION_RESUME.md` written when the first stretch ended mid-packet.
Checks independently reproduced: `npm run verify` → 0 (**426/426** across 24 files); `npm run test:e2e` → 0 (3 browser tests); `node tools/gen_save_roundtrip.mjs` re-run → no diff; `clanlab run` on SAVE-ROUNDTRIP with a restored-run tape → exit 0, and with a restarted-run tape → exit 1.

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| Medium (found and fixed inside the packet) | `StorageAdapter` was synchronous in slice 1; IndexedDB cannot implement it | the whole interface, `saveCheckpoint`, `loadLatest` and `applyResult` are now Promise-returning, with `MemoryStorage` on the same contract | Fixed before the adapters were written, not after — writing them against the broken interface would have meant writing them twice. Recorded in SESSION_RESUME as step 0 while it was still unfixed. |
| Medium (planning, worth carrying forward) | The card said criterion 3 would be BLOCKED in this sandbox. It is not: it executed and passed | `evidence/playwright.txt` | No code correction. The lesson is procedural: the kit's environment assumptions were overridden at W0-01 and later cards still carry the old ones. Check the environment before copying a card's BLOCKED expectation. |
| Low | `apps/web/src/persistence/**` is an in-scope path with no content | there is no app shell until W0-10 | Deliberate. The adapter lives where both runtimes already reach it; W0-10 wires it to the Worker. Recorded rather than filled with a placeholder. |
| Low | `tests/playwright/**` and `tools/static_server.mjs` are outside the listed in-scope paths | the card names `tests/playwright/persistence.spec.ts` itself | Unavoidable: the spec cannot run without a config and something to serve the module. Additive. |
| Low | The result payload is encoded as JSON inside the container rather than packed fields | `encodeResult` | Matches TP v1.1 §15's explicit allowance ("the first implementation may use canonical JSON payloads inside that container"); migration needs a codec version and round-trip tests, which the format version already supports. |
| Low | Quota and eviction are untested | TP v2.0 §15 names both as the storage risk | Belongs with the app shell (a quota check on start and a visible export action). Not silently dropped — carried into STATUS's risk list. |
| Info | Counters and the event log are not restored | test: restored host reports zero counters, identical digest | Correct: they are diagnostics, they were never in the hash, and claiming a restored process did work it did not do would be a lie in a report. |

Contract, ownership, hidden-state and serialization findings: contract v0 untouched. The dependency direction held and shaped the design rather than being worked around — persistence may not import `core`, so the save format is plain data and `host` owns the mapping; a JSON round-trip test proves no kernel object leaks into the format. Every container section is checksum-verified before any of it is interpreted, and both a flipped byte and a truncated file are distinguished by code.

Acceptance criteria: 1 **PASS**, 2 **PASS**, 3 **PASS** (executed in the sandbox, contrary to the card's expectation).

Verdict: **ACCEPTABLE_FOR_INTEGRATION** — two Medium (one found and fixed in-packet, one procedural), four Low, one Info.

This is review of the returned candidate, not proof that later merged code passes. The packet stays READY_FOR_REVIEW until Jani accepts it in chat.
