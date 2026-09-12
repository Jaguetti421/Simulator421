# ADR 001 — Web runtime now, native wrapper later

- **Status:** Accepted (W0-11, 12 September 2026)
- **Baseline:** tag `w0-baseline` · G0 candidate
- **Context sources:** TP v2.0 §2 (web-first rationale), §3 (Worker topology), §15 (browser persistence), §21 (boundaries); GDD §"PC first"

## Decision

The Last Clan ships as a **browser application** — a static Vite build, the simulation in a Web Worker, Three.js for presentation, IndexedDB for persistence — and a native wrapper is deferred until a concrete need appears.

## Why

1. **The simulation does not care.** `packages/sim` has no Node built-ins, no DOM, no clock and no floats in consequential paths. W0-10 proved that is real rather than aspirational: a browser Worker importing the same built bytes reaches the same authoritative digests as Node (`4d0bd28a` for 137 actors at 600 ticks, `bc38b04a` for 136 at 250). A wrapper would therefore change distribution, not architecture.
2. **Distribution and iteration.** A static build opens from a URL with nothing to install, which is what makes a playtest a link rather than an event.
3. **Evidence is cheaper.** The whole browser suite — shell, hash parity, persistence, `/capture` — runs in CI on a clean runner with its own Chromium. Screenshots and determinism proofs are produced by the same job that runs the tests.
4. **The known ceilings are acceptable at this stage.** Single-threaded Worker throughput, browser storage quota and eviction, and no OS-level file dialog. The synthetic 137-actor workload runs at roughly 0.2 ms per tick in this sandbox against a proposed 20 ms budget, so the headroom question is real work, not a wall.

## What would reverse this

- Worker throughput failing the tick budget on reference hardware at full population with AI, after profiling — a wrapper does not fix single-thread cost, but it opens native threading options.
- Storage quota or eviction losing a match in practice, where an OS file path would not.
- A distribution requirement (store presence, offline install) that a PWA cannot meet.

Each of those is measurable. None is measurable yet, and none of them is a reason to carry wrapper complexity now.

## Consequences

- Persistence is IndexedDB with export/import as the escape hatch (W0-08; export is P1-33).
- Presentation is Three.js with a procedural kit; a rigged kit replaces primitives behind `AppearanceRecipe` without data changes.
- **`AppearanceRecipe` is not yet a frozen contract record** — TP v2.0 refers to it as existing, but contract v0 has sixteen records and it is not among them. It lives app-level and versioned in `apps/web/src/kit/recipe.ts`; freezing it belongs to a contracts packet. Recorded here because a wrapper decision that assumed the contract existed would be resting on nothing.
- Frame budgets and GPU quality stay **HUMAN_REQUIRED** on real hardware: the sandbox renders with software WebGL, which proves layout and correctness and nothing about performance.
