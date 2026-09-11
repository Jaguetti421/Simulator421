# The Last Clan — HTML / Browser Pivot Analysis

**Date:** 11 September 2026
**Question:** Could The Last Clan be built as an HTML game, with reduced scope? What would the tech plan look like, how much of the GDD changes, and should the number of AIs be reduced?
**Inputs:** GDD v1 + v1.1 addendum, Technical Plan v1.1, Development Kit v2, the earlier reviews, and the current operating model (one developer — GPT-6 Astra in a browser chat — with Jani testing at phase ends).

---

## 1. Short answer

**Yes, and for this team it is probably the better path.** The simulation is already designed to be engine-independent — integer ticks, no engine physics, no engine types in the core, a renderer that only reads snapshots. That design ports to TypeScript almost line for line. The parts that change are the renderer, the UI, persistence and packaging, and in each of those the browser is either equal or better for an observer game built by an AI agent and tested automatically.

**What HTML does not require:** reducing the number of AIs. 136 actors at 10 Hz is well inside a browser's budget when the simulation runs in a Web Worker and the characters are instanced. If the population is reduced, it should be for design and content reasons (readability, 100 authored identities to write and tune), not because of the target.

**What is lost:** Godot's native desktop packaging and its built-in animation/import editor. Neither is load-bearing here: the kit already chose code-first scenes and a procedural character kit, and a desktop build for Steam is a wrapper (Tauri or Electron) added later.

**GDD impact:** small. Game rules, laws, AI, clans, economy, careers, forecasts, the Story episode and all 51 acceptance scenes are unchanged. The changes are confined to the platform and presentation sections (product assumptions, camera/rendering notes, performance targets, save storage) — roughly the parts marked "engineering" already.

---

## 2. Why the browser fits this team and this game

| Factor | Godot .NET (current plan) | HTML / TypeScript |
| --- | --- | --- |
| The developer's environment (browser chat sandbox) | Can build and test the C# core; cannot run the editor, export or render — every visual check goes to Jani's PC | Can build, test **and render** end to end: Node for the sim, headless Chromium for screenshots. The developer sees its own output |
| Team track record | None with Godot .NET in this context | Several browser games shipped recently with AI agents (React/TypeScript and single-file HTML) |
| Automated testing | Sim: excellent. Renderer/UI: needs a GPU machine | Sim: excellent (same code in Node). Renderer/UI: Playwright screenshots in CI on any runner; GPU numbers still need a real machine |
| Observer UI (dense panels, dossiers, timelines, text) | Control nodes and a Theme, all built in C# | HTML/CSS/React — the strongest possible toolkit for exactly this kind of UI, with browser accessibility (zoom, screen readers) for free |
| 3D tabletop scene with 100+ procedural characters | Straightforward; MultiMesh; shadows | Straightforward; Three.js `InstancedMesh` per kit part; one directional shadow; fog/night as shaders |
| Determinism | Native 64-bit integers | 53-bit safe integers; needs a 32-bit PRNG and a checked-math helper (see §4) |
| Performance headroom for the 100-person finale | Higher | Lower but sufficient at the plan's own operation ceilings; validated by the same G0-style spike |
| Distribution | Windows executable | Web page (itch.io, own site, offline via service worker); desktop wrapper later for Steam |
| Save durability | Files on disk | Browser storage can be evicted; mitigate with export/import and, later, the desktop wrapper |
| Optional local LLM | llama.cpp sidecar | In-browser WebGPU inference exists as an option; still deferred |

The first row is the one that decides it. Under the current operating model, the Godot lane is developed blind and verified by Jani by hand at phase ends. Under HTML, the developer verifies its own rendering every session.

---

## 3. Tech Plan v2 — what changes, section by section

Section numbers refer to Technical Plan v1.1. Unlisted sections are unchanged.

### §1–2 Stack

