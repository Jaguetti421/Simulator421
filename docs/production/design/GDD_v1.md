# The Last Clan

Game Design Document

Version 1.0 | 10 September 2026 | Working title

An autonomous survival competition for a persistent cast of 100 named contestants

## 1 Product direction

The Last Clan is a single-player survival simulation in which the player governs an island competition from above. One hundred named contestants arrive with different skills, temperaments, ambitions, and approaches to danger. They gather, craft, build, negotiate, form clans, raid, retreat, and betray. The player establishes enforceable laws, schedules changes, and watches contestants anticipate and adapt to them. The last surviving clan wins.

The player creates the conditions of the competition. Contestants decide how to live within them. The central experience is recognizing a contestant, understanding their plan, changing a rule, and seeing a believable consequence. A survivor who waits outside a protected storehouse until the protection expires should look patient and opportunistic. A survivor who abandons that plan because winter will arrive first should look perceptive.

This document defines the v1.0 design baseline for design and engineering review. It provides implementation contracts and prototype gates; it does not assert that the behavior, performance, or balance has already been demonstrated. Values marked TUNE are starting hypotheses. Launch targets are conditional on the gates in Section 24. The working title requires a separate availability check before commercial use.

Version 1.0 supersedes v0.2 as the complete design baseline. It adopts selected findings from The Last Clan GDD v0.2 Design Review and adds the designer's resolutions. The main changes are free observer forecasts, explicit time and survival tuning, readable staged migration, a procedural presentation baseline, and defined personality and skill effects. It preserves 100 contestants in Standard, last-clan victory, persistent records without permanent power growth, and the optional Christ episode. Section 27 records every review decision; Section 30 provides initial tuning and Section 31 the required intent catalog. Prior drafts remain historical references.

The Christ episode is optional, available without a progression requirement, and designed to function with authored dialogue and ordinary game AI. Its premise places a Gospel-informed portrayal of Jesus Christ inside the island as an autonomous guest who understands the arena's rules and its simulated nature. His presence may inspire cooperation or provoke opposition. The episode does not require the player to summon him, follow him, or arrange his death. Section 17 defines its characterization, outcomes, and limits.

### 1.1 Product assumptions

| Item | Proposed baseline |
| --- | --- |
| Platform | Windows PC first, keyboard and mouse, offline core simulation |
| Audience | Players who enjoy survival strategy, god games, emergent stories, and observing autonomous contestants |
| Camera | Stylized 3D tabletop view with constrained pitch, yaw orbit, zoom, close follow, pause, and time controls |
| Population | Exactly 100 contestants in Standard; eight in guided lessons, a curated 24 in the introductory trial, and 40 only as a comparative prototype or Custom preset |
| Standard duration | Fixed 60 simulation minute ceiling; TUNE 30 to 45 minutes of active viewing using mixed 1x and 2x, plus player pauses; 60 minutes at uninterrupted 1x if unresolved earlier |
| Victory | One surviving clan, including a clan with a single surviving member |
| Business assumption | Premium game; no paid contestant power or dependence on cloud inference |
| Main replay drivers | Familiar contestants, new island seeds, law schedules, relationships, and career history |
| AI promise | Perception, practical planning, differentiated threat response, temporal anticipation, and recoverable mistakes |
| Dialogue | Grounded contextual lines in the core; optional local language model conversations are a stretch goal |
| Optional story | Retained in the v1 launch content target, separately gated; one Christ guest, sourced teachings, voluntary fellowship, and contingent persecution |
| Population with a guest | 100 competitors plus one noncompeting guest and 36 wildlife actors produce a 137-actor workload before structures and effects |

### 1.2 Nonnegotiable design pillars

**Autonomy with understandable reasons.** Contestants select tasks, partners, routes, and risks. The player can inspect the reasons available to that contestant. A dramatic outcome does not justify invisible cheating or fabricated explanations.

**Laws that change strategy.** Rule changes affect which actions are possible and worthwhile. Their scope, announcement time, activation, and expiration must be explicit to both the player and contestants.

**A cast worth remembering.** Identity, appearance, voice style, behavioral tendencies, and career records create familiarity. Outcomes can vary without dissolving personality.

**Survival creates conflict and cooperation.** Food, exposure, materials, labor, and location make other people useful or threatening. Combat is one strategy among several during the build-up.

**A competition that reaches a conclusion.** Standard play has announced pressure and a bounded finale. Hiding can buy time, but cannot freeze the match indefinitely.

### 1.3 Scope boundaries

The initial game centers on one island, one competition, and the recurring cast. It does not require a controllable survival avatar, multiplayer gods, a seamless world, generational reproduction, unrestricted terrain destruction, fully freeform construction, or a civilization technology tree. These would change the production burden substantially. A divine creature remains an expansion candidate. Playable possession is excluded from the current direction because the player role remains observation and influence. No real-world cash betting is part of this design.

## 2 The player experience

### 2.1 The repeatable loop

Choose the mode and island preset, inspect the roster and initial conditions, and establish the opening law schedule. Standard always uses The Hundred; roster selection is available in Custom and trials. Follow interesting contestants as camps and relationships form. Observe a developing problem, decide whether and how to intervene, and examine the response. As pressure increases, follow migrations, negotiations, and conflicts. Resolve the final clan, review the run, and add its verified outcomes to the contestants' records.

The free Forecast feature records the player's predictions without informing contestants. The smallest satisfying interaction is a prediction: the player notices that a truce expires soon, expects an opportunist to attack, and follows the preparation. The larger interaction is an experiment: delay raiding and discover whether the same contestants invest in trade, stronger walls, or a timed ambush.

### 2.2 What the player actually does

The player sets public rules, selects scheduled events from a bounded catalog, uses observation tools, follows favorites, and spends intervention resources where the mode allows. The player does not assign chopping jobs, queue a clan's recipes, select a raid's targets, or force an alliance in Standard play. Contestants remain responsible for execution.

Deliberate observation is valid play. There is no attention meter and no requirement to click every minute. A schedule preview, developing-story alerts, and useful fast-forward make quiet preparation enjoyable. Players can precommit their entire permitted schedule and watch it unfold.

The contestants compete for victory; the player has no mandatory personal win or loss condition in the main mode. Their progression is the growing chronicle, understanding of the cast, and a collection of saved scenarios. Optional observer challenges use fixed forecast sets, such as predicting whether a contestant reaches the membership freeze. Their results never change bot goals or award contestant power. Scenario unlocks and cosmetic arena rewards must not withhold basic control tools needed for experimentation.

### 2.3 Modes and record categories

| Mode | Player control | Result handling |
| --- | --- | --- |
| Standard | Announced opening rules and a limited intervention budget; fixed finale contract | Records a Standard run with its seed, versioned ruleset, 100-person roster, and intervention history |
| Custom Sandbox | Freely adjust supported laws and events; optional indefinite duration | Records Custom outcomes separately; a run without a valid competition ending has no win |
| Story Episode | Optional Christ guest within a continuing competition or a preselected peace scenario | Story records, separate from Standard; a noncompetitive ending grants no clan victory |
| Tutorial Trial | Guided small roster and short scenarios | Tutorial history only, excluded from career win rates |
| Legacy Experiment | Later option for persistent relationship or habit changes across runs | Separate Legacy category with an explicit starting-state snapshot |

Standard records are local career records, not a verified global competitive ladder. Different schedules and player decisions affect results; the dossier must support filtering. Unlimited direct interventions, roster edits after arrival, and active competitor resurrection are Custom features only. The post-run Christ epilogue is a Story narrative event, not active competitor resurrection. The simulation switches the run to Custom before such an action takes effect and retains that classification if the player undoes the action.

Adding any authored noncompeting guest changes a Standard run to Story atomically. Christ is the first shipping guest. A neutral guest used in development follows the same contract. This is a record classification, not an additional permission prompt: the spawn preview states it clearly. Deleting the guest or reverting an intervention does not restore Standard classification. The first spawn is optional and free of an unlock, faith requirement, or Influence cost. Arbitrary direct editing within Story adds a Custom flag to that Story record. Spawning Christ in an already Custom run preserves that flag and adds Story classification; it never upgrades the record to a less-modified category. A disabled episode leaves Standard behavior and interface unchanged except for the optional entry in the scenario menu.

## 3 Match structure time and victory

### 3.1 Time and the viewing session

Standard has a fixed 60-minute simulation deadline. A match can resolve earlier when only one eligible clan remains. At 1x, one simulation second equals one wall-clock second; pause stops all gameplay clocks. Speed controls advance the same simulation ticks, including hunger, forecasts, laws, movement, and combat. Fictional time affects presentation and needs through the mapping below; it is never used as a separate timer.

One match spans five fictional days. Each day takes 12 simulation minutes: eight daylight minutes followed by four night minutes. Day 1 begins at 00:00; night intervals are 08:00–12:00, 20:00–24:00, 32:00–36:00, 44:00–48:00, and 56:00–60:00. Twilight blends visually over the 30 seconds preceding a boundary; mechanical night starts exactly at the published tick. No ambient rain, wetness meter, or random weather operates in v1. Cold Front is the explicit temporary exposure event.

The viewing target is TUNE 30–45 wall-clock minutes excluding voluntary pauses, using 2x during preparation and 1x around decisions and combat. The game starts at 1x and offers 2x once the player understands the opening. Automatic slow-down requires a visible player-selected toggle. This is a pacing hypothesis, not a guarantee of how long someone will watch. The real-time distribution is measured alongside travel, need rates, and story recall; changing one requires retesting the others.

### 3.2 Standard escalation calendar

| Simulation time | Phase | Public rule and desired experience |
| --- | --- | --- |
| 00:00 to 10:00 | Arrival | Sentient harm, theft, and hostile structure damage are blocked. Gather, meet, establish a fire, survive first nightfall at 08:00. |
| 10:00 to 25:00 | Settlement | Harm and theft open at 10:00; hostile structure damage opens at 15:00. Clans choose trade, defense, and raids. |
| 25:00 to 40:00 | Pressure | Outer sectors become unsafe at 25:00 and 36:00. Migration increasingly shares useful routes. |
| 40:00 to 50:00 | Commitment | Three staging areas and their onward routes dominate safe terrain at 40:00. Outer staging ground closes at 48:00, directing survivors toward the final refuge. |
| 50:00 to 58:00 | Finale | Membership locks at 50:00. All temporary protection ends. The final refuge contracts at 50:00, 54:00, and 56:00. |
| 58:00 to 60:00 | Terminal pressure | Final storm affects every competitor, bypasses armor and blocks healing. At 60:00 all remaining lives are resolved simultaneously. |

The complete law and Fog calendar, final refuge, and no-winner fallback are visible from arrival. At 09:00 and 09:50, a bell cue, countdown, and proximity overlay frame the coming permission change. These are notices, not forced camera moves. Nearby predators and night exposure create practical opening needs; protected preparation should produce decisions before any contestant can attack another.

Keep the ten-minute arrival baseline for the first fixture. Test an eight-minute alternative only in a separately versioned experimental ruleset if opening social actions finish too early. Do not silently vary the opening by seed.

Standard interventions need at least 60 simulation seconds of notice, must start no later than 48:00, and must end by 50:00. The opening protections themselves have zero Influence cost. Preselected optional modifications still spend the normal budget and obey notice from 00:00. A published event can be amended or canceled only with at least 60 seconds until its existing activation; replacing it cannot bring an effect forward or remove a promised protection without notice. Committed Influence is not refunded. Active laws run for their declared durations; extensions require a separately paid, valid amendment.

### 3.3 Clan identity and the membership lock

Every contestant arrives in a one-member clan. If that contestant joins another clan, their now-empty clan ID retires. A clan has a banner, membership, a leader, stockpile permissions, and at most two customs. The Standard cap remains TUNE eight living members, including downed members. This retains smaller groups and meaningful recruitment choices; a cap of twelve is a prototype comparison, not an undocumented v1 rule.

At 50:00, joining, merging, expulsion, and departure cease. In-progress membership actions completing on that tick fail after the lock installs. Already departed contestants retain their new membership and their remaining mutual departure protection expires at the lock. Departure previews before the lock show this truncation; no new cooldown extends finale immunity. Rejoining the same clan has a 120-second lockout. Neither treaties nor fellowship can merge winner eligibility.

A clan remains eligible while at least one member is living and not withdrawn; downed members count. A guest never counts. After the current tick fully resolves, exactly one eligible clan wins if it includes at least one standing member. If that sole clan is entirely downed, play continues until a legitimate revival opportunity, elimination, or the deadline. Contestants cannot self-revive in v1. No individual duel is required within a winning clan.

### 3.4 Staged migration without forced brackets

Use three connected staging areas before the final refuge. Terrain and separate approaches help distribute encounters, but the game never assigns clans to brackets, teleports survivors, caps a pocket's occupancy, or closes a route because an observer has seen too little combat. Multiple clans may voluntarily choose the same route. That crowding is measured and must still work.

The final refuge has at least three approaches and several internal cover choices. Site sockets cannot obstruct protected corridors or the last valid exit. At each boundary step, the generator validates a traversable route from every shrinking safe component to the next safe area, using loaded movement, reasonable recovery stops, and a 30-second margin. Maximum permitted travel time is below the remaining notice. Terrain and scenario geometry that fail this test are rejected before play. Downed, surrounded, or deliberately late contestants are not guaranteed evacuation.

Forecast masks and actual damage masks share one authoritative geometry. The Fog blocks vision and marks hazardous ground; it does not create invisible walls. Temporary Storm Warning uses this same geometry and escape validator, and cannot remove the only route to the next refuge. No new predators spawn during the finale; wildlife has no competitive eligibility.

### 3.5 End resolution and the Beacon decision

Standard preserves last-clan survival as the sole victory condition. A Beacon location is an orientation marker at the refuge; occupying it grants no victory, resource bonus, protection, or score. The review's proposed occupancy win is deferred to a Custom experiment because one bot touching a ring while several rival clans survive would change the main promise. The map labels the marker as the final refuge rather than suggesting it is capturable.

Terminal pressure starts at 58:00. Each competitor receives an armor-bypassing pulse of TUNE 4 health per simulation second, plus 2 per second for each completed 30-second interval since 58:00. Terminal damage directly eliminates at zero health, including downed competitors, and healing is disabled globally for competitors and active guests. At 60:00, any remaining competitors receive simultaneous terminal elimination. Section 30 defines ordinary Fog separately.

Install scheduled changes, complete movement and legal actions, collect simultaneous damage and deaths, then evaluate eligibility. At 60:00 the terminal elimination is included before evaluating victory. An all-dead or all-withdrawn state is a draw. A clan with a standing member can win on an earlier terminal pulse only if every other clan is already eliminated in that same completed tick. Entity update order must never select a champion.

Arena withdrawal is a deliberate six-second action, cancelable by danger or a changed decision. It permanently removes the contestant, retains history, and grants no kill. Encounter surrender instead pauses aggression under a negotiated promise and can end without withdrawing. The player ending a run early records Abandoned. A low observed win rate is addressed through AI urgency, routes, economy, and openly versioned tuning; a hidden tiebreaker is prohibited.

## 4 The island and survival economy

### 4.1 Geography that produces decisions

The first full content target is one island family with woodland, open meadow, rocky high ground, shallow crossings, ruins, and a central refuge. Biomes are strategic regions within a compact map, not separate worlds. Start locations vary between runs under fairness constraints; identities never receive a guaranteed favorable start because of their careers.

Travel time determines map scale. TUNE: reaching nearby opening food takes under 45 seconds, reaching a plausible camp takes under 90 seconds, and crossing the map takes roughly four to six minutes at an unburdened walking pace. These targets include navigable distance. A larger visual island must not produce ten minutes of uneventful walking.

Generate multiple sources of basic food, wood, stone, and fiber; distribute metal and safer shelter less evenly. No single bridge or mineral deposit may be required for every viable strategy. Place valuable resources so that taking a risk can accelerate development without making that risk mandatory for basic survival.

### 4.2 Needs and consequences

| System | Behavioral effect | Initial boundary |
| --- | --- | --- |
| Food | Prompts gathering, hunting, cooking, sharing, theft, and migration | Low food first reduces recovery; prolonged starvation then damages health |
| Fatigue | Encourages resting, guard rotations, and safer camps | High fatigue reduces stamina capacity and work speed; it does not cause spontaneous collapse |
| Exposure | Makes shelter, fire, clothing, and timing useful | Night and announced Cold Front add to one readable exposure measure; no ambient wetness |
| Health and injury | Changes mobility, risk tolerance, and rescue value | Small set of wound conditions; no detailed organ simulation |
| Carry capacity | Makes transport and shared production valuable | Weight slows travel; hard limit prevents infinite inventories |
| Morale | Modifies willingness to follow risky plans and remain in a clan | Explained by recent events; no arbitrary uncontrollable breakdowns |

Stamina is a short-term action resource, distinct from fatigue. Thirst, disease chains, breeding, and crop genetics are deferred. Needs must generate choices without spending most of a short competition on housekeeping.

### 4.3 Resource ownership and logistics

Resources exist in nodes, personal inventories, containers, construction reservations, or crafted objects. Transfers conserve quantities. Gathering, carrying, and crafting take time; no clan receives supplies merely because it has chosen a plan.

Ownership is explicit. A clan stockpile permits designated members to withdraw. A gift transfers ownership; a loan is a recorded promise, not an automatic claim over the recipient's inventory. A departing member keeps their current personal inventory and loses stockpile access at the membership change. Taking shared reserves immediately before leaving is observable if witnessed and can damage relationships.

Claiming land never deletes existing paths or silently takes another clan's belongings. Claims identify occupied camps and permissions, not a global right to all nearby natural resources. Contestants reason about contested resources through observed presence, danger, and agreements.

### 4.4 The Hearth

Adopt the Hearth as the clan's home anchor, rendezvous point, and shared storage reference. The first campfire can become a Hearth without requiring a separate survival tier. It helps the AI answer where to bring supplies, where to regroup, and what to evacuate. Destroying it removes those benefits and triggers relocation planning; it does not delete clan identity, expel members, or instantly transfer the whole settlement to the attacker.

A Hearth marks occupied facilities and known access permissions. It does not confer ownership of every natural resource in a radius. Bots may establish another validated camp site or use designated field sockets outside its vicinity. Global structure decay is deferred so that autonomous migration is not burdened with an additional maintenance economy before it works.

### 4.5 Scarcity and snowball control

Food regenerates slowly enough that larger groups must organize labor or move. Production and storage create tradeoffs: a well-stocked settlement is powerful but expensive to relocate and attractive to raiders. Cold Front changes exposure only in v1; Bountiful Ground changes natural food yield. Other weather and yield changes are deferred.

Avoid hidden bonuses that punish a successful clan or secretly rescue a favorite. Large clans face visible costs: consumption, coordination, route congestion, and a wider set of member needs. Small clans benefit from mobility, lower visibility, and fewer supplies required. The eight-member cap prevents total roster absorption but does not guarantee balance; coalition dominance must be tested separately.

### 4.6 Wildlife water and concealment

Two species ship initially: deer and wolves. Deer are prey that flee detected threats and yield finite raw meat when hunted. Wolves occupy authored or generated den regions, prefer isolated reachable prey, and can alert nearby packmates through audible calls. They use the same movement, obstruction, attack, injury, and death pipeline. They have neither clan membership nor career wins.

TUNE initial population is 24 deer and 12 wolves in four packs of three, in addition to 100 contestants. This is the actual full-world performance workload. No animal reproduction, predator respawn, taming, loot farming, or intentional lure command ships. Wolves do not pursue beyond a 45-metre den leash or across safe starting areas; they return rather than maintaining an endless chase. Den and leash volumes are placed to remain at least 35 metres from contestant start points and primary camp sockets throughout the run. Risk remains on optional routes and around night foraging. Den visuals communicate where a dangerous shortcut begins.

Truce and Sanctuary block harm between sentient actors; they do not stop hunting or animal attacks. A protected contestant seeing a wolf must still choose fight, flee, or seek nearby allies. Animals can die or be displaced by the Fog and never respawn behind survivors.

Deep water is impassable. Shallow crossing meshes are ordinary traversable terrain with a 0.8 movement multiplier. There is no swimming, drowning, boating, or jumping across water. Routes and site validators use the same crossing data as movement.

Concealment is a visible terrain property of dense forest and tall grass, combined with night sight reduction. It reduces detection range; it does not make a contestant invulnerable or erase a previously seen last location. Attacking or sprinting gives a short revealed cue to observers with valid range and obstruction checks. Fires reveal their own location and illuminate nearby actors, including a possible hidden attacker. Section 30 defines ranges and stale reports.

### 4.7 Rest and guard rotations

Rest is a purposeful recover action at a shelter, Hearth, or a known safe field socket. Fatigue above 60 raises rest priority; above 85 it normally interrupts nonurgent work. Hunger, observed danger, or insufficient travel margin overrides resting. Rest ends at fatigue 25 or when interrupted; the planner retains the reason and target. Night raises preference for shelter but never orders every actor to sleep simultaneously.

