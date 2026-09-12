# Project status (web build)

Owner: the developer. Updated 12 September 2026 (W0-06, session 2).

- Kit: The_Last_Clan_Web_Kit_v1 (kit zip SHA-256 `11136c86390b4b146c6eb5de3f87125c25ffdabc18318f6c7e1204d7fa06f179`), imported frozen under `docs/production/` — 196/196 files verified against its MANIFEST.json; live copies at the repository root (see README.md "Layout").
- Baseline: the W0-01 bootstrap commit `ed2766fec321584f9f021a1b8c591ffcef9e2ad6` (see state/ACCEPTED_BASELINE.json). W0-01 ACCEPTED on top of it; ACCEPTED_BASELINE.json is re-cut at the G0 tag (W0-11).
- HEAD at session end: cannot be written here without changing itself (same circularity as the archive hash). The sidecar `lastclan-W0-01-a01.zip.sha256` lists both the archive SHA-256 and the HEAD commit; next session verifies `git rev-parse HEAD` against it and expects `git log --oneline` to show the two W0-01 commits on top of nothing.
- Accepted packets: 5 / 133 shipping + 6 optional PX (W0: 5/11). Gates passed: none.
- Current phase: W0. W0-01 ACCEPTED (producer acceptance, 11 Sep). **W0-02 ACCEPTED** (producer acceptance, 12 Sep; primitives in `packages/sim/primitives`, 94/94 tests). **W0-03 ACCEPTED** (producer acceptance, 12 Sep; sfc32 + labeled streams + two-domain hashing, 124/124 tests). **W0-04 ACCEPTED** (producer acceptance, 12 Sep; contracts v0 frozen — 16 records, 16 schemas, 25 golden samples, reason registry, intra-sim dependency direction in lint; 233/233 tests). **W0-05 ACCEPTED** (fixture DSL v1: envelope, semantics, assertion registry, `clanlab validate`; 303/303 tests. Jani accepted in chat 12 Sep; `handoffs/W0-05/REVIEW.md` is the project's first genuine **fresh-context** review — new session, new sandbox, criteria re-run rather than read: 3 Low, 0 material). **W0-06 READY_FOR_REVIEW** (`clanlab run` and `clanlab inspect`: declared hosts, machine summaries with build/contract/content/geometry identity, bounded logs, reproducible failure bundles; 350/350 tests). Next after acceptance: **W0-07** (minimal deterministic tick kernel and the 137-actor synthetic workload) — the packet that gives `run` a real host.
- Continuity: **GitHub is now canonical.** `https://github.com/Jaguetti421/Simulator421` (private), branch `main`, pushed 11 Sep 2026 after Jani granted the token Contents: Read and write (first attempt was refused 403 read-only). Token used only via environment variable + per-command header; never in files. Each session: clone/fetch with the session token, `npm ci && npm run verify` on the baseline, push at every green step. Archives (`lastclan-<packet>-a<NN>.zip`) are the fallback only when no token is given.

## Environment observed in this sandbox (W0-01, 11 Sep 2026 — supersedes the AGENTS.md note)

| Item | Observed |
| --- | --- |
| OS / hardware | Ubuntu 24.04.4 LTS, x86_64, 1 CPU, 3.9 GiB RAM |
| Node / npm / git / Python | Node v22.22.2, npm 10.9.7, git 2.43.0, Python 3.12.3 (PyYAML available) |
| npm registry | reachable (all installs below succeeded) |
| github.com | reachable (`git ls-remote https://github.com/git/git.git` succeeds); push not tested — no token this session |
| api.github.com | reachable (HTTP 403 = unauthenticated rate limit; other hosts return the proxy's `x-deny-reason: host_not_allowed`) |
| Browsers | **present**, contrary to the kit note: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` with `chromium-1194` (Chromium 141.0.7390.37), `chromium_headless_shell-1194`, `ffmpeg-1011`; also `/opt/google/chrome`. Build 1194 = **playwright-core 1.56.x** (read from its browsers.json; 1.57 wants build 1200, which cannot be downloaded here — cdn.playwright.dev is not an allowed host) |
| WebGL2 in headless Chromium | **works via SwiftShader** (renderer "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))", WebGL 2.0 (OpenGL ES 3.0 Chromium)); `navigator.gpu` present. Software rasterizer: usable for 3D captures and correctness, **not** for performance or GPU-quality evidence |
| GPU | none (`/dev/dri` absent, no `nvidia-smi`); Xvfb present but not needed for headless |
| node-canvas | canvas 3.2.3 installs from prebuilt and works (2D draw + PNG encode) |
| headless-gl | gl 8.1.6 installs but `require('gl')(16,16)` returns null |
| CI runner | none exercised; ci.yml validated locally (PyYAML parse + actionlint v1.7.7, no findings). CI execution is BLOCKED_TOOL until a push happens |

## Toolchain pins (locked at W0-01; change only with a note here)

| Package | Pinned | Reason |
| --- | --- | --- |
| typescript | 6.0.3 | 7.0.2 is the registry `latest`, but typescript-eslint 8.70.0 supports `>=4.8.4 <6.1.0`; 6.0.3 is the newest supported stable |
| eslint / @eslint/js | 10.10.0 / 10.0.1 | flat config (`eslint.config.js`); ESLint 10 has no `.eslintrc`, so the card's `.eslintrc*` path is realised as `eslint.config.js` |
| typescript-eslint | 8.70.0 | recommended rules + `no-restricted-types` for DOM type bans |
| vitest | 5.0.0 | vite 8.3.0 arrives as its peer; Vite itself is adopted for apps/web at W0-10 |
| globals / @types/node | 17.12.0 / 22.20.2 | Node 22 globals and types for lab, content, tests |
| fast-check | 4.10.0 | property tests (W0-02) |
| @thi.ng/random | 4.1.54 | dev-only: independent SFC32 to cross-check the PRNG step (W0-03) |
| ajv | 8.20.0 | dev-only: independent JSON Schema (draft 2020-12) validation of the golden samples (W0-04) |
| Planned at later packets | canvas 3.2.3 (W0-09), @playwright/test 1.56.x (W0-10, must match installed browsers), three, react 19.x, fake-indexeddb 6.x (W0-08) | pinned when introduced, with a note here |

## Decisions recorded at W0-01

1. **Layout:** live kit directories at the repository root (`state/ work/ tools/ templates/ handoffs/ contracts/ design/ agents/ reference/`, plans, AGENTS/CLAUDE/CONVENTIONS) because every card, tool and instruction addresses them root-relative; `docs/production/` holds the delivered kit frozen and hash-verified (`tools/test_tools.py::KitSnapshot`). Only `adr/` and `KIT_IMPORT.md` may be added there.
2. **No `src/` inside packages:** modules live directly under the package directory (`packages/sim/primitives`, `packages/lab/cli`, …) exactly as CONVENTIONS.md maps them; tests are colocated `*.test.ts`. `apps/web` keeps `src/`.
3. **`packages/sim` is pure by type system and lint:** tsconfig `lib: ["ES2023"]`, `types: []`; ESLint bans render/app imports, Node built-ins, DOM/timer/clock globals and types, `Math.random`, transcendental `Math.*`, `parseFloat` and float literals in production files; sim tests may use Node and vitest but keep the render/DOM ban. W0-04 adds the intra-sim direction (`ai` ↛ `core` implementation).
4. **clanlab stub exits 3 (`NOT_IMPLEMENTED`)** for `validate|run|render`; the CI fixture step is `continue-on-error: true` with that reason written next to it, to be removed at W0-06. No stub output can be mistaken for a PASS.
5. **Archive hashing:** an archive cannot contain its own SHA-256. The HEAD commit is recorded here; the archive's SHA-256 travels in a sidecar `lastclan-<packet>-a<NN>.zip.sha256` and in chat. Next session verifies both.
6. **Playwright plan (for W0-10):** pin @playwright/test 1.56.x to the installed browsers; capture 3D screenshots in the sandbox with SwiftShader and label them software-rendered; keep GPU performance/quality as HUMAN_REQUIRED on Jani's PC.

7. **W0-02:** checkedMath asserts safe integers always (not only in test builds); `mulDiv` slow path is pure integer long multiplication with stated preconditions; the typed lint rule against bare arithmetic on `Int` is deferred to W0-04.

8. **W0-03:** the sfc32 *step* is the published algorithm and is cross-checked against an independent implementation; the *seeding rule* is project-defined, versioned by `RANDOM_SEEDING_RULE` and pinned in `packages/sim/primitives/vectors/random-v1.json` (regenerate with `node tools/gen_random_vectors.mjs`). Hash order-independence is achieved by canonical key ordering, not a commutative combiner. Sim tests load the vectors as a typed JSON module, so `packages/sim` still compiles with no Node types anywhere.

9. **W0-04:** contract records are declared once in a small typed DSL that emits the TS type, the validator, the JSON Schema and the canonical codec, so those four cannot drift; cross-field invariants live in `refine(...)` and are annotated as `x-refinements` in the emitted schema (JSON Schema cannot express them, and the sample manifest records which layer enforces each rejection). The intra-sim dependency direction from INTERFACES.md is now lint, composed into **one** `no-restricted-imports` rule per module — a second block for the same rule key would have silently replaced the first. Operation and event payload *fields* stay open at v0 and are frozen per operation by the packet that implements it.

10. **W0-05:** the fixture envelope is re-declared with the contract DSL and kept honest by a conformance test that runs every case through both ajv (the supplied `contracts/fixture.schema.json`) and the parser, requiring agreement on structural verdicts and requiring semantic-only rules to be genuinely beyond JSON Schema. Two of my own claims were corrected by that discipline: an invented "law must start before maxTicks" rule was deleted after it rejected a supplied example, and the tick-0 schedule rule turned out to be structural. Skipped checks (no content catalog) and Blocked assertions (no simulation) are reported as such and can never read as passes; `clanlab validate` is implemented and CI no longer needs `continue-on-error` on the fixture step.

11. **W0-06:** `clanlab run` is the harness, not a simulation. Events come only from a **declared** host — `none` (no run: every assertion Blocked, exit 4) or `tape` (`--events`, every event validated against the frozen `CommittedEvent` contract, and the file must state `source` and `producedBy`). A fixture's own `expectAck` is never turned into an event: deriving the outcome from the expectation would confirm it with itself. Both hosts are watermarked FakeSim with `gateEligible: false`. **Blocked is nonzero** (exit 4; FIXTURE_DSL.md says nonzero means failed, blocked *or* invalid), and 1 takes precedence over 4. Failure bundles carry copies of every input plus a `verdictDigest` that excludes the clock and the operator's paths, so the same failure hashes the same twice and `clanlab inspect` recomputes it rather than trusting it.

## Session log (one line per session)
| date | packet | session # for packet | status at end | tests added | fixtures authored/failing/passing | blocked checks | rework after self-review | human needed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-09-11 | W0-01 | 1 | ACCEPTED (producer) | 49 vitest (44 boundary cases, 5 clanlab) + 2 python (6 total in tools) | 0 / 0 / 0 | 2 (CI runner execution: BLOCKED_TOOL; GitHub push: refused 403, token lacks write) | waived — fresh-context review replaced by Jani's explicit acceptance; same-session review found 3 Low, 0 material | yes — token permission |
| 2026-09-12 | W0-02 | 1 | ACCEPTED (producer) | 44 vitest (13 fast-check properties) | 0 / 0 / 0 | 0 | waived — producer acceptance; same-session review found 2 Low | no |
| 2026-09-12 | W0-03 | 1 | ACCEPTED (producer) | 30 vitest (13 fast-check properties) + 4 mutation checks | 0 / 0 / 0 | 1 (cross-runtime stream equality: deferred to W0-07/W0-10 by the card) | waived — producer acceptance; same-session review found 2 Low | no |
| 2026-09-12 | W0-04 | 1 | ACCEPTED (producer) | 109 vitest (44 contracts, 29 samples/ajv, 36 arch) + 3 mutation checks | 0 / 0 / 0 | 0 | waived — producer acceptance; same-session review found 1 Medium (found and fixed in-packet, with a regression test) and 3 Low | no |
| 2026-09-12 | W0-05 | 1 | ACCEPTED (producer + fresh-context review) | 75 vitest (53 lab, 22 conformance) + 4 mutation checks | 3 authored / 0 failing / 0 passing (parse-only; running them is W0-06) | 2 (Invariant assertions → W0-07; HashEqualVariant → W0-08) | none material — fresh-context review (session 2) reproduced all three criteria and found 3 Low | no |
| 2026-09-12 | W0-06 | 1 | READY_FOR_REVIEW | 47 vitest (16 runner, 13 host, 12 bundle/inspect, 4 log, 2 CLI) + 7 mutation checks | 2 authored (1 deliberate-failure demo, 1 passing variant) / 1 failing as designed / 1 passing | 6 blocked assertions on the three supplied examples (no simulation until W0-07); reasonId matching blocked by contract v0 | pending | no |

## Risks and open questions
- **Toolchain versions post-date the developer's training data** (TypeScript 6, ESLint 10, Vitest 5, Vite 8, Playwright 1.56 browsers). Everything used at W0-01 was executed and observed; nothing is assumed. Expect occasional API surprises in later packets — verify by running, not by memory.
- **1 CPU / 3.9 GiB sandbox:** Vitest runs files serially (`fileParallelism: false`). The 137-actor workload (W0-07) and 100-seed batches (P3) will be slow here; wall-clock numbers from this sandbox are diagnostics only, never budget evidence.
- **Software WebGL only:** 3D captures in the sandbox prove correctness and layout, not frame budgets. Reference-hardware evidence is Jani's PC (templates/JANI_PC_CHECKLIST.md).
- **Token hygiene:** the token was pasted in chat; Jani may rotate it at any time — the developer needs it only per session. CI on the GitHub runner is **green**: the Actions API reports `completed / success` for `1a3d478`, `678fe94` and `e14e0a6` (checked 12 Sep, session 2), so the runner really executes build, lint, vitest, python and the workboard check. This clears the W0-01 BLOCKED_TOOL on CI execution.
- **W0-01 acceptance was producer acceptance, not a fresh-context review.** Recorded honestly in the metrics; later packets return to the fresh-context rule unless Jani says otherwise.
- **Open question for Jani (W0-06):** contract v0's `CommittedEvent` carries no `reasonId` and its payload fields are closed, so no run can report *why* a command was rejected — which the supplied `LAW-NOTICE-REJECTION` example asserts. The runner reports such assertions Blocked (naming P1-12), never Failed. Which packet freezes the rejection event payload, and does `CommandAck` enter the committed-event stream as a typed event?
- **A tape is hand-authored evidence.** Nothing in the tool distinguishes a truthful tape from a wishful one, which is why provenance (`source`, `producedBy`) is mandatory, the FakeSim watermark is unconditional and `gateEligible` is hard-coded false. W0-07's kernel becomes the first non-human `producedBy`.
- **Frozen kit vs live copies can drift:** intended. Live `design/`, `contracts/` may receive addenda; the frozen copy is the reference for "what was delivered".
