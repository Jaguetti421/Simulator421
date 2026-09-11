# The Last Clan — Technical Plan v1.0 Review

**Reviewed:** The_Last_Clan_Technical_Plan_v1.docx (v1.0, 11 September 2026)
**Review type:** Critical technical review, pre-implementation
**Date:** 11 September 2026
**Companion document:** The_Last_Clan_Agent_Work_Phases_v1.md (the agent-driven phase plan this review recommends)

**Conventions.** TP §N = Technical Plan section. GDD §N = GDD section. Each finding gives the affected sections, the smallest coherent change, and the test that would prove it. Cost marks are rough (S / M / L). Nothing here is a change order; Section 9 is a decision table.

**What I could not verify.** The plan is a companion to GDD v1.0, which I have not seen; I reviewed GDD v0.2. Several plan statements attribute specifics to "the GDD" that are not in v0.2 (Section 4 lists them). The Godot/.NET packaging claims are the plan's own and are correctly deferred to Gate G0. Where the plan cites documentation, I did not re-verify every link; I did confirm that Godot 4.7 is a real stable release with a 4.7.2 maintenance patch available.

---

## 1. Summary

**Verdict.** This is excellent simulation engineering and the wrong delivery plan for this team.

The architecture — integer-deterministic 10 Hz core, ten-stage tick transaction, operation-count budgets, actor-scoped knowledge views, atomic reservations, exactly-once career finalization, snapshot-plus-journal replay, and a headless lab with failure packages — is coherent, testable, and unusually honest about what is unproven. If it is built as specified, the acceptance scenes will be executable and the game will be debuggable. I would not change the core design.

The delivery model (TP §22–24) is written for three engineers, a designer, and a technical artist over 48–60 weeks. The stated build method is AI coding agents with a small human team. That mismatch is not cosmetic: it decides ticket size, verification loops, the art dependency at G1, and what "CI hardware" means. The plan has no notion of a session, a context budget, a handoff artifact, or agent-verifiable evidence. TP §24's tickets would exhaust any single session. The companion document replaces §23–24 with a phase plan built for agents.

**Findings by consequence**

1. **Delivery model doesn't match the build method** — replace roadmap and backlog with session-sized work packages, handoff docs, and model routing. (T1, T7)
2. **The stack decision omits agent verifiability** — keep Godot .NET, but score "can an agent build, test, and see the result without a human" in G0, and mitigate the Godot client's weakness with code-first scenes and a screenshot CLI. (T2, T5)
3. **GDD provenance I can't check** — the plan asserts many "GDD" specifics not in v0.2; a traceability pass against v1.0 is needed before coding. (T3)
4. **Island scale may violate the travel contract** — 800×800 m needs ≥2.2 m/s walking to meet a 4–6 minute crossing. (T4)
5. **G1 depends on a Blender rig and 12 clips** — without a technical artist this stalls the first playable; a procedural Tier 0 kit protects the gate. (T6)
6. **Cross-tick planner and route frontiers complicate snapshots and determinism** — per-tick-complete jobs are simpler and should be the default until measured otherwise. (T8)
7. **Operation budgets are the right determinism choice and are under-used** — they can be CI assertions on any hardware, which turns most of the performance story into automated regression. (T11)
8. **Test coverage is strong; specific gaps remain** — no fixture DSL definition, no per-PR replay regression, no round-trip property test, no fuzzing, no Why-panel ↔ trace contract. (T14)

---

## 2. What is strong and should be protected

