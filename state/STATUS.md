# Project status (web build)

Owner: the developer. Updated 11 September 2026 (W0-01, session 1).

- Kit: The_Last_Clan_Web_Kit_v1 (kit zip SHA-256 `11136c86390b4b146c6eb5de3f87125c25ffdabc18318f6c7e1204d7fa06f179`), imported frozen under `docs/production/` — 196/196 files verified against its MANIFEST.json; live copies at the repository root (see README.md "Layout").
- Baseline: the W0-01 bootstrap commit (see state/ACCEPTED_BASELINE.json). No packet ACCEPTED yet.
- Accepted packets: 0 / 133 shipping + 6 optional PX (W0: 0/11). Gates passed: none.
- Current phase: W0. W0-01 is READY_FOR_REVIEW (fresh-context self-review pending — next session). Next build packet after acceptance: W0-02.
- Continuity: **archive round-trip this session.** Jani created `https://github.com/Jaguetti421/Simulator421` (empty) during the session but no fine-grained token was available, so nothing was pushed; the remote `origin` is configured with the plain URL (no credentials). Next session: with a token, `git fetch` then push `main`; the token is used only via an environment variable and per-command header (AGENTS.md).

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
| Planned at later packets | canvas 3.2.3 (W0-09), @playwright/test 1.56.x (W0-10, must match installed browsers), three, react 19.x, fake-indexeddb 6.x (W0-08) | pinned when introduced, with a note here |

## Decisions recorded at W0-01

1. **Layout:** live kit directories at the repository root (`state/ work/ tools/ templates/ handoffs/ contracts/ design/ agents/ reference/`, plans, AGENTS/CLAUDE/CONVENTIONS) because every card, tool and instruction addresses them root-relative; `docs/production/` holds the delivered kit frozen and hash-verified (`tools/test_tools.py::KitSnapshot`). Only `adr/` and `KIT_IMPORT.md` may be added there.
2. **No `src/` inside packages:** modules live directly under the package directory (`packages/sim/primitives`, `packages/lab/cli`, …) exactly as CONVENTIONS.md maps them; tests are colocated `*.test.ts`. `apps/web` keeps `src/`.
3. **`packages/sim` is pure by type system and lint:** tsconfig `lib: ["ES2023"]`, `types: []`; ESLint bans render/app imports, Node built-ins, DOM/timer/clock globals and types, `Math.random`, transcendental `Math.*`, `parseFloat` and float literals in production files; sim tests may use Node and vitest but keep the render/DOM ban. W0-04 adds the intra-sim direction (`ai` ↛ `core` implementation).
4. **clanlab stub exits 3 (`NOT_IMPLEMENTED`)** for `validate|run|render`; the CI fixture step is `continue-on-error: true` with that reason written next to it, to be removed at W0-06. No stub output can be mistaken for a PASS.
5. **Archive hashing:** an archive cannot contain its own SHA-256. The HEAD commit is recorded here; the archive's SHA-256 travels in a sidecar `lastclan-<packet>-a<NN>.zip.sha256` and in chat. Next session verifies both.
6. **Playwright plan (for W0-10):** pin @playwright/test 1.56.x to the installed browsers; capture 3D screenshots in the sandbox with SwiftShader and label them software-rendered; keep GPU performance/quality as HUMAN_REQUIRED on Jani's PC.

## Session log (one line per session)
| date | packet | session # for packet | status at end | tests added | fixtures authored/failing/passing | blocked checks | rework after self-review | human needed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-09-11 | W0-01 | 1 | READY_FOR_REVIEW | 49 vitest (44 boundary cases, 5 clanlab) + 2 python (6 total in tools) | 0 / 0 / 0 | 2 (CI execution on a GitHub runner: BLOCKED_TOOL; GitHub push: not tested, no token) | n/a (review is next session) | yes — repository token |

## Risks and open questions
- **Toolchain versions post-date the developer's training data** (TypeScript 6, ESLint 10, Vitest 5, Vite 8, Playwright 1.56 browsers). Everything used at W0-01 was executed and observed; nothing is assumed. Expect occasional API surprises in later packets — verify by running, not by memory.
- **1 CPU / 3.9 GiB sandbox:** Vitest runs files serially (`fileParallelism: false`). The 137-actor workload (W0-07) and 100-seed batches (P3) will be slow here; wall-clock numbers from this sandbox are diagnostics only, never budget evidence.
- **Software WebGL only:** 3D captures in the sandbox prove correctness and layout, not frame budgets. Reference-hardware evidence is Jani's PC (templates/JANI_PC_CHECKLIST.md).
- **GitHub push unverified:** the remote exists; the first push happens when a token is supplied. Until then archives are canonical.
- **Frozen kit vs live copies can drift:** intended. Live `design/`, `contracts/` may receive addenda; the frozen copy is the reference for "what was delivered".
