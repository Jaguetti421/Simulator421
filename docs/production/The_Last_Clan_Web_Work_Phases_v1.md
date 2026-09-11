# The Last Clan — Web Work Phases v1

**Status:** the execution plan for the HTML/browser build. 12 September 2026.
**Operating model:** one developer agent does all packets in order; stops at the end of each phase for Jani's playtest and feedback; external review (Jani or another agent) only at phase ends. No per-packet authorization.
**Source of truth for packet state:** `state/workboard.json`. This document explains it; it does not replace it.

---

## 1. Phases and gates

| Phase | Deliverable | Packets | Exit gate | Jani receives |
| --- | --- | --- | --- | --- |
| **W0** | Web foundation and runtime proof | 11 (new) | G0 | Static build with the synthetic workload and eight procedural identities; G0 evidence |
| **P1** | First playable (eight-person valley) | 35 (carried) | G1 | Playable static build + playtest brief |
| **P2** | 24-person Trial, forecasts, careers | 26 (carried) | G2 | Trial build + brief; comprehension study decision |
| **P3** | Standard100, Custom, finale | 20 (carried) | G3 | Standard build + brief; 100-seed batch report |
| **P4** | Presentation and history alpha | 14 (carried) | G4 | Alpha build; readability review pack |
| **P5** | Optional-to-play Story episode | 15 (carried) | GS | Story build; portrayal review pack |
| **P6** | Beta and release candidate | 12 (carried, packaging adapted) | GR | Release candidate (static + optional wrapper) |
| **PX** | Optional local conversations | 6 (carried; deferred) | GL | — |

Packet IDs P1-01 … PX-06 are the Development Kit v2 packets, carried over unchanged in goal and acceptance so that `design/GDD_TRACEABILITY.md` and `state/acceptance_map.json` (all 51 GDD scenes) remain valid. W0 replaces the kit's P0 entirely. Section 4 lists the carried packets whose *implementation* changes for the web stack.

---

## 2. W0 — Web foundation and runtime proof (Gate G0)

Order is the dependency order; execute top to bottom.

| Packet | Title | Depends on | Size |
| --- | --- | --- | --- |
| W0-01 | Bootstrap the workspace, CI and instruction files | — | M |
| W0-02 | Primitives: checked integer math, units, rounding, serialization | W0-01 | S |
| W0-03 | PRNG (sfc32), stream derivation and canonical hashing | W0-02 | S |
| W0-04 | Contracts v0 and dependency boundaries | W0-02 | M |
| W0-05 | Fixture DSL parser, semantic validation and assertion registry | W0-03, W0-04 | M |
| W0-06 | `clanlab` run, summaries and failure bundles | W0-05 | S |
| W0-07 | Minimal deterministic tick kernel and 137-actor synthetic workload (Node + Worker) | W0-03, W0-04 | M |
| W0-08 | Persistence smoke: section container, IndexedDB adapter, exactly-once result key | W0-07 | M |
| W0-09 | Readability renderer and `clanlab render` | W0-06, W0-07 | M |
| W0-10 | Web app shell: Vite, Worker bootstrap, tabletop camera, procedural identity kit, `/capture`, Playwright job | W0-04, W0-07 | L (split allowed: 10a shell + kit, 10b capture + Playwright) |
| W0-11 | Integrate, G0 evidence, playtest brief, stop for Jani | all W0 | S |

**G0 exit** (Technical Plan v2.0 §2): Node and Worker hash equality on the workload; `clanlab` validates/runs/bundles the example fixtures; readability render in the sandbox; 3D screenshot via Playwright in CI or on Jani's PC; IndexedDB save/recover and exactly-once smoke in Node and browser adapters; static build serves offline; counters and environment recorded; unavailable checks blocked, not passed.

**Early runnable slice inside W0:** after W0-07 the developer can already run the synthetic workload headless and hash it; after W0-09 it can see a picture of it in the sandbox; after W0-10 there is a page to open. Aim for that sequence rather than finishing every packet's polish first.

---

## 3. P1–P6 — carried packets, order within each phase

Follow the kit's per-phase sequence (`phases/P1.md` … `phases/P6.md`, copied under `reference/kit_phases/`) with these dependency remaps and ordering notes:

**Remaps (already applied in `state/workboard.json`):** P1-01 depends on W0-11 (was P0-16); P1-27 on W0-10 (was P0-09); P1-33 on W0-08 (was P0-11); P2-20 on W0-08 (was P0-12). The kit's P0-14 (TypeScript comparison) no longer exists.