A clan requests one guard for two to four nearby members, and two for five to eight when danger is credible. Two guards are a cap, not a compulsory idle tax. Shifts last up to 60 seconds. A guard proposes relief when fatigue exceeds 65; if nobody accepts, the clan can shorten rest, relocate, or tolerate a stated risk. Assignment and relief require received messages. A lone survivor rests in shorter 20-second intervals, reassessing local evidence between them. Sleep reduces sensory range, so an alarm must be heard before it causes a response.

## 5 Crafting and construction

### 5.1 Production tiers

| Tier | Examples | Strategic consequence |
| --- | --- | --- |
| Improvised | Stone tool, spear, campfire, lean-to, crude bandage | A solo contestant can become viable without joining a specialist |
| Established | Workbench, bow, shield, cooked ration, storage, palisade | Group coordination improves efficiency and protection |
| Advanced | Metal tool, reinforced armor, breaching kit, insulated clothing | Access to contested materials improves a chosen strategy |

The v1 content budget is 28 recipes including 10 structure modules, with six combat equipment families. Section 30 lists their initial costs and prerequisites. A recipe earns its place by changing an option, a cost, or a risk. Cosmetic variants do not count toward systemic variety.

Every contestant knows basic survival recipes. Skills affect the limited factors defined in the skill table in Section 6. Recipe material costs and yields stay fixed in v1, preventing hidden economy multipliers. Advanced recipes require a known procedure and any specified worksite; procedures can come from an authored starting specialty, a discovered schematic, or completed teaching. Knowledge can be taught through an explicit interaction. No contestant is incapable of gathering food solely because their authored identity is a diplomat.

### 5.2 Autonomous building contract

In v1, bots select prevalidated camp sites and module sockets. Each site has valid entrances, work positions, storage access, and expansion slots by construction. Camps vary by chosen site, modules, priorities, and occupants. Freeform placement is deferred beyond v1; portable fires and lean-tos also use designated field sockets. The plan scorer considers exposure, travel, defense, known resources, law expiry, and expected time before evacuation. A camp intended for five minutes should be cheaper than a permanent defensive base.

Construction reserves materials and work positions. Reservations use a five-second lease renewed once per second of valid task progress. They release immediately when the worker dies, leaves, or abandons the task; any transfer to another worker is explicit and atomic. A site is revalidated before placement and at completion. Bots can cancel, reclaim unconsumed materials, select an alternate location, or seek help. No valid build may enclose a standing contestant without an exit. Unfinished structures do not become cheap invulnerable barricades.

Destruction initially operates per module with predictable damage states. Complex structural physics, tunneling, freeform terrain excavation, and boats are deferred. Salvage returns a TUNE fraction of invested materials and takes time, supporting deliberate migration.

### 5.3 Planning a production chain

A clan that wants shields must identify who can craft them, where the materials are, which jobs compete for those materials, and whether completion is worthwhile before the next move. A failed branch must offer alternatives: trade for a shield, make cheaper equipment, change the tactic, or postpone the raid. Repeatedly selecting the same impossible recipe is a defect, not an acceptable personality quirk.

### 5.4 Knowledge can be taught and lost

Adopt VIVARIUM's mortal knowledge for advanced recipes only. Basic food, fire, shelter, and bandage knowledge remains universal. A recipe is a known procedure, a skill is proficiency, and a station is equipment; losing a smith does not make an existing forge physically disappear. Survivors may still use surviving tools and finished goods.

Advanced procedures can be acquired from a recoverable schematic or a completed teaching interaction. Teaching takes TUNE 20 uninterrupted seconds for a known procedure; a witnessed completed demonstration reduces that learner's next teaching action for that procedure to 15 seconds. The reduction is a single flag, cannot stack, and expires at run end. Observation alone reveals the procedure's existence without granting it. A shared worksite does not give every member the owner's full knowledge. Procedure transfer has explicit participants, prerequisites, and an event record.

When the only knowledgeable crafter dies or leaves, new production of that procedure stops until someone learns it. Alternatives include recruiting, trading for the finished item, recovering a schematic, or choosing simpler equipment. Seed validation ensures that a single specialist is never the only route to basic survival or the finale. AI must recognize its knowledge dependency and may teach a second member before a dangerous expedition.

Prototype one advanced procedure and one redundancy decision before expanding. Unbounded experimentation, a large research tree, and copying knowledge through generative text are outside this feature. Within-run skill growth is deferred in v1. Adaptation comes from knowledge, relationships, equipment, and changed plans; fixed proficiency keeps the first economy and personality comparisons interpretable.

## 6 The recurring cast

### 6.1 Authored identity and variable outcomes

The full roster contains 100 stable contestant IDs. Each identity has a display name, recognizable silhouette, portrait, voice style, short background, preferred skills, temperament, values, and a bounded decision profile. The Hundred have fictional names and biographies. The separately authored Christ guest is governed by Section 17. The 12 examples in Section 26 establish the authoring format; the remaining roster is a dedicated content task, not a claim of completed content.

An identity combines several dimensions rather than belonging to one rigid class. A contestant can be a cautious fighter, an ambitious healer, or a generous opportunist. Starting conditions and encounters change outcomes. Demographic appearance does not determine ability or morality.

### 6.2 Decision dimensions

| Dimension | Low tendency | High tendency |
| --- | --- | --- |
| Risk tolerance | Requires a larger safety margin | Accepts uncertain opportunities |
| Trust | Requests evidence and safeguards | Cooperates earlier |
| Loyalty | Reconsiders commitments readily | Accepts personal costs for partners |
| Ambition | Prefers a secure supporting role | Seeks leadership and recognition |
| Generosity | Protects personal reserves | Shares when a recipient benefits |
| Patience | Favors immediate benefit | Invests or waits for a better window |
| Planning horizon | Focuses on near-term needs | Prepares for later laws and pressure |
| Assertiveness | Avoids confrontation | Makes demands and challenges leadership |

All contestants share a competent survival foundation. Differences primarily affect preference, information gathering, commitments, and execution. Lower planning horizon must not mean ignoring an immediately visible lethal threat. Skill gaps are bounded so that the roster contains no intended permanent losers.

Each profile may add up to two behavior quirks with explicit costs and conditions, such as discomfort in a crowd or a preference for night travel. Quirks cannot override imminent-survival safeguards or physical law. Curiosity, spiritual openness, forgiveness, and convictions are represented through authored values, beliefs, and experiences rather than a second stack of eight personality axes. Skepticism does not imply cruelty, and devotion does not imply gullibility.

### 6.3 Memory and continuity

Within a run, contestants retain consequential experiences, learned resource locations, trust changes, failed approaches, and revised threat estimates. A raid survivor may begin avoiding the same exposed road. This is explicit state change and bounded adaptation; it does not require training a neural network during play.

Across Standard runs, identity and career archives persist while inventories, injuries, skill gains, relationships, and learned tactical weights reset. The archive can support a line such as remembering a previous final, but does not silently change the bot's decision weights. Repeated winners receive no permanent strength bonus. This preserves recognizable characters without making an established favorite progressively unbeatable.

Persistent grudges and habits are a later Legacy option. Its initial state is recorded and its results are separated. Conversations must clearly distinguish a previous contest from the present one. A remembered defeat never reveals the current hidden location of its previous winner.

### 6.4 Skill list and bounded effects

All contestants can perform universal basics at band 1. Each identity has a primary skill at band 3 and a secondary at band 2; other skills are band 1. Bands do not improve during a v1 run. Profiles, skills, and appearance have separate stable data fields.

| Skill | Affected operation | Band 1 / 2 / 3 effect |
| --- | --- | --- |
| Gather | Harvest wood, stone, fiber, food, ore | Work duration multiplier 1.00 / 0.90 / 0.80 |
| Hunt | Prepare a shot against wildlife and butcher a carcass | Duration multiplier 1.00 / 0.90 / 0.80; no extra meat |
| Cook | Prepare a ration at a fire | Duration multiplier 1.00 / 0.90 / 0.80; nutrition unchanged |
| Build | Assemble or repair a structure | Duration multiplier 1.00 / 0.90 / 0.80 |
| Craft | Make tools, equipment, bandages, metal | Duration multiplier 1.00 / 0.90 / 0.80 |
| Medic | Stabilize and revive using a bandage | Duration multiplier 1.00 / 0.90 / 0.80; costs and restored health unchanged |
| Melee | Recover after a melee swing | Recovery multiplier 1.00 / 0.95 / 0.90; damage unchanged |
| Ranged | Projectile aim error | Spread multiplier 1.00 / 0.90 / 0.80; no automatic hit |
| Scout | Inspect a visible target or suspected route | Inspection duration 4 / 3 / 2 seconds; no increased access to hidden state |
| Negotiate | Prepare a feasible offer or mediation proposal | Preparation duration 10 / 9 / 8 seconds; no forced acceptance or trust bonus |

Only one skill applies to an action. Hunt replaces Ranged preparation modifiers against wildlife; no stacking of skill speed discounts. The final action duration is clamped above its explicit wind-up minimum. Distinct personality and information still determine whether an expert chooses to use a skill.

### 6.5 Personality to decision scoring

Each temperament dimension is a fixed value x from 0 to 1. Map it to a multiplier between the endpoints below. Actions expose named, normalized benefit and cost considerations using only known state. The baseline score is 100 times the weighted benefits minus 100 times the weighted costs, plus the bounded modifiers below. The sum of base weights for each side is one. No absent input silently becomes certain information: unknown danger carries an uncertainty cost.

| Dimension | Named considerations it changes | Multiplier at x 0 to x 1 |
| --- | --- | --- |
| Risk tolerance | Known physical danger cost; uncertainty cost | 1.35 to 0.75 for danger; 1.25 to 0.85 for uncertainty |
| Trust | Cost of relying on an untested partner | 1.30 to 0.70; witnessed betrayal remains explicit evidence |
| Loyalty | Benefit of honoring a promise or aiding a known partner; social cost of breaking it | 0.75 to 1.35 for both |
| Ambition | Benefit of leadership, reputation, and a larger productive role | 0.75 to 1.30 |
| Generosity | Benefit of actual unmet need relieved; cost of giving above the personal reserve | 0.60 to 1.40 for aid; 1.20 to 0.80 for surplus giving |
| Patience | Delay cost when a future payoff is credible | 1.30 to 0.70 |
| Planning horizon | Benefit of preparation for a known future need; number of relevant future events considered | 0.80 to 1.25; one to three events |
| Assertiveness | Cost of social confrontation; benefit of initiating a negotiation or challenge | 1.25 to 0.80 for confrontation; 0.85 to 1.20 for initiative |

Products affecting one consideration are clamped to 0.5–1.5. Ordinary values add at most 10 total score points for matching actions. Up to two conditional quirks add at most 5 points each, with the combined values-and-quirks contribution clamped to minus 15 through plus 15. Values are preferences unless explicitly authored as a rare hard conviction. Every hard conviction needs a viable refusal or escape fallback and a dedicated test; legality always wins. Christ's nonviolence is such a scoped guest constraint, not an inferred rule for all generous contestants.

Retain a feasible current plan with an 8-point commitment bonus. A nonemergency replacement must beat it by 10 points at two consecutive task evaluations. This hysteresis does not delay escape from observed danger, avoiding imminent starvation, or reacting to an invalid action. Ordinary contestants use emergency viability checks before scoring; a low planning horizon still reserves time for an already announced lethal storm. A commitment may justify a costly rescue after survival chances are explicitly considered, rather than unconditionally refusing all sacrifice.

Initial quirk examples are Night Traveller, adding 5 to safe night travel when fatigue is below 60, and Crowd Wary, adding 5 to a less crowded feasible camp when observed neighbors exceed six. Neither grants information or changes physical sight. The roster validator rejects undefined consideration names, out-of-range weights, and profiles with no feasible emergency action. The Why panel reports the contributions actually used. These mappings are design hypotheses to test with paired fixtures, not claims about human psychology.

## 7 AI capability requirements

Strong AI means contestants notice relevant opportunities, understand legal actions, pursue feasible plans, and change course for intelligible reasons. It does not mean omniscience, perfect play, or unlimited invention. The behavior catalog is authored; combinations and choices generate the emergent outcomes.

### 7.1 Perception and knowledge

Each observation has a subject, value or estimate, source, time, location, and confidence. Sight uses range, obstruction, and appropriate directional awareness. Sound reveals an approximate event location, not a perfect enemy inventory. Recent damage, discovered tracks, visible smoke, observed equipment, and nearby behavior can create evidence. Every sensory feature must expose what information it provides.

Contestants know their own condition and possessions. They know public laws, phase times, the active roster, and the public death register through the arena interface. They discover resource locations, private stores, concealed routes, and enemy plans through observation or communication. The death register names the eliminated contestant and clan but does not reveal location, killer, or circumstances unless those facts are publicly established.

Clan communication carries observations with their original timestamps and confidence. Nearby speech is immediate; distant sharing initially requires a runner or reunion. There is no telepathic clan map. Leaders can coordinate a rendezvous and timetable before splitting up. The player has an omniscient observer view, but inspecting it never updates a contestant's knowledge.

### 7.2 Decisions and plans

Decision-making has three horizons: immediate response to danger, an actionable task sequence, and a medium-term intention such as preparing for a raid window. The selected plan accounts for needs, law state, travel, equipment, expected opposition, companions, and a fallback. Long-horizon planning uses a limited set of relevant future events rather than simulating the whole island.

Candidate strategies include gathering alone, seeking protection, trading, joining a clan, fortifying, migrating, scouting, raiding, ambushing, threatening, rescuing, surrendering, and deliberately waiting. Each has prerequisites and costs. The bot first excludes impossible or prohibited actions, then evaluates the remaining alternatives according to its knowledge and personality.

Bots retain commitments long enough to finish useful work. New emergencies, expired permissions, failed prerequisites, or a materially better option can interrupt them. Small score fluctuations must not make a contestant alternate endlessly between eating and building.

### 7.3 Waiting is an explicit strategy

A waiting plan requires a reason, a trigger, a maximum duration, a safe location, ongoing survival costs, and a fallback. The planner considers whether the expected benefit after a change exceeds the cost and risk of waiting.

Example: a patient raider sees that a protected storehouse becomes raidable in 80 seconds. Travel takes 25 seconds and preparation takes 20. They gather nearby while a scout watches the approach, then rendezvous before expiry. If the storehouse is emptied, a rival arrives, or the law is extended with notice, the plan is reconsidered. Waiting indefinitely for a law with no announced end is invalid; the bot can only assign an uncertain expectation based on witnessed player behavior in the current run.

An aggressive contestant cannot queue prohibited damage for automatic instant release at expiry. They may approach and ready equipment, but a legal attack must still complete its normal wind-up after permission becomes active.

### 7.4 Differentiated threat response

| Situation | Plausible alternatives | Factors that distinguish contestants |
| --- | --- | --- |
| Stronger hostile clan approaches | Hide, evacuate, negotiate, fortify, call for help | Confidence, trust, escape routes, food reserves, allies |
| Friend is downed | Rescue, cover a rescuer, bargain, withdraw | Loyalty, available medicine, enemy attention, chance of escape |
| Food reserve collapses | Ration, forage, trade, steal, relocate | Hunger forecasts, generosity, local knowledge, law schedule |
| Leader orders a risky raid | Accept, propose an alternative, refuse, leave | Trust in leader, risk tolerance, recent losses, expected gain |
| Protection expires soon | Retreat, prepare defense, exploit the opening | Patience, strength estimate, distance, expiry certainty |

Retreat must seek a destination that reduces danger. Hiding needs concealment. A threat estimate considers numbers actually seen, equipment, health cues, terrain, known support, and uncertainty. A bot can misjudge unseen reinforcements, but must not ignore reinforcements once observed.

### 7.5 Measurable intelligence

The baseline must demonstrate multi-step provisioning, opportunistic use of law windows, reaction to invalidated plans, cooperative task allocation, and distinct responses to the same threat. Section 24 defines acceptance scenes. No promotional claim of human-level reasoning or open-ended learning is justified by this document.

### 7.6 Public facts and stale information

Belief sources are Self, Observed, Reported, and Arena Broadcast. Law and phase notices remain exact public facts. Death notices announce identity and clan only. Herald adds a timestamped authoritative observation, not ongoing surveillance. A fact verified at broadcast time can become stale afterward; its source confidence and current usefulness are separate fields.

Enemy positions become last-seen estimates immediately when visibility ends, lose precise tactical usefulness after 10 seconds, and require scouting after 60 seconds. Camps remain known locations until evidence changes them; old stockpile bands become stale after 30 seconds. Expiry of precision never deletes the memory of an encounter. A scout inspecting a camp cannot obtain an exact closed-container inventory without access or a Herald snapshot. Reports retain their original timestamp after repeated retelling.

## 8 Clans diplomacy and betrayal

### 8.1 Forming a clan

Membership requires an invitation and acceptance. The applicant evaluates food security, safety, trust, leadership, labor expectations, and personal independence. The receiving clan evaluates capacity, skills, supplies, relationships, and known conduct. Negotiation consists of structured offers such as shared rations for work, a protected place for a medic, or a temporary trial membership. Text describes the agreement; the agreement exists as simulation data.

The initial leader is the founder. A member can propose a leadership challenge before the finale. A leadership proposal opens a 20-second vote. Every living member at proposal time is eligible, including a downed member able to receive the message; a strict majority of that electorate must explicitly support it before the vote closes. Absent or silent members abstain. Votes weigh trust, competence demonstrated in this run, and recent outcomes. On death or departure, succession uses a pre-agreed deputy, then the earliest joined standing member, then the earliest joined living member as acting leader; it changes a public role without transmitting private knowledge. Death or departure triggers succession; the clan does not freeze because its leader vanished. Leadership changes do not automatically change ownership or remove members.

Clan strategy proposes a shared goal and requests roles. Members may accept, refuse, or suggest an alternative. Critical jobs use one assignee with explicit backup requests, not five bots consuming the same reserved materials. The leader cannot order a member to ignore imminent lethal danger without that member reevaluating the risk.

### 8.2 Clan customs

Adopt a small custom catalog with at most two active customs per clan: share a food reserve, welcome useful outsiders, aid wounded strangers, settle disputes through mediation, or prioritize raids on identified rivals. These are breakable social policies. They never override world protections or authorize invisible inventory transfers.

A leader proposes a custom, members evaluate its practical cost and fit with their values, and a strict majority of the standing membership at proposal time must explicitly approve within a TUNE 20-second consultation. The electorate is fixed when the proposal opens; an absent member abstains, and death or departure cancels that member's vote but does not silently reduce the required majority. Failure to reach a majority leaves the old custom intact. Absent members must receive notice before noncompliance can count as a known breach. Members can object, refuse a particular task, request change, or leave before the membership freeze. No response is assumed to be consent.

Every custom declares qualifying behavior, an observable breach, permitted responses, and the remaining survival reserve. Hunger can justify rationing without the engine fabricating an act of malice. Leaders cannot confiscate all food through an abstract policy. The initial social responses are complaint, reduced trust, renegotiation, refusal, and lawful departure. Forced imprisonment, automatic executions, and broad law-enforcer professions are deferred.

### 8.3 Cooperation between clans

The first relationship vocabulary is neutral, hostile, truce, trade agreement, and mutual aid agreement. Agreements specify parties, scope, duration, and termination notice. They are social promises and may be violated whenever world laws permit the action. There is no arbitrary speech-based mind control.

Trading initially uses simultaneous nearby exchanges with a visible offer and atomic transfer, preventing item duplication or half-completed swaps. Transporting goods to meet the trade remains risky. Extended credit, complex markets, and trade caravans are later scope.

Multiple clans may coordinate, but an alliance is not a shared victory entity. In a competition, everyone knows only one clan can win. Coalitions therefore create tensions about the final outcome. Bots can still honor a costly promise or withdraw; the AI must not be forced to betray merely to produce spectacle. The declared storm ends the match, potentially as a draw, if allied clans refuse to fight or withdraw.

### 8.4 Betrayal must have an identifiable commitment

A betrayal event requires a recorded agreement, membership obligation, or explicit promise that the actor knowingly violates. Attacking an unrelated neutral is aggression, not automatically betrayal. A false accusation is a rumor, not a verified career fact.

Useful motives include a credible better offer, fear of a failing leader, repeated unfair treatment, access to poorly guarded supplies, or a conflict between loyalty to a friend and loyalty to a clan. Decisions consider expected gain, detection, retaliation, reputation, and available escape routes. Betrayal is neither a random cooldown event nor the universally best strategy.

Leaving a clan is allowed before minute 50 and takes TUNE a 10-second commitment. At completion, permissions change atomically and the former clan receives a membership notice. Joining another clan still requires acceptance and capacity. Until the minute-50 lock, former clanmates cannot damage one another for TUNE 15 seconds after departure in Standard, preventing an instant affiliation toggle into a backstab; the shared cooldown blocks damage in both directions. This cooldown cannot be renewed by repeated joining and leaving, which also has a TUNE two-minute rejoin lock.

