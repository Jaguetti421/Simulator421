# Handoff — W0-01 / attempt 1

Status: **READY_FOR_REVIEW**. Never self-mark ACCEPTED — the fresh-context self-review (templates/REVIEW.md) is the next session.
Base ID / Git commit / contract / content: baseline none (PLANNING_ONLY_NO_GAME_SOURCE) → first commit `ed2766fec321584f9f021a1b8c591ffcef9e2ad6` (state/ACCEPTED_BASELINE.json); handoff committed on top of it. Contract version DESIGN_V0_UNIMPLEMENTED; no content.
Goal and implemented behavior: the smallest buildable npm workspace (TP v2.0 §21) with package skeletons and README stubs, strict TypeScript 6.0.3, Vitest 5, ESLint 10 import/global/type boundaries for `packages/sim` (+ Math.random bans for lab/content), a truthful `clanlab` stub, GitHub Actions CI, the production kit imported frozen under `docs/production/` with live copies at the root, and the real sandbox environment recorded. No game logic.

Changed files and purpose:
- `package.json`, `package-lock.json`, `.nvmrc`, `.gitignore`, `.editorconfig`, `scripts/clean.js` — workspace root, exact toolchain pins, scripts (build/test/lint/lab/fixtures/screens/check:workboard/verify).
- `tsconfig.base.json`, `tsconfig.json`, `packages/*/tsconfig.json`, `apps/web/tsconfig.json`, `tests/tsconfig.json` — strict, ESM/NodeNext, project references; `packages/sim` has no DOM lib and no ambient Node types.
- `eslint.config.js` — the boundaries (see README "Boundaries"); `globalIgnores` for dist, node_modules, docs/, reference/, handoffs/.
- `vitest.config.ts` — serial file execution (1 CPU sandbox).
- `packages/sim/{package.json,README.md,index.ts}`, `packages/content/{…,definitions/.gitkeep}`, `apps/web/{package.json,README.md,tsconfig.json,src/index.ts}` — skeletons, no systems.
- `packages/lab/{package.json,README.md,index.ts,cli/index.ts,cli/run.ts,cli/run.test.ts}` — clanlab stub: `--help/--version` exit 0, unknown command exit 2, `validate|run|render` → `NOT_IMPLEMENTED` exit 3 naming W0-05/06/09.
- `tests/arch/boundaries.test.ts` — 44 cases linting synthetic sources at sim/lab/content/web paths through the real config.
- `tools/test_tools.py` — extended: reset-to-planned helper (kit's "initial board" tests stay valid after acceptances), live-board sanity test, `KitSnapshot` (docs/production matches MANIFEST.json, 196 files, no extras beyond adr/ and KIT_IMPORT.md).
- `.github/workflows/ci.yml` — `verify` job (env record, npm ci, build, lint, test, test:tools, fixture subset with continue-on-error + reason, workboard check, artifact); `screens` job `if: false` (BLOCKED_RENDER until W0-10).
- `docs/production/**` (frozen kit + `KIT_IMPORT.md`), root live copies of the kit directories, `README.md`, `state/STATUS.md`, `state/ACCEPTED_BASELINE.json`, `state/workboard.json` (W0-01 → READY_FOR_REVIEW), `handoffs/W0-01/**`.

| Acceptance criterion | Evidence path | Executed result |
| --- | --- | --- |
| 1. `npm ci && npm test && npm run lint` pass on a fresh clone; packages sim/content/lab and apps/web exist with README stubs and no game systems | `handoffs/W0-01/evidence/fresh-clone-verify.txt` (clone of `ed2766f`: npm ci 0, test 0 [49/49], lint 0, build 0, test:tools 0, workboard PASS, fixtures 3 = NOT_IMPLEMENTED as designed); `packages/*/README.md`, `apps/web/README.md` | PASS |
| 2. An import of `three`, `react` or a DOM type inside packages/sim fails lint; demonstrated and recorded | `handoffs/W0-01/evidence/lint-boundary-violation.md` (probe: 7 errors, `npm run lint` exit 1; after deletion exit 0); `tests/arch/boundaries.test.ts` (44 cases); mutation check: removing the sim-purity block made 22 tests fail | PASS |
| 3. ci.yml runs build, lint, test, fixture subset and `tools/check_workboard.py`; a Playwright screenshot job exists but may be BLOCKED until W0-10 | `.github/workflows/ci.yml`; validated locally: PyYAML parse OK, actionlint v1.7.7 no findings; every step's command executed locally (see criterion 1). Execution on a GitHub runner: not possible yet (no push) | PASS (file + local run) / **BLOCKED_TOOL** (runner execution) |
| 4. state/STATUS.md records Node/npm/git versions, browser and GPU availability, and whether GitHub push works; ACCEPTED_BASELINE.json records the first commit | `state/STATUS.md` "Environment observed"; `state/ACCEPTED_BASELINE.json` `gitCommit: ed2766f…` | PASS (push: recorded as **not tested** — no token; reachability verified) |

Commands actually executed, exit codes and concise outcomes:
- `npm install --save-dev --save-exact typescript@6.0.3 vitest@5.0.0 eslint@10.10.0 @eslint/js@10.0.1 typescript-eslint@8.70.0 globals@17.12.0 @types/node@22.20.2` → 0.
- `npm run verify` (clean dist) → 0: build 0; lint 0; vitest 2 files / 49 tests passed; python 6 tests OK; check_workboard PASS (139 packets, 51 scenes).
- Fresh clone (`git clone` → `/tmp/fresh`): `npm ci` 0 (138 packages), `npm test` 0, `npm run lint` 0, `npm run build` 0, `npm run test:tools` 0, `npm run check:workboard` 0, `npm run fixtures` 3 (NOT_IMPLEMENTED). First attempt of this check **failed** (`npm ci` EUSAGE: lockfile lacked the workspace packages) — fixed by `npm install` and re-verified; the bootstrap commit was amended before anything else was built on it.
- `python3 tools/mark.py W0-01 READY_FOR_REVIEW` → 0.
- Environment probes: `node --version` v22.22.2; `npm --version` 10.9.7; `git --version` 2.43.0; `git ls-remote https://github.com/git/git.git` 0; `curl https://api.github.com/` 403 (rate limit body); headless Chromium 141 `--dump-dom` of a WebGL2 probe → `webgl2: OK`, SwiftShader; `canvas@3.2.3` draw+PNG OK; `gl@8.1.6` context null; `playwright-core@1.56.0` browsers.json → chromium 1194 (matches `/opt/pw-browsers`).

Pre-existing baseline failures and observed environment: no baseline existed. Environment table in `state/STATUS.md`. Two kit assumptions were wrong for this sandbox: browsers **are** installed (Playwright 1.56 set) and WebGL2 **works** (software, SwiftShader).

Design decisions within scope and reasons: listed in `state/STATUS.md` "Decisions recorded at W0-01" (layout with frozen kit + live root copies; no `src/` in packages; sim purity by tsconfig + lint incl. float-literal ban; clanlab exit 3 + CI continue-on-error with reason; archive hash sidecar; TypeScript 6.0.3 not 7.0.2 because of typescript-eslint's peer range; `eslint.config.js` because ESLint 10 dropped `.eslintrc`).

Contract proposals or deferred work outside scope: intra-sim dependency direction (`ai` ↛ `core` implementation) and the architecture test extension → W0-04. Branded-`Int` operator lint rule → W0-02. Vite adoption, Playwright pin 1.56.x, `/capture`, real `screens` job → W0-10. Removing `continue-on-error` from the fixture step → W0-06. `docs/production/adr/001-web-runtime.md` → W0-11.

Remaining risks, reproduction and exact next action:
- Risks: toolchain versions post-date the developer's knowledge (verify by running); GitHub push unverified; CI never executed on a runner; software WebGL only.
- Reproduce: `git clone <repo or archive> && npm ci && npm run verify`; then `cat handoffs/W0-01/evidence/*`.
- Next action: **fresh-context self-review of W0-01** (templates/REVIEW.md; read only this handoff and the diff `git show --stat ed2766f..HEAD` / `git diff --stat 4b825dc..ed2766f` for the bootstrap). If ACCEPTABLE_FOR_INTEGRATION: `python tools/mark.py W0-01 ACCEPTED`, then W0-02. With a token: push `main` to origin first.

Source archive/patch and RETURN_MANIFEST.json: `lastclan-W0-01-a01.zip` (repository without node_modules/dist/caches) in the session outputs, with `lastclan-W0-01-a01.zip.sha256` beside it; HEAD commit recorded in `state/STATUS.md`. No RETURN_MANIFEST.json is produced in the single-developer model (the git history is the manifest).

Reviewer request: reproduce the acceptance evidence against the returned files and record findings in `handoffs/W0-01/REVIEW.md`. The reviewer is the next session of the same developer in a fresh context; Jani looks only at phase ends.