| Layer | Selection | Notes |
| --- | --- | --- |
| Language | TypeScript everywhere; strict mode | One language, one toolchain, one package manager (pnpm workspace) |
| Simulation | Pure TS package `sim`, no DOM, no rendering imports; runs in a Web Worker in the browser and in Node for tests and batch | Same code in play and in the lab, as the plan requires |
| Renderer | Three.js, WebGL2 baseline | Perspective tabletop camera at 45°, exactly GDD 14.2; `InstancedMesh` for the procedural kit; labels drawn in-canvas (sprites), not DOM, at 100+ actors |
| UI | React (or Solid/Svelte) over HTML/CSS; view models fed by snapshots and events | Panels, timeline, dossiers, forecasts, Why panel, chronicle |
| Content | Versioned JSON compiled into immutable catalogs at build time | Unchanged |
| Persistence | IndexedDB for careers, snapshots and the input journal; JSON export/import for saves and Saga; optional Origin Private File System | Replaces SQLite; exactly-once finalization via an IndexedDB transaction and a unique result key — same rule, different store |
| Tests and tools | Vitest for sim/contract/property tests; Playwright for renderer, UI and screenshot fixtures; `clanlab` as a Node CLI | Fixture DSL unchanged |
| Build | Vite; static output; optional single-file build for distribution | Development stays a normal workspace; the single-file artifact is a packaging option, not the source layout |
| Packaging | Web first (static hosting, offline via service worker); Tauri or Electron wrapper later for Steam | ADR 001 becomes "web now, wrapper when needed" |

### §3 Runtime architecture

Unchanged in shape. The Worker owns the authoritative sim thread; the main thread owns rendering and UI. Commands go in via `postMessage`; snapshots come out per tick as transferable buffers (or `SharedArrayBuffer` where cross-origin isolation allows); the renderer interpolates between the last two snapshots as planned. Headless mode runs the same sim in Node with a null renderer.

### §4 Clock, tick transaction, determinism

Tick stages, integer units, saved remainders, stable ordering: unchanged. Three concrete adjustments for JavaScript:

- **Integers.** JavaScript numbers are exact up to 2^53. Millimeters over an 800 m island, thousandths, squared distances (≈6×10^11) and scored utilities all fit, but the plan's "64-bit intermediates" rule must become a **checked-math helper** (`mul`, `add`, `div` that assert `Number.isSafeInteger` in debug builds, plus a lint rule banning bare arithmetic in `sim/`). Products that could exceed 2^53 are restructured (divide before multiply, or use 32-bit `Math.imul` chains). No `BigInt` in hot paths.
- **PRNG.** PCG32 needs 64-bit state and multiply; replace with a 32-bit-state generator with published test vectors (sfc32 or xoshiro128**), keeping the labeled per-subsystem streams and the "unused stream does not advance core streams" rule.
- **Hashing.** A 32-bit hash built on `Math.imul` (xxHash32 or FNV-1a) over canonical little-endian serialization. Same-build reproducibility holds across browsers because integer arithmetic is specified exactly; the plan's "validated runtime family" clause becomes "validated browser family".

No floats in the sim remains the rule; branded integer types plus the lint rule enforce it.

### §5–11 Spatial, perception, planning, actions, clans, laws, combat

Unchanged. These are algorithms over integer state; they port directly. The route service's per-tick operation budgets, the knowledge-limited graphs, the reservation service, the permission service and the damage batch are all engine-free already.

### §12 Content

Unchanged, except the authoring dock (already deferred) becomes moot: content is JSON, previewed through Playwright screenshot fixtures.

### §13 Presentation

The procedural character kit (three builds, four heads, ten headwear, six accessories, twelve action states) maps directly to Three.js primitives with per-instance transforms and colors; procedural motion runs as per-instance attributes updated from snapshot state. Terrain is a height-field mesh with biome vertex colors; fog and night are shader uniforms; the Fog boundary is a decal ring. The optional rigged GLB kit remains possible later (Three.js loads glTF with skeletal animation), so D06's "art technique does not waive visual quality" stands.

### §14 Observer UI

