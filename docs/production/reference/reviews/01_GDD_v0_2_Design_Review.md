# The Last Clan — GDD v0.2 Design Review

**Reviewed:** The_Last_Clan_GDD_v0_2.docx (v0.2, 10 September 2026)
**Review type:** Senior game design review, pre–tech plan
**Date:** 10 September 2026
**Status:** Findings and proposals for the designer's decision. Nothing here is a change order. Section 13 is a decision table for accept / adapt / defer / reject.

**How to read this**

- Each finding names the affected sections, the smallest coherent change, and a scene that would validate it — the review format the GDD itself asks for in Section 29.
- "Suggest" and "option" mean exactly that. Cost marks (S / M / L) are my rough judgement relative to systems already planned, not estimates.
- Where I could not verify something from the document, it appears in Section 12 as a question rather than an assumption.
- Jani's brief for this review: respect scope, and make sure the game looks and feels good during testing — not only after a human artist finishes — using features AI agents can build and style. Sections 5 and 9 are written against that brief.

---

## 1. Summary

v0.2 is an unusually disciplined baseline. It is a contract, not a wish list: the law schema, attribution rules, mode classification, knowledge mortality, and the acceptance-scene approach are strong enough that a tech plan can be derived from them directly. Most GDDs at this stage fail on rules; this one doesn't.

The document is far better at guaranteeing what must not happen than at describing what the player feels. That is the gap to close before the tech plan, because the cheap-to-change things (rules, invariants) are already good, while the expensive-to-change things — population, time scale, camera, presentation strategy, and how much the player actually does — are still hypotheses.

Top findings, in order of consequence:

1. **The observer's hands are nearly empty.** Six non-regenerating points buy three to six interventions per hour, none after minute 48. Section 2 names prediction as the smallest satisfying interaction, but no system builds it. A Forecast system — free, event-verified, invisible to bots — would give the player a skill to express for the whole match, including the finale. (A1)
2. **Time is under-specified, and everything hangs on it.** There is no day/night cycle (a quirk references night travel), no fiction-time mapping, no stated real-time session target, and a 60-minute timeline whose travel, need, and combat pacing are all TUNE. A day structure would give exposure, rest, concealment, and pacing a spine — and give the prototype dramatic lighting for free. (B2)
3. **100 may be the right roster and the wrong default match size.** Attention budget: 36 seconds per contestant per match before clans and laws are considered. The Hundred as a league with a 32–40 draw per match is worth testing against 100. This is a question, not a recommendation, because "100" is the pitch. (B1)
4. **The finale is likely unreadable at 100 with an 8-member cap.** Thirteen or more clans converging on one refuge is a melee, and the 15–35 second fight target becomes noise. Staged refuge pockets and a public Beacon objective would keep the finale legible and reduce draws without hidden tiebreakers. (B3, B4)
5. **There is no presentation strategy, and it decides whether the prototype looks good.** The Section 14 art bar assumes a human art team. A Presentation Baseline built as code — palette, parametric character kit, icon language, tabletop camera, fog and night shaders — would make the first playable look intentional and let the artist upgrade pieces later without downstream rework. (C1–C6)
6. **Several referenced systems have no design.** Wildlife, skills, personality-to-decision mapping, dialogue budget, economy numbers, water, and concealment are all referenced and none is defined. Each is small; each blocks a tech plan. (D)
7. **The Christ episode is the largest optional item and is woven through the core.** A generic Guest abstraction, a cheaper persecution path without a custody state machine, and an explicit reception/platform risk line would reduce cost and coupling. Launch vs post-launch is a scope question for Jani. (F)

---

## 2. What is strong and should be protected

