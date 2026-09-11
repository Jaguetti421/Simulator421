# GDD traceability and acceptance ownership

The full GDD v1 source is bundled at reference/GDD_v1.md. Original source sections below were checked against it. This is a coverage plan, not a passed-test report. Earlier packets may establish partial foundations; the gate column identifies the first full required production proof. GR repeats all 51 scenes. STORY 11 checks authored source preservation at GS; generated-line probes are additionally required at GL if the optional model ships.

## Sixteen review provenance checks

| Question from T3 | Existing GDD v1 source |
| --- | --- |
| Exactly 28 recipes | 30.5 recipe manifest; 20.2 scope budget |
| Eight forecast templates and three slots | 11.2 |
| Five twelve-minute days | 3.1 |
| Camera 45° pitch, 35–65° range | 14.2 |
| Deputy then joining-order succession | 8.1 |
| Enemy positions 10s tactical age, food bands 30s | 7.6 and 30.2; enemy detail retention is separately 60s |
| Normalized benefits/costs, commitment and switching | 6.5 and 15.3 |
| Four music priorities and release delay | 14.5 |
| Shallow-water speed multiplier | 30.2 |
| One skill per action and Hunt bands | 6.4; unresolved interaction now D03 |
| Perception light and sleeping modifiers | 7.1 and 30.2 |
| Three builds/four heads/ten headwear/six accessories | 14.1 |
| 24 deer/12 wolves, den behavior | 4.6 and 30.4 |
| Six-minute aggregate opening food | 30.3 |
| Consumption at 50 percent construction progress | 30.5 |
| 51 controlled acceptance scenes | 24.1; rows counted and IDs validated by kit_check.py |

## Complete scene mapping

