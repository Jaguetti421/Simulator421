# The Last Clan — web build

A browser survival god game: the player observes 100 named AI contestants who craft, cooperate, betray and survive a sixty-minute competition under announced laws. This repository is the HTML/TypeScript build. Producer: Jani. Developer: one agent, one work packet per session (see `AGENTS.md`).

**State:** W0 (web foundation). No game system exists yet. `state/STATUS.md` is where things stand; `python tools/next_work.py` names the next packet.

## Layout

```
AGENTS.md CLAUDE.md CONVENTIONS.md     operating contract, entry pointer, conventions (live)
The_Last_Clan_Technical_Plan_v2_0_Web.md
The_Last_Clan_Web_Work_Phases_v1.md    the plans (live copies)
design/ contracts/ agents/ reference/  design authority, interface contracts, module guides, history (live)
work/ state/ tools/ templates/ handoffs/   packet cards, workboard + status, planning tools, templates, per-packet handoffs (live)
docs/production/                       the production kit exactly as delivered (frozen; hash-verified by tools/test_tools.py)
packages/sim       @lastclan/sim      the simulation — pure TypeScript, integer, deterministic (TP v2.0 §2–§4)
packages/content   @lastclan/content  versioned JSON definitions → immutable catalogs (TP v1.1 §12)
packages/lab       @lastclan/lab      clanlab CLI, fixtures, readability renderer (TP v2.0 §19)
apps/web           @lastclan/web      Vite + Worker + Three.js + React + IndexedDB (TP v2.0 §3, §13, §15)
tests/arch/                            architecture tests (import boundaries)
tests/fixtures/  tests/playwright/     fixture scenes (W0-05) and browser specs (W0-10)
.github/workflows/ci.yml               build · lint · test · fixtures · workboard; Playwright job blocked until W0-10
```

Why two copies of the kit: every card, tool and instruction addresses `state/…`, `work/…`, `contracts/…` from the repository root, and `state/`, `work/` and `handoffs/` change every session — those are the live copies at the root. `docs/production/` is the kit as Jani delivered it (196 files, SHA-256 per file in its `MANIFEST.json`), kept frozen for provenance; a test fails if it is edited. ADRs go in `docs/production/adr/`.

## Commands

```
npm ci                    install (lockfile is authoritative; Node 22, see .nvmrc)
npm run build             tsc -b: all packages, apps and tests type-check and emit to dist/
npm run lint              eslint . — includes the packages/sim boundaries
npm test                  vitest: tests/arch, package unit tests
npm run test:tools        python unittest for tools/ (workboard, kit snapshot)
npm run check:workboard   python tools/check_workboard.py
npm run lab -- --help     clanlab (stub at W0-01: validate/run/render report NOT_IMPLEMENTED, exit 3)
npm run fixtures          clanlab validate contracts/examples (NOT_IMPLEMENTED until W0-05/W0-06)
npm run verify            build + lint + test + test:tools + check:workboard
python tools/next_work.py what to work on next
```

## Boundaries (enforced)

`eslint.config.js` + `tests/arch/boundaries.test.ts`: nothing in `packages/sim` imports `three`, `react`, DOM types, timers, the wall clock, Node built-ins or `apps/web`; no `Math.random`, transcendental `Math.*` or float literals in `packages/sim` production code; `Math.random` is also banned in `packages/lab` and `packages/content`. `packages/sim/tsconfig.json` has no DOM lib and no ambient Node types, so the same violations are type errors. Render-only floats live in `apps/web`. Rule changes require a note in `state/STATUS.md` (CONVENTIONS.md).

## Continuity

The developer's sandbox resets between sessions; the repository is the memory. GitHub is preferred (push at every green step, token only through an environment variable and a per-command header — never in files, remotes, commits or logs). Fallback: `lastclan-<packet>-a<NN>.zip` of the repository (no `node_modules`, `dist`, caches) at session end, with the HEAD commit recorded in `state/STATUS.md` and the archive SHA-256 in a sidecar `.sha256` file next to it.