Simplifies. Every panel is HTML. Text scaling, high contrast and keyboard navigation come from the browser. The Why panel, timeline, forecasts, chronicle, dossiers and Saga export are ordinary web components over the same view models.

### §15 Saves, replay, careers

Same design: snapshot + append-only journal + career projection, exactly-once finalization, branch registry. Store: IndexedDB with versioned object stores; crash safety via IndexedDB's transactional writes and a generation pointer; export any run or the whole career archive as a JSON file; import validates versions. Browser storage eviction is the new risk — mitigate with a visible "export careers" action and quota checks; the desktop wrapper removes the risk entirely when it arrives.

### §16–17 Story, optional LLM

Unchanged. WebGPU in-browser inference replaces the llama.cpp sidecar as the optional path; still deferred behind GL.

### §18 Performance

Targets restated for the browser: 60 fps at 1080p in Chromium on a mid-range discrete GPU; a reduced-effects preset that holds 30 fps on a recent integrated GPU (both TUNE, both measured on real hardware as before). Operation-count ceilings are unchanged and run in CI on any runner. Wall-time and GPU numbers still need Jani's PC — that part does not change.

### §19–21 Lab, verification, repository

`clanlab` is a Node CLI with the same commands and the same fixture DSL. Screenshot fixtures run in headless Chromium (software rendering — adequate for readability checks, not for GPU budgets). Repository layout: `packages/sim`, `packages/content`, `packages/lab`, `apps/web`, later `apps/desktop`. CI on GitHub Actions runs build, Vitest, the fixture subset, kit_check and the Playwright screenshot set on every push — so PRESENT 01-style checks stop being BLOCKED_RENDER for most of development.

### §22–24 First playable and phases

P0 shrinks and stops depending on Jani's machine:

- G0 in the web plan: Node headless kernel and browser Worker produce identical hashes on the synthetic 137-actor workload; a Playwright screenshot of eight procedural identities; IndexedDB save/recover smoke; exactly-once finalization smoke; static build served offline; operation counts recorded. No engine export gate, no TypeScript comparison spike (it is the stack). Roughly 10 packets instead of 17.
- P1–P6 keep their structure and most packets; A4's presentation packets get simpler (HTML UI), A5's persistence packets swap SQLite for IndexedDB, packaging packets in P6 become "static build + optional wrapper".

### §25 Risks

Add: browser storage eviction (export/import; wrapper later); WebGL performance variance across GPUs and browsers (quality presets; measure on two machines); tab throttling in the background (pause when hidden — already the policy); DOM cost of many labels (in-canvas labels); audio autoplay policies (start audio on first click). Remove: Godot/.NET packaging mismatch, editor-only state.

---

## 4. GDD impact

| GDD area | Change | Size |
| --- | --- | --- |
| Product assumptions (platform, offline, session) | "Offline Windows product" → "browser game, offline-capable, with an optional desktop wrapper for stores" | Small |
| Rules, laws, phases, clans, economy, combat, knowledge, forecasts, careers, Story | None | — |
| Presentation §14 | Camera and readability unchanged; add "rendered with WebGL; labels in-canvas; browser text scaling" | Small |
| Performance targets | Restated for browser hardware classes (TUNE) | Small |
| Saves and careers | Storage moves to the browser; add a visible export/import requirement and a note on eviction | Small |
| Accessibility | Easier to meet; note browser zoom and screen-reader support | Small |
| Acceptance scenes (51) | None. PRESENT 01 is produced by screenshot fixtures instead of an engine capture | — |
| Addendum D01–D09 | None; D06 (procedural art acceptable) already anticipates this | — |

In total: a handful of paragraphs in the platform and presentation sections. The design does not move.

---

## 5. Should the number of AIs be reduced?

**Technically: no.** The tick is 100 ms at 1x and 25 ms at 4x; the plan's own AI budget is 5 ms per tick in C#. Even allowing JavaScript a wide margin over C#, 136 actors with the plan's per-tick operation ceilings stay inside the 4x budget, and the plan already tiers decision cadence (urgent every tick, ordinary every 20, strategic every 100). Rendering 136 procedural characters is one draw call per kit part with instancing. The G0 synthetic workload settles it with numbers rather than opinion — and in the web plan the developer can run that workload in its own sandbox.