- **Law schema and timing** (Sections 10, 24): announcement / activation / expiry ticks, atomic installation at tick boundaries, explicit precedence, projectile checked at launch and impact, sanctuary applied to both sides. This is the heart of the game and it is right.
- **Attribution and records** (Section 12): one credited killer at most, episode-scoped assists, rescue commendation caps, idempotent finalization, branch lineage. Career records will be trustworthy, which is what makes a cast worth remembering.
- **Waiting as an explicit plan** (Section 7): reason, trigger, maximum duration, safe location, cost, fallback — and "Waiting" with no trigger declared a defect. This single paragraph will prevent the most common failure of autonomous-agent games.
- **Bounded knowledge mortality** (Section 5): advanced procedures only, basics universal, seed validation forbids single-specialist dependency.
- **What the design refuses** (Sections 11, 18, 27): no worship economy, no alignment axis, no manufactured drama, no camera-dependent outcomes, no presumed cheap engine port.
- **Development sequence with evidence gates** (Sections 20, 24) and deterministic acceptance scenes. For a small team building with AI coding agents this is the correct shape: every scene can become an automated test.
- **Headless simulation core** as a prototype requirement (Section 15).
- **Record classification** (Section 2): Standard / Custom / Story / Legacy is clean and atomic.

---

## 3. Player experience and agency

### A1 — Forecasts: give the observer a skill

**Observation.** Section 11: six influence points, costs of 1–2, one-minute notice — three to six actions per match. Section 3: no interventions after minute 48. Section 2 calls prediction the smallest satisfying interaction; no system supports it. Section 21 lists "Nothing worth watching happens" with blind playtests as the only mitigation.

**Why it matters.** An observer game needs a skill the player can express. Understanding the cast is the stated fantasy; forecasting is that understanding made playable, at zero cost to autonomy. It also fills the twelve minutes of finale where the player currently has no verb at all.

**Option.** Forecast slots (TUNE three open at a time) built from templates: subject (contestant or clan) + outcome (leaves clan; joins clan X; raids Hearth Y; survives to the freeze; is rescued; breaks treaty Z; reaches the refuge) + deadline. Resolved from chronicle events. Forecast accuracy becomes a player statistic, separate from contestant careers, shown in the Saga. The optional observer challenges in Section 2 become curated forecast sets. Bots never see forecasts. No money, no wagering.

**Cost.** S–M: query logic over existing events plus UI.

**Validation.** FORECAST 01 — an outcome that occurs off-camera resolves correctly from the chronicle. FORECAST 02 — a STORY 01-style diff shows identical simulation with and without forecasts; forecasts appear nowhere in the belief store.

### A2 — The Standard intervention deck bends only one way

**Observation.** Section 10: the Standard deck is four protections (Truce, Buildings, Property, Sanctuary) and two environmental modifiers (Cold Front, Bountiful Ground). Nothing increases contact or changes information.

**Why it matters.** The pillar says laws change strategy, but the player's authorial range is "merciful" versus "slightly less merciful." The experiment fantasy in Section 2 — delay raiding and see whether they trade — has no opposite experiment.

**Options** (each reuses an existing pipeline):

