# The Last Clan — Technical Plan v2.0 (Web)

**Status:** normative for the HTML/browser build. 12 September 2026.
**Relationship to v1.1:** this document keeps v1.1's section numbering and **overrides only the sections listed below**. Every section not listed is unchanged and v1.1 (`reference/Technical_Plan_v1_1.md`) remains the authoritative text for it — the tick transaction, spatial model, perception, planning, actions, clans, laws, combat, wildlife, guest framework, lab design and verification layering all carry over as written. Work cards cite "TP §N"; resolve the section here first, then in v1.1.
**Design authority:** GDD v1 (`design/GDD_v1.md`) plus the v1.1 addendum (`design/GDD_v1_1_Addendum.md`). Nothing in this plan changes a game rule.

---

## 1 Technology decision and product contract (overrides v1.1 §1)

The Last Clan is built as a **browser game**: a static web application that runs offline after first load (service worker), with an optional desktop wrapper (Tauri or Electron) added later for store distribution. Windows-executable delivery is no longer a first-release requirement; a store build is a packaging packet in P6.

Product assumptions that change: platform (browser, Chromium-class engines first; Firefox and Safari verified later), performance targets (§18), save storage (§15), accessibility (browser text scaling and screen readers become the baseline). Session length, population, phases, laws, intelligence and content are unchanged.

## 2 Stack selection and feasibility gate (overrides v1.1 §2)

| Layer | Selection | Constraint or note |
| --- | --- | --- |
| Language | TypeScript, strict; one toolchain (Node 22+, npm workspaces) | No second language. Node is the test host; the browser is the play host |
| Simulation | `packages/sim` — pure TypeScript, no DOM, no rendering, no timers | Runs in a Web Worker in play and in Node in the lab; same bytes |
| Renderer | Three.js on WebGL2 (`apps/web`) | Perspective tabletop camera at 45° per GDD 14.2; `InstancedMesh` per kit part; in-canvas labels |
| Readability renderer | 2D canvas render of any snapshot in `packages/lab` (node-canvas in Node, `<canvas>` in the browser) | Deterministic, testable in the sandbox; also serves as the in-game overview map |
| UI | React over HTML/CSS, fed by view models from snapshots and events | Panels, timeline, Why panel, forecasts, dossiers, Saga |
| Content | Versioned JSON compiled at build time into immutable catalogs (`packages/content`) | Unchanged from v1.1 §12 |
| Persistence | IndexedDB (browser) behind a storage interface; in-memory and `fake-indexeddb` adapters for Node tests; JSON export/import | Replaces SQLite. Exactly-once finalization unchanged in rule |
| Tests and tools | Vitest (unit, contract, property, fixtures); Playwright (renderer, UI, 3D screenshots) in CI; `clanlab` Node CLI | Same fixture DSL as v1.1 |
| Build | Vite; static output under `apps/web/dist`; optional single-file build for sharing | Development is a workspace, not a single file |
| Version control | Git; GitHub repository; CI on GitHub Actions | Continuity across sessions; see AGENTS.md |
| Optional conversations | Deferred; in-browser WebGPU inference is the candidate path | Behind GL as in v1.1 §17 |

**Gate G0 (web) must produce evidence:**

