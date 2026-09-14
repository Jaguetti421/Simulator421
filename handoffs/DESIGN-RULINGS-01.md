# DESIGN-RULINGS-01 — delegated design decisions for The Last Clan

**Authority:** Jani (producer and GDD owner) delegated these calls on 14 September 2026 ("You may make those GDD and other calls now"). Rulings are binding for the web track unless Jani overrides in writing; they should be logged for the Godot track as shared design clarifications (RESEARCH_PROTOCOL: clarifications may be shared, code may not). Each ruling names the GDD/addendum section it refines and the TUNE constants it sets. **Every numeric value below is TUNE**: a starting point for the G1 playtest, not a measured truth.

## R1 — Every macro template is an island

GDD §4 and the addendum describe an island with a coast; none of the three compiled templates (`basin`, `ridge`, `valley`) currently is one. Ruling: every full-envelope template (800×800 m) has, from the outside in: **deep water (sea)** at the envelope edge, a **shallow coastal band** 3–12 cells wide, and a **land interior**. Targets over the whole 640,000-cell envelope: land (Ground + Cliff + Obstacle) **55–65 %**; shallow water **8–12 %** (coast plus crossings); deep water the remainder, of which at most **one inland lake** up to 15,000 cells. The macro feature (valley, ridge, basin lake) lives inside the land interior. Acceptance: a generator validator asserts the fractions and the D05 anchor-set route times at 3.5 m/s; the food-within-45 s and camp-within-90 s density rules stay as written.

## R2 — The shipping valley is a land valley; the current one becomes a test template

The current `valley` is a north–south flooded trough (deep for ~34 cells either side of the axis, shallow to ~166, land to an escarpment at 250). Ruling: rename it **`trough`** and keep it as a **test template** (it usefully instances every traversal class). The shipping **`valley`** is a land valley inside the R1 island: a floor 150–250 cells wide, one **stream** ≤ 6 cells wide running its length with at least **three shallow crossings** and no deep segment longer than 40 cells, and rims that may include **escarpments as design landmarks** with at least **two passes** each. Escarpments are authored for readability and routing interest, not for class coverage — coverage belongs to `trough` and `ridge`. The escarpment the developer added is therefore acceptable *as a landmark* if it gets passes and a stream below it; it is not acceptable as a test device inside the shipping map.

## R3 — The G1 first-playable scene

TP v1.1 §22's **180×180 m coastal valley** is the G1 scene, compiled as a bounded sub-recipe (a small grid, or a windowed region of the 800 grid — the developer's choice, recorded in the handoff): land-majority, one stream with two crossings, one obstacle cluster, eight starts each within 45 s walking of a food node and 90 s of a camp socket, the sea on one edge so the coast exists. Eight contestants, no cliffs unless there is a pass.

## R4 — The shipping template is always under test

Sight and route suites must include fixtures on the shipping `valley` (and later on every shipping island): LOS at the sight limit over open ground, a stream crossing with the 0.8 multiplier, a coast edge, the eight start positions, and the D05 anchors. Testing only on `ridge`/`trough` proves the algorithm, not the game.

## R5 — Fixture DSL v2 is accepted; name the acknowledgement source

`ToolCheck` is accepted as a dated addendum. Reason matching against acknowledgements is the correct resolution of the `CommandRejected` question; add an explicit **`AckCountGte`** assertion kind (or document that `EventCountGte` with `type: CommandRejected` reads acknowledgements) so a fixture states its source. A rejected command never enters the authoritative event log or hash domain.

## R6 — AppearanceRecipe carries palette indices

Accepted as designed: clan and accent colours are indices into limited palettes resolved by presentation; the 2D readability renderer and the 3D kit use the same palette table so both views agree by construction. Appearance never carries stats (enforced by the closed-record rule, not by a tautological refinement).

## R7 — TUNE constants ratified provisionally

Eye height 1.6 m; obstacle occluder height 2.2 m; cliff step 1.4 m; shallow water 0 to −1.2 m, deep below; walk 3.5 m/s, sprint 5.0 m/s (GDD §30.2); route budget 4,000 expansions per job with the relation "≤ 5 jobs per tick within TP v1.1 §5's 20,000 per tick" written where the budget is defined; portal repeat limit 2; sight budget 260 cells per ray. All stay `DEV`-tagged in a single `tune.ts` per package with the citing section until the G1 playtest.

## R8 — Readability thresholds apply at player scale

Nameplate overlap ≤ 0.35 and ring contrast ≥ 3:1 are ratified as TUNE **at the two GDD camera presets** (tabletop 45° at the default distance; close-follow at minimum zoom), evaluated on a viewport-limited render. Island-scale renders are the overview map and are not readability evidence.

## R9 — Regions are connected components

TP v1.1 §5's "regions" are defined as **connected components of passable cells**, size-capped and split at narrowings, with **portals** as passable cells on a component boundary. The current 128-cell tiling may remain as an interim label if `RouteResult` documents it as tiles; real regions land before P3-05/P3-06 (island family and refuge crowd navigation).

*Rulings end. Jani may override any of them; if he does, the override is recorded in the GDD addendum and both tracks are told.*
