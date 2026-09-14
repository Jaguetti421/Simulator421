# Gate evidence — G0

Candidate baseline / build / content / geometry / contract hashes:
- **Baseline:** tag **`w0-baseline`** — the tag is the identifier, because the commit it points at is the one that contains this document. `git rev-parse w0-baseline` resolves it. Branch `main`, GitHub `Jaguetti421/Simulator421`.
- **Contract:** version 0, 16 records, recordsDigest sha256:291f9b94ce3a4e8ed1b25bddb7258cca73353fed2c451cbe3fb2331e8c253521.
- **Content:** none. No content catalog exists (first content packets are P1); every summary that touches content records `Unavailable` with that packet named.
- **Geometry:** none. No map compiler exists (P1); map recipe and seed are recorded, the compiled digest is `Unavailable`.
- **Authoritative workload digests:** 137 actors / 600 ticks `4d0bd28a`; 136 actors / 250 ticks `bc38b04a`. Identical in Node (main thread and `worker_threads`) and in a browser Worker.

Prerequisite accepted gates and compatibility/retest notes: none — G0 is the first gate. No prior baseline to retest against.

All phase packet reviews and integrated checks:
- **All eleven W0 packets ACCEPTED** (W0-01 … W0-11), each with a handoff and a review in `handoffs/`.
- **Honest note on the review rule.** AGENTS.md requires a fresh-context self-review before ACCEPTED. Only **W0-05's review was genuinely fresh-context** (a new session, a new sandbox, no memory of authoring it). W0-01 through W0-04 were reviewed under the relaxed one-window rule in earlier sessions, and W0-06 through W0-11 were reviewed same-session in this one, each declaring that in its own file, with Jani accepting in chat. That is the producer-approved relaxation from the session prompt, not the written default, and it is the single largest caveat on this gate.
- **Integrated verification on the tagged baseline:** `npm run verify` → exit 0 — build (packages + static site), lint, **461 vitest across 28 files**, 6 python tool tests, workboard PASS with 10 accepted packets. Artifact: `evidence/verify.txt`.
- **Browser suite:** `npm run test:e2e` → exit 0, **17 Playwright tests**. Artifact: `evidence/playwright.txt`. The same suite passes on the GitHub runner with its own Chromium install (run `34686381154`).

| Required criterion | Evidence artifact | Actual environment | Result |
| --- | --- | --- | --- |
| Node headless kernel and browser Worker produce identical canonical hashes on the synthetic 137-actor workload | `evidence/g0-evidence.txt`; `tests/playwright/worker-hash.spec.ts`; `handoffs/W0-07/evidence/digests.txt` | Node 22.22.2 main thread and `worker_threads`; Chromium 1194 Worker, same `packages/sim/dist` bytes over HTTP | **PASS** — `4d0bd28a` (137a/600t) and `bc38b04a` (136a/250t) in all three; a third test shows the two workloads differ from each other, so the equality is not trivial |
| clanlab validates, runs and bundles failures for the example fixtures; a readability PNG renders in the sandbox | `evidence/g0-evidence.txt`; `handoffs/W0-06/evidence/`; `handoffs/W0-09/evidence/present-read-01-t300.png` | Node 22.22.2, node-canvas 3.2.0, no GPU | **PASS** — 3 supplied examples and 3 authored fixtures validate (exit 0); PERF-OPS-BASE runs 13/13 and SAVE-ROUNDTRIP 4/4 against kernel-produced tapes (exit 0); a deliberately failing fixture writes a bundle that `clanlab inspect` reopens with `intact: true`; the readability PNG renders with overlap 0.124, ring contrast 6.24 and 12/12 distinct icons |
| A real 3D screenshot of eight procedural identities is produced through /capture under Playwright with metadata | `handoffs/W0-10/evidence/identity-kit-prototype8.png`, `capture-t300.png`, `capture-metadata.txt`; correction: REVIEW-EXTERNAL-01 (W0-10, High) | Chromium 1194, **software WebGL (SwiftShader)**, 960×540 | **CORRECTED 14 Sep 2026 — originally marked PASS on empty images.** The capture camera targeted `[0,0,0]` while every actor stood near 400 m, so both PNGs cited here showed background and no characters. Nothing caught it: the structural assertions (39 instances, >5,000 bytes) and the PNG metadata were all correct. The camera now targets the actor nearest the crowd centre, the capture tests assert that actors project inside the viewport **and** that the middle of the frame is not background, and both images were regenerated and **looked at**. The criterion is **PASS** on the corrected artifacts; the judgement half remains HUMAN_REQUIRED |
| IndexedDB save/recover and exactly-once finalization smoke pass in Node adapters and in the browser adapter; no duplicate result | `handoffs/W0-08/evidence/playwright.txt`; `packages/sim/persistence/adapter-contract.test.ts`; `tests/playwright/persistence.spec.ts` | MemoryStorage and fake-indexeddb 6.2.2 in Node; the browser's own IndexedDB in Chromium 1194 | **PASS** — one contract suite over all three implementations: round trip, generation advance, fallback from a corrupt newest generation with `fellBackFrom` reported, repeat apply increments once, conflicting payload rejected with `ResultConflict`, failed write never acknowledged. A kernel save round-trips through browser storage and continues to the identical digest |
| Static build serves offline; operation counters, tick timing and the environment are recorded; ADR 001 is written | `evidence/playwright.txt` (offline test); `handoffs/W0-07/evidence/timing.json`; `evidence/g0-evidence.txt`; `docs/production/adr/001-web-runtime.md` | Chromium 1194 with every non-local request aborted; 1 CPU, 3.9 GiB | **PASS** — the built site boots and advances ticks with all external origins blocked and zero requests attempted. Counters over 600 ticks at 137 actors: 82,200 route-like, 657,600 perception-like, 130,424 law queries, 612 events. Per-tick wall time P50 0.19–0.23 ms, P95 0.30–0.42 ms, P99 up to 4.70 ms — **diagnostics only**, 1 CPU, software everything. ADR 001 written |
| Unavailable checks are BLOCKED_RENDER / BLOCKED_TOOL / HUMAN_REQUIRED, never PASS | this table; `state/STATUS.md` risk list; every render and run summary | — | **PASS** — no criterion above is closed by a plan or an unexecuted command. Open items are named as HUMAN_REQUIRED with the step that produces them |

