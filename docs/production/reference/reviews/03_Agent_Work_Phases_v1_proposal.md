# The Last Clan — Agent Work Phases v1

**Purpose.** Replace Technical Plan v1.0 §23–24 (human-team roadmap and backlog) with a phase plan built for AI coding agents: session-sized work packages, a handoff protocol that survives context cutoffs, and model routing for Claude Opus 5, Claude Fable 5.1, and GPT-6 Astra.
**Keeps.** Every gate (G0–G4, GS, GL) and every acceptance scene from the Technical Plan. Only the delivery model changes.
**Date.** 11 September 2026. Model facts are from vendor and third-party publications in the week before this date; they are provisional and should be re-checked after P0 with the project's own fixtures.

---

## 1. Why sessions run out of tokens, and the fixes

| Cause | Fix in this plan |
| --- | --- |
| The task is bigger than one session | One work package (WP) per session; a WP is one system plus its fixture, ending green |
| The agent re-reads the repository to find out where things stand | `docs/STATUS.md` (one page) and the WP ticket are the only required reading; module READMEs on demand |
| Large files enter the context | Source files capped at ~400 lines; content split into many small JSON files; generated catalogs, exports, and logs in ignored directories |
| Test and batch output floods the context | Runner prints one line per fixture plus the first failure; everything else goes to files and the failure package |
| Work is lost at cutoff | Commit at every green step; a `HANDOFF` section in the ticket records the exact next action and failing test |
| The agent explores instead of building | Ticket lists an allow-list of files in scope; anything else requires a note, not an edit |
| Long-running batches inside a coding session | Batches run in CI or on the reference PC; sessions read the report |
| Stable context re-sent every turn | Instruction files and contracts form a stable prefix; Fable 5.1's cheaper cache reads help on long sessions, and Codex with Astra can carry notes across context windows |

---

## 2. Repository conventions for agents

Layout follows Technical Plan §21. Additions:

```
AGENTS.md                # read by Codex (Astra); ≤ 1 page: conventions, protocol, commands
CLAUDE.md                # read by Claude Code (Opus/Fable); same content, same length
docs/STATUS.md           # ≤ 1 page: current gate, last done WP, next WP, open risks
docs/ARCHITECTURE.md     # ≤ 2 pages: module map, tick stages, contracts pointer
docs/CONVENTIONS.md      # file size caps, naming, integer rules, forbidden APIs, test naming
docs/adr/                # architecture decisions (TP §25)
docs/wp/WPx.y.md         # one ticket per work package (template in §4)
src/*/README.md          # ≤ half page per module: purpose, public surface, fixtures that cover it
tests/fixtures/*.json    # fixture DSL scenes (Tech Plan Review T14)
```

**Rules every ticket inherits**

- Simulation code: integers only, project PRNG only, no engine references, no wall-clock, no dictionary iteration in consequential paths. Enforced by source tests, not by trust.
- Godot client: scenes and UI constructed in C#; `.tscn` limited to a minimal root; shaders as text files; screenshots via `clanlab screenshot`.
- Every WP adds or extends a fixture and records its operation-count budgets.
- Output discipline: `clanlab` and the test runner print summaries; logs go to `out/` (ignored).

---

## 3. Session protocol

**Build session**

1. Read `AGENTS.md`/`CLAUDE.md`, `docs/STATUS.md`, and `docs/wp/WPx.y.md`. Read nothing else unless the ticket lists it.
2. Run the short suite (`clanlab test --short`). If red, stop and report — do not start the WP on a broken baseline.
3. Implement in small steps. After each green run: `git commit -m "WPx.y: <step>"`.
4. Add or extend the WP's fixture; run it plus the affected fixtures; record budgets in the ticket.
5. Update `docs/STATUS.md` (three lines: done / next / risks), the module README if an interface changed, and the ticket checklist. Commit `WPx.y: done`.
6. If the context is filling or the scope grows: commit, write the `HANDOFF` section (next step, failing test name, files touched), stop. The next session resumes from the last commit.

**Review session** (a different model from the builder)

1. Read the ticket and the diff; run the short suite and the WP's fixtures.
2. Write review notes into the ticket: correctness, contract adherence, test adequacy, budget sanity.
3. Approve, or open a follow-up WP. Trivial fixes may be committed directly; anything else is a new WP.