Friendly fire within a clan is disabled in the baseline. Violent internal betrayal therefore requires visible departure first. Betrayal can still involve leaking observed information, taking personally carried clan goods on departure, refusing a promised rescue, or breaking an interclan treaty. More elaborate secret sabotage is deferred until perception and attribution can support it.

### 8.5 Trust and accountability

Trust updates from witnessed actions and credible reports, with source and recency retained. Saving someone creates an obligation; repeated small gifts have diminishing effect. Negotiation proficiency reduces offer preparation time; it never changes witnessed evidence or compels a partner to accept unfavorable terms. Rumors may affect beliefs, but the observer must distinguish a belief from a verified event.

### 8.6 Beliefs witnessing and message transmission

Adopt witnessed interventions as evidence, not as automatic worship income. An actual witness can update awe, trust in the Overseer, fear of harm, or confidence in a speaker according to what they saw and how it affected them. A miracle outside perception provides no firsthand belief update. Hearing about it creates a reported belief with a source. Gratitude toward a rescuer, confidence in Christ's teaching, and trust in the player are separate relationships.

Messages carry an event or teaching ID, source, timestamp, and confidence. A listener can believe, doubt, ignore, or later challenge a report. The first release preserves message content and models disagreement about its credibility; randomly distorted rumors are deferred. All hard law changes remain globally and accurately announced. Only social teachings, rumors, and customs spread through conversations and witnesses.

The inspector distinguishes heard about an idea, agreed with it, acted on it, and publicly claimed allegiance. These states allow a sincere follower, a sympathetic nonfollower, and an opportunist seeking protection to behave differently without pretending to measure the truth of a person's soul.

### 8.7 Departure and trust thresholds

Trust toward another actor ranges from minus 100 to plus 100, beginning at zero. TUNE meaningful events change trust by +15 for a qualifying rescue, +4 for a needed meal, minus 10 for an observed broken sharing promise, and minus 25 for a knowingly broken safe-passage promise. Repeated meals from one donor add at most +8 per day. Directly witnessed harm has its own event context; a report scales the update by credibility and cannot become eyewitness evidence. These are bounded relationship changes, not persuasion probabilities.

Morale begins at 65 on a 0–100 scale. Every ten simulation seconds, it moves two points toward a target: 65, plus 10 for secure shelter and food, plus 10 for trusted nearby support, minus 20 for unresolved danger, minus 15 for severe unmet needs, and minus 15 for a witnessed unresolved custom breach. Clamp the target to 0–100. Events remain separate so the UI can name the cause.

Departure enters the candidate set when morale stays below 35 for 30 seconds, leader trust drops below minus 30, two known custom breaches remain unresolved within 180 seconds, or a credible competing invitation is received. These conditions enable consideration; they do not force departure. Loyalty, safety outside the clan, personal inventory, invitation validity, travel, and the lock deadline determine whether leaving is worth the cost. A complaint or attempted renegotiation is preferred when it offers a feasible improvement. A received urgent threat can trigger immediate consideration without waiting for a morale timer.

Leaving during an attack is evidence of abandonment only if the contestant accepted an explicit defense duty or rescue promise and knowingly broke it. The chronicle can truthfully record every departure under attack, but labels Betrayal only when it links a real commitment, the actor's knowledge, and the breach. Peaceful departure remains legitimate. Frozen members may still refuse a task, seek shelter, or withdraw from the arena.

## 9 Combat rescue and elimination

### 9.1 Readable tactical combat

The baseline uses melee weapons, bows, shields, with consumable breaching tools for structures; damaging traps are deferred beyond v1. Combat emphasizes range, attack wind-up, recovery, stamina, line of sight, cover, local numbers, morale, and escape routes. Equipment improves options without making an advanced contestant invulnerable.

A bot can hold a chokepoint, flank using a known route, kite within its mobility limits, defend a wounded member, disengage, or coordinate arrival with allies. Coordinated attacks require observed targets or shared reports and a plan; every member cannot instantly know an enemy's new position. Friendly collision and local avoidance must not cause a clan to block its own retreat.

TUNE: a broadly even isolated fight should last long enough to understand and follow, roughly 15 to 35 seconds including maneuvering. Numerical superiority matters, but terrain, preparation, and retreat must offer a plausible response. This is a readability target, not a universal time-to-kill formula.

### 9.2 Downed state and rescue

Lethal ordinary damage usually causes a downed state with a TUNE 30-second bleed-out timer. A rescuer can stabilize and revive with a bandage through a TUNE six-second interruptible action. The revived contestant returns with low health and a temporary wound penalty. No infinite free resurrection is possible. Subsequent damage can eliminate a downed contestant if the active laws permit it.

Contestant damage protection pauses hostile sentient-actor bleed-out and removes damaging sentient-actor status effects when it activates; it does not restore lost health or stabilize wildlife injuries. Expiration resumes the remaining paused timer, without accumulating missed damage. The protection UI lists this effect. Final-storm damage is explicitly terminal and bypasses the downed state from minute 58, preventing a last-minute downed stalemate.

A temporary encounter surrender means standing down, dropping a negotiated item, or accepting safe passage. It does not automatically switch clans, grant invulnerability, create captivity, or eliminate the contestant. Full prison management and forced labor are outside the baseline. Section 17 uses the same approach, downed, rescue, and interruptible lethal-action primitives for its optional persecution encounter; there is no custody system. Permanent arena withdrawal is a separate action described in Section 3.

### 9.3 Damage and event attribution

Every damaging effect records its original actor when one exists, clan at origin, effect type, lawful creation state, and contributing action chain. A projectile checks permission at launch and again at impact. A future trap must check placement and trigger rules before it can be added to the deferred catalog. An actor leaving a clan does not rewrite the ownership history of an existing attack.

The core avoids mechanics that make non-damage griefing indistinguishable from a broken peace law. Movement uses soft local avoidance with no damage or blocking credit. During sentient protection, a surrounded actor can pass through overlapping actor capsules at reduced speed after a one-second congestion check; structures remain solid and need valid exits. This is a visible peace-period movement rule, not teleportation. Contestant shoving, lethal structural collapse, spreading player-made fire, and intentional predator luring are excluded initially. Ordinary wildlife remains dangerous during a contestant truce. Adding indirect harm later requires explicit permission and attribution rules first.

## 10 The law system

### 10.1 Public laws and social promises

A world law is an engine-enforced permission or environmental parameter. A bot cannot disobey it through strong personality or language-model output. Social promises and optional glory objectives operate above those constraints. The UI uses different icons and verbs for a prohibition, an announced future rule, and a breakable agreement.

Every law contains an ID, version, category, scope, announcement tick, activation tick, expiration tick or explicit indefinite duration, parameters, priority, and a plain-language effect description. Target scopes initially are global or a marked region; Herald targets one existing clan Hearth for a one-time information event. Contestant-specific immunity is Custom-only. The law's affected action types are part of its data, not inferred from its display name.

The player-facing name remains Rulebook. Its panels are World Laws, Announced Changes, and Social Commandments. VIVARIUM's unified Covenant vocabulary is not used because it obscures the difference between physical impossibility and moral expectation. The inspector reports zero permitted violations for a hard prohibition, and observed compliance or breaches for a social commandment.

Custom and Story modes add two initial social commandments: share with someone in need and honor safe-passage agreements. They create requests and reputational consequences, not compelled actions. A contestant may refuse; a leader may advocate them as customs. Their text never claims that the player speaks for God the Father.

### 10.2 First law catalog

| Law | Exact permission or effect | Likely strategic response |
| --- | --- | --- |
| Contestant Truce | Blocks hostile health damage and harmful statuses between sentient actors, including guests; blocks all lethal follow-up actions | Craft, move safely past rivals, negotiate, prepare for expiry |
| Buildings Protected | Blocks damage to another clan's structures; ownership and doors remain intact | Trade, scout, stockpile breaching supplies, or wait |
| Property Protected | Blocks unauthorized withdrawal from owned containers | Seek a trade, use unowned resources, plan for expiry |
| Sanctuary | Applies the same protection to sentient actors at a visible bounded region; wildlife and the final storm remain separate | Seek recovery, meet safely, watch nearby exits |
| Open Stores | Temporarily permits withdrawals from selected regional containers | Redistribute, race for supplies, relocate valuables in advance |
| Cold Front | Applies a fixed announced exposure increment for a duration; no yield reduction in v1 | Craft clothing, shelter, collect fuel, or migrate |
| Bountiful Ground | Increases natural food yield in a visible area for a fixed period | Forage, meet competitors, reconsider a camp location |
| Glory Trial | Adds a public optional objective with explicit qualifying events | Pursue a title or useful reward if its costs make sense |

Truce and Sanctuary use the generic Sentient actor tag, covering contestants and guests. Guest injuries use the same hostile-status removal and paused bleed-out policy as contestant injuries. Activating protection cancels an ongoing hostile follow-up and its animation; no delayed death event survives cancellation. Wildlife damage and the declared final storm remain unaffected.

The Standard deck contains eight intervention types: Truce, Buildings Protected, Property Protected, Sanctuary, Cold Front, Bountiful Ground, Storm Warning, and Herald. Open Stores and Glory Trial are deferred Custom experiments; they are not required v1 content and never replace Standard victory.

### 10.3 Precedence and validation

First evaluate mode and finale restrictions, then absolute world permissions, then scoped protections, then ownership permissions, then social consequences. A prohibition wins over a permission when both govern the same action. For example, Open Stores cannot override an overlapping Property Protected law; the composer rejects that redundant overlap and explains why. A social treaty cannot authorize an action forbidden by world law.

A target qualifies for a sanctuary by its ground-position centre, with boundary points included. The marked geometry and attack checks use that same convention.

In Standard, one global modifier per category and a maximum of three player-created temporary modifiers can be active concurrently. Queueing a conflicting modifier is rejected rather than silently replacing the old one. A paid extension explicitly amends the same law ID with a new version and announced expiry; it is not a second overlapping law. Durations, regions, and targets must fit the supported schema. The player previews exact activation, expiry, and effects before committing.

At a simulation tick boundary, install all due law changes atomically, invalidate affected plans and permissions, resolve actions against the resulting law state, then calculate victory. Presentation messages reference that same tick. Damage already applied is not reversed. In-flight attacks cannot bypass a newly active prohibition. There is no delayed burst of damage when a truce ends.

Sanctuary protection applies if either the attacker or target is inside the marked region at the relevant check. This prevents firing outward from invulnerability. For a projectile, both launch and impact obey their respective law states. Retreating into a sanctuary may block a previously launched arrow; that visible protection is intentional.

### 10.4 What bots know about time

Public law notices go to every contestant and active guest simultaneously through the fictional arena signal, even when they are isolated. The bots know exact announced times and supported effects. They do not know a future intervention the player has not yet committed. A planned route or task evaluates the laws expected at arrival and completion, with a margin for travel uncertainty.

An indefinite Custom law remains indefinite in the planning model. A bot may prepare a contingency for a possible reversal, but should not starve while repeatedly waiting for a nonexistent expiry. A useful reason label is "Waiting until the announced raid window"; a defective one is "Waiting" with no trigger or deadline.

### 10.5 Pressure and information interventions

Storm Warning marks one region as temporarily unsafe for 120 seconds, costing two Influence. It is a spatial hazard with at least 60 seconds of notice. Reject any placement whose worst validated escape exceeds its lead time, covers the final refuge, or removes the only viable onward route. It deals the ordinary Fog rate; overlapping hazards use the highest rate, never added damage. Contestants evaluate evacuation or short exposure with the same planner used for the Fog. Sanctuary does not block environmental harm, and its preview makes an overlapping storm explicit.

Herald costs one Influence. At commitment the player selects a known, existing clan Hearth; the notice identifies the subject clan, while the exact location and stockpile snapshot are broadcast at activation after 60 seconds. This gives the clan time to move supplies. At activation, all contestants and guests receive that Hearth's current location and a food stockpile band: empty at 0 edible units, low at 1–3, stocked at 4–11, and abundant at 12 or more. Personal inventories, exact counts, equipment, plans, and remote members' positions remain private. If the Hearth is destroyed or abandoned, the result says no active Hearth was found; it does not retarget a new site. No refund is given. The snapshot's timestamp is always visible.

Herald is an instantaneous event, so it does not occupy a temporary-modifier slot. Other player-created effects, including extensions of baseline protection, each occupy one of the three slots while active. Multiple effects in the same category cannot overlap spatially. Cold Front has one global scope; Bountiful Ground and Storm Warning are regional. Phase laws and the Fog calendar do not consume player slots. Finale restrictions always take precedence.

## 11 Player powers and meaningful limits

Standard begins with TUNE six influence points that do not regenerate. Changing only the camera, speed, favorites, overlays, or alerts costs nothing. All players can view the baseline schedule before starting. Optional law modifications spend influence so that choosing one opportunity reduces later options.

| Standard intervention | Influence cost | Effect and limit |
| --- | --- | --- |
| Truce | 2 | Global sentient harm protection for 120 seconds |
| Buildings Protected | 1 | Global hostile structure damage protection for 120 seconds |
| Property Protected | 1 | Global unauthorized container withdrawal protection for 120 seconds |
| Sanctuary | 2 | One 18-metre radius region protected for 120 seconds |
| Cold Front | 2 | Global additional exposure for 120 seconds |
| Bountiful Ground | 1 | One 35-metre radius food region gains one extra item per natural harvest for 120 seconds |
| Storm Warning | 2 | One validated region becomes unsafe for 120 seconds |
| Herald | 1 | One clan Hearth location and coarse food snapshot broadcast once after notice |


Costs and durations are hypotheses. The target is a few consequential interventions per match with enough freedom to create a recognizable style. The player can place a sanctuary near a favorite if they can pay for it; the event is public and rivals can respond. The archive records that intervention without pretending the run was impartial.

v1 Custom supports instant changes, unbounded supported durations, and predefined resource placement. Contestant blessings and resurrection are later extensions requiring their own action and attribution contracts. The UI makes the changed record category clear before the action. A resurrection produces a new life instance in that Custom run so deaths and eliminations are not overwritten.

The base game does not require a moral alignment score. A player may run a harsh but predictable competition or a generous but disruptive one. Contestants can express trust, fear, gratitude, or resentment based on observed interventions. These reactions affect contextual communication and the credibility of later structured proposals. Christ-related convictions additionally affect voluntary helping, mediation, and affiliation under Section 17; a worship economy and compulsory devotion remain excluded.

### 11.1 Focus and witnessed influence

Focus is one selected contestant among the five followed slots in the first release. Pinning a Focus gives deeper intent narration, preferred alerts, and a persistent dossier bookmark. It confers no secret decision budget, protection, or discounted miracles. Christ is a separate guest with his own authored role and cannot be turned into a trained champion.

Custom and Story modes include structured whispers such as consider a truce, inspect a marked place, or seek a known resource. A whisper is a proposal with a sender, visible evidence, and a refusal path. It supplies only explicitly indicated information and grants no ability to perform an impossible action. Christ rejects proposals that contradict his characterization. Freeform orders and physical Hand manipulation remain later work.

The powers preview can show an estimated potential audience using current positions, clearly marked as an estimate. Only actual perception at resolution creates witness events. Influence remains the fixed Standard budget. Worship, fear, killing, and the Christ episode do not regenerate it; this avoids a loop in which manufacturing suffering purchases more control.

### 11.2 Forecasts as a free observer activity

Forecasts let the player make a claim about a future contestant decision or outcome, then inspect the evidence. They cost no Influence, generate no rewards for contestants, and never enter beliefs, action scoring, or simulation random streams. Three forecasts may be open concurrently. Observation without forecasts remains a complete way to play; the panel can stay closed.

A forecast contains an immutable subject ID, template ID and version, any target clan or location ID, creation tick, and future deadline. For event templates, offer deadline choices of 2 or 5 minutes from now plus the next relevant phase boundary, always at least 30 seconds away and no later than match end. Survives to the lock fixes its deadline at 50:00; Clan wins fixes it at result finalization or the declared match ceiling. Eligibility is checked against the authoritative current state before commitment so an already true outcome cannot be predicted. The UI previews the exact success and failure rule. A proposition cannot be edited after commitment; canceling it records Canceled rather than removing a failed attempt.

| Template | Eligibility | Event or state that resolves success |
| --- | --- | --- |
| Leaves the clan | Subject belongs to a clan of at least two; deadline before 50:00 | Completed voluntary departure from the clan named at creation |
| Joins a clan | Target clan exists and differs from subject clan; deadline before 50:00 | MembershipAccepted event for that exact target clan |
| Starts a raid | A different clan has a known Hearth | First legal hostile structure hit or unauthorized withdrawal at that Hearth by the named raiding clan |
| Survives to the lock | Subject alive before 49:30 | Subject alive and not withdrawn after the full 50:00 tick; downed counts |
| Receives a rescue | Subject alive; no completed rescue already fulfills this forecast | A completed post-commitment revive event for the subject |
| Breaks a treaty | Exact treaty is active, known to its parties, and has not expired | Verified breach initiated by the named subject or clan against that treaty ID |
| Reaches the refuge | Subject outside the refuge when committed | Subject standing within its published final footprint for 5 continuous seconds |
| Clan wins | No result has finalized | Named clan is declared winner by the selected ending contract |

Evaluate qualifying events only after the creation tick and through the deadline tick inclusive. A deadline is evaluated after that tick's complete event batch. A raid forecast records starting, not winning, a raid. Death or clan retirement before an outcome makes an impossible forecast Incorrect. If a match naturally ends early, milestone and other unresolved future-event predictions become Incorrect, unless their template has already succeeded; the preview states that reaching 50:00 requires the run to reach it. Abandoned, incompatible, or forcibly edited endings mark remaining forecasts Voided. They cannot manufacture a correct prediction.

The observer is omniscient and this is a local reflection statistic, not a skill certification. Any simulation-affecting player input committed after a forecast is created marks that forecast Influenced, whether or not a causal link is provable. The match's precommitted schedule is permitted and stored. Markers are sticky across cancellation and reload; forecasts created afterward reference the new schedule state. Show unassisted and influenced Correct, Incorrect, Canceled, and Voided counts separately. Accuracy is Correct divided by Correct plus Incorrect, with both counts visible; there is no currency, payout, difficulty multiplier, or public leaderboard.

Deduplicate the same subject, template, target, and deadline across a run and its practice branches. Forecast history has its own observer save stream and branch lineage. With forecasts enabled or disabled, the authoritative simulation hash must be identical. FORECAST acceptance scenes cover off-camera resolution, event boundaries, invalidated targets, abandonment, intervention tagging, and save/load.

## 12 Career records and the chronicle

### 12.1 Persistent data contract

Contestant IDs remain stable if names or art are revised. Each run stores its own ID, roster and profile versions, seed, simulation version, mode, law history, relevant starting-state snapshot, start and end conditions, and whether the player abandoned or branched it. Each life and causal event has an ID. Preselected Coexistence and open Story scenarios are classified Story from creation even if the guest is never spawned. Story runs additionally store episode settings, guest instances, teaching and fellowship events, persecution action state, the selected ending contract, and epilogue status. Guest events never leak into competitor combat totals. Career totals derive from finalized qualifying events and can be rebuilt without double-counting.

Saving and loading the same run never creates a second career result. Finalization is idempotent. Loading an earlier checkpoint of a finalized run creates a branch classified as Custom Practice and cannot award a second Standard win. A finalized Story run is equally protected from duplicate outcomes or epilogues on reload; later branches retain their Story lineage and a Custom flag. A new match creates a new run ID. Replaying the same seed is allowed and visible in the history; it is not a global competitive record.

### 12.2 Definitions for visible statistics

| Statistic | Definition |
| --- | --- |
| Completed runs | Finalized results where the contestant participated; separately count abandoned appearances |
| Survival wins | Contestant is living, nonwithdrawn, and in the winning clan at resolution; a living downed teammate qualifies if that clan has a standing winner |
| Clan championships | Member of the winning clan at the minute-50 lock, including members who die afterward; if victory occurs earlier, use membership at resolution |
| Kills | Final lethal attacker, or actor responsible for the unrecovered downing that leads to bleed-out; exactly one credited killer at most |
| Combat assists | Other eligible opponents who dealt at least TUNE 10 percent of maximum health during the same elimination episode; at most one assist per actor and victim episode |
| Rescues | Successful revival from an actual downed state; record rescuer, patient, and circumstances |
| Survival time | Simulation time alive in that run, with downed time included; phase reached is also shown |
| Contributions | Useful food consumed by others, completed shared structures, equipment supplied and used, and verified aid events |
| Betrayals | Verified breach of a recorded commitment, with the commitment and event attached |
| Notable events | A bounded set of significant witnessed or authoritative outcomes with links to their evidence |

If several actors contribute to a lethal or downing batch on the same tick, assign its origin to the eligible actor with the greatest post-mitigation damage in that batch; exact ties use stable actor ID, never iteration order. Terminal storm overrides ordinary attribution on its pulse: a storm elimination grants no kill. For mixed ordinary environmental and hostile damage, the largest source contribution determines origin with a fixed source-ID tie rule. A later permitted hit on a downed actor takes lethal credit according to the same rule. These bookkeeping ties cannot change health or victory.

