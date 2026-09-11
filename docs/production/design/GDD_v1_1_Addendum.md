# The Last Clan — GDD v1.1 engineering addendum

11 September 2026. Adopted design decisions for implementation under Jani's delegated design authority. This supplements the complete GDD v1 in reference/GDD_v1.md; it does not replace its content. Numeric values remain tuning hypotheses where marked. No prototype test has yet validated them.

## D01 — Simultaneous support and damage

At each 10 Hz boundary, install scheduled laws/phases first, process commands, observations and decisions, then advance motion/actions. Resolve eligible resource/work/support completions in stage 6, all damage in stage 7, cleanup in stage 8, results in stage 9. A standing executor valid at stage 6 may complete aid even if stage-7 damage later downs or eliminates them. Downed patients are valid targets for actions that explicitly revive. Earlier range, law, target or ownership invalidation cancels completion. Terminal policy disables healing before support. Apply this symmetrically to contestants and the guest.

## D02 — Integer duration and rate semantics

Positive action durations use ceil(modified_seconds × 10) ticks after the single applicable skill modifier. A 1.2-second action × 0.9 takes eleven ticks. Rates accumulate fractional remainders in saved integer state rather than losing fractions at each tick. Newly started actions first progress on the following interval; no zero-tick attack wind-up appears at a law boundary. Display duration from the quantized action contract.

## D03 — Hunt and Ranged do not stack

A wildlife bow shot uses Hunt for preparation duration and retains base spread. A sentient-target bow shot uses Ranged for spread and retains base preparation. Butchering uses Hunt. Adopt an eight-tick minimum preparation as TUNE; current Hunt bands 1/2/3 produce 12/11/10 ticks from the GDD multipliers. One shot never receives both skill bonuses. The cap is a balancing value, not evidence of measured combat balance.

## D04 — Accepted commands and forecast influence

A rejected command has no world effect and cannot mark a forecast Influenced. Any accepted world-changing input committed after forecast creation marks influence permanently, including a future scheduled change. Already committed schedules are part of the known baseline. Observer-only notes, focus and forecasts never influence the simulation. Cancellation/reload does not clear a previously acquired influence flag; branch and result deduplication still apply.

## D05 — Collision size and strategic travel validation

Use a 0.3 m actor radius as TUNE, checked against all camp work positions, melee reach and crowded passages. The GDD's base walk is 3.5 m/s, sprint is 5 m/s, and terrain/carry multipliers remain authoritative. Keep approximately 800 × 800 m as the initial Standard authoring envelope; do not substitute real-world 1.4 m/s walking or shrink the island automatically.

The four-to-six-minute crossing intent applies to Standard geography; Trial and tutorial publish smaller profile-specific spans while retaining the opening-access rules. For Standard it becomes a strategic route test: identify a fixed, versioned anchor set covering spawn neighborhoods, major camps, every macro-region extremity and final staging entrances. Compute all reachable anchor-pair shortest travel times using the unburdened walking model and actual terrain. Require the longest designated cross-island route to be approximately 240–360 seconds, and reject any required anchor-pair route above 360 seconds. Record lower-bound/timing deviations for tuning. An all-anchor-pair calculation is not an exhaustive diameter over every traversable point; reports must say so. Bound worst access from local fine geometry to its regional anchors and reject inaccessible work areas separately. Retain food within 45 walking seconds, plausible camp within 90 seconds and aggregate six-minute opening food supply. Resource contention and dangerous encounters receive behavioral tests in addition to these static reachability checks.

## D06 — Art acceptance is independent of asset technique

An attractive procedural character kit is an acceptable production path. AppearanceRecipe separates identity from implementation. G1 requires all twelve shared action states and readable carrying, tools, waiting, danger and aid, using code-generated motion where useful. P4 refines the complete three-build/four-head/ten-headwear/six-accessory kit and all 100 recipes. A rigged GLB replacement is optional if the same human visual gate is met procedurally. Debug capsules alone do not meet the first-playable presentation promise. Rendering cannot create gameplay effects.

## D07 — Catalog profiles

Fixture permits an explicitly declared subset and deterministic setup overrides, can never write canonical careers, and cannot certify a production population gate. Prototype8 uses eight declared roster identities and a recipe subset with closed dependencies. Trial24 requires exactly 24 identities and its declared supported subset. Standard100 requires all 100 identities and exactly the GDD's 28 recipes including ten structures. The Story guest is additional and never counted as a contestant. Test flexibility never weakens Standard validation.

## D08 — Trial's explicit thirty-minute schedule

The GDD specifies a 24-person thirty-minute Trial but leaves its detailed shortened calendar to implementation. Adopt half the Standard phase timestamps for Trial. Do not halve action durations, physiology, travel speed, combat or ordinary day/night rates. Trial still uses twelve-minute days: night is 08:00–12:00 and 20:00–24:00 within its duration. Tutorial is a separate authored eight-minute profile.

| Trial transition | Time | Tick |
| --- | --- | --- |
| Sentient harm and theft open | 05:00 | 3000 |
| Structure harm opens | 07:30 | 4500 |
| First Fog pressure | 12:30 | 7500 |
| Second Fog pressure | 18:00 | 10800 |
| Staging announcement | 20:00 | 12000 |
| Outer closure | 24:00 | 14400 |
| Membership lock, protection end, announced refuge | 25:00 | 15000 |
| Further refuge contraction | 27:00 / 28:00 | 16200 / 16800 |
| Terminal pressure | 29:00 | 17400 |
| Forced elimination then final resolution | 30:00 | 18000 |

Trial keeps six Influence, sixty-second notice, two-minute modifiers except instant-on-activation Herald, and three simultaneously active paid modifiers. Latest modifier activation is 23:00 and all protections/modifiers expire by 25:00; submission must still satisfy notice. Terminal pressure starts at 4 HP/s and rises by 2 HP/s every thirty seconds, with healing disabled and downing bypassed. Shorter exposure to the terminal ramp is intentional. Trial winner-rate and pacing are separately tuned and never used as Standard balance proof.

## D09 — Closing boundaries are exclusive

Use start-inclusive, end-exclusive action windows unless a GDD rule explicitly states otherwise. Accord accepts signatures from tick 34200 through ticks strictly below 35700 (57:00 to before 59:30); withdrawals must commit strictly before tick 36000. At tick 36000 closure installs before commands and evaluation. The qualifying conduct interval includes actions at 57:00; final evaluation occurs after all accepted preclosure conduct has been committed. This makes UI countdowns and evaluator samples unambiguous. Forecast matching retains its distinct explicit contract: events after creation and through its deadline inclusive.