**Stop rules**

- A WP that needs a third session is split.
- A fixture that cannot be written for a WP means the WP is mis-scoped; rewrite the ticket first.
- A human decision (ADR, design clarification, visual acceptance) blocks a WP; the agent records the question in the ticket and stops rather than guessing.

---

## 4. Work package ticket template

```
# WPx.y — <title>
Gate: G1 | Tech Plan: §5, TECH 05 | Size: S/M
Goal: <one sentence>
In scope (allow-list): src/Sim.Spatial/Routing/*, tests/fixtures/AI-05*.json
Out of scope: motor, avoidance, cache tiering
Read first: docs/ARCHITECTURE.md §Spatial, src/Sim.Spatial/README.md, docs/adr/003.md
Inputs: Sim.Contracts v0.3 (RouteRequest, RouteResult)
Steps:
  1. ...
  2. ...
Tests to add: AI-05-blocked-route; PERF-OPS-routing (≤ N expansions)
Budgets to record: routeExpansions per job, per tick
Definition of done: fixtures green; budgets recorded; README updated; STATUS updated; review by <model>
Builder: <model>   Reviewer: <model>   Human: <none | decision | visual accept>
HANDOFF: (filled only if the session stops early)
Review notes:
```

---

## 5. Model roles and routing

Roles are shaped by the published evidence: Fable 5.1 leads on long-horizon, multi-file, mergeable work and frontend/design taste; Opus 5 is half the price and solved slightly more hard tasks outright in one head-to-head while being less token-efficient; Astra leads on 3D/spatial benchmarks and terminal work but tends to over-complicate and drift generic on UI. Re-validate on this project's own fixtures after P0.

| Task type | Builder | Reviewer | Why |
| --- | --- | --- | --- |
| Contracts, repo skeleton, fixture DSL, cross-cutting refactors | Fable 5.1 | Opus 5 | long-horizon, mergeable code |
| Simulation systems with a clear spec and fixture | Opus 5 | Fable 5.1 | cost; reliable on specified work |
| Spatial: terrain compile, LOS, hierarchical routing, motor and avoidance, projectile sweep, crowd | Astra | Fable 5.1 | 3D/spatial strength; bounded tasks |
| AI planner core, beliefs and provenance, temporal waits | Fable 5.1 | Opus 5 | subtle multi-file logic |
| Persistence, codecs, career DB, batch runner, reports | Opus 5 | Fable 5.1 | well-specified |
| Godot client bridge, view models, UI, theme | Fable 5.1 | Opus 5 | design taste; keep Astra off UI |
| Procedural mesh kit, shaders, MultiMesh chunking, Blender scripts | Astra | Fable 5.1 + human visual | 3D strength |
| TypeScript/Babylon spike | Astra | Fable 5.1 | web strength |
| Content drafting from schema (profiles, dialogue templates) | Opus 5 | human designer | cost, volume |
| Determinism and replay divergence debugging | Fable 5.1 | — | must hold many threads |
| Performance: engine side | Astra | Opus 5 | |
| Performance: simulation side | Fable 5.1 | Opus 5 | |
| Story systems | Opus 5 | Fable 5.1 + narrative editor | |

**Human (Jani):** ADRs and design clarifications, visual acceptance from screenshots, Godot editor-only steps (import settings, templates), reference-PC captures, playtests, gate sign-off. Every WP is designed to make this review short: green fixtures, budgets, screenshots, failure packages.

**Cost shape (rough).** Opus 5 on roughly two thirds of WPs by count; Fable 5.1 and Astra on the rest at twice the list price. Cross-model review roughly doubles session count for a WP but is the cheapest defense against model-specific blind spots.

**Parallelism.** Models are not people: several sessions of the same model can run at once. The real limit is human review and integration. Lanes below are designed so that after the contracts freeze, up to four lanes run concurrently with one integration commit per day.

---

## 6. Phases and work packages

Sizes: S = one session comfortably; M = one session with a mid-point commit. Anything larger is split before it starts. "TP" references are Technical Plan sections and tickets.

### P0 — Foundation and feasibility (Gate G0)

