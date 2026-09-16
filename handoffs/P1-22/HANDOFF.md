# Handoff — P1-22 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `fa37680` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: three-phase swings whose wind-up clock starts when the attack legally starts, permission checked at launch **and** at contact, and GDD values for stamina, arrows, range and facing.

Changed files: `packages/sim/core/combat.ts` (new) — `beginAttack`, `advanceSwing`, `isFacing`, `MELEE`, `BOW`; `packages/sim/core/index.ts`; `packages/sim/core/combat.test.ts` (13 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. Prohibited attacks cannot precharge an instant hit | `evidence/combat.txt`, `combat.test.ts` | **PASS** — an actor refused at ticks 60, 80 and 99 accrues **nothing**; when the truce lapses at 100 the swing begins at 100 and the blow lands at 106, a full six-tick wind-up later. There is no structure in which an intention can be recorded early and counted later, which is what makes the GDD's rule enforceable rather than aspirational. A second swing during a swing is refused, so wind-ups cannot be stacked |
| 2. Launch and impact checks both enforce current rules | `evidence/combat.txt`, `combat.test.ts` | **PASS** — a truce installed during the wind-up aborts at contact with `PermissionDenied`, and the stamina is **still spent**: the actor really did swing. A target that steps out of reach aborts with `OutOfRange`. A truce that lapses mid-swing does not retroact an illegal beginning into a legal hit, because the illegal beginning never produced a swing to rescue |
| 3. Stamina, arrows, range and facing follow GDD values | `evidence/combat.txt`, `combat.test.ts` | **PASS** — melee reaches 1,800 mm and refuses 1,900; a bow reaches 45 m and refuses 46; a target behind the attacker is `NotFacing` on the same 160-degree arc the sensory adapter uses; no stamina and no arrows each refuse with their own reason, and a loosed shot spends its arrow at release rather than at impact |

Commands executed: `npm run verify` → **0** (build, lint, **844/844** vitest across 54 files — 831 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Three notes.
1. **Precharging is prevented by absence, not by a check.** There is no "readying" state that stores intent, so `beganAtTick` cannot be earlier than the tick the attack was permitted. A guard against precharging would have been a rule to remember; having nowhere to store the charge is a property.
2. **An aborted swing still costs.** Stamina and the arrow are spent even when the blow is refused at contact, because the swing happened — refunding them would make waiting for a truce to lapse cost-free, which is the same exploit from the other direction.
3. **Refusal order is fixed** (stamina, arrows, range, facing, permission) so two runs agree on *why* an attack failed, not just that it did. A varying reason is a replay divergence dressed as a detail.

Deferred and out of scope: this is preparation and contact. **Not here:** applying the damage (P1-23 owns simultaneous damage and health states), shields, blocking, cover, weapon tiers and the GDD's per-class duration multipliers, morale and local numbers, the bow's projectile itself — P1-21 sweeps it and nothing yet joins the two — and the revealed cue that attacking gives observers, which belongs with perception.