An elimination episode starts with hostile damage, resets after revival or TUNE 30 seconds without hostile damage while standing, and remains open during an unrecovered downed state. Assist thresholds aggregate damage within that episode. Friendly damage is impossible in the baseline and cannot earn credit in Custom. Environmental death without a qualifying hostile lethal effect has no credited killer. Chasing someone toward danger may appear in a contextual highlight but does not fabricate a kill.

Rescues are not called "lives saved" as a certainty. Repeatedly downing and reviving the same patient cannot farm prestige: the chronicle retains the events, but commendations count at most one qualifying rescue per rescuer-patient pair per run and exclude a rescuer who caused the downing. Healing, scouting, and provision are shown as support contributions rather than being forced into combat assists.

The dossier displays the numerator and denominator for win rates, with mode, roster size, and ruleset filters. Standard participation always means 100 competitors; subset records never enter that denominator. Survival wins and clan championships are separate labeled columns. Contestants who died before the final clan lock may receive a "Contributed to the winning clan" highlight when their recorded contributions support it, without being awarded a survival win.

### 12.3 Stories grounded in events

The chronicle ranks events by consequence, rarity, relationship significance, and player favorites. A short run summary can mention a rescue that enabled a later victory or an early departure that formed the eventual winning clan when that causal chain exists. It must not invent motives that were never part of the decision record.

Awards such as First Founder, Resourceful Survivor, Trusted Ally, or Last Defender are secondary recognition. They have explicit criteria and grant no permanent combat bonus. Custom, Story, and Standard awards remain distinguishable. The opening dossier has no fabricated historical wins; it becomes richer through actual play.

### 12.4 Threads and Saga export

Adopt six initial story threads: Bond, Rivalry, Exodus, Ascent, Betrayal, and Reconciliation. A thread requires a small state progression with evidence, not merely a high score on one event. For example, Reconciliation connects a prior dispute, a mediation or restitution attempt, and a later act of cooperation. Threads can fail, pause, or remain unresolved.

The post-run Saga groups verified events, contributor records, important law changes, and the player's interventions into a readable account. First-release export is text or a simple static HTML document, with optional portraits when available. Ongoing events and interrupted plans are labeled accurately. The Christ episode adds teaching, fellowship, persecution, and aftermath entries to the same chronicle rather than replacing it with a separate campaign log.

Saved scenario files contain seed, content versions, roster IDs, initial rules, scheduled inputs, and selected story settings. A scenario recreates starting conditions; it does not promise an identical outcome after different interventions. Exact replay additionally requires compatible simulation code, random state, and the complete input history. Imported unknown content defaults to Custom until validated. Workshop publishing and automatic online sharing are deferred.

### 12.5 Continuity without permanent power

Dossiers include head-to-head encounters, eliminated-by and rescued-by links, win streaks, and one earned epithet selected from verified awards. An epithet has a source run and can be hidden on the map. It changes neither personality nor proficiency. Lines referencing a past contest are visibly labeled with that run; they cannot create current knowledge or change current relationships in Standard.

The first v1 meta layer is the career archive. Ten-run seasons are deferred until players value the archive; standings would require an explicit participation rule and must not obscure survival wins versus championships. Players may attach plain-text notes to bookmarks and include them in the Saga. Notes are labeled as the Overseer's words and cannot become narrator facts or bot memories. Text and HTML exports escape user text and preserve source event links.

## 13 Observation interface and onboarding

### 13.1 Main interface

The top bar shows simulation time, phase, living contestants, eligible clans, and the next public transition. A compact law strip distinguishes active rules from announced future rules. The main island view uses banners and readable actions. A side panel holds up to TUNE five followed contestants or clans; one followed contestant can be Focus, and an event feed prioritizes developing situations over trivial task completions.

Selecting a contestant opens current needs, inventory, clan, visible relationships, present intention, and a concise explanation. "Preparing to leave before the storm" can expand into known travel time, supplies needed, and the next planned action. The Why panel shows the chosen plan and up to two considered alternatives, each with one actual reason for rejection or lower priority. If an alternative was not evaluated this cycle, say so; do not invent a counterfactual. A developer view adds scores, input facts, and the decision tick. Cached reasons show their age and refresh when a meaningful decision changes.

### 13.2 Essential controls

| Tool | Purpose |
| --- | --- |
| Pause and speeds of 1x 2x and 4x | Inspect a decision or move through preparation; faster speeds are conditional on performance |
| Tabletop camera and contestant follow | Read territory or connect with an individual within the same constrained view |
| Law timeline and region preview | Understand current restrictions and anticipate changes |
| Clan overlay | See membership, camps, public agreements, and known conflicts |
| Knowledge lens | Show only what the selected contestant knows and its confidence |
| Situation alerts | Follow a raid forming, imminent law expiry, rescue attempt, or evacuation |
| Career dossier | Inspect outcomes across completed runs |
| Chronicle bookmarks | Jump the camera to a recorded location and inspect the event; full cinematic replay is later scope |

A relationship overlay shows direct trust and commitments for the five followed slots and a selected actor, expanding one neighbor at a time rather than drawing all 100 people. The observer view may show a secret plan, but private plans never enter the public bot information channel. Notifications can be filtered to favorites and major events. Automatic camera movement and automatic slow-down are independently opt-in. The first tutorial demonstrates a suggested camera move and lets the player enable the Auto-Director; declining leaves a focusable alert. A visible indicator distinguishes an intentional wait from a blocked task.

The optional Auto-Director follows developing threads using a TUNE eight-second minimum dwell time, an urgency threshold that only imminent elimination or equivalent danger can interrupt, and a return-to-Focus control. It can suggest a camera change without making it. It does not spawn incidents, change bot decisions, or manufacture a twist. A separate incident co-director is deferred. The law timeline becomes an escalation calendar for all scheduled law, weather, and Fog transitions.

Story mode adds a small episode panel: guest status, current intention, upcoming gathering, relevant teaching, fellowship relationships, and developing threats. Selecting a teaching shows its source and distinguishes a quotation, a paraphrase, and an island-specific adaptation. The panel avoids a conversion percentage or a salvation score.

### 13.3 First session

Begin with an eight-contestant guided lesson lasting TUNE eight simulation minutes. It has a declared short schedule and Tutorial records. Follow two different personalities, show a shelter proposal, commit one forecast, announce a truce extension, and inspect an actual replan. A staged fixture supplies a threat opportunity; bot responses remain autonomous and the tutorial accepts a valid retreat as well as a rescue. The lesson ends with evidence for its forecast and one explained record.

Next offer a curated 24-person introductory trial using C001–C024. It runs a shortened 30-minute calendar with explicit times and separate Trial history. It tests all major decisions without claiming to be a Standard match. The player can skip it and start The Hundred. Introduce full Standard with a complete default calendar and five suggested followed contestants; never ask the player to configure 100 people individually.

The first meaningful intention should be visible within 20 seconds: seeking a camp, taking food home, or approaching a potential partner. By the first night, a new viewer should recognize a real dependency between at least two contestants. Do not script a friendship solely to hit this target; failed social approaches can be equally readable. Test whether the viewer can explain the 10:00 bell, identify a deliberate wait, and distinguish a forecast from a command.

## 14 Presentation baseline art and audio

### 14.1 Visual direction for the first playable

Build a stylized mythic island presented as a physical tabletop: low-poly landforms, matte materials, readable vegetation clusters, warm occupied camps, and clearly marked laws. The behavior prototype must use a coherent visual kit, typography, lighting, and interaction feedback. Plain debug capsules and temporary text walls are for diagnostics, not the player-facing test. The first playable is usable without a later art replacement.

The following is a code-buildable art specification. It is not a finished concept-art pack. Production can implement mesh generators, instancing, procedural materials, projected markers, and portrait capture in the chosen renderer. Artists can replace meshes, textures, and clips through the same attachment points, scale, action IDs, and material slots.

| Element | Baseline specification | Readability requirement |
| --- | --- | --- |
| Terrain palette | Meadow #687A50, forest #314E43, stone #85847B, soil #6B5947, sand #C7B58F, water #426674 | Biomes distinguish routes and danger without texture detail |
| Objects and light | Wood #805C3C, iron #657079, cloth #D8C7A5, fire #E5AA55, Fog #71838A, sky #C7D1D0 | Dark night retains visible ground silhouettes and boundary contrast |
| Interface | Paper #F3EFE4, ink #202820, muted #627066, alert #B94B3D | High contrast; danger also has shape, text, and sound |
| Clan identities | Eight accent colors combined with numbered geometric banner glyphs | At least 100 distinguishable clan labels; no reliance on color uniqueness |
| Typography | One licensed, legible sans serif; 16-pixel body at 1080p, 14-pixel minimum labels, 125–150 percent scaling | Reserve space for longer translations and stable numeric widths |
| Boundaries | Solid shield line for active protection, dashed clock line for future protection, hatched edge for hazard | Icons and line patterns remain distinct in grayscale |

Use three body builds, four head shapes, ten hair/headwear variants, and six personal accessories. Authored combinations create 100 identities; headwear, personal accent, and portrait composition survive clan changes. Render portraits from the same model kit. Equipment is attached to consistent hand, back, and waist points. Do not promise 100 uniquely recognizable silhouettes at a distant zoom; the combination of portrait, banner, name, and selective follow makes identity readable.

### 14.2 Camera and screen layout

Use a perspective 3D camera with near-orthographic tabletop framing, a default 45-degree pitch, a 35–65-degree pitch band, full yaw orbit, and clamped zoom. Minimum zoom follows one contestant and shows nearby context without requiring facial animation. Terrain and foliage between the camera and Focus fade or cut away visually; picking still resolves the correct ground and actor. Camera changes never alter perception or navigation.

At 1080p, reserve roughly 60 pixels for the top status bar, 300 for the right inspector when open, 260 for the collapsible left event and favorites panel, and 76 for the bottom law calendar. Smaller windows collapse panels instead of shrinking text below the minimum. The main map displays broad clans and migration routes at wide zoom; names and exact intentions appear for selected, followed, threatened, or near-camera actors. One hundred permanent nameplates are prohibited by the presentation budget.

The top bar includes simulation time, fictional day/night, active competitor count, eligible clan count, and the next permission change. The bottom calendar keeps the lock and finale visible throughout. Hovering or focusing an event highlights its actors and location; a click follows it. Every action has a keyboard equivalent. The optional guest panel adds one clearly separate actor count and tab.

### 14.3 Action feedback and animation budget

Readability priority depends on zoom. At strategic range: banner glyph, hazard or intent icon, and selected name. At close range: name and epithet, intent label, equipment, and movement. Animation supports this information and cannot be the only evidence of a legal action, blocked plan, or rescue. Waiting has a clock icon with trigger time; failed work has a broken-path icon with retry or fallback status.

Every action definition must include an intent template, icon ID, progress or interruption cue, sound hook, and animation mapping. A hook may explicitly be silent, but cannot be undefined. Section 31 gives the required initial goal catalog. Templates use actual targets and reason codes, with fallback wording for unknown identities.

Budget 12 shared animation clips: idle/scan, walk, run/flee, generic work, rest, aim, melee, exchange/gesture, guard, downed, revive, and surrender/refuse. Gather, build, cook, craft, repair, and teach reuse work or gesture clips with tools and progress indicators. Damage flashes, death stillness, blocked-work symbols, and interrupted actions are explicit overlays or transitions. No ragdoll, facial system, or fully simulated carrying is required. The guest adds two gesture variants and one restrained aftermath composition; it reuses movement and injury clips.

### 14.4 Procedural world and lighting

Use a bounded heightmap with flat-shaded biome regions, instanced rocks and trees, authored camp socket data, and projected construction footprints. Keep paths and shallow crossings distinct. Fog combines a ground mask, low layered geometry, and restrained desaturation; the ground mask is the gameplay boundary. Visual fog never claims a different safe location from the simulation.

Night uses an ambient gradient and campfire pools of light. Limit visible dynamic lights to the nearest TUNE eight and approximate distant lights visually; this renderer budget does not change the authoritative illumination map. Shadows and particle density may scale with quality. Silhouettes, nameplates, protection lines, and attack wind-ups must remain legible on low settings. Rain and volumetric cloud simulation are outside v1.

### 14.5 Dialogue and sound

Core speech is authored, local text. Start with 40 situation templates in the slice, then a budget of 100 situations with three tone variants each for v1, about 300 core lines before names and object slots. Tone is selected from the profile and situation, not generated unrestricted prose. The Christ teaching catalog is separately budgeted and tagged. English is the initial writing and test language. All text uses localization keys and language-aware formatting; Finnish release text remains a production decision, not an assumed completed translation.

A contestant normally speaks at most once per 20 seconds; emergency calls bypass that cooldown but duplicate nearby calls are grouped. The display shows at most two expanded speech bubbles simultaneously, prioritizing Focus and actionable threats. All real requests remain in the event log when their presentation is suppressed.

Implement calm, contact, combat, and storm ambience with priority storm above combat above contact above calm and five-second release hysteresis. Contact is nearby observed hostile presence without active damage. Threat state changes audio only. Use a clear law announcement chime, a distinct expiry bell, and a short SFX vocabulary for work, trade, footsteps, arrows, impacts, downing, revival, and Fog. Audio muted must remain fully playable. Full voice acting and generative voices are deferred.

Use temporary synthesized effects or assets with documented redistribution rights in the prototype. Music is optional for the behavior gate. Select a score that supports quiet observation and makes rising pressure audible without obscuring contestant calls. A small licensed or commissioned adaptive score can follow the slice; sourcing, budget, and authorship are production decisions.

### 14.6 Presentation acceptance

At 1080p with default UI scaling and at 150 percent text scale, verify no clipped panels, overlapping critical labels, or unreadable law boundaries. Test day, night, dense forest, a crowded camp, and the full 100-person refuge. A new player should recognize three followed contestants from kit portraits, explain a law transition without audio, and identify intentional wait versus blocked work at 4x. Art polish is judged with observed comprehension and direct visual review, not an assertion that no one can spot a placeholder.

Graphic gore is unnecessary. Reduced motion disables rapid camera travel and harsh flashes. The episode's reduced-intensity presentation uses an aftermath card for persecution while preserving the event. These settings change presentation only.

## 15 AI implementation direction

This is an implementation direction for prototype comparison, not a separate technology plan or a committed engine selection. The required behavior and diagnostics govern the choice of framework.

Adopt a simulation core that can run without a rendered scene, with an explicit adapter boundary for navigation and presentation. Data definitions and a headless batch runner should exist from the prototype. Headless execution must use equivalent navigation, perception, timing, and legality semantics; replacing them with easier abstract outcomes would invalidate the tests.

Do not commit to a TypeScript prototype followed by a presumed inexpensive C# port. Choose the prototype language with the likely production path and team skills in mind, and measure any migration cost. Do not adopt camera-dependent abstract plan outcomes or an unmeasured 8x performance promise. Adaptive scheduling is allowed only while preserving the same authoritative decisions and outcomes.

### 15.1 Responsibilities

| Component | Owns | Must not do |
| --- | --- | --- |
| Authoritative simulation | Time, resources, health, ownership, laws, actions, events, results | Accept an illegal action because a planner or dialogue requested it |
| Perception and belief store | Observations, reports, uncertainty, recency, public notices | Expose hidden world state to ordinary decision code |
| Goal selection | Compare viable needs and opportunities using personality and current beliefs | Score prohibited or physically impossible actions as executable |
| Task planning | Build bounded action sequences with prerequisites, costs, deadlines, and fallbacks | Assume that reserved materials or locations remain valid indefinitely |
| Tactical execution | Movement, interaction, aim, wind-up, local avoidance, interrupts | Silently teleport, fabricate inventory, or ignore damage permissions |
| Clan coordination | Shared proposals, role requests, agreements, resource reservations | Replace all individual judgments with one omniscient commander |
| Chronicle and explanation | Derive records and readable reasons from authoritative events and decision snapshots | Invent events to make a story more dramatic |
| Optional conversation | Render personality and approved memories in dialogue | Change laws, grant items, or become the authority on career facts |
| Optional story controller | Evaluate authored encounter eligibility, guest state, teaching references, and epilogue conditions | Force affiliation, skip action permissions, or declare a competitive result |

The proposed combination is utility-based goal selection, a bounded task planner, and a small execution state machine or behavior tree. Utility scoring compares alternatives under changing needs and personality; inertia and emergency priorities prevent oscillation. This draws on the techniques described in [An Introduction to Utility Theory by David Graham](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter09_An_Introduction_to_Utility_Theory.pdf). The particular scoring factors and limits in this document are project proposals.