| WP | Scope | Builder / Reviewer | Human | Depends on |
| --- | --- | --- | --- | --- |
| WP0.1 | Repo skeleton, assemblies, dependency and source-rule tests, `AGENTS.md`/`CLAUDE.md`, `STATUS`, `ARCHITECTURE`, `CONVENTIONS`, CI (compile, test, validate) — TP §21, TECH 01/02 | Fable / Opus | approve | — |
| WP0.2 | Units, IDs, fixed-point helpers, angle LUTs, project PRNG with test vectors and stream labels, canonical hash writer — TP §4, TECH 02 | Opus / Fable | — | 0.1 |
| WP0.3 | `Sim.Contracts` v0: commands, acks, event headers and first typed payloads, snapshot schema, reason codes with text keys, golden sample files — TP §3, §12, Review T12 | Fable / Opus + Astra | sign-off | 0.1 |
| WP0.4 | Fixture DSL: schema, loader, assertion library, summary-only runner, failure-package writer; `clanlab run/validate/test` — TP §19, Review T14 | Fable / Opus | — | 0.2, 0.3 |
| WP0.5 | Godot project scaffold: solution wiring, code-first root scene, CLI export script, `clanlab screenshot`, snapshot bridge stub against `FakeSim` — TP §2, §3, Review T5 | Fable / Opus | install 4.7.2 + .NET; clean-machine export | 0.3 |
| WP0.6 | Stress fixture v0: 137 moving, perceiving actors on a placeholder grid; counters — TECH 14 (part) | Opus / Astra | — | 0.2–0.4 |
| WP0.7 | TypeScript/Babylon/Electron spike on the same fixture and counts; agent-verifiability notes — TP §2, Review T16 | Astra / Fable | measure; write ADR 001 | 0.4 |
| WP0.8 | Tier 0 presentation: primitive character kit, palette table → Theme, procedural motion, state icons, tabletop camera — TP §13, Review T6 | Astra (mesh, motion) + Fable (camera, theme) / Opus | visual accept via screenshots | 0.5 |

**G0 exit** (TP §2): clean-machine export; console runner and client produce identical hashes on the small fixture; Tier 0 kit renders; stress fixture survives without stalls; save write/reload/finalize smoke; ADR 001 recorded. Also: throughput measured — WPs completed per week and sessions per WP — as the basis for all later estimates.

### P1 — First playable (Gate G1)

Four lanes after WP1.1–1.2 land: Core (Opus), Spatial (Astra), AI (Fable), Client (Fable). Persistence rides in Core.