- **TP §4 tick transaction.** Ten ordered stages with named guarantees; transitions before actions; support before damage; result after the whole tick. The boundary examples (arrow at 10,800; departure at 30,000) are exactly the kind of worked case that makes an agent implement it correctly.
- **TP §4 integer determinism.** Millimeters, thousandths, saved remainders, 64-bit intermediates, versioned lookup tables, project-owned PRNG with test vectors and labeled streams, no System.Random, no hash-map iteration, no wall-clock. This is the correct and complete list.
- **TP §5–7 budgets counted in operations, never milliseconds.** Determinism survives hardware differences. See T11 for how far this can be pushed.
- **TP §6 ActorKnowledgeView** and the information-isolation metamorphic test. Compile-time boundaries plus a test that moves hidden state and asserts identical decisions is the right defense against accidental omniscience.
- **TP §8 actions as transactions**, canonical-order multi-key reservations, consumed-input ledgers, salvage from actual consumption.
- **TP §10 PermissionService** as the single legality path for AI, actions, story, and effects.
- **TP §15 persistence.** Snapshot + append-only journal + SQLite projection; crash-safe generation replacement; exactly-once finalization with a unique result key; branch registry; hash every 100 ticks in replay; local integrity honestly scoped as not-anti-cheat.
- **TP §19 lab.** Four questions (what happened, what was known, why chosen, where diverged), bounded failure packages that open directly in the lab, counterfactual and decision-local comparison. The `clanlab` CLI is the right shape for agent workflows.
- **TP §20 verification layering** with property-based and metamorphic tests, and a full acceptance-scene-to-gate map.
- **TP §25 clarifications recorded as an addendum before coding.** Correct discipline.

---

## 3. Findings

### T1 — The roadmap is for a team that isn't building this

**Where.** TP §22 (G1 in weeks 6–8), §23 (3 engineers + designer + tech artist; 48–60 weeks; 270 person-weeks), §24 (18 tickets).

**Why it matters.** With agents: (a) a ticket must fit one session and end with green tests, or work is lost at cutoff; (b) the verification loop must be headless and fast, or agents cannot self-check; (c) art and editor-dependent steps are human tasks, not parallel lanes; (d) the bottleneck shifts to human review bandwidth, so every work package must produce self-verifying evidence; (e) calendar estimates from person-weeks don't transfer.

**Change.** Replace §23–24 with the agent phase plan in the companion document. Keep the gates G0–G4/GS/GL exactly as defined; they are good exit criteria regardless of who does the work. Re-estimate after P0–P1 by measured work-package throughput, as the plan itself suggests for G0.

**Cost.** Planning only.

### T2 — ADR 001 doesn't score agent verifiability

**Where.** TP §2 (Godot .NET rationale, bounded TypeScript comparison), §25 ADR 001.

**Observation.** The comparison criteria are packaging, animated character, dense UI, startup, and profiler evidence. Missing: can a coding agent build, run, test, and *see the result* without a human? The C# core is strong here (`dotnet test`, console runner, hash comparison). The Godot client is weak: `.tscn` files and import settings assume the editor, and rendered verification needs a GPU machine. The TypeScript/Babylon candidate is strong on the client loop (a browser can be driven and screenshotted headlessly) and matches the team's recent builds, but is weaker for integer determinism (53-bit safe integers; 64-bit intermediates need BigInt or careful bounding) and has no comparable desktop 3D asset pipeline. The plan's note that Godot 4 C# has no web export is a real constraint and is correctly stated.

**Change.** Keep Godot .NET as the recommendation. Add "agent verifiability" as a scored G0 criterion for both candidates: time for an agent to go from a failing fixture to a passing one, and whether visual output can be captured without a human. Mitigate the Godot weakness regardless of outcome via T5. Run both spikes with agents in parallel using the same fixture DSL (companion doc, WP0.7).

**Cost.** S.

### T3 — GDD provenance I cannot verify

**Where.** Throughout; the plan states "The GDD remains authoritative for game rules."

**Observation.** The plan attributes the following to "the GDD"; none appear in v0.2. If they are in v1.0, this finding closes. If not, the tech plan is inventing design facts under the GDD's authority — which the GDD explicitly forbids for the game itself.

Spot-check list against GDD v1.0: 28 recipes (§8, §12); eight forecast templates and three slots (§14); five 12-minute days (§10); 45° pitch with 35–65° range (§13); deputy and joining-order succession (§9); 10 s enemy-position and 30 s food-band staleness (§6); normalized benefits/costs, commitment bonus, switch threshold (§7); four music priorities and release delay (§13); shallow-water speed multiplier (§5); one-skill-per-action rule and Hunt bands (§25); perception light and sleep modifiers (§6); three builds / four heads / ten headwear / six accessories (§13); 24 deer and 12 wolves with den leash (§1, §11); aggregate six-minute opening supply (§5); construction consumption at 50 percent progress (§8); 51 acceptance scenes (§20).