| GDD ID | Required setup and pass condition (original v1) | Completing packet / owner | First full gate |
| --- | --- | --- | --- |
| AI 01 | A hungry contestant has a known reachable food source and enough time to reach it. **Pass:** Acquires and consumes food without unrelated work causing avoidable starvation | [P1-18](../work/P1-18.md) / A3; A7 verification | G1 |
| AI 02 | A desired tool is missing but its materials and worksite are available. **Pass:** Completes a valid acquisition and crafting sequence with conserved resources | [P2-03](../work/P2-03.md) / A3; A7 verification | G2 |
| AI 03 | A protected target opens after a known delay. **Pass:** Patient profile may wait with a deadline; immediate-need profile selects a viable alternative | [P1-19](../work/P1-19.md) / A3; A7 verification | G1 |
| AI 04 | A publicly announced expiry is extended with legal notice. **Pass:** Relevant plan is invalidated and updated without an illegal attack or endless wait | [P2-14](../work/P2-14.md) / A1; A7 verification | G2 |
| AI 05 | The only known route becomes blocked. **Pass:** Chooses another route, target, or useful fallback and reports failure if none exists | [P1-06](../work/P1-06.md) / A2; A7 verification | G1 |
| AI 06 | Two clan members require the same scarce material. **Pass:** Reservations prevent duplication; one replans or a shared priority resolves the conflict | [P1-08](../work/P1-08.md) / A1; A7 verification | G1 |
| AI 07 | A stronger enemy appears during work. **Pass:** Reassesses promptly and selects a defensible response using observed information | [P1-25](../work/P1-25.md) / A3; A7 verification | G1 |
| AI 08 | A friend is downed with a feasible rescue route. **Pass:** Loyal and self-preserving profiles can choose different justified responses | [P2-09](../work/P2-09.md) / A3; A7 verification | G2 |
| AI 09 | A leader dies during a multi-person plan. **Pass:** Leadership and reservations recover; survivors do not remain indefinitely idle | [P2-08](../work/P2-08.md) / A3; A7 verification | G2 |
| AI 10 | Hidden enemies move beyond all valid perception. **Pass:** Bot knowledge does not update until a legitimate observation or report | [P1-15](../work/P1-15.md) / A3; A7 verification | G1 |
| LAW 01 | Projectile impacts on the tick a truce activates. **Pass:** Damage uses the new law and is blocked consistently | [P1-22](../work/P1-22.md) / A1; A7 verification | G1 |
| LAW 02 | Protected area boundary separates shooter and target. **Pass:** Neither side can exploit sanctuary to deal one-way damage | [P1-13](../work/P1-13.md) / A1; A7 verification | G1 |
| LAW 03 | Law expires while a bot is poised to attack. **Pass:** Normal legal wind-up occurs after permission opens | [P1-19](../work/P1-19.md) / A3; A7 verification | G1 |
| END 01 | Multiple clans receive lethal damage in the same tick. **Pass:** Result is independent of entity iteration order | [P3-08](../work/P3-08.md) / A1; A7 verification | G3 |
| END 02 | All remaining members are downed. **Pass:** No premature winner; recovery, bleed-out, or final storm resolves the state | [P3-08](../work/P3-08.md) / A1; A7 verification | G3 |
| END 03 | Membership change arrives on the freeze tick. **Pass:** Freeze installs first and invalidates the change | [P3-08](../work/P3-08.md) / A1; A7 verification | G3 |
| DATA 01 | Save, reload, finalize, then reload an earlier checkpoint. **Pass:** One Standard result; later branch cannot duplicate its credit | [P2-20](../work/P2-20.md) / A5; A7 verification | G2 |
| DATA 02 | Downing, revival, second fight, and elimination occur. **Pass:** Kill and assist attribution uses the correct episode | [P2-20](../work/P2-20.md) / A5; A7 verification | G2 |
| KNOW 01 | The sole knower of an advanced recipe dies before teaching it. **Pass:** Survivors retain basics, recognize the missing procedure, and find a legitimate alternative | [P2-03](../work/P2-03.md) / A3; A7 verification | G2 |
| KNOW 02 | A teaching action is interrupted, then completed later. **Pass:** No premature knowledge transfer; completion records teacher, learner, and procedure | [P2-02](../work/P2-02.md) / A1; A7 verification | G2 |
| SOCIAL 01 | A clan adopts a custom while a member is out of contact. **Pass:** An uninformed member is not accused of knowingly breaking it; notified members may refuse | [P2-07](../work/P2-07.md) / A3; A7 verification | G2 |
| SOCIAL 02 | A private intervention has no witnesses. **Pass:** No bot receives firsthand evidence without perception; later reports retain their source | [P2-07](../work/P2-07.md) / A3; A7 verification | G2 |
| STORY 01 | Episode disabled with the same seed and inputs. **Pass:** Core event sequence and results match the baseline; no guest AI, teaching effects, or story RNG changes | [P5-11](../work/P5-11.md) / A0; A7 verification | GS |
| STORY 02 | Guest arrives on a law or phase boundary. **Pass:** Mode changes atomically, current permissions apply, and roster and winner eligibility remain correct | [P5-11](../work/P5-11.md) / A0; A7 verification | GS |
| STORY 03 | Receptive, skeptical, opportunistic, and indifferent listeners hear a lesson. **Pass:** Reactions use individual state; refusal is valid; aid and religious affiliation remain distinct | [P5-05](../work/P5-05.md) / A3; A7 verification | GS |
| STORY 04 | Hungry listeners and an approaching threat interrupt a gathering. **Pass:** Needs and danger cancel attendance; no indefinite sermon loop or free food | [P5-04](../work/P5-04.md) / A6; A7 verification | GS |
| STORY 05 | More than eight people from rival clans enter fellowship. **Pass:** Clan caps, ownership, information limits, and competitive membership remain unchanged | [P5-05](../work/P5-05.md) / A3; A7 verification | GS |
| STORY 06 | Truce activates during an ordinary guest attack or persecution preparation. **Pass:** Hostile action stops, bleed-out follows source policy, and no deferred lethal event fires | [P5-07](../work/P5-07.md) / A1; A7 verification | GS |
| STORY 07 | Persecution initiator leaves or is downed, guest is revived, or bleed-out occurs first. **Pass:** Action cancels; the actual death cause is retained and no ordinary kill is relabeled crucifixion | [P5-08](../work/P5-08.md) / A6; A7 verification | GS |
| STORY 08 | Healing is used, saved, and reloaded. **Pass:** Only one validated encounter per visit; no eliminated competitor returns and no storm damage is canceled | [P5-06](../work/P5-06.md) / A1; A7 verification | GS |
| STORY 09 | Guest dies, lives, or is never spawned when the run ends. **Pass:** Correct departure or conditional coda; no guest K/A reward, duplicate credit, or mandatory death | [P5-10](../work/P5-10.md) / A6; A7 verification | GS |
| STORY 10 | Coexistence reaches its deadline with qualifying aid or with staged empty trades. **Pass:** Only actual useful aid counts; Shared Peace or Unresolved is recorded; no competitive win | [P5-10](../work/P5-10.md) / A6; A7 verification | GS |
| STORY 11 | A follower repeats a lesson and a generated line claims a false quotation. **Pass:** Teaching ID and source persist; unsupported wording cannot be presented as scripture | [P5-03](../work/P5-03.md) / A6; A7 verification | GS |
| FORECAST 01 | Outcome occurs off-camera, on deadline, before creation, or after deadline. **Pass:** Only events after creation and through deadline count; reasons link to evidence | [P2-21](../work/P2-21.md) / A5; A7 verification | G2 |
| FORECAST 02 | Same seed and commands with forecasts, notes, and director toggled. **Pass:** Identical authoritative state hashes and outcomes; no observer state in beliefs | [P2-21](../work/P2-21.md) / A5; A7 verification | G2 |
| FORECAST 03 | Commit a forecast, intervene, reload, cancel, branch, or abandon. **Pass:** Sticky influence and branch flags; no duplicate credit; Correct/Incorrect/Canceled/Voided follow contract | [P2-21](../work/P2-21.md) / A5; A7 verification | G2 |
| TIME 01 | Cross all night, law, and Fog boundaries at 1x, 2x, 4x, and pause. **Pass:** Same ticks and outcomes; pause freezes all clocks | [P3-08](../work/P3-08.md) / A1; A7 verification | G3 |
| EXPO 01 | Night at open ground, fire, shelter, and Cold Front overlap. **Pass:** Accumulation and mitigation equal Section 30; ordinary shelter alone handles ordinary night | [P2-16](../work/P2-16.md) / A1; A7 verification | G2 |
| WILD 01 | A wolf threatens three contrasting contestants during Truce. **Pass:** Wildlife damage remains legal; justified fight, flee, or nearby-group response; 100 contestants remain the roster | [P2-11](../work/P2-11.md) / A3; A7 verification | G2 |
| INFO 01 | Herald activates after a clan moved food or lost its Hearth. **Pass:** Timestamped broadcast uses current authorized fields, stale bands age normally, no retarget or hidden inventory leak | [P2-16](../work/P2-16.md) / A1; A7 verification | G2 |
| LAW 04 | Storm Warning would isolate a safe component or stack with Fog. **Pass:** Invalid placement rejected; valid damage uses maximum hazard rate, with legal escape notice | [P2-16](../work/P2-16.md) / A1; A7 verification | G2 |
| LAW 05 | Paid amendments, maximum concurrency, expiry and lock collide. **Pass:** Six-point budget conserved; three active modifier cap; no protection extends beyond 50:00 | [P3-08](../work/P3-08.md) / A1; A7 verification | G3 |
| BUILD 01 | Fill every legal camp socket and remove its Hearth. **Pass:** All work positions and exits remain reachable; clan identity and permissions survive Hearth loss | [P3-04](../work/P3-04.md) / A2; A7 verification | G3 |
| SOCIAL 03 | Absent members miss a vote and later return; a member leaves under attack. **Pass:** Fixed electorate, explicit consent, notice before breach, and no fabricated betrayal | [P2-10](../work/P2-10.md) / A3; A7 verification | G2 |
| FINALE 01 | Several clans choose the same staging route and all 100 reach the refuge. **Pass:** No teleports, forced assignment, invalid paths, omitted damage, or missing priority labels | [P3-10](../work/P3-10.md) / A3; A7 verification | G3 |
| END 04 | One clan occupies the refuge marker while another survives. **Pass:** Standard declares no occupancy win; only last-clan or explicit draw resolution applies | [P3-08](../work/P3-08.md) / A1; A7 verification | G3 |
| END 05 | Departure ends at 49:55 or on 50:00; all survivors die in a terminal pulse. **Pass:** Cooldown truncates at lock; on-lock departure fails; simultaneous deaths cannot award an update-order win | [P3-08](../work/P3-08.md) / A1; A7 verification | G3 |
| ECON 01 | Two crafters compete for one bar and a worker dies mid-build. **Pass:** Quantities and reservations conserve; consumed inputs are not duplicated or refunded twice | [P3-05](../work/P3-05.md) / A1; A7 verification | G3 |
| AI 11 | Swap one trait between paired otherwise identical fixtures. **Pass:** Relevant considerations change as specified; survival competence and knowledge access remain equal | [P2-10](../work/P2-10.md) / A3; A7 verification | G2 |
| PRESENT 01 | Day/night, forest, dense camp, 100-person finale at 100 and 150 percent text scale. **Pass:** No critical clipping; selected identities, boundaries, actions, and waiting states remain readable | [P4-13](../work/P4-13.md) / A7; A7 verification | G4 |
| STORY 12 | Accord includes late acceptances, a violator, victims, and useful aid across pairs. **Pass:** Public qualifying set matches the final evaluator; no hidden subset search or religious requirement | [P5-10](../work/P5-10.md) / A6; A7 verification | GS |

## Shipping scope beyond the named scenes

| Deliverable | Required packets |
| --- | --- |
| Standard100 and complete 28-recipe economy | P3-02–P3-11 |
| Custom law/resource tools and mode provenance | P3-12, P3-14–P3-17 |
| Two commandments and three voluntary whispers | P3-13–P3-14 |
| Career archive, episodes and forecasts | P2-19–P2-22 |
| Six chronicle threads, dossiers, notes, epithets, Saga | P4-09–P4-12 |
| Scenario import/export | P3-14, P3-16 |
| Full procedural identity, twelve motions, 300 core lines | P4-02–P4-08 |
| Eight-minute tutorial, clean-PC offline release | P6-02–P6-03, P6-09 |
| Guest, teachings, fellowship, persecution and Coexistence | P5-01–P5-15 |
| Optional read-only local conversations | PX-01–PX-06; not a release prerequisite |

Additional engineering evidence includes replay hashes, save-frequency invariance, malformed-input fuzzing, bridge ownership, hidden-route mutation, bounded route progress, operation counts, factual narrative exports and independent visual/player validation. See contracts/FIXTURE_DSL.md and each phase gate. Core deterministic tests alone cannot prove emotional attachment or adequate frame pacing.