- Node headless kernel and browser Worker produce identical canonical hashes on the synthetic 137-actor workload.
- `clanlab` validates, runs and bundles failures for the three example fixtures.
- A 2D readability render of the workload is produced in the sandbox; a 3D screenshot of eight procedural identities is produced by Playwright in CI (or on Jani's PC if CI is not yet configured), with capture metadata.
- IndexedDB save/recover smoke and exactly-once finalization smoke survive interruption with no duplicate result (Node adapter and browser adapter).
- Static build serves offline; operation counters recorded for the workload; environment (Node version, browser versions, CI runner) recorded.
- Unavailable checks are BLOCKED_RENDER / BLOCKED_TOOL / HUMAN_REQUIRED, never PASS.

There is no runtime comparison spike. ADR 001 is recorded as "web now, desktop wrapper later" with the G0 workload as its first evidence; the revisit trigger is a measured performance failure at G1 or G3.

## 3 Runtime architecture and ownership (amends v1.1 §3)

Shape unchanged: one authoritative simulation thread, a renderer and UI that consume read models, persistence that writes completed checkpoints.

- **Play:** the simulation runs in a **Web Worker**. Main thread → Worker: `PlayerCommand`, speed and pause. Worker → main: per-tick `RenderSnapshot` (transforms and action views as typed arrays in one transferable `ArrayBuffer`; identity and law views as small JSON that changes rarely), `CommittedEvent` batches, `CommandAck`. The three-buffer ownership rule of v1.1 becomes: the Worker transfers a buffer; the main thread owns it until it transfers it back or drops it; the renderer interpolates between the two most recent confirmed snapshots.
- **Lab:** the same `sim` package runs in Node with a null renderer via `worker_threads` or in-process; hashes must match the browser Worker (G0).
- **Host:** `packages/sim/host` is the composition root for both.

## 4 Simulation clock and tick transaction (amends v1.1 §4)

Stages, boundary examples, remainders, stable ordering: unchanged. JavaScript-specific rules:

- **Integers.** All consequential values are integer-valued `number`s within ±2^53. A `checkedMath` module provides `add`, `sub`, `mul`, `divFloor`, `divCeil`, `mulDiv` (multiply then divide without intermediate overflow) and asserts `Number.isSafeInteger` on every result in debug and test builds. Bare arithmetic on branded `Int` values is a lint error in `packages/sim`. Squared distances in millimeters over the 800 m envelope (≈6.4×10^11) and thousandths products stay inside the range; anything that could not is restructured with `mulDiv`. No `BigInt` in hot paths.
- **Floats.** None in `packages/sim`. `Math.sin/cos/sqrt/random` and `Date` are banned by lint; angles use versioned lookup tables; square roots use integer `isqrt`.
- **PRNG.** sfc32 (four 32-bit words, `Math.imul`/shift arithmetic) replaces PCG32. Streams are derived per subsystem by mixing (match seed, stream label) through splitmix32. Test vectors are generated from the reference implementation in W0-03, pinned in the repository and identified by algorithm, seeding rule and byte order. Adding an unused stream does not advance any other stream.
- **Hashing.** Canonical little-endian serialization hashed with a 32-bit `Math.imul`-based hash (FNV-1a as the default; xxHash32 acceptable). Two domains: authoritative state and observer state. Hash every 100 ticks in replay, as in v1.1.
- **Reproducibility scope.** Same build reproduces across Chromium-class browsers and Node because integer arithmetic is exact and specified; cross-browser equivalence is verified at G1, not assumed.

## 5–11 Geometry, navigation, perception, planning, actions, clans, laws, combat

**Unchanged.** Implement from v1.1. These are integer algorithms over the state model and carry over directly, including the per-tick operation budgets, knowledge-limited route graphs, the reservation service, the permission service and the damage batch.

## 12 Content schemas and authoring tools (amends v1.1 §12)

Unchanged in substance. The content compiler is a Node script in `packages/content`; validators run in Vitest; previews are readability renders (§13) and Playwright screenshots. The editor dock is gone rather than deferred.

## 13 Presentation pipeline and contestant identity (overrides v1.1 §13)

- **Procedural character kit** (three builds, four heads, ten headwear, six accessories per GDD 14.1 and addendum D06) built from Three.js primitives with per-instance colors and transforms; one `InstancedMesh` per kit part; clan color and personal accent as instance attributes. The `AppearanceRecipe` contract from v1.1 is unchanged, so a rigged glTF kit can replace primitives later without data changes.
- **Twelve action states** (v1.1 §13 list) as code-driven motion: per-instance offsets, lean, tool raise and state icons updated from snapshot action views; no animation clips required at G1.
- **Terrain:** height-field mesh with biome vertex colors; instanced trees and rocks; decal ring for the Fog boundary; night as a lighting gradient plus point lights at fires; one directional shadow with a reduced-effects preset.
- **Labels:** nameplate, epithet and intent icon drawn in-canvas (sprite atlas or a 2D overlay canvas), never as per-actor DOM nodes.
- **Camera:** perspective tabletop per GDD 14.2 (45° default, 35–65° band, yaw orbit, clamped zoom, close follow at minimum zoom).
- **Readability renderer:** a deterministic 2D top-down render of a snapshot — terrain classes, law boundaries, actors as discs with clan ring, headwear glyph, action icon, nameplate — implemented once in `packages/lab` and reused as the in-game overview. Fixtures assert on it (label overlap count, minimum contrast, every action state distinguishable) and it runs in the sandbox without a GPU.
- **3D screenshots:** `apps/web` exposes a `/capture` route (`?fixture=&tick=&camera=&textScale=`) that loads a fixture, advances to the tick, waits for warm-up frames and renders. Playwright drives it in CI and on Jani's PC; the PNG carries capture metadata (build hash, fixture, tick, renderer string). A screenshot from anything other than the real renderer is not evidence.

## 14 Observer interface and forecasts (amends v1.1 §14)

Unchanged in behavior. Implemented as React components over event-driven view models. Text scale, high contrast and keyboard navigation come from the browser and CSS; the 150 percent text-scale checks in PRESENT 01 are CSS variables, not a custom scaler.

## 15 Saves, replay and career persistence (overrides v1.1 §15)

Design unchanged: snapshot files plus an append-only input journal, career projection, exactly-once finalization with a unique result key, branch registry, hash checks in replay. Storage:

- IndexedDB object stores: `runs`, `snapshots` (key `run/tick`), `journal` (key `run/seq`), `results` (key = result key; `add` semantics so a duplicate key fails the transaction), `careers`, `observer` (separate hash domain), `meta` (schema version, generation pointers).
- Crash safety: a checkpoint is written as a new generation in one IndexedDB transaction and the generation pointer advances last; a failed transaction leaves the previous generation intact.
- Export/import: any run or the whole career archive as a versioned JSON file (File System Access API where available, download otherwise). Import validates schema version and refuses unknown versions.
- Node tests use an in-memory adapter and `fake-indexeddb` against the same interface; the browser adapter is verified in Playwright.
- Risk: browser storage eviction. Mitigation: quota check on start, a visible "export careers" action, and the desktop wrapper when it arrives.

## 16–17 Guest framework, optional conversations

**Unchanged.** Optional conversations, if ever enabled, use in-browser WebGPU inference behind the same isolation rules.

## 18 Performance budgets and measurement (amends v1.1 §18)

Operation-count ceilings are unchanged and run in CI on any runner. Wall-time targets are restated for the browser and remain **proposed until measured**:

| Measure | Proposed target (TUNE) | Where measured |
| --- | --- | --- |
| Simulation tick P95 at 137 actors, Node | ≤ 20 ms | Sandbox and CI (synthetic W0-07 workload; production fixtures from G1) |
| Simulation tick P95 at 137 actors, browser Worker | ≤ 25 ms (sustains 4x) | Playwright timing in CI; Jani's PC |
| Frame time at 1080p, mid-range discrete GPU | ≤ 16.7 ms (60 fps) | Jani's PC (HUMAN_REQUIRED) |
| Frame time, reduced-effects preset, recent integrated GPU | ≤ 33 ms (30 fps) | Jani's PC or a second machine |
| Memory, full population | ≤ 512 MB tab | Chromium task manager on Jani's PC |

## 19 Simulation laboratory (amends v1.1 §19)

`clanlab` is a Node CLI (`packages/lab`) with the v1.1 command set: `validate`, `run`, `batch`, `replay`, `inspect`, plus `render` (readability PNG for a fixture and tick). Summaries are JSON; logs go to files; failure bundles open in the lab. Batch runs matches in `worker_threads` in parallel.

## 20 Verification (amends v1.1 §20)

Layers unchanged. Homes: Vitest for unit, contract, property and metamorphic tests and for fixture scenes; Playwright for renderer, UI, screenshot fixtures and the browser persistence adapter; CI for operation-count ceilings and the replay subset; Jani's PC for GPU timing; humans for readability, comprehension and portrayal review. PRESENT 01 has two halves: the readability renderer (automated, sandbox) and Playwright 3D screenshots (automated in CI, reviewed by a human).

## 21 Repository, build and distribution (overrides v1.1 §21)

```
lastclan/
  package.json              npm workspaces; scripts: build, test, lint, lab, screens
  packages/sim/             primitives, contracts, core, spatial, ai, story, observer, persistence-core, host
  packages/content/         JSON definitions, compiler, validators, catalogs
  packages/lab/             clanlab CLI, fixture runner, assertion registry, readability renderer, failure bundles
  apps/web/                 Vite app: worker bootstrap, Three.js renderer, React UI, IndexedDB adapter, /capture route
  tests/fixtures/           fixture DSL scenes (v1)
  tests/playwright/         renderer, UI, screenshot and browser-persistence specs
  docs/production/          this kit: design/, contracts/, plans, state/, work/, templates/, agents/
  .github/workflows/ci.yml  build, lint, vitest, fixture subset, workboard check; separate job: playwright screenshots
```

Dependency direction inside `packages/sim` follows v1.1 §21 / INTERFACES.md and is enforced by ESLint import boundaries plus a Vitest architecture test: `ai` may not import `core` implementation; nothing in `sim` may import `three`, `react`, DOM types or `apps/web`.

Distribution: `vite build` static output; optional single-file build; offline via service worker; desktop wrapper (Tauri preferred for size, Electron acceptable) as a P6 packet only if a store release is planned.

## 22 The first playable scene

**Unchanged** (v1.1 §22: the 180×180 m valley, eight contestants, the viewing sequence, exit criteria). Delivered as a static build plus a playtest brief.

## 23–24 Delivery and packets

Replaced by `The_Last_Clan_Web_Work_Phases_v1.md`, `state/workboard.json` and `work/`.

## 25 Risks and decisions (amends v1.1 §25)

Removed: Godot/.NET packaging mismatch; editor-only state. Added:

| Risk | Earliest evidence | Response |
| --- | --- | --- |
| Browser storage eviction loses saves or careers | G0 persistence smoke; G2 career tests | Export/import, quota check, desktop wrapper later |
| WebGL performance varies across GPUs and browsers | G1 captures on two machines | Reduced-effects preset; instancing; label atlas |
| Background tab throttling stalls the Worker | G1 | Pause when the tab is hidden (already policy) |
| Safe-integer overflow in scoring or distance math | W0-02 checked-math tests; property tests | `checkedMath` asserts in test builds; `mulDiv` |
| Rendering cannot be verified in the developer's sandbox | W0-09/W0-10 | Readability renderer in the sandbox; Playwright in CI; Jani's PC for GPU |
| Label and DOM cost at 100+ actors | G1 profiling | In-canvas labels only |

ADR 001 (web now, wrapper later) is recorded at G0 with the workload evidence. ADR 002–006 carry over unchanged.

## 26 Sources

GDD v1 and v1.1 addendum; Technical Plan v1.1; Development Kit v2 contracts and traceability; the reviews in `reference/reviews/`.