**Change.** Run a traceability pass: every "the GDD's X" in the plan gets a "GDD v1.0 §N" reference. Anything without one becomes a TP §25 clarification. Please send GDD v1.0 so I can do this pass.

**Cost.** S.

### T4 — Island scale versus the travel contract

**Where.** TP §5 (≈800×800 m, 640,000 cells); GDD v0.2 §4 (crossing the map takes roughly four to six minutes at an unburdened walking pace).

**Observation.** 800 m in 360 s requires 2.2 m/s; real walking is about 1.4 m/s, which makes the crossing nine to ten minutes. Either the walkable extent is well under 800 m, or the movement speed table in v1.0 is game-scale fast.

**Change.** Add a generator validator: farthest-pair walkable route time ≤ TUNE 360 s under the movement model (alongside the existing food-within-45-s and camp-within-90-s checks). Size the island from the validator, not the other way round. A ~500 m walkable extent gives ~250,000 cells and halves the world memory envelope.

**Test.** MAP 01 — generator rejects any seed whose farthest-pair route exceeds the crossing bound.

**Cost.** S.

### T5 — The Godot client must be code-first

**Where.** TP §2 (Control nodes and shared Theme), §13, §21.

**Observation.** If scenes and UI are authored in the editor as `.tscn`, agents cannot own, diff, or test them. If they are constructed in C#, agents can build, review, and unit-test the view models, and a human only inspects the rendered result.

**Change.** Construct scenes and UI in C# code; keep `.tscn` to a minimal root. Generate the Theme from a C# palette table (which also serves the Presentation Baseline). Shaders as text `.gdshader` files. Add a `--screenshot` CLI mode to the client: load fixture, set camera preset, render N frames, write PNG — run on the reference machine; humans (or a vision-capable review session) inspect PNGs. That is the agent visual loop.

**Test.** PRESENT 01 uses the screenshot CLI; a rendered-tests checklist lists which checks are automated (export smoke, screenshot fixtures) and which are manual.

**Cost.** S (policy) + S (screenshot mode).

### T6 — G1 depends on a rig, GLB pipeline, and 12 clips

**Where.** TP §13 (Blender rig, GLB, initial clips), §22 (eight contestants with distinct silhouettes and the initial shared animation kit), §24 TECH 10.

**Observation.** This is the technical artist's work in §23. If that person is not staffed at week 3, the first playable stalls on art. Jani's brief was that the game must look good during testing using features agents can build and style.

**Change.** Two presentation tiers behind one `AppearanceRecipe`. Tier 0 is fully agent-built: primitive-based body/head/headwear/accessory meshes, palette materials, procedural motion (bob, lean, tool raise), and state icons above heads. Tier 1 is the rigged GLB kit that replaces Tier 0 assets with no data changes. G1 exits on Tier 0; Tier 1 lands in P4 (human technical artist, or a bounded Astra Blender-scripting experiment with human review).

**Test.** G1 exit criterion "identity, carrying, tool use, waiting, and danger readable at default camera distance" evaluated on Tier 0 via screenshot fixtures.

**Cost.** M for Tier 0, and it removes a critical-path dependency.

### T7 — Tickets are session-unsafe

**Where.** TP §24 TECH 05 (routing + fine grid + motor + recovery), TECH 08 (hunger, rest, gather, eat, carry, first utility/task methods), TECH 12 (permission service, projectile sweep, damage batch, downing, rescue, truce tests).

**Observation.** Each bundles four to six systems. Any of these exceeds one agent session; a cutoff mid-ticket loses context and often work.

**Change.** Decompose into work packages of one system plus its fixture, each ending with green tests and a committed handoff note. The companion document does this for all 18 tickets.

**Cost.** Planning only.

### T8 — Cross-tick frontiers complicate snapshots and determinism

**Where.** TP §5 (route jobs yield with their frontier intact), §7 (method expansions per reconsideration), §15 (snapshot includes planning frontiers and passage queues).