**For design and content: possibly, and the browser target does not change the argument either way.** The GDD review raised it as B1: 60 minutes across 100 contestants is 36 seconds of attention each; 100 identities, 300 core lines and full tuning are the largest content items in the plan. The GDD kept Standard100. If Jani wants to reduce scope, the cleanest form is the one proposed then: **The Hundred as the roster and career archive; a Standard match draws 40 (TUNE); "Grand Arena" at 100 as a mode gated by the measured G3 evidence.** That cuts per-match readability load and lets content land in stages without changing any rule. It reopens a design decision the designer already made, so it should be a deliberate GDD v1.2 change, not a side effect of the platform.

**Reducing the AI architecture itself: no.** Utility scoring plus authored task methods plus an executor state machine is already the cheap, testable choice. What can be trimmed without hurting the design is fidelity at distance — region-level knowledge for far entities and lower perception cadence for actors outside any player's Focus — and the plan already allows both.

---

## 6. Effect on the Development Kit

Stack-neutral and unchanged: contracts (INTERFACES.md dependency table, boundary records, reason registry), the fixture DSL and schema, GDD_TRACEABILITY.md, gates and their criteria, evidence-maturity rules, the addendum, the role briefs' watchpoints, the templates.

Stack-specific and needing a rewrite: Technical Plan §1–2, §4 (PRNG/hash/checked math), §13–15, §18–21; the P0 packet set; owned paths in the briefs (`src/Sim.*` → `packages/sim/*`, `game/` → `apps/web/`); the P6 packaging packets; CONVENTIONS.md (namespaces, serialization); AGENTS.md's "nonnegotiable engineering boundaries" (replace "no Godot types" with "no DOM or rendering imports in `sim`").

Practical path: issue **Technical Plan v2.0 (web)** and **Work Phases v3** with a new P0; carry P1–P6 forward with path renames and the persistence/packaging swaps. Most of the 145 cards survive with their goals and acceptance lines intact.

---

## 7. What is lost, honestly

- **Native headroom.** If the 100-person finale with full perception turns out to need more than the browser gives, the options are the same as before (tiered cadence, region knowledge, quality presets) but the ceiling is lower. The G0 workload measures this before anything is built on top of it.
- **Save durability without a wrapper.** Browser storage is not a file on disk. Export/import covers it; the desktop wrapper closes it.
- **Store distribution needs a wrapper.** Not a blocker; a later packet.
- **The Godot editor's animation and import tools.** Not used by the kit's code-first plan; Three.js covers glTF and skeletal animation if a rigged kit is ever made.
- **A second runtime comparison.** ADR 001 flips to web on the strength of the operating model and the team's history rather than a spike. That is a judgment call; the G0 workload is the evidence that follows it.

---

## 8. Recommendation

Adopt the web target, with Three.js for the tabletop 3D scene (not a 2D reduction — the GDD's camera and readability design survive intact) and React for the observer UI. Keep the simulation design, the fixture DSL, the gates and the 51 scenes exactly as they are. Decide the population question separately, as a GDD change, if Jani wants the smaller default match.

Three decisions for Jani:

1. **Target:** web now, desktop wrapper later — confirm.
2. **Renderer:** Three.js tabletop 3D as recommended, or a 2D/isometric reduction (cheaper still, but it changes GDD §14 and the character kit).
3. **Population:** keep Standard100 as designed, or adopt the 40-draw with 100-roster as a GDD v1.2 change.

With those three answered, the developer can produce Technical Plan v2.0 and a replacement P0, and the first runnable, screenshot-verified slice arrives inside the developer's own sandbox rather than at the end of a phase on Jani's PC.

*Analysis ends. No performance figure here is measured; every target is a hypothesis for the web G0 workload to confirm.*