**Order for an early runnable slice in P1:** P1-01 → 07 → 09 → 12 → 14 → 16 → 17 → 18 (one actor finds food and eats, visible in the readability render) before widening to spatial (02–06), combat (21–24) and client (27–31). The kit's chains P1-09 → 10 → 11 may be relaxed: fatigue (P1-10) and exposure (P1-11) depend on the needs framework in P1-07, not on the food code in P1-09.

**P2–P6:** as in the kit's phase documents. P4 and P5 may interleave after G3 exactly as the kit describes; P5 stays disabled by default in the integrated build.

---

## 4. Carried packets whose implementation changes for the web

The goal and acceptance lines of these packets are unchanged; the *how* is web-specific. Read Technical Plan v2.0 for the overriding section before starting any of them.

| Packet | Web adaptation |
| --- | --- |
| P1-27 Snapshot bridge and interpolation ownership | Worker `postMessage` with transferable buffers; ownership rule per TP v2.0 §3 |
| P1-28 Twelve procedural action motions | Three.js per-instance attributes and state icons; no animation clips |
| P1-29 / P1-30 / P1-31 Selection, timeline, Why panel and feed | React components over view models; keyboard and text-scale from CSS |
| P1-33 First-playable save and replay | IndexedDB adapter (browser) and in-memory / fake-indexeddb (Node); export/import |
| P2-19 / P2-20 / P2-21 Career archive, finalization, forecasts | IndexedDB stores per TP v2.0 §15; `results` with `add` semantics |
| P2-22 Trial UI | React |
| P3-16 / P3-17 Scenario files and Custom UI | JSON export/import via File System Access or download |
| P4-02 … P4-08 Identity kit, motions, lines, cues | Three.js kit refinement; readability renderer updated in step |
| P4-13 Presentation and narrative fidelity review | PRESENT 01 = readability fixtures (automated) + Playwright 3D screenshot matrix (automated) + human review |
| P6-05 Schema fuzz and architecture enforcement | ESLint boundaries + Vitest architecture test replace assembly-reference tests |
| P6-08 Reference hardware budget certification | Jani's PC via `templates/JANI_PC_CHECKLIST.md`; two machines if available |
| P6-09 Offline packaging and clean-PC validation | Static build + service worker; optional Tauri/Electron wrapper; "clean PC" = a fresh browser profile plus, if wrapped, a clean Windows machine |
| PX-01 … PX-06 | In-browser WebGPU inference candidate; still optional and deferred |

Every other carried packet is stack-neutral: implement it in TypeScript from its card and the v1.1 section it cites.

---

## 5. Session protocol (one packet per session)

1. **Start.** Restore the repository (git clone with the session token, or unzip the latest archive). Read `AGENTS.md`, `state/STATUS.md`, the packet card. Run `npm test` on the baseline; if red, fix or report before starting.
2. **Work.** Small steps; after each green run, commit. Write or extend the packet's fixture *before* implementing the behavior where the card names one.
3. **Verify.** Run the packet's tests and fixtures, the five replay seeds if the change is consequential, and the operation-count ceilings it touches. Record exact commands, exit codes and artifact paths.
4. **Fresh-context self-review.** Open a new session with only `templates/REVIEW.md`, the packet's HANDOFF.md and the diff; reproduce the checks; record findings; fix material ones.
5. **End.** Update `state/STATUS.md` (done / next / risks / metrics), `state/workboard.json` (status ACCEPTED only after the self-review), the module README if an interface changed; commit; push or produce the archive; write `handoffs/<packet>/HANDOFF.md`.
6. **If context runs short:** commit, write `SESSION_RESUME.md`, push or archive, stop as IN_PROGRESS. The next session resumes the same packet.
7. **Phase end.** The integration packet produces GATE_EVIDENCE.md, the build, PLAYTEST_BRIEF.md and, where GPU or human checks are needed, JANI_PC_CHECKLIST.md. Then **stop and wait for Jani.** If Jani returns nothing, the next phase starts on the developer's own evidence with human criteria still marked not done.

---

## 6. Metrics to record (for Jani's research comparison)

In `state/STATUS.md`, one line per session: date, packet, sessions used so far on that packet, status at end, tests added, fixtures by state (authored / failing / passing), blocked checks, rework after self-review (yes/no), human intervention needed (yes/no). At each gate: packets accepted, sessions per packet by size, time to first runnable slice, playtest scores from PLAYTEST_BRIEF.md. The same fields are what the Godot track should record, so the two builds can be compared honestly.

---

## 7. Gates and human evidence

Gate criteria are the kit's (`state/gates.json`), with G0 rewritten for the web and "reference hardware" meaning Jani's PC. The G2 criterion "ten real new viewers" is HUMAN_REQUIRED: carry it as not done by default, run a partial study when people are available, and the full study once before G4. Nothing human is ever marked PASS by the developer.