**Observation.** Serializing mid-flight A* frontiers and planner state makes snapshots larger, replay more fragile, and fixtures harder to reason about. The plan's own budgets are per-tick operation counts, which already allow a per-tick-complete design.

**Change.** Route jobs complete within one tick under an operation budget: regional route first, then local route to the nearest reachable portal, returning `Partial` when the budget runs out; no cross-tick frontier state. Planner reconsideration likewise atomic within a tick. Measure in the stress fixture; revisit only if the budget proves insufficient.

**Test.** Snapshot-independence metamorphic test (see T14): identical hashes with checkpoints every 60 s versus every 10 s.

**Cost.** Neutral; it removes code.

### T9 — Route cache keyed by per-actor knowledge mask

**Where.** TP §5 (cache corridors by start region, destination region, traversal policy, topology version, and knowledge-mask version).

**Observation.** A per-actor knowledge-mask key makes the cache effectively per-actor; hit rates will be low at 136 actors.

**Change.** Two tiers: shared corridors over public/static topology; per-actor validation of returned segments against the discovered mask (already specified). Confirm in TECH 14 counters.

**Cost.** S.

### T10 — "Static visibility data" is undefined

**Where.** TP §5 (store height, traversal class, region, cover, and static visibility data).

**Change.** State that this means per-cell openness, cover, and height only — no precomputed visibility sets — and that LOS is a height-field raycast on demand under a per-tick ray budget.

**Cost.** Wording.

### T11 — Operation budgets should be CI assertions

**Where.** TP §5, §7, §18, §21.

**Observation.** Because every budget is an operation count, the counts are deterministic and hardware-independent. Only wall-time needs the reference machine. The plan currently treats performance as reference-hardware-only.

**Change.** Each fixture records and asserts op-count ceilings: route expansions, LOS rays, planner method expansions, candidates scored, reservation attempts, allocations (if tracked). Regressions fail in CI on any runner. Wall-time captures stay on the reference PC (a self-hosted runner on it is enough for a small team).

**Test.** PERF-OPS fixtures per system; the stress fixture asserts totals per tick.

**Cost.** S, high leverage.

### T12 — Contracts-first, so agents can work in parallel

**Where.** TP §3, §12 (representative contracts), §21 (`src/Sim.Contracts`).

**Change.** Make Sim.Contracts a P0 work package with a versioned schema, golden sample files, and human sign-off: commands, acknowledgements, typed events, snapshot schema, reason codes with text keys. Then core and client proceed against fakes — a `FakeSim` emitting scripted snapshots for the client, and a headless consumer for the sim — until integration.

**Cost.** S.

### T13 — Hard-coded catalog counts

**Where.** TP §12 (exactly 100 Standard identities; exactly 28 recipes).

**Change.** Validation counts come from a catalog profile (prototype 8 / trial 24 / standard 100) so validation passes at every gate.

**Cost.** S.

### T14 — Test coverage gaps

**Where.** TP §19–21, §24.

The layering is right. Specific additions:

| Gap | Addition | Layer |
| --- | --- | --- |
| Fixture DSL is named but never defined | Define it now; it is the handoff contract between sessions. Proposal below. | Foundation |
| Replay regression is nightly only | A small seed set (TUNE 5) replays on every PR touching laws, movement, actions, AI, or serialization; hash equality required | CI |
| Save/load round-trip | Property test: at random ticks, snapshot → load → advance N → hash equals uninterrupted run | Contract |
| Checkpoint-frequency invariance | Metamorphic: results identical with checkpoints every 10 s vs 60 s | Contract |
| Command validation and save loading | Fuzz: malformed commands and corrupted saves never crash or mutate state; typed rejection only | Contract |
| Architecture rules | Source tests: no engine references in core (planned); add no `float`/`double` in Sim.*, no `System.Random`, no `DateTime.Now`, no dictionary iteration in consequential paths | CI |
| Why panel truthfulness | Contract test: Why-panel alternatives equal the recorded decision trace's evaluated candidates; never a post-hoc set | Contract |
| Content catalogs | Golden hash per catalog; a hash change requires an intentional update in the same commit | CI |
| Stuck detection | Batch invariant: no actor stuck > 10 s without an intentional wait with deadline | Batch |
| Reason-code coverage | Validator: every reason code has localized player text and a debug field set | Content |
| Op-count budgets | See T11 | CI |
| Rendered checks | Explicit split: automated (export smoke, screenshot fixtures at two text scales) vs manual checklist per gate | Reference PC / human |