- **Storm Warning** — a region becomes unsafe with notice and duration. Reuses the Fog's unsafe-sector mechanic and evacuation lead-time validation (Section 3). Suggested cost 2.
- **Herald** — publicly broadcasts a currently true fact (a clan's Hearth location and a stockpile band) through the arena signal (Section 7). Suggested cost 1. Requires a belief class "public authoritative fact" alongside law notices and reports.
- **One Glory Trial in Standard** once exploit testing passes (already planned for Custom).

**Cost.** S each.

**Validation.** LAW 04 — Storm Warning uses the same route and lead-time validation as the Fog; a bot inside evacuates with a labeled reason. INFO 01 — Herald updates every contestant's beliefs with source "arena," never as firsthand witness.

### A3 — The arrival phase risks being ten quiet minutes

**Observation.** Section 3: 0–10 minutes, no damage, no theft, food accessible. The real tension is the countdown to 10:00 and who is standing next to whom when it rings — but nothing frames it.

**Options.** Treat the 10:00 bell as a designed set-piece (countdown, audio, clan overlay showing proximity). Place the first nightfall inside arrival (B2) so fires and camps are forced. Add wildlife as the arrival-phase threat (D1). Consider TUNE 6–8 minutes if clan formation proves faster than expected.

**Validation.** Extend the Section 24 comprehension test: a new player can say what happens at 10:00 without coaching.

### A4 — Explainability as a player feature, not a developer view

**Observation.** Section 13: players see plain language; candidate scores are developer-only.

**Option.** A "Why?" panel showing the chosen plan plus the top two rejected alternatives with one-line reasons ("Raid rejected: defenders unknown; friend owes Mara a rescue"). Utility scoring makes this nearly free, and it is the core fantasy. Add a relationship web overlay for followed contestants, drawn from existing trust data.

**Cost.** S.

**Validation.** The existing comprehension gate (explain two consequential decisions) passed using only the Why panel.

---

## 4. Population, time, and the finale

### B1 — The Hundred as a league, not necessarily as a match

**Observation.** Section 1: "Exactly 100." Pillar: "A cast worth remembering." Section 20 validates recognition with 24 first. Section 24 asks new players to identify three contestants. Arithmetic: 60 minutes ÷ 100 = 36 seconds of potential attention per contestant, before clans, laws, and camera.

**Option.** The Hundred remains the roster and career archive. A Standard match draws TUNE 32–40 of them, rotating like a league where not everyone plays every fixture. "Grand Arena" is the 100-person mode. Favorites recur with different companions, so familiarity may form faster, not slower. Performance headroom and iteration speed improve as a side effect.

**Risk.** "100" is the pitch. Question Q2.

**Validation.** Run the attachment gate at both populations; compare recall and the "who would you follow again" answer.

### B2 — Time needs a spine

**Observation.** Section 1 says 45–60 minutes; Section 3 defines a 60-minute timeline; Section 4 sets travel times; Section 6 lists a night-travel quirk; Section 4 defines exposure. No day/night cycle exists anywhere, no fiction-time mapping, and no stated real-time session target.

**Option.** Define the match as N days. Illustration only: 5 days × 12 minutes, 8 minutes day and 4 minutes night, all TUNE. Night gives exposure pressure, rest, fire light, concealment, and a lighting gradient that makes even primitive geometry look good. Phases become diegetic ("Day 3 — Pressure"); Fog steps can land at dawn. Decide the real-time session target first (Q1) and derive travel, need, and combat rates from it — the four are coupled and cannot be tuned independently.

**Cost.** S–M: a time-of-day parameter drives lighting, exposure, sight range, and rest utility.

**Validation.** EXPO 01 — a contestant without fire or shelter at night accrues exposure; with fire or shelter does not. TIME 01 — day/night never alters law ticks.

### B3 — Refuge readability

**Observation.** Cap of eight (Section 3) means at least 13 clans if every clan is full, and realistically more at minute 40. Fights of 15–35 seconds (Section 9) become noise inside a 40–80 person melee, and "winner via attrition" dominates. Section 22 asks the cap question.

**Options.** (a) Staged Fog: contraction forms two to four pockets before the final refuge, so contact is two or three clans at a time and survivors converge afterwards — reuses unsafe sectors. (b) TUNE the cap to 10–12 in Standard. (c) Both.

**Validation.** FINALE 01 — at minute 45 in a 100-person match, no pocket holds more than TUNE N contestants; player readability test at the refuge.

### B4 — A Beacon instead of a draw

**Observation.** Section 3: a draw when no clan stands at 60:00, and no unannounced tiebreaker. Correct. Section 22 asks whether a public alternative is preferable.

**Option.** A physical Beacon at the refuge center, visible from arrival on the escalation calendar. If more than one clan stands at 60:00, the clan with a standing member inside the Beacon ring wins; none or several inside means a draw. Public, spatial, gives bots a concrete finale objective (reach and hold), gives the camera a focal point, and reduces draws without hidden rules.

**Risk.** Shifts the finale toward king-of-the-hill. Ring radius is the tuning knob.

**Validation.** END 04 — two clans inside the ring at 60:00 produce a draw; one produces a win; the ring appears in the escalation calendar from arrival.

---

## 5. Presentation that looks finished at prototype

This section answers Jani's brief directly.

### C1 — A Presentation Baseline as a design deliverable

**Observation.** Section 14 sets a bar — 100 distinct silhouettes, portraits, voice styles, 13 critical animation states, expressive close observation, free-orbit 3D — that assumes a human art team, and there is no plan for what the prototype looks like before that team exists.

**Option.** Define a Presentation Baseline with the same rigor as the action contract: palette (TUNE 12–16 base colors plus clan accents), time-of-day lighting gradient, fog and storm shader, terrain style (flat-shaded, biome color zones), a parametric character kit (C2), an icon language, typography, and UI layout. All of this is buildable as code and procedural materials by AI agents. The artist later replaces kit pieces and textures inside the same rules; nothing downstream changes.

**Validation.** At the behavior prototype, a fresh viewer cannot tell which parts are placeholders.

### C2 — Parametric character kit

**Option.** Body (2–3 builds) × head shape × hair or headwear (8–10) × tunic or cloak color (clan color plus a personal accent) × held tool or weapon (which also serves threat readability). One hundred identities become combinations plus a name and an epithet. Portraits are rendered from the same kit by a snapshot camera, so they are consistent by construction and update automatically when the artist upgrades a piece. Silhouette distinctiveness comes from headwear, build, and tool — exactly what reads at strategic distance.

**Cost.** M once; afterwards each identity is data.

**Validation.** The Section 24 recognition gate run with kit characters.

### C3 — Readability channels, ranked

**Option.** In order: nameplate and epithet; intent icon and label; clan banner color; visible equipment; animation. Ship the first four first; animation is polish. Add a presentation contract per action — icon, label template, VFX hook, SFX hook, optional animation — as a sibling of the action contract in Section 15. A required intent-label template per goal means an agent cannot add a goal without making it readable.

**Validation.** The "intentional wait versus blocked task" indicator (Section 13) readable from icons alone at 4x.

### C4 — Camera

**Option.** A tabletop camera: fixed pitch band, orbit yaw, zoom; close-follow is the same camera at minimum zoom locked to a contestant. Cheaper than free orbit (occlusion, picking, level of detail), and close observation is carried by the inspector, portrait, and speech lines rather than facial animation. If a 2.5D or orthographic direction is acceptable (Q3), cost drops further.

### C5 — World rendering

Low-poly heightmap terrain with biome color zones; instanced trees and rocks; decals for ground markings and law boundaries; Fog as layered planes plus ground decals and a post-process desaturation; night as a gradient plus point lights at fires. All procedural, all agent-buildable, and all of it upgrades in place.

### C6 — Audio

Not specified in the GDD. Suggest an adaptive ambient state (calm / contact / combat / storm) driven by simulation state, a small SFX vocabulary bound to the presentation contract, and the law announcement as the game's signature sound. Music sourcing is a production question (Q7).

---

## 6. System gaps and clarifications

| ID | Gap | Where referenced | Suggestion | Cost |
| --- | --- | --- | --- | --- |
| D1 | **Wildlife** is referenced (hunting, "wildlife remains dangerous," truce exclusions) but never designed | 3, 4, 9, 10 | Minimal set: one prey species (hunting, flees) and one predator (pack, active at night and during arrival, ignores laws). The predator gives arrival a threat and a reason to group before PvP opens. Validation WILD 01: predator attack during Truce damages contestants; bots respond fight / flee / group with labeled reasons | S–M |
| D2 | **Skill list** — primary and secondary skills, capped bands, but no list | 5, 6 | About ten: gather, hunt, cook, build, craft, medic, melee, ranged, scout, negotiate | S |
| D3 | **Personality → decision mapping** — eight dimensions, values, quirks, but no statement of how they enter scoring | 6, 15 | A design-owned table: dimension → which considerations it scales → multiplier range. Values as tags that unlock or veto actions. Quirks as explicit modifiers with conditions. Without this table, agents will invent the mapping | S |
| D4 | **Dialogue budget** — "grounded contextual lines," no count | 14 | Situation templates × tone tags derived from personality (TUNE 150 situations × 4–5 tones) with slots for names and objects; a human writer polishes. Localization affects this (Q6) | M |
| D5 | **Economy numbers** — none, appropriately, but the tech plan needs a first pass | 4, 5, 9 | A tuning sheet: hunger, fatigue, and exposure rates; food per node and regeneration; carry weight; travel speed by load; HP; damage by equipment family; armor; bleed timers; build costs and times; salvage fraction. I can draft this next (Q10) | S |
| D6 | **Water** — "shallow crossings," nothing on swimming | 4 | Water impassable except at crossings: chokepoints, navigation simplicity, readability | S |
| D7 | **Concealment** — "hiding needs concealment," undefined | 7 | A terrain property (forest, tall grass, night) that reduces sight range; no crouch mechanic | S |
| D8 | **Autonomous building placement** — listed as a top risk | 5, 21 | Prototype with socketed camp sites in the terrain: bots choose site and modules, not freeform placement. Freeform later only if the socketed version proves limiting. Validation BUILD 01: every completed site has a valid entrance and work positions by construction | M (saves L) |
| D9 | **Betrayal register** — friendly fire off plus departure cooldown makes turning on clanmates mid-fight impossible; the pitch says "betray" | 8, 12 | Confirm the intended register: abandonment, theft on departure, treaty breaking, refused rescue. If so, make "left clan while it was under attack" explicit Betrayal-thread evidence | S |
| D10 | **Weather** — yields change only through published events, yet exposure includes wetness | 4 | Suggest no ambient weather in v1: day/night plus Cold Front only. Clarify either way | S |
| D11 | **Rest** — fatigue and guard rotations mentioned, no behavior | 4 | Rest at Hearth or shelter at night; guard as a clan role with rotation | S |
| D12 | **Departure thresholds** — morale, trust, custom breach lead to leaving; triggers unstated | 4, 8 | Explicit thresholds in the tech plan, design-owned | S |
| D13 | **Public fact class** — law notices and reports exist; no class for a broadcast fact | 7, 8 | Needed if Herald (A2) is adopted | S |
| D14 | **Perception cost at 100 agents** — sight cones and obstruction | 7, 15 | Tech plan (G5) | — |

---

## 7. Replay and meta

- **E1 — Statistical continuity that stays Standard-legal.** Head-to-head records, killed-by / rescued-by networks, streaks, and an earned epithet on the nameplate drawn from awards (Section 12). No bot behavior changes, so no Legacy classification is needed. Cost S.
- **E2 — Season framing.** TUNE ten runs form a season: standings, hall of champions, season Saga. Pure presentation over existing records. Cost S.
- **E3 — Onboarding roster.** First matches use a curated 24 (Section 26's twelve plus twelve) so attachment forms before The Hundred appears. Cost S.
- **E4 — Overseer's notes.** Player text attached to a bookmark, exported with the Saga. Cost S.

---

## 8. The Christ episode

The care taken in Section 17 — sourcing, tagging quotations, no worship economy, no conversion multiplier, refusal as valid, Coexistence selected up front — is what makes the portrayal credible inside a sandbox. Keep all of it. The findings below are about cost and coupling, not about the creative choice.

### F1 — Coupling: a generic Guest, with Christ as the first authored one

**Observation.** Guest-specific clauses appear in Sections 3, 9, 10, 11, 12, 13, 15, 19, 20, 21, and 24. Every guest rule is written as a Christ rule.

**Option.** Define a core "Guest actor" contract: non-competing, non-clan, protected as a sentient actor by Truce and Sanctuary, separate life IDs and record category, cannot occupy a winner slot or hold a run open. Christ is the first authored Guest. The core stays neutral, the tech plan implements one abstraction, the pipeline can be tested with a neutral guest (a wandering trader, a hermit healer) before the sensitive content lands, and future guests become cheap.

**Cost.** Neutral to S; it is mostly a re-labeling of what Section 17 already specifies.

### F2 — The custody branch

**Observation.** Custody is a bespoke 90-second state machine (six-second seizure, captor at a marked site, 20-second execution preparation) with dedicated acceptance scenes, used in one branch of one optional episode. Section 22 already asks whether it is worth it.

**Option.** Express accusation → persecution through existing verbs: threat, exclusion, attack, downed state, lethal follow-up. The crucifixion becomes the authored, restrained aftermath of a lethal attack by an actor who adopted the accusation. Presentation and coda are unchanged; STORY 06 and 07 reduce to existing truce-interrupt semantics; no captor-site invariants.

**Cost.** Saves M–L.

### F3 — A missing risk line: reception and platform policy

**Observation.** The risk table in Section 21 covers scope, authenticity, predetermination, and record mixing, but not public reception. A playable portrayal of Jesus, including a possible crucifixion, will draw attention regardless of the care taken.

**Suggestion.** Add a risk row: verify storefront content policies and rating implications for the intended platforms, prepare communication before any announcement, and decide whether the episode ships at launch or as a later update so the core game's reception is established first. A production risk, not a comment on the creative choice.

### F4 — Scope timing

Section 20 places the story slice inside first release. It is the largest optional item in the content budget and carries 11 of the 33 acceptance scenes plus a separate performance gate. Launch versus post-launch is Q5.

### F5 — Coexistence legibility

The Section 17 evaluator (six living from three clans, three aid exchanges across distinct pairs, no hostile action in the final three minutes, a proposal at 57, evaluation at 60) is precise but hard to communicate. Suggest a visible "Accord" object at minute 57 listing signatories and their conduct so the minute-60 result is legible. Cost S.

---

## 9. Notes for the tech plan

These are not decisions; they are things the tech plan will need to take a position on.

- **G1 — Data-first content with schemas and validators.** Laws, actions, recipes, structures, identities, dialogue templates, threads, and forecasts as data with a JSON schema and a validator each. Agents author; validators catch contract gaps before they reach the simulation.
- **G2 — Executable acceptance scenes.** Each Section 24 scene as a fixture (seed, scripted inputs, assertions) run headless in continuous integration, with a scene-authoring format defined in the tech plan. This is the single highest-leverage practice for agent-built code: an agent can prove a change did not break AI 03 before anyone watches a run.
- **G3 — Determinism.** Fixed timestep, per-subsystem seeded random streams, no wall-clock in the simulation, integer tick IDs on every event. Same-build reproducibility (Section 24) is otherwise a wish.
- **G4 — Stack.** The GDD rejects the assumption of a cheap C# port, not TypeScript itself. Given the team's recent browser and TypeScript builds with AI agents, a web stack — TypeScript simulation, WebGL renderer, headless Node for batch runs, a desktop wrapper for distribution — may be a production path rather than a prototype detour. The performance spike in Section 20 should measure it against at least one native alternative on the same fixtures. Q3.
- **G5 — AI cadence.** Tiered: threat interrupts at TUNE 10 Hz; task planning round-robin so each agent replans every 2–4 seconds; strategic intentions every 10–20 seconds; region-level knowledge for distant entities; precomputed static visibility. Section 15 permits adaptive scheduling as long as decisions remain authoritative.
- **G6 — Save and replay.** Event-sourced log plus periodic snapshots. The chronicle is derived from the log; a scenario is seed plus inputs; replay is the log. Matches Sections 12 and 19 and makes DATA 01 natural.
- **G7 — Batch telemetry.** The 100-match gate needs an automatic outcome report by identity, clan size, alliance size, equipment tier, and intervention pattern. Build it during the performance spike; tuning will live there.

---

## 10. Responses to the Section 22 questions

Format as requested: counterexample → consequence → proposed change.

| # | Question | Counterexample | Consequence | Proposed change |
| --- | --- | --- | --- | --- |
| 1 | Eight-member cap at 100 | Thirteen-plus full clans reach minute 40 | Refuge becomes a melee; individual fights unreadable | Staged Fog pockets (B3); TUNE cap 10–12; test both |
| 2 | 60 minutes with fast-forward | A player runs 4x from minute 10; a 60-minute match is 15 real minutes of mostly walking | Crafting and social development are never perceived | Decide the real-time target first (Q1); Auto-Director as the default first-run mode with opt-out; forecasts (A1) reward slowing down |
| 3 | Minute-50 freeze | None found | Freeze is correct and well highlighted | Keep |
| 4 | All-dead draw vs public tiebreaker | Two exhausted clans hide in opposite corners until 60:00 | An hour of investment ends in "no winner" | Public Beacon (B4); keep the draw as the fallback |
| 5 | Six influence points | A player spends all six by minute 25 and watches for 35 minutes with no verb | Second half of the match has nothing to do | Forecasts (A1) rather than more points; consider one pressure tool (A2) |
| 6 | Immediate elimination notices | None found | Readability wins for v1 | Keep; realism preset later |
| 7 | Standard reset and continuity | Two contestants meet in ten runs and nothing acknowledges it | Continuity is invisible | Head-to-head records and epithets (E1); seasons (E2) |
| 8 | One island | None found for v1 | Seeds, laws, roster draws, and day/night give variety | Keep; add draw size (B1) as a variety axis |
| 9 | Losing advanced knowledge | Sole smith dies at minute 20 and no schematic exists | Clan falls back to basics — acceptable, since basics are universal | Keep; ensure KNOW 01 fixture includes the "no schematic" case |
| 10 | Distinguishing laws, customs, fellowship, teachings | Four social layers on one screen | Player confusion | Social Commandments and fellowship are already Custom/Story only; in Standard only laws and customs appear — keep it that way; icon language in C3 |
| 11 | Recognizable Gospel-informed character with skeptical bots | None found | Design handles it | Keep F5 protections |
| 12 | Custody branch worth its cost | One branch, one episode, dedicated state machine and gates | High cost, single use | Existing-verb persecution (F2) |
| 13 | Coexistence without changing the competition | None found | Selected up front; correct | Keep; add the Accord object (F5) |

---

## 11. Contradictions and clarifications

| # | Sections | Issue | Suggested clarification |
| --- | --- | --- | --- |
| 1 | 1 vs 3 | "45 to 60 simulation minutes" versus a fixed 60-minute timeline | State that the timeline is 60 and matches typically resolve earlier by attrition |
| 2 | 11 vs 20 | "Six influence points" and "six Standard interventions" are different things (six points, six intervention types) | Use "six intervention types" and "six points" explicitly |
| 3 | 6 vs 4 | A night-travel quirk exists; no day/night cycle is defined | Define the day cycle (B2) or remove the quirk |
| 4 | 4 | Weather changes yields only via published events, but exposure includes wetness | State whether ambient rain exists (D10) |
| 5 | 3, 4, 9, 10 | Wildlife referenced repeatedly, never specified | D1 |
| 6 | 2 vs 1 | "Choose a roster" versus "Exactly 100"; records filter by roster size, implying subsets are allowed in Standard | State whether Standard permits a roster subset and whether it affects record category |
| 7 | 14 vs 20 | Section 14 lists 13 critical animation states; the content budget in Section 20 does not budget animation | Add an animation line to the budget, or adopt the icon-first approach in C3 |
| 8 | 11 vs 13 | Focus is "one" contestant; the side panel follows "up to five" | State that Focus is one of the five followed slots |
| 9 | 10 vs 11 | "One global modifier per category and a maximum of three temporary modifiers" versus a budget that could buy up to six protections | Clarify that the three-modifier limit is concurrent, not per match |
| 10 | 5 | Teaching takes 20 seconds; Section 17 gatherings last 45 seconds; Section 8 custom consultation takes 20 seconds | Consistent, but worth a single "social action durations" table |

---

## 12. Questions for Jani

Things I cannot verify from the document and did not want to assume.

1. **Session length.** What real-time session do you want a Standard match to be — around 30 minutes, or a full hour at 1x? This decides map scale, need rates, and the day structure (B2).
2. **The number 100.** Is "100 contestants per match" essential to the pitch, or is "The Hundred" as a league with a smaller default draw acceptable (B1)?
3. **3D and stack.** Is full 3D with an orbit camera a commitment, or would a tabletop or 2.5D camera be acceptable (C4)? Is there a leaning toward a web/TypeScript stack versus Unity or Godot, given how the team has built recent projects (G4)?
4. **Art resources.** Is a human artist committed, and roughly when? Which style families do you like, so the placeholder kit points the same direction from day one (C1)?
5. **Christ episode timing.** Launch feature or a later free update? And is a generic Guest framework desirable — would you want other guest archetypes eventually (F1, F4)?
6. **Localization.** Finnish and English at launch, or English only? It changes how dialogue templates are built (D4).
7. **Audio and music.** Any plan or source for music? Licensed, commissioned, or generated (C6)?
8. **Platform and rating.** Steam first? Any rating targets in mind? This feeds the reception risk line (F3).
9. **Wildlife.** Any preference for the fauna set (D1)?
10. **Next deliverable.** Would a first-pass tuning sheet (D5) and a personality-to-scoring table (D3) be useful before or alongside the tech plan? I can draft both.

---

## 13. Decision table

For the designer to mark: Accept / Adapt / Defer / Reject.

| ID | Proposal | Sections | Cost | Decision |
| --- | --- | --- | --- | --- |
| A1 | Forecast system (free, event-verified, invisible to bots) | 2, 11, 12 | S–M | |
| A2 | Storm Warning and Herald in the Standard deck; one Glory Trial after testing | 3, 7, 10, 11 | S | |
| A3 | 10:00 bell as a set-piece; first night inside arrival; TUNE arrival 6–8 | 3 | S | |
| A4 | "Why?" panel with rejected alternatives; relationship web overlay | 13 | S | |
| B1 | The Hundred as league; TUNE 32–40 default draw; Grand Arena at 100 | 1, 6, 20 | S | |
| B2 | Day/night cycle and fiction-time mapping; real-time target set first | 1, 3, 4, 6 | S–M | |
| B3 | Staged Fog pockets; TUNE cap 10–12 | 3, 8 | M | |
| B4 | Public Beacon finale objective | 3 | S | |
| C1 | Presentation Baseline as a design deliverable | 14 | M | |
| C2 | Parametric character kit with rendered portraits | 6, 14 | M | |
| C3 | Ranked readability channels; presentation contract per action; required intent-label template | 13, 14, 15 | S | |
| C4 | Tabletop camera | 1, 13 | S | |
| C5 | Procedural world rendering baseline | 14 | M | |
| C6 | Adaptive ambient audio state | 14 | S | |
| D1 | Minimal wildlife: one prey, one predator | 3, 4, 9 | S–M | |
| D2 | Skill list | 5, 6 | S | |
| D3 | Personality-to-scoring table | 6, 15 | S | |
| D4 | Dialogue templates × tone tags | 14 | M | |
| D5 | First-pass tuning sheet | 4, 5, 9 | S | |
| D6 | Water impassable except crossings | 4 | S | |
| D7 | Concealment as a terrain property | 7 | S | |
| D8 | Socketed camp sites for the prototype | 5 | M | |
| D9 | Confirm betrayal register; abandonment as thread evidence | 8, 12 | S | |
| D10 | No ambient weather in v1 | 4 | S | |
| D11 | Rest and guard behavior | 4 | S | |
| D12 | Departure thresholds | 4, 8 | S | |
| E1 | Head-to-head records and epithets | 12 | S | |
| E2 | Seasons | 12 | S | |
| E3 | Curated 24 onboarding roster | 13, 26 | S | |
| E4 | Overseer's notes in the Saga | 12 | S | |
| F1 | Generic Guest contract; Christ as first authored Guest | 3, 9–13, 17 | S | |
| F2 | Persecution through existing verbs; drop custody state machine | 17, 24 | saves M–L | |
| F3 | Reception and platform risk row | 21 | S | |
| F4 | Decide launch vs post-launch for the episode | 20 | — | |
| F5 | Accord object for Coexistence | 17 | S | |

---

## 14. Design inputs the tech plan will need

Regardless of which proposals are accepted, the tech plan cannot be written well without these from design:

1. Real-time session target and the day structure (B2, Q1).
2. Default match population (B1, Q2).
3. Camera model and presentation baseline (C1–C4, Q3–Q4).
4. First-pass tuning sheet (D5).
5. Personality-to-scoring table (D3) and skill list (D2).
6. Wildlife specification (D1).
7. Intent-label catalog for every goal and plan type (C3).
8. Forecast templates, if A1 is accepted.
9. Guest contract, if F1 is accepted; custody decision (F2).
10. Decision on the Standard intervention deck (A2).

---

*Review ends. This document evaluates The Last Clan GDD v0.2 as written and makes no claim that any behavior, performance, or balance has been demonstrated. All numbers marked TUNE remain hypotheses, including the ones proposed here.*