| WP | Lane | Scope | Builder / Reviewer | Human | Depends on |
| --- | --- | --- | --- | --- | --- |
| WP1.1 | Core | Tick loop, ten stages, pause barrier, command queue and acks — TP §4, TECH 03 | Opus / Fable | — | P0 |
| WP1.2 | Core | Law calendar, PermissionService v0 (hard permissions, phases), intervention validation — TP §10, TECH 03/12 (part) | Opus / Fable | — | 1.1 |
| WP1.3 | Spatial | Terrain manifest compile (height field, traversal classes, regions, cover), spatial hash, LOS raycast with ray budget, crossing-time validator — TP §5, TECH 04, Review T4/T10 | Astra / Fable | — | P0 |
| WP1.4 | Spatial | Hierarchical routing, per-tick-complete jobs, two-tier cache — TP §5, TECH 05 (part), Review T8/T9 | Astra / Fable | — | 1.3 |
| WP1.5 | Spatial | Kinematic motor, avoidance candidates, passage reservations, stuck diagnostics — TP §5, TECH 05 (part) | Astra / Fable | — | 1.4 |
| WP1.6 | AI | Belief store, sensory queries, `ActorKnowledgeView`, provenance, eviction; information-isolation test — TP §6, TECH 06 | Fable / Opus | — | 1.1, 1.3 |
| WP1.7 | Core | Inventory transactions, reservation service, leases, conservation property tests — TP §8, TECH 07 | Opus / Fable | — | 1.1 |
| WP1.8 | Core | Needs (hunger, rest, exposure) with remainder accumulators; day/night calendar — TP §10, TECH 08 (part) | Opus / Fable | — | 1.1 |
| WP1.9 | AI | Utility goal selection with decision trace (candidates, scores, rejection reasons, evidence age) — TP §7, TECH 08 (part) | Fable / Opus | — | 1.6 |
| WP1.10 | AI | Task methods v0: AcquireFood, Rest, Carry/Deliver, WaitForLaw; horizon and deadlines — TP §7, TECH 08 (part) | Fable, then Opus for further methods / Opus | — | 1.9, 1.7 |
| WP1.11 | Core | Executor state machine, interrupts, revalidation, typed failures — TP §8, TECH 08 (part) | Opus / Fable | — | 1.7, 1.10 |
| WP1.12 | Core | Sockets, build milestones, consumed-input ledger, salvage — TP §8, TECH 09 | Opus / Fable | — | 1.5, 1.7 |
| WP1.13a | Spatial | Projectile segment sweep against obstacles and actor discs — TP §11, TECH 12 (part) | Astra / Fable | — | 1.3 |
| WP1.13b | Core | Wind-up/recovery, melee contact, damage batch, downed/bleed, rescue action, truce interplay, attribution episodes — TP §11, TECH 12 (part) | Opus / Fable | — | 1.2, 1.11, 1.13a |
| WP1.14 | Core | Wildlife v0: wolf and deer species policies — TP §11 | Opus / Fable | — | 1.13b |
| WP1.15 | Core | Snapshot codec, input journal, replay with hash checks, crash-safe write; round-trip and checkpoint-invariance tests — TP §15, TECH 13 | Opus / Fable | — | 1.1, 1.7 |
| WP1.16 | Client | Snapshot bridge (three-buffer), interpolation, Tier 0 actor presentation, selection — TP §3, §13, TECH 11 (part) | Fable / Opus | screenshot review | 0.5, 0.8 |
| WP1.17 | Client | View models and UI: top bar, timeline, follow, intent labels, Why panel, chronicle feed; Why ↔ trace contract test — TP §14, TECH 11 (part) | Fable / Opus | screenshot review | 1.16, 1.9 |
| WP1.18 | Integration | First playable scene: 180×180 valley recipe, eight-contestant content, demo calendar, exit-criteria fixtures — TP §22, TECH 17 | Opus (content, fixtures) + Fable (integration) / Opus | viewing sessions | all above |
| WP1.19 | Spatial | Stress fixture v1 with production spatial and perception; counters; op-count ceilings — TECH 14 | Astra / Opus | reference captures | 1.3–1.6 |
| WP1.20 | AI | GOAP feasibility experiment, one session, results to ADR 004 — TP §7 | Opus / Fable | decide ADR 004 | 1.10 |

**G1 exit** (TP §22): eight contestants complete survival and work sequences; obstacle, contention, threat, and law-boundary fixtures pass; selection, follow, pause, speed, timeline, intent, Why, chronicle work in the export; identity and actions readable on Tier 0 at default distance; save/load reproduces the next 600 ticks; stress fixture measured with omissions listed.

### P2 — Trial slice (Gate G2)

| WP | Scope | Builder / Reviewer | Human | Depends on |
| --- | --- | --- | --- | --- |
| WP2.1 | Clan membership transactions, cap, freeze, departure and rejoin timers — TP §9, TECH 15 (part) | Opus / Fable | — | P1 |
| WP2.2 | Promise, treaty, vote records; breach eligibility and attribution — TP §9 | Opus / Fable | — | 2.1 |
| WP2.3 | Trust and relationship updates; reports and messages with provenance — TP §6, §9 | Fable / Opus | — | 2.2 |
| WP2.4 | Clan proposals and roles; leader succession — TP §9 | Opus / Fable | — | 2.1 |
| WP2.5 | Threat response and rescue methods; profile-differentiated responses — TP §7 (AI 07, AI 08) | Fable / Opus | — | 1.13b |
| WP2.6 | Temporal planning: waits with deadlines, amendments and version invalidation — TP §7, §10 (AI 03, AI 04) | Fable / Opus | — | 1.10 |
| WP2.7 | Trade interaction with atomic transfer — TP §9 | Opus / Fable | — | 1.7 |
| WP2.8 | Forecast consumer, observer journal, influence semantics — TP §14, TECH 16 (part) | Opus / Fable | decide influence scope | 1.15 |
| WP2.9 | Career database, exactly-once finalization, branch registry — TP §15, TECH 16 (part) | Opus / Fable | — | 1.15 |
| WP2.10 | 24-identity content: profiles, appearance recipes, intent and dialogue templates v0 — TP §12 | Opus drafts / designer | author and approve | 0.3 |
| WP2.11 | 30-minute Trial calendar; comprehension-test build; telemetry export — TP §20 | Opus / Fable | 10-player test | 2.1–2.10 |
| WP2.12 | Batch runner: parallel isolated matches, report generator with TP §19 metrics — TECH 14 | Opus / Fable | — | 1.15 |
| WP2.13 | Profile-pair evaluation tool (decision-local comparison) — TP §19 (AI 11) | Fable / Opus | — | 1.9 |