**Fixture DSL proposal** (JSON; one file per scene):

```json
{
  "id": "AI-03-patient-wait",
  "gate": "G2",
  "catalogProfile": "trial",
  "map": { "recipe": "valley-180", "seed": 4107 },
  "roster": ["C003", "C006"],
  "initialState": [
    { "actor": "C003", "hunger": 350, "inventory": { "berries": 2 } }
  ],
  "schedule": [
    { "tick": 0, "command": "ScheduleLaw", "law": "PropertyProtected", "activate": 0, "expire": 1200 }
  ],
  "maxTicks": 2400,
  "assert": [
    { "type": "eventBefore", "event": "PlanAdopted", "actor": "C003", "intent": "WaitForLaw", "tick": 300 },
    { "type": "noEvent", "event": "IllegalActionAttempt" },
    { "type": "latency", "from": "LawNotice", "to": "PlanReplaced", "maxTicks": 10 },
    { "type": "invariant", "name": "conservation" },
    { "type": "budget", "counter": "routeExpansions", "max": 40000 }
  ],
  "golden": { "hashAtTicks": [600, 1200, 2400] }
}
```

The runner prints one line per fixture plus the first failure, writes the failure package, and never prints logs to stdout. That output discipline is what keeps agent sessions small.

### T15 — Definition of Done for agent work packages

**Where.** TP §24 (definition of done for a consequential system).

**Change.** Add: fixture added or extended; op-count budgets recorded; module README updated if an interface changed; `docs/STATUS.md` updated; handoff section in the ticket completed; review by a second model recorded. The companion document has the template.

### T16 — The engine spike is a good agent task

**Where.** TP §2 (ten engineering days across two spikes).

**Change.** Run both candidates as parallel agent work packages against the same fixture DSL and actor counts; the human measures on the reference PC and writes ADR 001. Score agent verifiability (T2) alongside the existing criteria.

### T17 — Smaller items

- Pin the current maintenance patch in G0; 4.7.2 exists as of August 2026.
- TP §12 authoring dock: defer; `clanlab validate` plus fixture preview is enough for a designer editing JSON in P1–P2.
- TP §14 forecast "Influenced" semantics: any accepted intervention marks all active forecasts Influenced. Strict but simple. The alternative — scope-based influence (only forecasts whose subject or region the intervention touches) — is a design call; note it for the GDD owner.
- TP §10 confirms the Beacon was rejected ("no refuge-occupancy shortcut"). Fine; the batch report must surface draw rate by schedule class, which §20 already requires.
- TP §7 GOAP comparison: with agents this is cheap — one bounded session, results into ADR 004.
- TP §18 reference hardware: for this team this is one PC; a self-hosted CI runner on it covers nightly batches and captures.
- Risk register (§25) additions: agent-code inconsistency across sessions (mitigation: contracts, conventions file, cross-model review, architecture tests); human review bandwidth as the bottleneck (mitigation: self-verifying evidence per WP); art dependency at G1 (mitigation: T6).

---

## 4. GDD v1.0 traceability pass — requested

I need GDD v1.0 to complete this review. The list in T3 is the spot-check set. Until then, treat every "the GDD's X" in the plan that is not in v0.2 as an unverified design decision.

---

## 5. Automated-test map by system

Which layer proves each system, and where humans are still required.