Real human/reference-machine observations and who supplied them: **none yet** — and on 14 September 2026 an external fresh-context review (REVIEW-EXTERNAL-01) showed what that costs: the two images this gate cited as its 3D evidence were empty, and nobody had looked at them. The images are corrected above; the finding stands as the clearest argument in this document for the human checks below. Nothing in this gate has been seen on real hardware or judged by a person. Every visual artifact was produced with software rendering; every timing number came from a 1-CPU sandbox. `JANI_PC_CHECKLIST.md` is the list of what only Jani can supply, and `PLAYTEST_BRIEF.md` is the viewing script.

Known limitations, severity, ownership and reproduction:
1. **No gameplay exists** (high, by design). The kernel is a synthetic motion-and-query workload: no goals, decisions, combat, crafting, economy, clans or terrain. Eight omissions travel with every counter report. Owner: P1.
2. **Visual quality is unjudged** (high for G1, not for G0). Software WebGL, primitives, no human review. Owner: Jani's checklist step 2, then P4.
3. **`AppearanceRecipe` is not a frozen contract record** (medium). TP v2.0 refers to it as existing; contract v0's sixteen records do not include it. It lives app-level in `apps/web/src/kit/recipe.ts`. Owner: a contracts packet.
4. **Fixture DSL v1 cannot express a readability assertion** (medium). The verdict lives in the render summary and exit code instead. Owner: a lab packet.
5. **A reason cannot ride on a committed event** (medium, resolved as a design answer). `CommandAck` carries `reasonId`; `CommittedEvent` does not, and TP v2.0 §3 makes them separate channels. Fixture assertions matching on `reasonId` stay Blocked until the lab reads acks as a second matchable source. Owner: P1-12.
6. **The typed lint rule for bare arithmetic on branded `Int` is not delivered** (low). Measured: `const x: Int = a + b` already fails to compile, so the open gap is only expressions consumed as plain `number`. Owner: the first P1 packet with comparison-heavy consequential arithmetic.
7. **Browser storage quota and eviction are untested** (low). Owner: the app shell packets.
8. **Timing numbers are sandbox diagnostics** (low, but easy to misread). Reference-hardware measurement is Jani's checklist step 3.

Playable/source package and exact review path for Jani:
- Repository `main` at `w0-baseline`, tag `w0-baseline`.
- `npm ci && npm run build`, then serve `apps/web/dist-site` and open `index.html` (the shell) or `capture.html?fixture=PRESENT-READ-01&tick=300&camera=45,30,220` (a capture).
- The two PNGs in `handoffs/W0-10/evidence/` and one in `handoffs/W0-09/evidence/` are the images to look at first.
- `PLAYTEST_BRIEF.md` and `JANI_PC_CHECKLIST.md` in this folder.

Gate verdict: **READY_FOR_JANI_APPROVAL.** Every automated criterion executed and passed; the two items that need a person or real hardware are named as HUMAN_REQUIRED rather than closed.

Jani authorization message and approved next phase/baseline: pending.