**G2 exit** (TP §20): Trial slice runs; scenes mapped to G2 pass; eight-of-ten comprehension result or a recorded plan to fix presentation before adding content.

### P3 — Standard complete (Gate G3)

| WP | Scope | Builder / Reviewer | Human | Depends on |
| --- | --- | --- | --- | --- |
| WP3.1 | Full economy: recipe manifest, stations, teaching and knowledge transfer, salvage — TP §8 (KNOW 01/02, ECON 01) | Opus / Fable | — | P2 |
| WP3.2 | Clan customs; social commandments for Custom/Story — TP §9 | Opus / Fable | — | 2.2 |
| WP3.3 | Full law deck: Sanctuary geometry, Cold Front, Bountiful, Storm Warning, Herald, amendments and budgets — TP §10 (LAW 04/05, INFO 01) | Opus / Fable | — | 1.2 |
| WP3.4 | Match director: Fog contractions, staging areas, refuge, terminal policy, draws — TP §10 (END 01–05) | Opus / Fable | — | 3.3 |
| WP3.5 | Island family: three macro templates, seeded variation, generator validators — TP §5 | Astra (terrain) + Opus (validators) / Fable | — | 1.3 |
| WP3.6 | Refuge crowd navigation: corridor capacity, throughput, retreat options — TP §5 (FINALE 01) | Astra / Fable | readability review | 1.5, 3.4 |
| WP3.7 | Wildlife full: four packs, 24 deer, dens, hunting and butchering — TP §11 | Opus / Fable | — | 1.14 |
| WP3.8 | 100-seed correctness batch; invariant hardening; draw-rate reporting by schedule class — TP §20 | Opus / Fable | review outcomes | 2.12 |
| WP3.9 | Performance pass 1: spatial, LOS, planner fan-out, pooling, chunked MultiMesh — TP §18 | Astra (engine) + Fable (sim) / Opus | captures | 1.19 |
| WP3.10 | Save migration framework; read-only old-run policy — TP §15 | Opus / Fable | — | 1.15 |

**G3 exit** (TP §20): 100 contestants and 36 wildlife; complete calendar; batch contract met (zero illegal damage, duplicates, deadlocks; every run terminates with an explicit result).

### P4 — Content and presentation alpha (Gate G4)

| WP | Scope | Builder / Reviewer | Human | Depends on |
| --- | --- | --- | --- | --- |
| WP4.1 | Remaining 76 profiles drafted from schema; distinctness validation — TP §12 | Opus / designer | author, approve | 2.10 |
| WP4.2 | Tier 1 art: rig, kit, clips, portraits from the same recipe — TP §13 | technical artist, or Astra Blender-scripting experiment / human visual | own | 0.8 |
| WP4.3 | Dialogue templates × tone tags; localization keys — TP §12 | Opus / writer | polish | 2.10 |
| WP4.4 | UI polish; accessibility fixtures (text scales, color + shape); camera director — TP §14 | Fable / Opus | screenshot review | 1.17 |
| WP4.5 | Audio: adaptive ambient state, SFX bindings from committed events — TP §13 | Opus / Fable | assets | 1.16 |
| WP4.6 | Authoring dock, only if authoring throughput demands it — TP §12 | Fable / Opus | decide | 4.1 |
| WP4.7 | Performance capture matrix; PRESENT 01 screenshots — TP §18, §20 | Astra / Fable | captures | 3.9 |