| System | Contract / property | Fixture scenes | Batch / statistical | Perf (op-count in CI; wall-time on reference PC) | Human |
| --- | --- | --- | --- | --- | --- |
| Tick loop, clock | stage order, pause barrier | LAW 01, END 01, TIME 01 | — | — | — |
| PRNG, hashing | test vectors, stream independence | STORY 01 equivalence | — | — | — |
| Laws, director | precedence, overlap, budget | LAW 01–05, END 01–05 | draw rate by schedule | — | — |
| Spatial, LOS | geometry goldens | AI 05, LAW 02 | — | rays, expansions | overlay compare (screenshot) |
| Routing, motor | no teleport, no corner cut | AI 05, BUILD 01, FINALE 01 | stuck-detector | expansions | crowd readability |
| Perception, beliefs | provenance, isolation | AI 10, SOCIAL 02 | — | candidates checked | — |
| Goals, planning | trace contract, budgets | AI 01–04, 07–09, 11 | idle-by-reason, waits | expansions, candidates | "interesting?" (G2 test) |
| Actions, reservations | conservation, atomic multi-key | AI 06, ECON 01 | contention | attempts | — |
| Construction | consumption ledger, salvage | BUILD 01, ECON 01 | socket fill | — | — |
| Clans, promises | consent, breach eligibility | SOCIAL 01–03, END 03 | breach stats | — | — |
| Combat, wildlife | damage batch, attribution | LAW 01–03, DATA 02, WILD 01 | kill/assist sanity | sweeps | fight readability |
| Persistence | round-trip, crash matrix, exactly-once | DATA 01 | 10-match retention | snapshot size | — |
| Forecasts | isolation, influence | FORECAST 01–03 | — | — | — |
| Client, UI | view-model tests, Why ↔ trace | PRESENT 01 (screenshots) | — | frame time | readability, comprehension |
| Story | disabled equivalence | STORY 01–12 | Story batch | 137-actor | narrative editor, player test |

Human-only items are exactly the ones the plan already names: readability, memorability, comprehension, narrative review. Everything else can be automated.

---

## 6. Questions for Jani

1. **GDD v1.0** — please send it; T3 depends on it.
2. **Technical artist** — is one staffed, and when? Decides whether Tier 1 art is human or an Astra experiment (T6).
3. **Reference PC** — is your own machine the benchmark and self-hosted runner? (TP §18)
4. **Godot editor comfort** — are you happy doing the small editor-only steps (import settings, export template install), leaving everything else code-first? (T5)
5. **Engine spike** — run both candidates with agents in parallel as proposed (T16), or skip the TypeScript spike and commit to Godot now?
6. **Forecast influence semantics** — strict (any intervention) or scoped? (T17)
7. **Agent tooling** — Claude Code for Opus/Fable and Codex for Astra, or a single harness? Affects the instruction-file layout in the companion document.

---

## 7. Decision table

| ID | Proposal | TP § | Cost | Decision |
| --- | --- | --- | --- | --- |
| T1 | Replace §23–24 with the agent phase plan; keep gates | 22–24 | — | |
| T2 | Add agent verifiability to ADR 001 criteria | 2, 25 | S | |
| T3 | Traceability pass against GDD v1.0 | all | S | |
| T4 | Crossing-time validator; size island from it | 5 | S | |
| T5 | Code-first scenes and UI; screenshot CLI | 2, 13, 21 | S | |
| T6 | Tier 0 procedural presentation for G1; Tier 1 later | 13, 22 | M | |
| T7 | Session-sized work packages | 24 | — | |
| T8 | Per-tick-complete route and planner jobs | 5, 7, 15 | neutral | |
| T9 | Two-tier route cache | 5 | S | |
| T10 | Define static visibility data | 5 | wording | |
| T11 | Op-count budgets as CI assertions | 5, 7, 18, 21 | S | |
| T12 | Contracts-first with fakes | 3, 12, 21 | S | |
| T13 | Catalog profiles for counts | 12 | S | |
| T14 | Test additions and fixture DSL | 19–21 | M | |
| T15 | Agent Definition of Done | 24 | S | |
| T16 | Engine spike as parallel agent WPs | 2 | S | |
| T17 | Small items and risk-register additions | various | S | |

---

*Review ends. The plan's architecture is sound and should be built as written; the delivery model should be replaced by the companion phase plan. No performance, packaging, or behavior claim in the plan has been verified by this review.*