Planning chains actions through prerequisites and effects. [Jeff Orkin's account of the AI in F E A R](https://www.gamedevs.org/uploads/three-states-plan-ai-of-fear.pdf) is a relevant precedent for combining planning with simple execution states. It does not establish that this game's social and construction problems are solved. Compare a small goal-oriented planner with an authored hierarchical task planner in the prototype, using the same acceptance scenes.

### 15.2 Every new action has a complete contract

An action definition includes its ID, requirements, legal scopes, relevant knowledge, resource cost, duration, reservations, expected effects, interruption policy, failure reasons, observable cues, resulting events, and the presentation fields in the action feedback rules in Section 14. Designers cannot add a new recipe, law, or tactical option without declaring the AI options it creates and how they can fail.

For example, TradeForBandage requires a reachable known partner, a valid offer, legal transfer permissions, available goods, and time before the patient bleeds out. If the trade cannot arrive in time, the bot should consider another treatment or abandon the attempt with a reason. This exposes the relationship between temporal planning, social decisions, and survival rather than treating them as isolated features.

### 15.3 Bounded computation and recovery

Spatial queries return relevant nearby entities. Cheap threat signals interrupt quickly; expensive planning is scheduled and has a node or time budget. Candidate goals are filtered before detailed evaluation. Clan proposals reduce redundant work but retain the information limits of their participants.

Maintain one shared game time and authoritative simulation order. Rendering and animation interpolate around simulation steps. Observation frequency and distant path detail may vary, but camera location must not alter combat outcomes, food consumption, legal actions, or the information a contestant is entitled to receive.

When planning exceeds its budget, the bot retains a valid current plan or selects a safe short action. Path failures trigger a bounded retry, a fresh route or target, and a communicated request for help when useful. Repeated failure is tagged for inspection. Never hide a persistent deadlock by teleporting a contestant in Standard play.

### 15.4 Data boundaries and candidate technology

Schemas and validators are required for laws, actor profiles, actions, recipes, camp sockets, treaties, dialogue, story encounters, forecasts, and intent templates. References use IDs and versions, never display strings. Content validation checks missing prerequisites, undefined reason codes, resource conservation, inaccessible work positions, and absent presentation mappings. New recipes count toward the 28-item budget unless one is explicitly removed.

The technical plan should evaluate a TypeScript headless simulation with a WebGL renderer as a credible production candidate alongside a small native baseline such as Godot. Do not build two full games: compare the same stress fixtures, navigation representation, legality, and event load in short feasibility spikes. A desktop wrapper, engine version, rendering library, and distribution path remain unselected until benchmark evidence and packaging needs are known. No later port is presumed cheap.

Use a fixed 10 Hz authoritative timestep as the initial target, stable entity IDs, ordered input application, and independent seeded random streams for world generation, AI, combat, wildlife, and optional story. Camera, forecasts, UI, and notes have no access to these random streams. Physics-dependent damage and projectile intersections must be deterministic under the selected simulation representation. Cosmetic animation and particles may interpolate independently.

Urgent perception checks run each 0.1-second tick. Ordinary task reconsideration is staggered every 2 seconds per actor; strategic goals every 10 seconds. Law invalidation or an observed threat queues a priority replan with a one-second law-response bound and a 0.5-second threat-response bound. This is explicit priority scheduling: the ordinary cadence cannot excuse a missed urgent deadline. A crowded event must fit the measured budget, including wolves and deer.

### 15.5 Save logs replay and batch evidence

The event journal is authoritative for facts and records; a snapshot plus the complete input and random state restores a run. A journal of high-level story events alone is not enough to reconstruct simulation state. Exact same-build replay uses initial state, inputs, random streams, and deterministic execution, with periodic checksums and snapshots for seeking and divergence diagnosis. Full cinematic rewind UI remains deferred.

Build a headless fixture runner with seed, content versions, scripted inputs, maximum ticks, and outcome assertions. It must exercise the same map, visibility, reservations, damage, and rules as rendered play. Batch reports include win/draw/abandoned classification, deaths by cause, blocked durations, law violations, duplicate transfers, decision latency, crowded encounters, and outcomes by profile and strategy. Store raw evidence when a run fails, not only a pass percentage.

## 16 Optional conversations and guest contract

### 16.1 Intended experience

The player can pause the competition and speak with a selected contestant about their current situation, companions, remembered experiences, or past contests. Post-run interviews are the first target because their facts are stable. A cautious builder might explain why they left a strong clan; a previous winner might remember the person who rescued them.

The core already provides event-grounded contextual lines. The language model expands expression and question handling. It is not required for survival, alliances, betrayal, or remembering recorded events. The optional feature must be removable without changing the authoritative match result.

### 16.2 Grounding and authority

Conversation context includes the stable character profile, the selected contestant's current beliefs, a small set of relevant verified memories, relationship state, and explicit uncertainty. Previous-run memories carry run labels. Current hidden enemy positions and private plans of others are excluded. The model receives only the information the character may discuss.

Gameplay numbers and career facts appear in an adjacent deterministic facts panel. Generated statements are checked against retrieved event IDs where feasible, and unsupported assertions fall back to a grounded response. Validation reduces errors but is not assumed to guarantee perfect narrative accuracy. Contradictory or invented recollections are a release-blocking quality issue for claims presented as facts.

The first release of this stretch feature is observational conversation. Typed text cannot execute orders, rewrite history, create agreements, or modify trust values. A later influence feature must translate permitted requests into structured proposals that the simulation validates and the bot can refuse. Player text and character dialogue never become executable simulation instructions.

For Christ, the approved teaching catalog and contextual authored responses ship without a language model. If the optional local conversation layer is enabled later, retrieval uses that catalog plus permitted event memories. It cannot invent scripture, claim a new revelation, assign a real-world spiritual diagnosis, or confuse the player's account with God the Father. Questions outside the authored scope receive a grounded acknowledgment of the limit. These are character and content constraints, not evidence that the software is the religious figure himself.

### 16.3 Runtime approach and gate

[llama.cpp](https://github.com/ggml-org/llama.cpp) is one candidate local inference runtime for optional local inference. It is not itself the language model, and no specific model or hardware requirement is selected here. Prototype the intended languages and actual conversation workload before selecting model size, distribution terms, memory requirements, or download packaging.

[Generative Agents by Park and colleagues](https://arxiv.org/abs/2304.03442) is a research reference for memory, reflection, and planning in language-model agents. It is not evidence that 100 such agents can run economically and responsively inside this real-time game on ordinary player hardware. The proposed game instead limits inference to one optional conversation at a time.

Conversation initially pauses the simulation. Inference has a cancel control, a memory budget, a bounded context, and a timeout with a deterministic fallback. Installation is optional and offline after the required model assets are available. Select and review redistribution terms before shipping a model. No cloud fallback is enabled silently. Target latency and supported hardware remain uncommitted until measured.

### 16.4 Generic guest actor contract

The simulation supports a data-defined Guest category separate from Contestant and Wildlife. A guest is sentient, noncompeting, non-clan, protected by Truce and Sanctuary, and subject to ordinary movement, needs, health, visibility, and environmental hazards unless a declared encounter supplies a scoped effect. Guest life IDs and story records never occupy clan slots, the 100-person roster, kill/assist totals, or winner eligibility. An active guest cannot keep a concluded run open.

Creating a guest marks the run Story atomically; arbitrary edits additionally mark Custom. Ordinary Story permits one active guest and one arrival per episode; repeat spawning is Custom with new life IDs. Arrival costs no Influence, requires a valid safe position, and cannot extend a schedule. End-of-run departure, death, and optional coda are explicit separate events.

Christ is the first shipping authored guest and retains Section 17's full characterization. A neutral hermit profile can validate movement, information, aid, protection, save/load, and records in development; it is a fixture, not a second promised content package. Core systems branch on capabilities and actor tags instead of checking the name Christ.

## 17 The optional Christ episode

### 17.1 Purpose and scope

The episode asks how a competitive society responds to someone who teaches love of God and neighbor, forgiveness, truthfulness, repentance, and service while refusing its assumption that another person's defeat is the highest good. It adds one autonomous guest, a small teaching catalog, a fellowship relationship, and a few contextual encounters. It is a light systemic story layer within the island, not a mandatory Gospel reenactment or a separate long campaign.

The guest is explicitly Jesus Christ, portrayed through the canonical Gospels. He is not merely an unnamed prophet or an ordinary contestant with unusually high persuasion. His distinctiveness comes from stable convictions, teaching, compassionate action, and his understanding of the setting. The software remains an authored fictional portrayal. The episode introduction makes that distinction once; dialogue need not repeatedly interrupt itself with disclaimers.

Planned first-release content is one guest profile, eight teaching themes, six encounter templates, a voluntary fellowship, one optional persecution branch using existing actions, and a short conditional epilogue. Those features use authored text and existing planning, relationship, and event systems. Freeform local LLM conversation remains stretch scope; the Christ episode itself is part of the planned optional content and must work without it.

### 17.2 Spawning and competition membership

The player may choose Spawn Christ before arrival or during an active run. There is no required unlock, payment, alignment, worship level, or earlier story completion. The player picks a valid navigable arrival point outside an immediate damage volume. A late arrival does not delay the competition. The preview shows the time remaining, the episode settings, and the resulting Story record classification.

Christ uses guest ID G001, a separate actor category and life ID, and no contestant roster slot. A full run contains 100 competitors plus at most one active guest. His arrival equipment is ordinary clothing and one trail ration, with no transferable rare item or endlessly replenishing supply. He starts with 100 HP, food 85, fatigue 10, exposure 0, and baseline skill band 1; ordinary movement, hunger, fatigue, exposure, injury, and navigation rules apply. His authored decision constraints are separate from those physical values; any exceptional healing is the explicit encounter in Section 17. He cannot join a competing clan, become its leader, fill its eight-member cap, occupy a winner slot, or prevent a match from ending merely by remaining alive. Followers retain their existing competitor and clan identities. The interface displays competitor and guest counts separately.

Only one Christ arrival is allowed per ordinary Story run. Custom repeat-spawn experiments create separate guest instances and cannot erase the first visit's events. A surviving guest leaves the active scene when the match ends; this is an episode departure, not a death. Guest death does not eliminate his followers. The guest never keeps a run active after its selected ending condition resolves. All-dead or all-withdrawn states end immediately; in Coexistence they are Unresolved. A single eligible clan wins in a continuing competition, while Coexistence continues to its published time limit and evaluates the actual clans and commitments at that deadline.

### 17.3 The portrayal and its sources

Use the four canonical Gospels as the core source set. The initial English source text is the public-domain World English Bible, with book, chapter, verse, and translation retained per passage. Every authored line is tagged as an exact quotation, a paraphrase, or an island adaptation. Only exact quotations receive quotation formatting and the claim that these are the source's words. New dialogue must not be presented as a lost saying or newly discovered scripture.

His knowledge that the island is a simulation is a fictional premise of this game. It is not presented as a biblical claim that the real world is a computer simulation. He knows the public rules, committed schedules, his own role, and what he can perceive or has been legitimately told. He does not read private bot memories, undiscovered inventories, future uncommitted player choices, or engine debug state.

The player is the Overseer of the arena. God the Father in Christ's teaching is not identified with the human player, the computer, or the developer. The portrayal can acknowledge the Overseer's control of weather and law while challenging how that control is used. Knowing that the arena is constructed does not make suffering meaningless or turn compassion into an exploit.

The Kingdom of God is expressed through teachings about God's reign and through the fellowship's conduct. It is not a map-control percentage, a new conquest faction, or a certification that a bot has achieved salvation. Luke 17:20-21 is translated as within you in the World English Bible and as in your midst or among you in several other translations; the content notes acknowledge that difference. The episode does not declare an exclusively inward interpretation to be uncontested biblical meaning. See [Luke 17](https://ebible.org/engwebp/LUK17.htm) and [parallel translations](https://www.bible.com/bible/compare/LUK.17.20-21).

### 17.4 Teaching catalog

The following mappings are design adaptations. They preserve the distinction between a Gospel teaching and the specific mechanic built to express it.

| Theme | Source | Practice inside the island |
| --- | --- | --- |
| Love God and neighbor | [Luke 10 verses 25 to 37](https://ebible.org/engwebp/LUK10.htm) | Offer care across clan boundaries; a wounded rival is still someone to help |
| Mercy and love of enemies | [Matthew 5 verses 7 to 9 and 43 to 48](https://ebible.org/engwebp/MAT05.htm) | Attempt reconciliation, refuse retaliation, and protect someone previously hostile |
| Prayer and sincere generosity | [Matthew 6 verses 1 to 13](https://ebible.org/engwebp/MAT06.htm) | Pray, share, or serve without turning the act into a demand for status |
| Repentance and forgiveness | [Mark 1 verse 15](https://ebible.org/engwebp/MRK01.htm) and [Luke 15 verses 11 to 32](https://ebible.org/engwebp/LUK15.htm) | Acknowledge harm, make feasible restitution, and leave a path toward restored relationships |
| Leadership through service | [Mark 10 verses 42 to 45](https://ebible.org/engwebp/MRK10.htm) | Feed or assist before demanding obedience; challenge coercive leadership |
| God and spiritual life | [John 4 verses 21 to 24](https://ebible.org/engwebp/JHN04.htm) | Teach worship in spirit and truth; do not equate shrine ownership with access to God |
| The Kingdom and worldly power | [Luke 17 verses 20 to 21](https://ebible.org/engwebp/LUK17.htm) and [John 18 verses 36 to 37](https://www.biblegateway.com/passage/?search=John+18%3A36-37&version=WEB) | Build a community of service without claiming that conquest establishes God's Kingdom |
| Hope beyond death | [John 11 verses 25 to 35](https://ebible.org/engwebp/JHN11.htm) and [Matthew 28 verses 1 to 10](https://ebible.org/engwebp/MAT28.htm) | Offer hope and comfort while preserving grief, consequences, and recorded loss |

Spiritual-world dialogue stays within this sourced scope: God, prayer, Spirit, eternal life, resurrection, and hope. It does not invent a detailed geography of the afterlife, classify real people as spiritually saved or condemned, or treat deleted game data as the biblical meaning of death. Denominationally disputed details require a documented editorial choice rather than an unconstrained generated answer.

Character review must include both compassion and moral challenge. He can confront hypocrisy, exploitation, vengeance, and the use of piety for status; he is not a bot who approves every request. Preserve Jesus' Jewish context. Responsibility for persecution in the fictional island belongs to particular simulated actors and their actions, never to an ethnic or religious population.

### 17.5 Autonomous conduct

His planner uses a constrained action set: travel, observe, teach, ask a reflective question, share available provisions, tend wounds, mediate, pray, rest, warn of an announced danger, seek safety, and respond to an accusation. Core commitments reject killing for victory, recruiting a warband, lying about events, demanding worship of the player, or exchanging salvation for goods. Utility selection still decides where help is feasible and whom he can actually reach.

He can recognize a coming law change and use a safe interval for a gathering or a rescue. He may warn a clan before an announced storm without revealing a secret intervention. When a peace law expires, his response can be continued mediation, evacuation with vulnerable people, or a refusal to endorse a planned attack. Nonviolence does not require mindlessly walking into every threat or seeking death. The portrayal can leave a hostile settlement and resume teaching elsewhere.

Two example island adaptations are: The protection will end soon. Use this time to make peace, not only to sharpen your weapons; and You can change the boundary, Overseer. What do you want those within it to learn? These are newly authored lines inspired by the episode's themes, not Bible quotations. The codex labels them accordingly.

### 17.6 How teaching spreads

A teaching opportunity starts from a real need, question, dispute, or willing gathering. Listeners can decline or leave. TUNE: a short exchange takes 10 to 20 seconds, a gathering lasts at most 45 seconds before every participant reevaluates their needs, and repeats to the same listener have a two-minute diminishing-return window. Imminent survival emergencies interrupt attendance. No sermon can keep hungry bots stationary indefinitely.

The listener records the teaching ID, speaker, context, and their reaction. Sincere receptivity can make a matching helping or reconciliation action more attractive; practical evidence and later choices strengthen or weaken that conviction. Personality remains relevant. A cautious skeptic might help because the proposal is sensible while declining religious affiliation. An ambitious opportunist might claim devotion to gain access to a generous camp. A sincere follower may fail under fear and later regret it.

Followers can repeat a known teaching through the same bounded message system. They cannot transfer Christ's identity, special knowledge, or healing ability. The base text of a passage remains stable; followers' interpretations and disagreements are recorded separately. A false claim about scripture is a character claim requiring attribution, not automatically a narrator-endorsed lesson.

### 17.7 Fellowship and the Kingdom pathway

Fellowship is a voluntary relationship network across existing clans. It is distinct from a truce, a trade treaty, or clan membership. Members may offer meals, shared shelter, care for enemies, mediation, and teaching. A communal table is a functional variant of the existing camp worksite. A meeting place or simple worship gathering can use existing structures; this episode does not require a new religious building technology tree.

The network creates genuine dilemmas. A hunter may share food with a rival who later attacks. A leader may adopt a care-for-strangers custom that strains reserves. Another member may refuse a raid after listening to a teaching. Those decisions must be individually evaluated and traced to experience. Belonging does not automatically share inventories, reveal every member's position, confer sanctuary, cancel hostility, or merge the clans.

Track observable outcomes such as outsider meals consumed, mediated disputes followed by cooperation, voluntary refuge offered, and members who keep or break commitments. Do not rank Christians above skeptics or award a conversion multiplier. A believer may act badly, and a nonbeliever may act compassionately. The chronicle can describe a flourishing fellowship without making a theological judgment about every participant.

### 17.8 Miracles and practical limits

Include one authored healing encounter in the initial episode catalog, drawing on the care of a hostile wounded person in [Luke 22 verses 49 to 51](https://ebible.org/engwebp/LUK22.htm). It may be offered once per visit when a suitable injured actor is present. It is optional, cannot be demanded by a whisper, and has no loyalty requirement. A witness may be moved, frightened, skeptical, or concerned by its political implications.

Healing changes health through a validated guest event with its origin recorded. It does not revive eliminated competitors, manufacture a win, create armor or rare loot, or override the final storm. Additional food miracles or active resurrection mechanics are deferred. The one-encounter limit is a content and simulation boundary, not a claim about Christ's theological power. Ordinary aid remains available using the same finite provisions and treatment rules as the world.

### 17.9 Opposition and persecution

Opposition requires a concrete situation: a leader fears losing willing followers, someone blames the fellowship for an actual shortage, a rival objects to mediation, or an opportunist adopts an accusation for advantage. A remembered teaching by itself cannot generate a persecution score. A skeptic may question, ignore, help, or defend the guest. Hostility must be an individual decision with evidence, not an automatic consequence of religious affiliation or doubt.

Use the existing verbs approach, threaten, exclude, attack, flee, down, rescue, and lethal follow-up. There is no seizure, prisoner transport, captor inventory, or persistent custody state. Accusations refer to actual actor beliefs, which may be false; the narrator attributes the claim to its speaker. Other actors may refuse a proposed attack or continue mediation.

A possible crucifixion outcome remains in the episode. It must be its own announced hostile intent and verified event; an ordinary sword kill must never be relabeled as crucifixion after the fact. To initiate this encounter, an actor who adopted a specific accusation must perceive the downed guest, have lawful access at a valid reachable interaction point, and choose the episode's lethal follow-up. The choice starts a 20-second visible preparation using the existing interruptible action framework. This branch can be attempted once per visit; it is not a reusable combat skill or a player execution button.

The action requires the initiator to remain standing, within interaction range, with a still-downed living target, lawful sentient harm, and safe enough ground to continue. Ordinary bleed-out keeps running. If the guest bleeds out first, that is the actual recorded cause and the crucifixion action fails. If revived, protected, moved outside reach through supported movement, or if the initiator is interrupted or downed, the action cancels. There is no restraint state to release. Treatment and warnings can interrupt an attack through normal priorities. A truce cancels preparation on its activation tick and cannot leave a queued narrative death behind.

On an uninterrupted legal completion, a terminal guest damage event records the acting perpetrator, accusation, location, and action ID. The presentation uses a restrained distant silhouette and aftermath. It does not simulate torture, binding anatomy, or an interactive punishment procedure. The guest's downed pose cannot create an implicit prisoner system. This is an adaptation of the review's simpler persecution approach, preserving the user's requested outcome and a truthful causal record.

Christ may seek safety or leave a hostile settlement. Nonviolence does not require seeking death. Followers and nonfollowers may rescue him, object, refuse participation, or flee. Death is neither a required chapter nor an achievement target, and guest harm grants no combat score, Glory, Influence, or loot advantage. If his ordinary survival equipment drops, its quantity follows the declared inventory and is not multiplied by the encounter.

Aftermath can include grief, shame, fear, division, continued service, or rejection of revenge, each based on witnessed events and relationships. No automatic island-wide conversion or curse occurs. [Luke 23](https://ebible.org/engwebp/LUK23.htm) informs the Passion themes; the island's perpetrators and circumstances are fictional. Preserve the source translation's textual notes when quoting a passage with variants.

### 17.10 Endings and persistence

| Selected setting | How the run ends | Career treatment |
| --- | --- | --- |
| Competition continues | Existing last-clan or draw rules resolve; the guest never counts as a rival clan | Story survival wins may be recorded for competitors; never a Standard win |
| Coexistence scenario | A preselected 60-minute Story scenario evaluates voluntary cooperation; final Fog contraction stops at the announced refuge | Shared Peace or Unresolved story result, with no last-clan victory credit |
| Open Story sandbox | The player ends the observation or a selected custom ending resolves | Story history and useful contributions; no invented competitive win |

Coexistence is selected before the run and classified Story from creation, even if Christ never arrives. Its 60-minute scenario uses the same economy and initial harm permissions but stops Fog contraction at the announced refuge at 50:00. Terminal pulses and the final lethal resolution are disabled from creation. One remaining clan does not win or end it early. All-dead or all-withdrawn ends Unresolved immediately. Standard-style interventions still expire by 50:00; later edits add Custom.

At 57:00, the arena broadcasts an Accord proposal to all living competitors. Its public panel states the terms, names accepted signatories, and displays aid and conduct criteria. Acceptance is an explicit received decision and remains open until 59:30. A signatory can withdraw before 60:00; aggression records a conduct breach regardless of whether it hit or was blocked. A valid rescue or defensive escape does not itself breach the Accord, but initiating damage does. Merely suffering an attack never disqualifies its victim.

At 60:00, evaluate the full set of living, nonwithdrawn signatories who have accepted and initiated no hostile action between 57:00 inclusive and resolution. Do not search for an undisclosed optimal subset. Shared Peace requires at least six such competitors, at least three clans among them, and useful aid between at least three distinct unordered clan pairs among that same set in the interval 50:00–60:00. Food must have been consumed, treatment completed for a real injury, or shelter used for at least 20 seconds while it reduced exposure or fatigue. Each aid event retains the participants and their clans at event time; post-lock clan membership is stable. Empty trades and repeated pairs do not advance the pair count. The panel shows the exact qualifying set and three counters without announcing a result early.

Religious conversion, fellowship membership, and Christ's survival are not conditions. If the criteria fail, the result is Unresolved with missing conditions listed. Shared Peace is a story ending and gives no clan championship or survival win. This ending can be reached without spawning the guest.

In a continuing competition, refusal to fight may cost a follower victory. A clan can still win through defense, opponents' withdrawal, or attrition. The episode never changes the declared victory conditions without a visible Custom rule change. A guest subject to the storm receives its actual effects; healing and story actions do not provide a hidden escape from the finale.

If Christ dies, a Gospel-inspired resurrection epilogue is available after the run has finalized and is on by default within the episode settings. It draws on Matthew 28 and is presented as an authored narrative coda outside the competitive simulation. It neither erases death and responsibility nor restores eliminated contestants, awards another win, or implies that reloading a save is the meaning of resurrection. If he lives or leaves, the episode uses a living departure and continuation of the teaching instead; no death is forced to unlock the coda.

The chronicle stores teachings heard and repeated, aid, refusals, commitments, persecution responsibility, and the episode outcome. Guest harm is a separate story event and never contributes to competitor kill leaderboards, combat assist totals, Glory, or Influence. Standard future runs reset the mechanical consequences of this episode while retaining its labeled archive. Legacy experiments may explicitly carry convictions or relationships forward with a recorded starting state.

### 17.11 Initial encounter templates

Each template exposes an opportunity that agents may accept or refuse. The controller supplies eligible dialogue and event hooks; it cannot invent a shortage, accusation, wound, agreement, or listener merely to start a scene. Ordinary scenes can recur with a cooldown, while the exceptional healing and persecution branch have their stated visit limits.

| Encounter | Eligibility | Possible consequence |
| --- | --- | --- |
| A meal for a stranger | A willing host has a real food reserve and a reachable outsider needs food | Share, ration, refuse, or discuss duty to outsiders; consumption is the contribution event |
| A gathering before the law changes | A known safe meeting place and enough time before an announced danger | Some attend, others prepare or leave; listeners may reconsider a plan |
| A wounded adversary | A reachable injured actor, an available aid opportunity, and lawful access | Ordinary treatment or the once-per-visit healing; witnesses respond individually |
| A leader's challenge | An actual dispute about authority, supplies, or a follower's refusal | Debate, accommodation, exclusion, or a recorded threat; no automatic hostility |
| Forgiveness after harm | A known commitment was broken or a recorded injury caused a grievance | Apology, restitution, refusal, or later reconciliation demonstrated by conduct |
| An accusation and its aftermath | A hostile actor adopts a specific accusation and acts on it | Escape, mediation, refusal to participate, interrupted attack, rescue, guest death, or continuation of teaching |

### 17.12 Release criteria for the episode

The episode must remain absent when not selected, run fully offline without an LLM, respect every harmful-action prohibition, and resolve without a follower, an opponent, a miracle, or a death if the conditions do not arise. Test receptive, skeptical, opportunistic, hostile, and indifferent profiles. Verify that a fellowship exceeding eight people does not create an oversized competing clan. Test guest arrival near a phase boundary, death during the finale, interrupted persecution, and a match ending with the guest alive.

Before this optional content ships, a narrative editor familiar with the canonical Gospels reviews the teaching catalog, exact quotations, contextual adaptations, Passion portrayal, and resurrection coda. This is a production content check; it does not require the player to approve doctrine or complete a religious tutorial. The prototype first proves a meal, a teaching response, a skeptical refusal, and a leader's concern using actual simulation state.


## 18 Fairness and exploit resistance

| Failure or exploit | Required response |
| --- | --- |
| Bots use hidden inventories or unannounced future laws | Restrict decision queries to the belief interface and test knowledge access |
| Invulnerable attackers fire out of sanctuary | Apply protection checks to both attacker and target |
| Traps or projectiles bypass a new truce | Validate effect creation and damage resolution against authoritative law state |
| Bots surround a victim during peace and attack without wind-up | Preserve legal wind-up; provide collision escape and threat-aware withdrawal |
| Everyone joins one clan | Enforce the public membership cap; retain individual acceptance decisions |
| Several capped clans act as one dominant coalition | Measure coalition outcomes; use finite final refuge and exclusive clan victory; tune costs or scenario rules openly if needed |
| A last-second merger creates a universal winner | Apply the announced membership freeze atomically |
| Repeated gifts or staged rescues farm prestige | Count useful outcomes, apply diminishing social returns, and cap commendation eligibility |
| Camera follow makes a favorite smarter or stronger | Keep equivalent simulation semantics regardless of presentation detail |
| Reloading multiplies career wins | Finalize each run once; retain branch lineage |
| Natural-resource or construction reservations never clear | Release on failure, death, expiration, departure, and cancellation |
| Generated dialogue claims an event that never happened | Ground to records, validate factual fields, and fall back when unsupported |

Do not secretly manufacture betrayal, injury, or bad luck to make a dull run exciting. Improve the underlying incentives, surface an overlooked story, or let the player choose a visible intervention. Standard generation and AI errors that prevent a viable contest must be recorded for diagnosis rather than disguised as emergent drama.

## 19 Saving accessibility and player comfort

Save complete simulation state, contestant beliefs, active plans, reservations, random-stream state, law schedules, event history, and pending result transactions. Include learned recipe procedures, custom votes, message IDs, witness evidence, thread progress, fellowship commitments, and all active guest encounter timers. Save/load must not restart a teaching benefit, healing allowance, persecution action deadline, or influence budget. Autosave at phase transitions and a configurable interval, using a rotating backup. Version saves and content profiles. If an update cannot safely continue an old match, retain its completed career archive and explain the compatibility boundary.

The core should support remappable controls, adjustable text size, high-contrast law boundaries, subtitles, non-color clan identifiers, optional reduced motion, and configurable event density. Pause remains available outside any optional challenge-specific restriction. No vital information depends only on sound or rapid camera movement. A photosensitivity-conscious presentation avoids intense flashing during repeated law transitions.

Favorite contestants can die. A player may continue watching, save the result, or branch into Custom to explore another outcome. Standard does not secretly protect favorites. Optional content settings can reduce blood and harsh audio without changing combat rules. Career progress is local first, with export or backup considered before cloud synchronization.

## 20 Scope and development sequence

### 20.1 Delivery stages

| Stage | Population and content | Evidence required to advance |
| --- | --- | --- |
| Behavior prototype | 12 identities; six recipes including three structures; three laws; one test map; coherent presentation kit | AI 01–10, law boundaries, readable waits, valid resource and action contracts |
| Performance and stack spike | 100 contestants plus 24 deer and 12 wolves; representative navigation, combat, law changes, and event load | Compare candidate runtime costs and packaging; headless batch runner and actual-rate display work |
| Vertical slice | 24 finished profiles; 30-minute Trial; clans, knowledge, trade, rescue, forecasts, two pressure interventions, dossiers | Comprehension and attachment test; complete match without debug intervention |
| Full roster alpha | All 100 authored competitors; 60-minute Standard calendar; full 28 recipes and 10 included modules | Full population, crowded refuge, deterministic records and save/load, 100-run telemetry |
| Guest and story slice | Stable core plus generic guest fixture, then Christ with a meal, teaching, skepticism, fellowship, and real leadership concern | Optional feature absence, independent reception, truthful evidence, law-compliant interruption |
| v1 release target | One island family; Standard, bounded Custom, tutorials, optional Christ episode, dossiers and Saga; no LLM dependency | Core gates and separate episode gates on declared hardware |
| Later work | Local interviews, Legacy, seasons, cinematic rewind, extra guests or biomes | Feature-specific evidence and explicit scope change |

The Christ episode remains part of the intended v1 content. It follows a stable social slice and has its own launch gate. If it is not ready, record an explicit revised delivery decision and date before announcing it; do not quietly remove the user's requested pathway or force a scripted substitute. No release date, artist availability, budget, or staffing commitment is assumed here.

### 20.2 Consolidated content budget

| System | v1 budget | Deferred scope |
| --- | --- | --- |
| World | One island family, six strategic terrain types, socketed sites, deer and wolves | Swimming, boats, freeform placement, spreading fire, weather simulation, reproduction |
| Crafting | 28 recipes total, of which 10 produce structure modules; three tiers; six combat equipment families | Large research tree, traps, procedural invention, within-run skill growth |
| Cast and society | 100 authored identities, ten skills, eight temperament axes, up to two quirks and two clan customs | Generated replacement cast, prisoners, permanent Standard power, elaborate rumor distortion |
| Player controls | Eight Standard intervention types, six Influence points, eight forecast templates, five follow slots | Renewable power, direct possession, physical Hand, multiplayer gods |
| Custom | Supported instant law edits, predefined resources, two commandments, three whisper proposals; declared finite or open endings | Arbitrary script execution; blessings, competitor resurrection, Open Stores and Glory Trial await specific implementation gates |
| Presentation | Parametric character kit, rendered portraits, 12 shared clips, 100 situations × three tone variants, state-driven ambience | Facial acting, full voice acting, generative voice, large cinematic pipeline |
| History | Six thread types, facts and relationship dossiers, epithets, notes, text or HTML Saga, scenario files | Seasons, Workshop, broadcast integration, complete rewind UI |
| Christ episode | One guest, eight themes, six encounters, fellowship, one healing, one persecution attempt, conditional coda and Accord panel | General custody, full Gospel campaign, active resurrection, religion technology tree |
| Conversation | Authored lines and lesson inspection, offline | One-at-a-time local LLM interview is stretch work |

These totals replace earlier ranges and must not be added to them. Structure recipes are already inside the 28 count. The profile examples specify the first 24; the remaining 76 profiles and final art combinations are an explicit content task. The game must prove behavior with the first 12 before multiplying authored variants.

### 20.3 Definition of implementation ready

The GDD fixes population, time, camera, interventions, initial economy, personality effects, wildlife, guest contract, and intent vocabulary. Engineering next selects the stack and benchmark machine, translates the fixtures into executable scenes, and versions the data schemas. Design owns subsequent parameter changes and their reasons. Presentation work begins with the behavior prototype, not after the full roster is complete.

## 21 Main production risks

| Risk | Why it matters | Response and gate |
| --- | --- | --- |
| AI cannot finish basic work reliably | More content multiplies failures | Prove survival and recovery scenes before adding recipes |
| Social behavior feels random | Players cannot form expectations | Require motives, commitments, and recorded trust evidence |
| One strategy dominates every map | Personality becomes cosmetic | Compare outcomes across seeds and laws; tune visible incentives |
| Nothing worth watching happens | Autonomy becomes background activity | Measure memorable events and comprehension in blind playtests |
| Bots build unusable settlements | Navigation failures corrupt all later behavior | Use validated modules and path-access tests |
| The finale forces too many draws | Competition feels unresolved | Tune area, movement, damage, timing, and bot urgency before adding tiebreakers |
| Persistent winners become unbeatable | Career attachment becomes progression imbalance | Keep Standard mechanical state reset and audit profile balance |
| AI performance collapses with 100 agents | The core pitch cannot ship | Run the population spike early; reduce map and content complexity before weakening decision correctness |
| LLM scope consumes core development | A stretch feature delays the actual game | Isolate conversation and require a separate go or no-go decision |
| Content production cannot distinguish 100 people | Roster size becomes a number rather than attachment | Validate identity recognition with 24 polished contestants first |
| Lost knowledge creates irreversible helplessness | One death can stall a clan for the wrong reason | Universal basics, alternatives, visible teachers and schemas, and a deliberate loss scenario |
| Story scope becomes a second game | Teaching, fellowship, and exceptional actions multiply content and edge cases | Enforce one guest and six templates; reuse actions, avoid custody, and gate the story slice separately |
| Christ becomes a generic persuasion buff | Portrayal loses both authenticity and meaningful agency | Gospel source records, stable commitments, practical service, skeptical responses, and narrative review |
| Persecution feels predetermined or rewarded | Bot autonomy and the episode's meaning collapse | Real accusations and decisions, interruptions, refusal paths, no guest-harm progression rewards |
| Story and competition records mix | Guest intervention or a peace ending inflates Standard achievements | Atomic mode classification, separate guest IDs, ending-specific credits, and idempotent finalization |

Additional risks introduced by this revision are tracked explicitly.

| Risk | Why it matters | Response and gate |
| --- | --- | --- |
| Forecasts become chores or self-fulfilling scores | More UI can distract from attachment and the player can influence outcomes | Optional panel, three slots, influence tags, clear denominators, no economic rewards |
| Connected staging areas still attract every clan | Spatial design cannot guarantee readable population distribution | Crowded 100-person fixture, selective labels, route variation, director suggestions; no forced occupancy cap |
| A prototype looks unfinished despite working AI | Playtesters may judge unreadable intent as bad reasoning | Ship the palette, camera, kit, labels, and audio cues in the behavior slice |
| Wildlife is omitted from performance estimates | 100 contestants is not the total simulation workload | Benchmark 136 core moving actors and 137 with the guest, plus projectiles and buildings |
| Religious portrayal or persecution affects reception and distribution | Optional content is still part of the public product | Before announcement, check actual chosen storefront submission and rating requirements, document portrayal and content settings, and complete narrative review; no acceptance or rating is assumed |

The last row is a production verification task, not a claim that a platform prohibits the episode. No current storefront or rating guidance is asserted in this GDD; the distribution plan must obtain and record the applicable requirements when its platforms and content are fixed.

## 22 Resolved design decisions and remaining production work

The following are the designer's v1 defaults. They resolve the review's questions so implementation can begin without another concept round.

| Topic | v1 decision | What could justify a later change |
| --- | --- | --- |
| Session and clock | 60 simulation minutes maximum; five 12-minute days; TUNE 30–45 active viewing minutes with mixed speeds | Measured pacing and recall across complete sessions |
| Population | 100 in Standard; 24-person introductory trial; 40-person comparative test | Evidence of attachment or performance failure, followed by an explicit product revision |
| Clan and finale | Eight-person cap, 50:00 lock, connected staging areas, last-clan victory and explicit draw | Measured coalition dominance, congestion, or draw rate; no hidden rule alteration |
| Camera | Constrained tabletop 3D with close follow | A usability test showing a specific camera limitation |
| Art availability | No external artist is assumed for a coherent first playable | A staffed art plan can upgrade the established kit |
| Story timing | Optional Christ episode retained in the v1 target, separately gated | Explicit documented rescheduling if its own gates fail |
| Languages | English first for content and tests; localization architecture immediately | Finnish or other launch text selected and budgeted in production |
| Music | Functional ambience and SFX first; score source undecided | Rights, budget, and actual listening tests |
| Platform | Offline Windows PC design target; Steam is a candidate storefront, not a publishing commitment | Technical packaging and distribution research |
| Wildlife | Deer and wolves, no respawn or reproduction | A concrete need for a different ecological decision |
| Tuning | Initial values and personality mapping are supplied in this GDD | Fixture and batch evidence recorded with each ruleset version |
| Technology | Compare representative TypeScript/WebGL and native feasibility; no automatic port plan | Headless correctness, performance, packaging, maintenance, and team fit |

Engine version, minimum hardware, final name clearance, rating, release date, hiring, art procurement, music selection, Finnish translation, and model licensing remain production decisions. None is silently presented as approved or completed. These do not block implementing the core fixtures and content schemas.

## 23 Example competition

### 23.1 A competition shaped by changing laws

This is an illustrative target sequence for a 24-contestant slice, not a scripted promise or a recorded test result. Its shortened finale preserves the same ordering and public notice rules as Standard.

During protected arrival, Mara the cautious builder locates a defensible clearing. Oren the cook proposes shared shelter in return for provisions. Sable scouts a nearby storehouse and notes when property protection expires. Kellan, a capable negotiator, recruits two independent gatherers with a credible plan for food security.

The player announces a two-minute cold front. Mara delays a planned weapon upgrade and builds shelter. Sable has enough food but inadequate clothing; waiting for a theft window is now less attractive. She trades observed resource information for a warm garment, then reassesses the storehouse.

When raiding becomes legal, Brann proposes attacking Mara's settlement. Ilya refuses because her estimate of the defenders is uncertain and a friend owes Mara a rescue. Brann recruits other willing members instead. The raid fails after the defenders close one approach; the attackers retreat rather than dying against the gate.

Kellan negotiates passage for a migrating clan. Later he receives a better offer, but breaking the passage agreement would cost the trust of two current followers. Whether he honors it depends on their actual relationship state, the gain, and the risk. The game does not force a betrayal for this example.

Before membership freezes, Sable leaves her failing clan and applies to Mara's. Acceptance depends on available capacity, known conduct, and useful supplies. If accepted, her scouting may help the group survive the refuge. If rejected, she remains a mobile one-person clan. The same authored identity supports either plausible outcome.

The final chronicle credits actual events: Oren's food consumed by teammates, the rescuer's completed revival, Brann's failed raid and subsequent survival time, and the winning clan's eligible members. It never awards Sable a betrayal merely because her profile is opportunistic.

### 23.2 A guest changes the social question

This is another possible sequence, not a promised plot. At minute 18 the player spawns Christ beside a migration route. The run becomes Story and the competition clock continues. Nessa has a bandage and sees a wounded rival; she already values care, so a lesson about the neighbor reinforces a feasible treatment plan. Tovin hears the same exchange, helps supply cloth, and declines fellowship. The difference is visible in their beliefs and conduct.

Oren later shares a meal. Senna objects because the pantry is nearing its reserve threshold; her concern points to real stock levels. Christ can acknowledge the shortage, ask willing members to gather, or leave with those seeking another shelter. The game does not make Senna cruel for questioning the plan. Kellan may negotiate a sharing limit; Sable may attend for access to a trade opportunity and leave without accepting the teaching.

If a leader responds to repeated departures with a concrete accusation, the story may become persecution. If the law still protects the guest, that leader can threaten or argue but cannot harm him. After protection expires, willing attackers might attack; others may refuse or rescue him. If he is downed, a specifically chosen lethal follow-up can create the contingent persecution outcome. A new lawful sanctuary cancels its preparation. No execution happens unless the necessary decisions, opportunity, and unbroken preparation actually occur.

As the finale approaches, fellowship members still face their selected ending. In a continuing competition they must migrate and decide whether to defend, yield, or preserve another life at a cost. In preselected Coexistence, three clans may accept the public peace proposal and demonstrate aid. Either route can fail, and both produce a chronicle grounded in what these particular people did.

## 24 Acceptance scenes and release gates

These are proposed pass conditions, not test results. Behavioral correctness gates apply before optional content expansion. Numerical experience and performance targets are TUNE hypotheses and should be revised with recorded evidence.

### 24.1 Required deterministic scenes

| ID | Controlled setup | Observable pass condition |
| --- | --- | --- |
| AI 01 | A hungry contestant has a known reachable food source and enough time to reach it | Acquires and consumes food without unrelated work causing avoidable starvation |
| AI 02 | A desired tool is missing but its materials and worksite are available | Completes a valid acquisition and crafting sequence with conserved resources |
| AI 03 | A protected target opens after a known delay | Patient profile may wait with a deadline; immediate-need profile selects a viable alternative |
| AI 04 | A publicly announced expiry is extended with legal notice | Relevant plan is invalidated and updated without an illegal attack or endless wait |
| AI 05 | The only known route becomes blocked | Chooses another route, target, or useful fallback and reports failure if none exists |
| AI 06 | Two clan members require the same scarce material | Reservations prevent duplication; one replans or a shared priority resolves the conflict |
| AI 07 | A stronger enemy appears during work | Reassesses promptly and selects a defensible response using observed information |
| AI 08 | A friend is downed with a feasible rescue route | Loyal and self-preserving profiles can choose different justified responses |
| AI 09 | A leader dies during a multi-person plan | Leadership and reservations recover; survivors do not remain indefinitely idle |
| AI 10 | Hidden enemies move beyond all valid perception | Bot knowledge does not update until a legitimate observation or report |
| LAW 01 | Projectile impacts on the tick a truce activates | Damage uses the new law and is blocked consistently |
| LAW 02 | Protected area boundary separates shooter and target | Neither side can exploit sanctuary to deal one-way damage |
| LAW 03 | Law expires while a bot is poised to attack | Normal legal wind-up occurs after permission opens |
| END 01 | Multiple clans receive lethal damage in the same tick | Result is independent of entity iteration order |
| END 02 | All remaining members are downed | No premature winner; recovery, bleed-out, or final storm resolves the state |
| END 03 | Membership change arrives on the freeze tick | Freeze installs first and invalidates the change |
| DATA 01 | Save, reload, finalize, then reload an earlier checkpoint | One Standard result; later branch cannot duplicate its credit |
| DATA 02 | Downing, revival, second fight, and elimination occur | Kill and assist attribution uses the correct episode |
| KNOW 01 | The sole knower of an advanced recipe dies before teaching it | Survivors retain basics, recognize the missing procedure, and find a legitimate alternative |
| KNOW 02 | A teaching action is interrupted, then completed later | No premature knowledge transfer; completion records teacher, learner, and procedure |
| SOCIAL 01 | A clan adopts a custom while a member is out of contact | An uninformed member is not accused of knowingly breaking it; notified members may refuse |
| SOCIAL 02 | A private intervention has no witnesses | No bot receives firsthand evidence without perception; later reports retain their source |
| STORY 01 | Episode disabled with the same seed and inputs | Core event sequence and results match the baseline; no guest AI, teaching effects, or story RNG changes |
| STORY 02 | Guest arrives on a law or phase boundary | Mode changes atomically, current permissions apply, and roster and winner eligibility remain correct |
| STORY 03 | Receptive, skeptical, opportunistic, and indifferent listeners hear a lesson | Reactions use individual state; refusal is valid; aid and religious affiliation remain distinct |
| STORY 04 | Hungry listeners and an approaching threat interrupt a gathering | Needs and danger cancel attendance; no indefinite sermon loop or free food |
| STORY 05 | More than eight people from rival clans enter fellowship | Clan caps, ownership, information limits, and competitive membership remain unchanged |
| STORY 06 | Truce activates during an ordinary guest attack or persecution preparation | Hostile action stops, bleed-out follows source policy, and no deferred lethal event fires |
| STORY 07 | Persecution initiator leaves or is downed, guest is revived, or bleed-out occurs first | Action cancels; the actual death cause is retained and no ordinary kill is relabeled crucifixion |
| STORY 08 | Healing is used, saved, and reloaded | Only one validated encounter per visit; no eliminated competitor returns and no storm damage is canceled |
| STORY 09 | Guest dies, lives, or is never spawned when the run ends | Correct departure or conditional coda; no guest K/A reward, duplicate credit, or mandatory death |
| STORY 10 | Coexistence reaches its deadline with qualifying aid or with staged empty trades | Only actual useful aid counts; Shared Peace or Unresolved is recorded; no competitive win |
| STORY 11 | A follower repeats a lesson and a generated line claims a false quotation | Teaching ID and source persist; unsupported wording cannot be presented as scripture |
| FORECAST 01 | Outcome occurs off-camera, on deadline, before creation, or after deadline | Only events after creation and through deadline count; reasons link to evidence |
| FORECAST 02 | Same seed and commands with forecasts, notes, and director toggled | Identical authoritative state hashes and outcomes; no observer state in beliefs |
| FORECAST 03 | Commit a forecast, intervene, reload, cancel, branch, or abandon | Sticky influence and branch flags; no duplicate credit; Correct/Incorrect/Canceled/Voided follow contract |
| TIME 01 | Cross all night, law, and Fog boundaries at 1x, 2x, 4x, and pause | Same ticks and outcomes; pause freezes all clocks |
| EXPO 01 | Night at open ground, fire, shelter, and Cold Front overlap | Accumulation and mitigation equal Section 30; ordinary shelter alone handles ordinary night |
| WILD 01 | A wolf threatens three contrasting contestants during Truce | Wildlife damage remains legal; justified fight, flee, or nearby-group response; 100 contestants remain the roster |
| INFO 01 | Herald activates after a clan moved food or lost its Hearth | Timestamped broadcast uses current authorized fields, stale bands age normally, no retarget or hidden inventory leak |
| LAW 04 | Storm Warning would isolate a safe component or stack with Fog | Invalid placement rejected; valid damage uses maximum hazard rate, with legal escape notice |
| LAW 05 | Paid amendments, maximum concurrency, expiry and lock collide | Six-point budget conserved; three active modifier cap; no protection extends beyond 50:00 |
| BUILD 01 | Fill every legal camp socket and remove its Hearth | All work positions and exits remain reachable; clan identity and permissions survive Hearth loss |
| SOCIAL 03 | Absent members miss a vote and later return; a member leaves under attack | Fixed electorate, explicit consent, notice before breach, and no fabricated betrayal |
| FINALE 01 | Several clans choose the same staging route and all 100 reach the refuge | No teleports, forced assignment, invalid paths, omitted damage, or missing priority labels |
| END 04 | One clan occupies the refuge marker while another survives | Standard declares no occupancy win; only last-clan or explicit draw resolution applies |
| END 05 | Departure ends at 49:55 or on 50:00; all survivors die in a terminal pulse | Cooldown truncates at lock; on-lock departure fails; simultaneous deaths cannot award an update-order win |
| ECON 01 | Two crafters compete for one bar and a worker dies mid-build | Quantities and reservations conserve; consumed inputs are not duplicated or refunded twice |
| AI 11 | Swap one trait between paired otherwise identical fixtures | Relevant considerations change as specified; survival competence and knowledge access remain equal |
| PRESENT 01 | Day/night, forest, dense camp, 100-person finale at 100 and 150 percent text scale | No critical clipping; selected identities, boundaries, actions, and waiting states remain readable |
| STORY 12 | Accord includes late acceptances, a violator, victims, and useful aid across pairs | Public qualifying set matches the final evaluator; no hidden subset search or religious requirement |

Use fixed random seeds and controlled fixtures for these scenes. Exact same-build reproducibility is a development target. Cross-platform bit-for-bit replays are not promised. Tests must exercise outcomes and invariants, not merely mirror individual scoring functions.

### 24.2 Population and performance targets

On a benchmark PC whose exact CPU, GPU, memory, operating system, and build are recorded, target 60 rendered frames per second at 1080p in ordinary 1x observation with 100 contestants plus 24 deer and 12 wolves, including a crowded finale. At the 95th percentile, total CPU frame time should fit a 16.7-millisecond budget, with TUNE no more than five milliseconds spent on AI decision and coordination work. Navigation, physics, rendering submission, and other systems require separate measured budgets. These are engineering targets, not minimum system requirements. The Story benchmark must repeat the population and crowded-scene workloads with 100 competitors, 36 wildlife actors, and the guest, including listeners and fellowship messages; 137 moving actors plus structures and effects is the separate Story workload.

Urgent local threats should produce a decision response within TUNE 0.5 simulation seconds at 1x; ordinary replans after a public law change should complete within TUNE one simulation second. Camera position must not change these contractual semantics. If 4x cannot sustain complete simulation steps, reduce achievable acceleration and show the actual rate rather than skipping authoritative outcomes.

The full-roster gate runs at least 100 varied fixed-seed Standard matches with scripted legal intervention schedules, including crowded refuges and simultaneous law changes. Require zero illegal damage, duplicate transfers, duplicated career results, or unresolved simulation deadlocks. Investigate every avoidable opening death and every contestant stuck longer than TUNE 10 simulation seconds without an intentional waiting plan or meaningful fallback.

At least TUNE 95 percent of the automated baseline Standard batch should produce a winner before the hard cutoff; this target excludes deliberately stalemated Custom/Story scenarios and is not a guarantee for every lawful player schedule. Include passive and coalition-heavy legal schedules as separately reported stress sets; all other matches must end as explicit draws within the defined maximum. Record outcomes by identity, spawn conditions, clan size, alliance size, equipment tier, and intervention pattern. A low win rate alone is not an AI bug, but persistent dominance or failure across conditions requires explanation and review.

### 24.3 Player comprehension and attachment

In an initial test with TUNE 10 new players, target at least eight who can identify three contestants after a short observed session, correctly explain two consequential decisions, and understand the next law transition without developer coaching. Ask each player which contestant they want to follow again and why. Record behavior and recall rather than relying only on a general enjoyment score.

Advance from the vertical slice only when sessions produce several remembered events from actual systems and players can distinguish deliberate waiting from failure. If the AI is technically correct but unreadable, prioritize animation, intent labels, pacing, and camera tools before adding more personality dimensions. In the story slice, ask players to distinguish a law from a teaching, identify why two listeners reacted differently, and explain the selected ending. Check that they understand spawning is optional and cannot mistake the player for God the Father in the portrayal.

### 24.4 Optional conversation gate

Run at least TUNE 100 scripted factual probes across current and previous runs, including false premises, unknown events, identity confusion, and attempts to issue unsupported commands. Canonical displayed statistics must have zero mismatches; the simulation must accept zero unauthorized mutations. Human review checks whether dialogue preserves character, admits uncertainty, and avoids unsupported memories. Measure generation latency and peak memory on the intended hardware while the game is loaded. Ship the stretch feature only if these results justify it; otherwise retain contextual dialogue.

## 25 Reference rationale

The references establish relevant precedents. All rules, numeric values, scope choices, and implementation contracts above are proposals for The Last Clan rather than claims that another game already implements this combination. The v0.2 source set is retained; selected Gospel and AI references were rechecked during v1 preparation on 10 September 2026. No sales forecast or market-size claim is made.

| Reference | Relevant precedent | Design use |
| --- | --- | --- |
| Valheim | Exploration, crafting, settlements, biome threats, boss progression | Resource access and equipment create reasons to travel and cooperate |
| Rust | Environmental and interpersonal survival pressure, bases, raids | Camps and possessions create stakes for negotiation and conflict |
| Black and White | Divine interaction and a creature shaped by teaching | Emotional relationship between observer and autonomous inhabitants |
| RimWorld | Needs, backgrounds, relationships, and story-producing events | People and understandable consequences remain central |
| WorldBox | World creation and observation of interacting civilizations | Accessible intervention and an overview of changing groups |
| Dwarf Fortress | Personalities, history, and interacting simulation systems | Durable consequences and an inspectable chronicle |

Sources: [Valheim official site](https://www.valheimgame.com/), [Rust official site](https://rust.facepunch.com/), [Black and White historical overview](https://en.wikipedia.org/wiki/Black_%26_White_%28video_game%29), [RimWorld official site](https://rimworldgame.com/), [WorldBox official site](https://www.superworldbox.com/), and [Dwarf Fortress developer and publisher store page](https://store.steampowered.com/app/975370/Dwarf_Fortress/).

For engineering, the primary references are [Graham on utility theory](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter09_An_Introduction_to_Utility_Theory.pdf), [Orkin on planning in F E A R](https://www.gamedevs.org/uploads/three-states-plan-ai-of-fear.pdf), [Park and colleagues on generative agents](https://arxiv.org/abs/2304.03442), and the [llama.cpp project documentation](https://github.com/ggml-org/llama.cpp). Their specific relevance and limits are described in Sections 15 and 16.

Internal inputs are The Last Clan GDD v0.2, its supplied design review dated 10 September 2026, and the earlier The Last Clan v0.1 and VIVARIUM v0.1 drafts. They are design proposals, not external evidence of technical feasibility. Section 27 makes their integration traceable. No unverified market numbers, engine-port cost estimate, or performance claim from either draft is adopted as a fact.

The Christ episode uses the canonical Gospel passages linked in Section 17. Its English quotation source is the public-domain [World English Bible](https://ebible.org/engwebp/); source and translation metadata remain attached to every exact quotation. The simulation-awareness premise, island encounters, mechanical limits, and ending rules are original fictional design choices rather than claims made by those passages.

## 26 Initial contestant authoring examples

These 12 profiles are proposed prototype identities, with stable provisional IDs. They establish behavioral contrasts for testing. Their skill numbers, appearance, biography, and final naming should be authored together, with no prefilled career achievements.

| ID and name | Strength and tendency | Tension to test |
| --- | --- | --- |
| C001 Mara | Builder; cautious, patient, loyal | Overinvests in defense unless the migration forecast outweighs her preference |
| C002 Oren | Cook; generous and ambitious | Balances feeding outsiders with keeping enough reserves for his own clan |
| C003 Sable | Scout; independent and opportunistic | Waits for favorable law windows but abandons them when survival costs rise |
| C004 Kellan | Negotiator; sociable and calculating | Weighs profitable new offers against commitments and followers' trust |
| C005 Ilya | Archer; observant and loyal | Refuses weakly supported plans yet risks herself for a known friend |
| C006 Brann | Fighter; assertive and impatient | Learns to retreat from failed assaults without losing his appetite for initiative |
| C007 Nessa | Healer; reserved and compassionate | Offers aid across clan lines when the practical rescue risk is acceptable |
| C008 Tovin | Crafter; methodical and possessive | Shares valuable equipment when cooperation is worth more than ownership |
| C009 Edda | Forager; adaptable and independent | Can survive alone but recognizes when protection becomes worth joining |
| C010 Rook | Defender; brave and distrustful | Protects members while requiring credible evidence from potential recruits |
| C011 Senna | Organizer; patient and status-conscious | Distributes labor effectively but may challenge an ineffective leader |
| C012 Varo | Scavenger; cautious and persistent | Exploits abandoned resources without following danger beyond a viable escape |

Each full profile must additionally define a primary and secondary skill, preference strengths, a short personal ambition, a few contextual speech patterns, distinctive visual cues, and at least one controlled scene that could disprove the intended behavior. Shared baseline competence is mandatory. The authoring process should create surprising combinations and credible weaknesses rather than 100 slight variants of a fighter.

### 26.1 Additional introductory identities

The curated 24 consists of C001–C024. These additions broaden the first-session contrasts without increasing the Standard roster beyond 100. Primary/secondary skill names use the skill table in Section 6. Every biography, quirk, and final kit combination remains a validated content record before implementation.

| ID and name | Primary and secondary | Behavioral contrast to test |
| --- | --- | --- |
| C013 Ada | Medic and Scout | Cautious aid: scouts a rescue route before committing |
| C014 Dain | Gather and Build | Distrustful producer: stocks personal supplies but accepts a fair work agreement |
| C015 Liora | Negotiate and Cook | Loyal mediator: offers reciprocal aid without denying a partner's breach |
| C016 Merek | Melee and Gather | Patient fighter: guards a retreat instead of chasing a weak target |
| C017 Anja | Build and Craft | Restless builder: prefers a viable temporary camp before an early migration |
| C018 Corin | Ranged and Hunt | Risk-tolerant hunter: takes a dangerous food route with a withdrawal point |
| C019 Esme | Cook and Medic | Possessive caregiver: keeps an emergency reserve while helping a rival |
| C020 Hald | Scout and Negotiate | Independent explorer: relays verified information for a concrete return |
| C021 Mira | Craft and Build | Generous craftsperson: teaches the only advanced procedure before a raid |
| C022 Toren | Hunt and Melee | Sociable provider: organizes paired hunting and notices absent support |
| C023 Vela | Negotiate and Scout | Ambitious skeptic: can refuse fellowship and still broker safe passage |
| C024 Noll | Gather and Cook | Loyal low-status worker: refuses an unsafe order without instantly abandoning friends |

The initial twelve use these primary/secondary pairs: Mara Build/Craft; Oren Cook/Negotiate; Sable Scout/Gather; Kellan Negotiate/Scout; Ilya Ranged/Scout; Brann Melee/Hunt; Nessa Medic/Cook; Tovin Craft/Build; Edda Gather/Scout; Rook Melee/Build; Senna Negotiate/Build; Varo Gather/Craft. These replace informal role labels as the actual skill IDs.

## 27 Review decisions and retained merge choices

Accept means included substantially as proposed; Adapt means included with the stated changes; Defer means outside the committed v1 scope; Reject means not used for Standard. This table resolves all proposals in the supplied review, including its additional D13 and D14 notes. Section references identify the integrated contract, not a separate change request.

| Review ID | Decision | Treatment and reason |
| --- | --- | --- |
| A1 Forecasts | Adapt | Free three-slot predictions with evidence, eligibility, deadlines, influence flags, and separate observer records; no incentive farming (11, 24). |
| A2 Intervention range | Adapt | Add Storm Warning and Herald for eight types and six points; defer Glory Trial until exploit testing (10, 11). |
| A3 Arrival | Adapt | First night at 08:00 and visible 10:00 bell; retain ten-minute opening until an eight-minute experiment has evidence (3). |
| A4 Why panel | Accept | Real chosen reason plus two evaluated alternatives, with source age; focused relationship overlay (13). |
| B1 Smaller default | Reject for Standard | Preserve the explicit 100-contestant pitch. Use 24 for onboarding and 40 for comparison/Custom, with separate records (1, 3, 20). |
| B2 Time model | Adapt | Five 12-minute days, eight daylight/four night, fixed 60-minute deadline, TUNE 30–45-minute viewing target (3, 30). |
| B3 Pockets and cap | Adapt | Connected staging areas with escape validation. Keep cap eight; test twelve separately. Never enforce a pocket occupancy ceiling (3, 24). |
| B4 Beacon victory | Defer | Standard retains last-clan survival. A future Custom occupancy experiment must declare its own ending (3). |
| C1 Presentation baseline | Accept | Palette, camera, UI, rendering, audio, and visual QA are behavior-prototype deliverables (14). |
| C2 Character kit | Accept | Authored parametric combinations and portraits rendered from the same kit (14). |
| C3 Readability | Adapt | Zoom-dependent priority; mandatory icons and intent templates plus 12 shared clips. Animation retains explicit budget (14, 31). |
| C4 Tabletop camera | Accept | Constrained-pitch 3D, yaw, zoom, and same-camera close follow (14). |
| C5 Procedural world | Accept | Low-poly terrain, instancing, projected boundaries, restrained Fog and night rendering (14). |
| C6 Adaptive audio | Accept | Four ambience states, hysteresis, meaningful law cues, explicit source decisions (14). |
| D1 Wildlife | Adapt | Deer and wolves, den leashes, finite populations, no respawn; count all 36 in performance (4, 24, 30). |
| D2 Skills | Accept | Ten named skills, three fixed bands, limited nonstacking effects (6). |
| D3 Personality mapping | Adapt | Eight defined mappings, normalized scores, bounded values/quirks, inertia and emergency priority (6). |
| D4 Dialogue budget | Adapt | 100 situations × three tones rather than 150 × five; localization keys from the start (14). |
| D5 Economy values | Accept | Embedded initial tuning and 28-recipe manifest, all unproven and versioned (30). |
| D6 Water | Accept | Deep water impassable; shallow crossings only (4). |
| D7 Concealment | Accept | Terrain, night, illumination, and stale knowledge; no crouch subsystem (4, 7, 30). |
| D8 Building sockets | Adapt | Socketed construction remains the v1 baseline, not only a disposable prototype (5). |
| D9 Betrayal | Accept | Real obligations; abandonment under attack needs a knowingly broken duty (8). |
| D10 Weather | Accept | No ambient rain or wetness; day/night and announced Cold Front only (3, 4). |
| D11 Rest | Accept | Need thresholds, safe rest targets, guard requests, shifts and relief (4). |
| D12 Departure | Accept | Design-owned morale/trust thresholds enable deliberation without forcing a departure (8). |
| D13 Public fact class | Accept | Arena Broadcast with timestamp and current uncertainty, used by Herald (7, 10). |
| D14 Perception cost | Accept as tech requirement | Spatial queries and staged cadence measured with real obstruction and all wildlife (15, 24). |
| E1 Statistical continuity | Accept | Verified head-to-head records, rescuer links, streaks, epithets; no Standard power bonus (12). |
| E2 Seasons | Defer | Career history first; later seasons need explicit participation accounting (12, 20). |
| E3 Curated 24 | Adapt | Eight-person lesson followed by curated 24-person Trial; can skip directly to The Hundred (13, 26). |
| E4 Overseer notes | Accept | Player-authored notes in Saga, labeled separately from verified facts (12). |
| F1 Generic guest | Accept | Neutral actor contract, Christ as first shipping portrayal, hermit as a development fixture (16). |
| F2 Cheaper persecution | Adapt | Remove custody; use downed/rescue and interruptible lethal action. Preserve an explicit crucifixion event, never relabel ordinary death (17). |
| F3 Reception and platforms | Accept | Production risk and pre-announcement verification task; no assumed rating or storefront approval (21). |
| F4 Episode timing | Retain v1 target | User-requested optional episode stays in v1 with a separate gate and explicit rescheduling if necessary (20). |
| F5 Accord | Adapt | Visible signatories and deterministic qualifying set, useful aid counters, conduct window, no hidden subset search (17). |

The technical review notes G1–G7 are adopted as requirements or investigations: schemas, executable fixtures, deterministic tick order, representative stack comparison, priority AI scheduling, snapshot/input replay, and batch telemetry. High-level events alone are insufficient to replay a run. None of these notes is evidence that a technology has already passed the workload (15, 24).

Retained VIVARIUM decisions from v0.2 are advanced teachable knowledge with universal basics; Hearth coordination without land monopoly; voluntary customs and source-tagged beliefs; six story threads and Saga export; observation-only Focus; optional Auto-Director; versioned scenarios; and a headless authoritative core. Renewable worship power, permanent Standard stat growth, camera-dependent outcomes, forced dramatic events, and an assumed inexpensive engine port remain rejected. Hand manipulation, general prisons, creatures, broad extra modes, multiplayer, and freeform construction remain deferred. The Christ episode remains a user-requested addition, not a feature inherited from VIVARIUM.

## 28 Shared vocabulary

| Term | Meaning in this document |
| --- | --- |
| The Hundred | The stable roster of 100 fictional competitors; a particular tutorial or prototype may use fewer |
| Contestant | A competing actor with a career identity, clan membership, and current life instance |
| Guest | A noncompeting actor; G001 is the optional Christ portrayal and does not occupy a roster or clan slot |
| Clan | A bounded competitive membership group; even one contestant forms a clan |
| Alliance | A breakable agreement between separate clans; it does not merge winner eligibility |
| Fellowship | A voluntary network organized around teaching and conduct; it can cross clan and alliance boundaries |
| Hearth | A clan's chosen home and coordination anchor; survival does not depend on owning one |
| World law | An authoritative physical permission or parameter, with explicit time and scope |
| Social commandment | A player-proposed behavioral expectation in Custom or Story; bots may refuse or breach it |
| Clan custom | A locally adopted social policy, with notice, voluntary responses, and visible consequences |
| Influence | The player's bounded Standard intervention budget; it is not faith or a contestant persuasion score |
| Conviction | A character belief or commitment that affects deliberation; it does not override world permissions |
| Chronicle and Saga | The verified event archive and its readable story-oriented presentation |
| Standard, Custom, Story, Legacy | Record categories that preserve how the player and prior history affected a run |
| Forecast | A player prediction resolved from events; never a command or bot belief |
| Accord | The visible voluntary cooperation proposal used by preselected Coexistence |
| Simulation time | Authoritative time advanced by game ticks; independent of camera and wall-clock pauses |
| TUNE | A proposed numerical value requiring prototype evidence, not a measured result or final promise |

## 29 Version record and technical handoff

Version 0.1 established the autonomous competition. Version 0.2 integrated selected VIVARIUM systems and the optional Christ episode. Version 1.0 adopts the reviewed player-agency and presentation improvements, supplies the missing system definitions, and resolves population, time, finale, guest scope, and initial balance inputs.

This complete document supersedes v0.2. The review remains an input rather than an automatic change order. Sections 1–24 define the product and gates; Sections 25–28 provide sources, profile examples, decision traceability, and vocabulary; Sections 30–31 supply concrete tuning and intent authoring inputs for the technical plan. All TUNE values and benchmark targets are hypotheses. Writing the GDD has not implemented, simulated, or validated the game.

The next deliverable should be a technical plan tied to these action contracts and scenes. It must select the first runtime, define map and navigation representation, declare subsystem ownership and schemas, budget the full actor workload, specify saves and tests, and sequence a coherent visible prototype. It should identify any design conflict before coding around it. A failed fixture should produce a reproducible scene, not a new invisible exception to the rules.

## 30 Initial tuning and content manifest

### 30.1 Units and authority

Every number in this section is TUNE, a coherent initial fixture value rather than measured balance. Seconds and minutes always mean simulation time. Distances are world metres. One carry unit is a game weight unit, not a claim of physical kilograms. HP means health points. All rates apply with the fixed timestep; fast-forward never reduces consumption or work duration. This section is the numeric source of truth if an earlier illustrative example is less precise. A changed number requires a new tuning version and an updated fixture where relevant.

### 30.2 Movement needs and perception

| Parameter | Initial value | Consequence or boundary |
| --- | --- | --- |
| Island extent | Roughly 800 × 800 metres | Navigable end-to-end path 840–1260 metres; validate 4–6-minute unburdened crossing, not straight-line distance |
| Walk and sprint | 3.5 and 5.0 metres/second | Sprint drains 12 stamina/second; ordinary walking restores 6/second when not attacking |
| Carry load | Soft limit 16, hard limit 24 units | Above 16, linear speed penalty to 0.70 at 24; no pickup over the hard limit |
| Starting state | 100 HP, 100 stamina, food 85, fatigue 10, exposure 0, morale 65 | No starting combat gear; two berry units and ordinary clothing; equal material start independent of identity |
| Food | 0–100 fullness; minus 6/minute | Below 25, ordinary HP recovery stops; at zero, lose 8 HP/minute |
| Eating | 3 seconds; consume one item at completion | Berry +18, raw meat +12, cooked ration +35, trail ration +32; cap fullness at 100 |
| Ordinary recovery | 3 HP/minute while resting, food at least 25, exposure below 60 | No in-combat regeneration; bandage cannot repeatedly manufacture combat HP |
| Fatigue | +8/minute working or fighting, +4 travelling, +2 idle | At 80 or more, stamina maximum becomes 70 and work duration rises 15 percent |
| Rest | Minus 45 fatigue/minute, ending at 25 | Emergency interruption and guard behavior remain authoritative |
| Exposure | +12/minute at night; additional +24 during Cold Front | Shelter minus 24, within 8 metres of lit fire minus 24, warm cloak minus 12; stack mitigation to zero minimum accumulation |
| Exposure recovery | Minus 20/minute whenever net accumulation is zero | Exposure range 0–100; at 80 or more lose 10 HP/minute |
| Day and night sight | 32 and 20 metres for actors | Terrain concealment multiplies range by 0.65; dense geometry can obstruct entirely |
| Sight directions | 160-degree forward field plus unobstructed 8-metre awareness radius | Hearing and recent damage can turn attention; no perfect 360-degree long-range vision |
| Revealed cues | Attack or sprint reveals the actor for 3 seconds | Removes concealment reduction within valid sight; never sees through solid obstruction |
| Fire visibility | Fire glow detectable to 60 metres; illumination radius 10 metres | Lit actors use up to day sight range when unobstructed; fire location is not a stockpile report |
| Hearing | Work 12 metres, speech 15, combat/alarm 35 | Approximate event location with 5-metre uncertainty; no inventory or unseen participant list |
| Resting perception | Half usual sight and hearing ranges | A heard alarm or nearby received damage interrupts sleep |
| Interaction distance | 2 metres | Participant and work-position access is rechecked at completion |

Stamina is local exertion and fatigue is accumulated need. At zero stamina, sprint and heavy attacks are unavailable; walking and defensive retreat remain possible. Morale and trust use the departure and trust rules in Section 8. Need-related downing uses ordinary downed rules; final storm is the explicit terminal exception. Starvation and exposure are separate damage sources, so Truce cannot pause them.

A night lasting four minutes adds 48 exposure without shelter or fire. Ordinary night is survivable long enough to find a camp; a two-minute Cold Front plus night adds 72 exposure before mitigation. These arithmetic checks show why timing, fuel, clothing, and rest can matter without a hidden weather penalty. Actual behavior must still be tested.

### 30.3 Resource generation and conservation

The seed starts with 64 berry patches of six items each, 80 tree nodes of eight wood, 60 stone nodes of six stone, 60 fiber patches of six fiber, and 12 ore deposits of six ore. Distribute at least 32 small camp sites, 12 large camp sites, and sufficient field sockets along viable routes. Small camps have six module sockets; large camps have twelve. Two lean-tos can shelter an eight-person clan. Site occupancy does not grant a monopoly over nearby resources.

Berry patches regenerate one item every 180 seconds, capped at six; fiber regenerates one every 240 seconds, capped at six. Timber, stone, ore, and animals do not regenerate during the match. An unsafe node can still be harvested at actual risk until depleted; it is never silently teleported into safe territory. Bountiful Ground adds one berry per successful harvest while consuming the same one node item and logging the declared additional yield. It does not accelerate regeneration or refill inventories instantly. That exception to ordinary transfer conservation is explicit event-generated production, not duplication.

Universal bare-hand harvesting takes 10 seconds per item; a stone tool reduces wood/stone/fiber harvesting to 8 seconds, and a metal tool to 6. Food harvesting takes 6 seconds regardless of tool. Ore needs a stone or metal tool and takes 12 or 9 seconds. Apply the one relevant skill multiplier afterward. Each node supports at most two workers at distinct work positions. Animals yield a finite carcass; butchering takes 12 seconds. Deer yield four raw meat, wolves two. All carcass quantity is reserved and consumed through normal transfers.

Basic material items weigh one carry unit; berries and prepared food 0.5, raw meat one, arrows 0.1, metal bars two. Equipment weights appear in the recipe manifest. Wood fuel burns one item per 90 seconds; a fuel bundle weighs one and provides 180 seconds from its two wood inputs, improving transport without creating energy. All tools and weapons are reusable in v1; durability simulation is deferred. Arrows and breaching kits are consumed when used. Missed arrows are not recoverable in v1.

At 100 contestants, fullness consumption is 600 points/minute. Sustaining everyone on berries alone would require about 33.3 berries/minute; 64 patches regenerate about 21.3/minute before inaccessible terrain or contention. Starting food, initial patch stocks, hunting, cooking, mortality, and relocation bridge the difference. This is an intentionally finite baseline, not proof that every seed is fair. Early edible supply is validated per spawn neighborhood, and late reachable supply is checked against survivor telemetry rather than tuned to rescue a particular clan.

Before accepting a seed, each contestant has a reachable opening food patch within 45 walking seconds and a plausible camp within 90. Overlapping neighborhoods must have aggregate food capacity, including starting inventories, for the modeled first six minutes; validating each contestant against the same single berry is insufficient. Every initial region has wood, fiber, and stone access without crossing a den. At least three separated ore sources remain reachable at 25:00. Advanced production is optional for reaching the refuge.

### 30.4 Combat and wildlife values

All ordinary contestants have 100 maximum HP. Damage listed below is before armor. An ordinary hit reaching zero HP first downs a standing target. A downed target is eliminated by any subsequent permitted damaging hit, completed lethal follow-up, expired bleed-out, or terminal storm. Damage in the same tick that causes downing is one simultaneous batch and cannot also count as a subsequent hit. Continuous sources retain their origin. No passive weapon bleed status ships initially; the downed timer is the initial bleeding system.

| Equipment or actor | Damage and timing | Tactical limits |
| --- | --- | --- |
| Unarmed | 5 damage; 0.8-second wind-up, 1.2 recovery | 1.3-metre range; 6 stamina |
| Club | 12 damage; 0.8 wind-up, 1.4 recovery | 1.6 metres; 10 stamina |
| Spear | 14 damage; 0.8 wind-up, 1.6 recovery | 2.4 metres; 12 stamina |
| Iron blade | 16 damage; 0.6 wind-up, 1.4 recovery | 1.7 metres; 12 stamina; advanced procedure required |
| Bow | 16 damage; 1.2-second aim, 1.8 recovery | 22-metre range, 18 metres/second projectile, 4-degree base spread; one arrow and 8 stamina |
| Shield | Blocks 40 percent of frontal damage when guarding | 100-degree front arc; 8 stamina per blocked hit; no block at zero stamina |
| Light and reinforced armor | 10 and 20 percent ordinary damage reduction | No reduction for starvation, exposure, Fog, or terminal pulses; shield and armor reductions apply multiplicatively |
| Breaching kit | 60 damage to one hostile module after 6-second action | One kit consumed; 2-metre range; cannot target actors; protection cancels before consumption |
| Deer | 35 HP; 4.2 metres/second flee speed | No attack; stamina-independent short wildlife flight, then return to forage if safe |
| Wolf | 45 HP; 3.8 metres/second chase speed | Bite 8 damage, 0.7 wind-up/1.5 recovery, 1.5-metre reach; 45-metre den leash |
| Ordinary Fog and Storm Warning | 3 HP/second outside current safe mask or inside warning region | Highest overlapping hazard only; no armor reduction; ordinary downed injury rules |

Combat moves, misses, blocking, stamina recovery, and local numbers determine actual fight duration. A spear needs eight unarmored hits to down a full-health target: roughly 19 seconds of complete cycles before movement, evasion, or rest. This fits the 15–35-second readability hypothesis without making it a universal guarantee. Melee hits check range, line of sight, facing, law, and target state on the hit tick. Bows additionally resolve projectile intersection, not an automatic hit percentage.

A downed actor has a 30-second bleed-out timer. A bandage revive takes six seconds before Medic modifiers, consumes one bandage only on completion, restores 25 HP, and applies a 30-second wound penalty of 0.85 movement and 0.85 maximum stamina. Reviving clears the previous downing episode. A deliberate ordinary finish takes a two-second wind-up against a downed target. Truce and Sanctuary block sentient finishes, pause sentient-origin bleed-out, and remove any future declared hostile status; wildlife and needs keep their own timers. Downed actors do not crawl in v1, reducing movement and rescue complexity.

A bandage used on a standing injured actor takes six seconds and restores 10 HP once per combat episode; it cannot exceed maximum health or heal during terminal pressure. Christ's once-per-visit exceptional healing is a six-second interruptible aid action that restores the target to 75 HP or its higher existing HP, clears the ordinary wound penalty, and revives a downed living target. It consumes the visit allowance on successful completion, uses no bandage, cannot affect an eliminated actor, and fails once terminal pressure starts. This is an explicit Story exception recorded separately from ordinary medical work.

### 30.5 Recipe manifest

Recipes R01–R18 produce portable items; R19–R28 produce the ten structure modules. Ordinary clothes, raw resources, and carcasses are not recipes. Starter knowledge includes R01–R04, R06, R08–R11, R16–R24, and R27–R28. Established recipes R05, R07, and R12–R15 require their named procedure; multiple initial specialists and recoverable schematics provide independent access. Procedures for R25–R26 also require explicit learning. Skills alone do not grant a procedure.

Materials are W wood, S stone, F fiber, O ore, M metal bar, B berry, and R raw meat. Quantities are consumed once on completion except construction, which consumes half the raw-material cost at the 50-percent work point, rounded down per input, and the remainder at completion. Reservations lock the full required amount before work starts. Canceling construction returns only unconsumed reserved items. Existing partial input value is represented in the unfinished module and cannot be refunded twice.

| Recipe | Inputs and work time | Output and requirement |
| --- | --- | --- |
| R01 Stone tool | 2 W, 2 S, 1 F; 12 seconds | One tool, weight 2; field craft |
| R02 Club | 3 W; 10 seconds | One club, weight 2; field craft |
| R03 Spear | 2 W, 1 S, 1 F; 15 seconds | One spear, weight 2; field craft |
| R04 Arrow bundle | 1 W, 1 S, 1 F; 12 seconds | Five arrows; field craft |
| R05 Bow | 3 W, 3 F; 25 seconds | One bow, weight 2; known Bow procedure and workbench |
| R06 Shield | 3 W, 2 F; 20 seconds | One shield, weight 3; workbench |
| R07 Iron blade | 2 M, 1 W; 25 seconds | One blade, weight 2; known Smith procedure and workbench |
| R08 Bandage | 2 F; 10 seconds | One bandage, weight 0.5; field craft |
| R09 Cooked ration | 1 R; 8 seconds | One ration; active fire with fuel; burns ordinary fuel over action time |
| R10 Trail ration | 2 B; 10 seconds | One ration; field craft; less nutrition than eating both berries, lower carry weight |
| R11 Warm cloak | 6 F; 25 seconds | One cloak, weight 2; workbench; replaces ordinary outer garment |
| R12 Light armor | 5 F, 2 W; 25 seconds | One armor, weight 3; known Armor procedure and workbench |
| R13 Reinforced armor | 1 light armor, 2 M; 35 seconds | One armor, weight 5; known Armor procedure and workbench |
| R14 Metal tool | 2 M, 1 W; 25 seconds | One tool, weight 3; known Smith procedure and workbench |
| R15 Metal bar | 2 O, 1 W; 15 seconds | One bar; known Smith procedure and forge; wood is the explicit smelting fuel |
| R16 Breaching kit | 3 W, 3 S, 2 F; 25 seconds | One consumable kit, weight 5; workbench |
| R17 Fuel bundle | 2 W; 6 seconds | One transport-efficient fuel bundle, weight 1; field craft |
| R18 Torch | 1 W, 1 F; 8 seconds | One torch, weight 1; field craft; 90-second active light, then consumed |
| R19 Hearth | 4 W, 3 S; 20 seconds | Fire/home anchor, 80 HP; one clan owner, lit only with fuel |
| R20 Lean-to | 6 W, 4 F; 25 seconds | Four rest positions, 90 HP; shelter mitigation while occupied |
| R21 Storage | 5 W, 2 F; 20 seconds | 64 weight-unit capacity, 100 HP; explicit access permissions |
| R22 Workbench | 8 W, 3 S; 30 seconds | Two work positions, 120 HP |
| R23 Palisade segment | 6 W; 20 seconds | 100 HP; approved perimeter sockets only; no final-corridor obstruction |
| R24 Gate | 6 W, 2 F; 25 seconds | 100 HP; opens to permitted members; valid alternate exit required |
| R25 Cooking station | 6 S, 4 W; 30 seconds | Two ration work positions, 120 HP; known Kitchen procedure, fuel required |
| R26 Forge | 8 S, 4 W; 35 seconds | One smelting position, 160 HP; known Forge procedure |
| R27 Lookout | 10 W, 2 F; 35 seconds | One guard position, 100 HP; visible vantage, no magical sight radius bonus |
| R28 Communal table | 6 W; 20 seconds | Four meal/meeting positions, 80 HP; existing aid and gathering actions |

The forge construction procedure and Smith item procedure are separate prerequisites. Each Standard seed supplies at least three geographically separated holders or recoverable schematic instances of each established procedure, with universal lower-tier alternatives. Learning the procedure needs no worksite; making its outputs still does. Scenario validation reports the exact supply of procedures rather than silently granting knowledge after a specialist dies.

Only one worker assembles a module in v1; others can deliver reserved materials. Repair restores 20 HP over 10 seconds for one wood, consuming on completion and clamping at module maximum; stone-heavy modules use one stone instead. No repairs apply to actors. Dismantling takes 15 seconds and returns floor(0.5 × consumed inputs) for each input type to a reachable container or ground pile; unfinished modules use only their recorded consumed quantities, and crafted input items are never duplicated. Hostile destruction yields floor(0.25 × consumed inputs), with contents dropped as an owned ruin cache. Property Protected still applies to that cache, closing a destruction-to-free-theft loophole. Destroying a container does not destroy its contents or ownership metadata.

Equipment capacity is one primary weapon, one shield or bow offhand arrangement, one armor, one cloak, one tool, and a carried inventory within weight limits. A shield cannot guard while a bow is aimed. Weapons do 50 percent of listed damage to structures; fists and arrows cannot damage structures. Tool harvesting rates never apply as a combat modifier. Every structure uses a predefined footprint and cannot be placed over an actor, resource work point, required path, or other module.

### 30.6 Shared social action durations

| Action | Base simulation duration | Completion and interruption |
| --- | --- | --- |
| Invitation or simple offer | 10 seconds, Negotiate applies | Explicit recipient decision; no reply means no agreement |
| Nearby atomic trade | 4 seconds after acceptance | Both goods reserved; interruption transfers neither side |
| Custom consultation or leadership vote | 20 seconds | Fixed electorate and explicit majority; no forced consent |
| Depart clan | 10 seconds | Completion before 50:00; permissions change atomically |
| Teach procedure | 20 seconds, or 15 after one observed demonstration | Teacher/learner present; no partial knowledge grant |
| Ordinary short teaching exchange | 10–20 seconds | Listener may leave; actual understanding/reaction recorded |
| Guest gathering | Up to 45 seconds | Reassess needs and danger continuously; repeat listener benefit limited for 120 seconds |
| Arena withdrawal | 6 seconds | Permanent on completion; no kill credit |
| Guest persecution preparation | 20 seconds | Specific hostile intent, valid downed target and laws throughout; no custody state |

The range in a teaching exchange is selected by its authored template before it starts. A work or social duration does not restart on save/load. At most one committed interaction occupies an actor at a time; invitations can be queued as received messages while the actor finishes a safe current action.

## 31 Intent catalog and authoring contract

Every goal and plan type must map to a visible template and real reason data before it is added. Placeholders in braces refer to known actors, places, items, times, or law IDs. Unknown names render as an unknown clan or last seen camp; the label cannot leak information. The icon vocabulary below is symbolic design language, not reliance on a particular font glyph. UI assets should be SVG or renderer-native icons with text equivalents.

| Goal or plan | Intent label template | Icon and required feedback |
| --- | --- | --- |
| Gather food | Gathering {food} before supplies run low | Food; harvest progress and destination |
| Gather material | Collecting {material} for {recipe} | Resource; reserved count and work cue |
| Hunt | Hunting {prey} with {partner} | Prey; observed target, approach and shot cue |
| Eat or share meal | Eating {food} / Bringing food to {recipient} | Bowl; consumption event, no credit for offering alone |
| Rest | Resting until fatigue falls or the watch warns me | Bed; fatigue target and interruption cue |
| Warm up | Seeking warmth at {place} | Fire; exposure trend and fuel status |
| Build or repair | Building {module} / Repairing {module} | Hammer; inputs, work stage and interruption |
| Craft or cook | Making {item} for {purpose} | Tool or pot; procedure/worksite requirement |
| Learn or teach | Learning {procedure} from {teacher} | Book; named participants and completion |
| Join or recruit | Considering {clan}'s offer / Inviting {candidate} | Joined banners; offer terms and consent |
| Trade | Trading {offer} for {request} with {partner} | Exchange; reserved goods and atomic completion |
| Scout | Checking {place} before {plan} | Eye; last observation age and inspection |
| Patrol or guard | Watching {approach} until {shiftEnd} | Shield-eye; received assignment and relief request |
| Migrate | Moving to {refuge} before {hazardTime} | Route; ETA, supplies, and current safe route |
| Wait for law | Preparing until {law} ends at {time} | Clock; trigger, deadline, survival cost and fallback |
| Ambush | Waiting for an observed target on {route} | Hidden bow; known evidence, maximum wait and escape route |
| Raid | Approaching {hearth} when raiding is legal | Broken gate; observed objective and legal start |
| Fight | Defending against {target} / Attacking {target} | Crossed weapons; legal wind-up, range and recovery |
| Retreat | Leaving {threat} through {route} | Retreat arrow; safe destination and threat estimate |
| Hide | Concealing myself near {place} | Leaf-eye; actual concealment and reassessment trigger |
| Rescue or treat | Helping {patient} before {deadline} | Bandage; supplies, progress and risk |
| Negotiate or mediate | Offering {terms} to end {dispute} | Speech; real proposal and refusal path |
| Surrender | Requesting safe passage from {actor} | Open hands; proposed terms, no assumed immunity |
| Depart or withdraw | Leaving {clan} / Yielding from this arena | Exit; countdown, inventory permissions and finality |
| Leadership or custom | Proposing {candidateOrCustom} | Banner-circle; electorate, received votes and deadline |
| Reconciliation | Making amends for {event} | Linked hands; prior breach and proposed restitution |
| Idle recovery | No feasible {goal}; trying {fallback} | Broken path; failure reason, retry time, no empty Waiting label |
| Guest teach or pray | Sharing {theme} / Praying before {decision} | Open book; sourced theme and voluntary listeners |
| Fellowship or Accord | Considering {commitment} | Joined hands; terms, acceptance and later conduct |
| Guest accusation | {speaker} accuses the guest of {claim} | Attributed speech; belief source, never narrator endorsement |
| Persecution intent | {actor} prepares a lethal act against the guest | Danger; visible 20-second preparation and interrupt conditions |
| Final refuge | Seeking a defensible place before {closure} | Converging route; no capture or occupancy score |

The catalog covers the v1 goal vocabulary. Sub-actions such as walking, picking up, depositing, wind-up, and recovery inherit the parent intent and supply their own progress and failure event. Content validation rejects an unrecognized goal, missing label, unresolved placeholder, undefined icon, or action with no observable completion. The Why panel uses the same decision record so intent, speech, and the actual action cannot describe three different plans.