### P5 — Story episode (Gate GS) — separate branch, starts after G2 is stable

| WP | Scope | Builder / Reviewer | Human | Depends on |
| --- | --- | --- | --- | --- |
| WP5.1 | Guest contract; neutral hermit; disabled-module equivalence — TP §16 (STORY 01/02), TECH 18 | Opus / Fable | — | 1.13b, 1.15 |
| WP5.2 | Christ policy, teaching records, fellowship, healing action — TP §16 (STORY 03–05, 08) | Opus / Fable | narrative editor | 5.1, 3.2 |
| WP5.3 | Persecution through existing verbs; crucifixion attempt action and interrupts — TP §16 (STORY 06/07) | Opus / Fable | narrative editor | 5.2 |
| WP5.4 | Coexistence evaluator and Accord — TP §16 (STORY 10/12) | Opus / Fable | — | 3.4 |
| WP5.5 | Coda presentation; record isolation — TP §16 (STORY 09) | Opus / Fable | narrative editor | 5.3 |
| WP5.6 | Story batch and player test — TP §20 | Opus / — | run test | 5.1–5.5 |

### P6 — Beta and release candidate

Regression across both Story states, onboarding tutorial on the eight-person scene, fault-injection matrix, clean-machine packaging, accessibility closure, save migrations. Opus for implementation, Fable for final review passes, human for packaging and sign-off. GL (local conversations) stays deferred behind its own gate.

---

## 7. Sequencing at a glance

```
P0  0.1 → 0.2 → 0.3 → 0.4 ─┬─ 0.5 → 0.8
                            ├─ 0.6 → 0.7 → ADR 001
P1  1.1 → 1.2 ─┬─ Core:    1.7 → 1.8 → 1.11 → 1.12 → 1.13b → 1.14 → 1.15
               ├─ Spatial: 1.3 → 1.4 → 1.5 → 1.13a → 1.19
               ├─ AI:      1.6 → 1.9 → 1.10 → 1.20
               └─ Client:  1.16 → 1.17
     all → 1.18 (first playable) → G1
P2  2.1 → 2.2 → 2.3/2.4 ; 2.5, 2.6 ; 2.7 ; 2.8, 2.9 ; 2.10 → 2.11 ; 2.12, 2.13 → G2
P3  3.1–3.4 (Core) ∥ 3.5–3.6 (Spatial) ∥ 3.7 ; 3.8–3.10 → G3
P4  ∥ P5 (separate branch) → G4, GS
P6  → RC
```

---

## 8. Measuring throughput instead of promising a calendar

The Technical Plan's 48–60 week estimate assumes three engineers. It does not transfer. Instead:

- In P0 and P1, record sessions per WP and WPs per week, split by model and by lane.
- After G1, project P2–P6 from measured throughput and the WP counts above (P0: 8, P1: 21, P2: 13, P3: 10, P4: 7, P5: 6), adjusting for human review time, which is the likely bottleneck.
- Re-project after G2, as the Technical Plan already requires.

No calendar is stated here on purpose; the first honest one comes out of P0.

---

## 9. Token-safety checklist (per session)

- One WP, one session. If the ticket doesn't fit, split before starting.
- Read only `AGENTS.md`/`CLAUDE.md`, `STATUS.md`, and the ticket unless the ticket lists more.
- Never open `out/`, exports, generated catalogs, or logs directly; read summaries and failure packages.
- Never paste full logs, snapshots, or batch output into the conversation.
- Commit at every green step; `HANDOFF` before stopping early.
- Keep files under ~400 lines; split by system, not by convenience.
- Run batches in CI or on the reference PC, not in the coding session.
- Cross-model review on every WP; trivial fixes only during review.
- A human decision blocks: record the question, stop, don't guess.

---

## 10. Open items for Jani

1. Confirm the agent harnesses (Claude Code for Opus/Fable, Codex for Astra) so the instruction-file layout in §2 is right.
2. Confirm whether a technical artist is staffed (decides WP4.2's owner).
3. Decide whether WP0.7 (TypeScript spike) runs or is skipped.
4. Send GDD v1.0 so the review's traceability pass can close before P1.

*Plan ends. All gates and acceptance scenes are the Technical Plan's; this document changes only who does the work, in what size, and with what handoff.*
