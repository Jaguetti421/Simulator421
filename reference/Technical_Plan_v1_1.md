# The Last Clan Technical Plan v1.1

11 September 2026 · Full revised engineering baseline · Development remains unimplemented.

Use the companion Agent Work Phases v2 and GDD v1.1 addendum. This revision adopts the review decisions in REVIEW_DECISIONS.md and retains the detailed technical design below.

## 1 Technology decision and product contract

**Build the first production candidate in Godot 4.7.2 .NET, with a standalone C# simulation library and a Windows x64 desktop client.** The same simulation assembly runs inside the game and in an automated console runner. Godot owns the camera, models, animation, interface, audio, and input collection. The simulation owns every consequential fact: what a contestant knows, what they choose, where they can move, what a law permits, and who survives.

This separation serves the game's main promise. A patient contestant should wait because an announced law makes waiting useful. A rescue should fail because of a visible risk or a diagnosable mistake. We need to inspect those causes, reproduce them, and improve the behavior without reconstructing an entire graphical scene by hand.

This plan implements GDD v1.0 plus the explicit v1.1 addendum. Its technical choices are recommendations for the first build; numeric engineering budgets are proposed gates. No game benchmark, compatibility spike, or player test has yet been completed. The GDD remains authoritative for game rules. Section 25 links the adopted engineering clarifications; the addendum is part of this implementation baseline.

### Scope that governs the architecture

| Requirement | Implementation consequence |
| --- | --- |
| 100 named contestants in Standard | Identity is separate from the live entity slot; all contestants retain full simulation semantics |
| 24 deer and 12 wolves | Benchmark 136 active core actors; test 137 with the optional guest |
| 60 simulation minute ceiling at 10 Hz | A complete Standard match contains at most 36,000 authoritative ticks |
| Announced laws and adaptive strategies | Future permissions belong in planning, with versioned invalidation and deadlines |
| Socketed camps and changing obstacles | Navigation and construction share one geometry model and route validator |
| Persistent careers without permanent Standard buffs | Career records are a separate durable projection; Standard initialization reads identity and authored profile only |
| Optional Christ episode | Guest behavior is a separately enabled module using the same action and law checks |
| Offline single player | No backend, account, multiplayer replication, or cloud AI dependency is required |

The first user-visible deliverable is a compact, attractive observation scene with eight autonomous contestants, survival, construction, an announced truce, selection, and a truthful Why panel. A separate stress fixture exercises the full cast during the same milestone. The eight-person scene is a development and onboarding scale; it does not replace the 100-person Standard promise.

### What we build ourselves

Own the rule engine, actor beliefs, utility scoring, task planning, reservations, transactions, world queries, records, and diagnostic runner. Those systems define the game and must remain inspectable. Use the engine for mature presentation facilities. Begin with ordinary C# arrays and small explicit systems; a third-party entity framework, neural policy training, distributed service architecture, and generalized scripting language are unnecessary for the first release.

## 2 Stack selection and feasibility gates

Godot is the recommended first runtime because this is a desktop 3D game with substantial animation, camera, UI, and content-authoring needs. A C# core keeps simulation data independent of engine objects while retaining a single production language. Godot publishes a 4.7.2 stable .NET build and matching export templates. Its current C# documentation supports desktop export and still identifies web export as unavailable for Godot 4 C# projects. Browser delivery is therefore outside this baseline. [Godot 4.7.2 archive](https://godotengine.org/download/archive/4.7.2-stable/) and [C# platform documentation](https://docs.godotengine.org/en/stable/tutorials/scripting/c_sharp/c_sharp_basics.html).

| Layer | Selected first implementation | Constraint or alternative |
| --- | --- | --- |
| Engine and renderer | Godot 4.7.2 .NET; Forward Plus renderer; Windows x64 | Pin a verified stable patch and matching templates in Gate G0; test a reduced-effects preset on the same renderer |
| Language and runtime | C#; .NET 10 LTS candidate | Prove editor, export, console runner, and native SQLite compatibility together before freezing the target framework |
| Simulation | Pure C# library with fixed-tick systems | No Godot namespace, scene nodes, wall-clock decisions, or engine physics dependency |
| UI | Code-authored Godot Control nodes and shared Theme | Minimal root scene, text shaders, event-driven view models; reproducible generated scenes are allowed |
| Art | Procedural character kit and twelve code-driven action states first | AppearanceRecipe supports later reproducible rigged GLB assets; art technique does not waive visual quality |
| Content | Versioned JSON definitions compiled into immutable catalogs | System.Text.Json plus project validators; agents edit validated data and preview it through fixture screenshots; editor dock deferred |
| Persistence | Versioned snapshot files, input journal, SQLite career database | Microsoft.Data.Sqlite behind a storage interface; one database writer |
| Tests and tools | .NET console runner, xUnit, project fixture DSL | Same simulation and geometry in tests and play; no simplified combat substitute |
| Version control | Git, LFS for large source art and audio | Lock package versions and imported asset settings; exclude generated engine caches |
| Optional conversations | Authored dialogue first; llama.cpp evaluation later | Local, explicitly enabled, paused interviews with no simulation authority |

.NET 10 has an LTS support horizon through November 2028 in Microsoft's current policy. The Godot C# documentation still contains examples referencing older minimum frameworks, so this plan does not infer that every export combination has already been tested. Gate G0 must validate the exact SDK, Godot.NET.Sdk, export templates, runtime, and native dependencies as one package. Do not start a new long-lived production branch on .NET 8 simply because an older example uses it; its published support ends in November 2026. [Microsoft .NET support policy](https://dotnet.microsoft.com/en-us/platform/support/policy).

### Bounded comparison required by the GDD

Keep the GDD's TypeScript candidate as a bounded comparison: TypeScript integer fixture, Babylon.js presentation and Electron desktop export. P0-13 supplies equivalent 136/137-actor synthetic motion/query and synchronized-law workloads. Compare algorithm vectors, common geometry, query counts, basic animated identity, dense UI, save and packaging. Explicitly record missing production AI/combat behaviors. JavaScript safe-integer limits require proven intermediate bounds or BigInt; do not silently replace C# integer arithmetic with float behavior.

P0-14 is one isolated comparison packet, with a checkpoint/split if necessary; do not port the full game. Score agent verifiability: reproducible build/import commands, failing-fixture diagnosis, replay comparison and actual PNG capture without editor-only actions. Measure observed iteration effort and failures rather than assuming browser or engine superiority. Godot remains the preferred candidate unless evidence changes ADR 001.

### Gate G0 must produce evidence

- A clean Windows machine launches the exported .NET candidate offline without editor or developer SDK.
- The minimal real kernel and rendered host agree on synthetic fixture hashes under the frozen runtime family.
- Eight distinguishable procedural identities, representative motion, UI scaling and a real screenshot command work in the export. All twelve production action states are required at G1, not falsely claimed from a G0 mock.
- The full-population synthetic workload records operation counts, timings and its explicit omissions. It cannot certify production FINALE 01 or complete AI latency.
- Save recovery and a SQLite finalization smoke test survive interruption with no duplicate result.
- Build/runtime/template/native-library versions, available rendering backend and the comparison decision are recorded; unavailable checks are blocked rather than assumed.

Failure means resolve the specific incompatibility or revisit ADR 001. It does not justify changing the roster size, suppressing distant behavior, or postponing packaging until the end.

## 3 Runtime architecture and ownership

The client is one desktop process with one authoritative simulation thread, the Godot main thread, and a background persistence worker. The optional language runtime is a separate process. The initial design uses one simulation writer; parallelize independent matches in the test runner before parallelizing the inside of a match.

See ARCHITECTURE.md for the runtime data-flow diagram and contracts/INTERFACES.md for the compile-time dependency table.

Commands enter the simulation through a narrow queue. Read models and committed events leave it. Presentation, persistence, and dialogue never acquire mutable world state.

| Module | Owns | Boundary |
| --- | --- | --- |
| Sim.Core | Tick loop, actors, laws, actions, needs, combat, clans | Depends on contracts and compiled content only |
| Sim.Spatial | Grid, spatial index, LOS, routes, swept collision | Pure C# deterministic queries; engine-free |
| Sim.AI | Beliefs, candidate goals, task decomposition, execution intent | Receives actor-scoped knowledge and public arena notices |
| Sim.Story | Guest policy, teaching records, episode evaluator | Registered only for an enabled episode; uses ordinary action services |
| Client.Godot | Scenes, input, UI, audio, interpolation, asset presentation | Produces commands and reads snapshots; cannot change actor components |
| Observer | Forecasts, bookmarks, chronicle views, camera priorities | Consumes committed facts; its state is excluded from simulation hashes and random streams |
| Persistence | Save containers, journals, career transactions, recovery | Writes immutable checkpoint packages; never reads a live mutable array |
| Tools.Runner | Fixtures, batches, replay, hash comparison, reports | Instantiates the same Sim.Core and Sim.Spatial assemblies |
| Tools.Content | Definition validation, compile, authoring previews | Emits versioned catalogs and geometry manifests |

Godot's active scene tree is not thread-safe. Keep node creation and mutation on the main thread; exchange plain immutable data with the simulation. Avoid a design that calls into scene nodes from every bot decision. Godot also notes the cost of C# interop and array marshalling; bulk snapshot updates and cached bindings keep that overhead visible and bounded. [Godot threading guidance](https://docs.godotengine.org/en/stable/tutorials/performance/thread_safe_apis.html) and [C# interop guidance](https://docs.godotengine.org/en/stable/tutorials/scripting/c_sharp/c_sharp_basics.html).

### State and presentation handoff

Use an explicit three-buffer ownership protocol. The producer owns its write buffer; the consumer owns a read buffer; one completed buffer may be pending. Publication and release exchange handles under a short lock or proven atomic protocol. The writer never reuses a buffer that the renderer still holds. The renderer copies its previous interpolation sample into a local presentation cache, holding only one shared read buffer at a time. Cosmetic snapshots may be replaced by a newer complete snapshot. Committed events, acknowledged commands, and persistence packets may never be silently discarded.

If a reliable event or persistence queue fills, apply backpressure at a tick boundary and surface the stall; never drop events or grow memory without a bound.

Publish actor transforms and action progress at 10 Hz, and detailed selection data only for the selected or pinned contestants. Interpolate between two completed snapshots with a nominal 100 ms visual delay at 1x. Cap extrapolation; freeze briefly rather than depict an unconfirmed attack impact. On pause, settle to the last completed tick. The panel displays the snapshot tick so a debug inspection never mixes two moments.

Input commands carry a client sequence, expected rules version, requested operation, and immutable target IDs. The simulation assigns the authoritative tick and returns an acknowledgement with accepted or rejected status and a reason code. Pausing uses a barrier: the UI shows Paused only after the current tick finishes. Commands submitted while paused are staged in sequence for the next tick; the player sees their pending status. A save captures committed state plus any explicitly persisted pending-command queue.

## 4 Simulation clock and tick transaction

Use a 100 ms fixed step. Tick zero contains the initialized world. Step t advances state from the previous boundary to boundary t. Scheduled transitions at t install before actions resolving at t; newly started actions consume their first interval on the following tick. This gives an unambiguous answer when a projectile impact, departure, healing completion, and law transition coincide.

The clock uses integer ticks. Positions use integer millimeters on a 2.5D height field, rates and vital values use integer thousandths, and all division has documented rounding with saved remainder accumulators. A 0.1 HP-per-tick effect must accumulate correctly rather than round away. Use 64-bit intermediate arithmetic for distances, dot products, damage, and score products. Angles and movement normalization use versioned lookup tables or explicitly specified integer routines. Render-only floats do not enter the simulation.

| Order | Tick stage | Guarantee |
| --- | --- | --- |
| 1 | Install scheduled phase, law, membership-lock, and terminal-policy transitions | New permissions apply to every action that resolves on this boundary |
| 2 | Apply queued player commands in authoritative sequence | Validate notice, Influence, geometry, mode, and expected versions; emit acknowledgements |
| 3 | Gather valid actor observations and public notices | Evidence has a source and tick; hidden world data remains unavailable to decision code |
| 4 | Run immediate interrupts and due decisions | Stop illegal or unsafe plans; schedule newly selected actions for future progress |
| 5 | Advance needs, timers, movement, projectiles, and running actions | Apply rates and regrowth; recheck routes, range, leases, ownership, and legality; collect effects |
| 6 | Resolve resource and nonlethal support transactions | Atomic transfers; eligible standing executors complete work and aid; targets use action-specific checks |
| 7 | Resolve all damage and health transitions as a batch | Apply support first, then same-tick damage; terminal policy rejects healing before this stage |
| 8 | Apply elimination cleanup, clan succession, and lease release | Death cannot leave duplicate items or permanently held work slots |
| 9 | Evaluate match result after the whole tick | At tick 36,000, forced elimination precedes winner evaluation; simultaneous deaths can draw |
| 10 | Commit events, checksum, observer feed, and immutable snapshot | Downstream consumers see one coherent tick |

Support-before-damage is the adopted D01 rule in the GDD v1.1 addendum for the simultaneous heal and hit case. An action that was valid at the stage-6 boundary may complete even if its actor is eliminated by stage-7 damage. A movement or law invalidation earlier in the tick cancels it. This rule applies symmetrically to every actor; Section 25 records it as a design clarification.

### Boundary example

At tick 10,799, an arrow is already in flight and a truce is scheduled for tick 10,800, corresponding to 18:00. At tick 10,800 the truce installs first. The arrow intersects its target in stage 5; the impact permission check denies sentient damage. The shot remains in the record as fired, and its projectile is consumed, but no damage or kill is fabricated. A poised attacker can begin a normal wind-up only after permission later reopens.

At tick 30,000, corresponding to 50:00, membership freezes before an in-progress departure can finish. That completion fails with MembershipLocked. At tick 36,000, the final elimination affects all remaining contestants before any winner is considered. Entity iteration order cannot manufacture a survivor.

### Determinism and scheduling

Use a project-owned, versioned integer PRNG implementation with explicit test vectors and serialized state. Derive independent streams for world generation, each contestant's decisions, combat, wildlife, and the optional guest from stable seed labels. Do not use System.Random, hash-map iteration, current time, thread completion order, or camera position for consequential choices. Generating a guest stream must not advance a core stream.

Stable ordering uses numeric IDs and a defined comparison. Work queues use urgency, due tick, and actor ID; resource contention uses request age and a seed-derived run priority to avoid granting every scarce item to the lowest ID. Save the queue order and priority state. A tie-break changes who obtains a contested reservation, so it is part of the game contract.

The wall clock requests how many complete ticks to run. At 2x and 4x, run more fixed ticks; never enlarge delta or skip needs, perception, or combat. If the machine falls behind, lower delivered acceleration and show the actual rate. Suspend catch-up across OS sleep. Pause on minimize by default for this offline game; returning resumes from the last completed tick.

## 5 Island geometry and navigation

Represent the island as a static height field, semantic terrain layers, and a dynamic occupancy overlay. The camera shows a 3D island, while authoritative movement and interaction operate on its walkable surface. This matches the GDD's absence of climbing, boats, swimming, freeform floors, and physical destruction.

Use a 1 m base grid over approximately 800 by 800 m: 640,000 cells. Store height, traversal class, region, cover, and openness data (no precomputed visibility sets) in compact arrays. Add sparse 0.25 m detail grids around camp sockets, gates, narrow paths, and work positions. The coarse grid finds regional routes; fine geometry validates clearance and actual motion. Cell count is a memory estimate, not a navigation benchmark.

The 800 m envelope is an initial authoring dimension. GDD walking is 3.5 m/s, not real-world pedestrian speed. Apply addendum D05 strategic anchor route-time checks (approximately 240–360 seconds across the island), local accessibility and opening supply validators before accepting a seed. Label sampled anchor diameter honestly; do not claim exhaustive all-cell route validation.

### One world for every subsystem

Start with three authored macro-layout templates, then use seeded variation for resources, camp placement, foliage, and appearance. Quantize all generated geometry before the run begins. Compile the island through terrain, walkability, camp sockets, resources, spawn neighborhoods, knowledge distribution, and phase-escape validation in that order. Enforce the GDD's food within 45 walking seconds, plausible camp within 90 seconds, aggregate six-minute opening supply, and separated reachable advanced sources. Reject and retry a seed deterministically up to a bounded attempt count, then report generation failure or offer a known valid seed; never repair scarcity invisibly during play.

World generation produces both the render mesh inputs and a versioned simulation geometry manifest. LOS, movement, projectile collision, sanctuary membership, storm escape, and camp placement query that same manifest. Visual foliage may be decorative only when tagged as such. A tree that blocks sight or movement must have an authoritative footprint. Camera occluder fading does not change that footprint.

Deep water is impassable. Shallow water applies the GDD's speed multiplier. Height and slope limits are compiled terrain data. A bot plans through its discovered terrain and publicly announced arena geometry. Concealed routes, dynamic obstacles, and resources enter route assumptions through observations. Store a per-actor discovered-cell mask and remembered obstacle layer; explore frontiers when a complete route is unknown. If an unseen new wall invalidates motion, the motor stops physically and emits a contact observation; it does not send the planner the complete hidden settlement layout.

### Route service

Use hierarchical A*: public/known regional connectivity and portals first, then a local grid route without diagonal corner cutting. Initial TUNE budgets are 2,000 expansions per request and 20,000 total per tick. Each search invocation finishes atomically within its deterministic budget; queued requests may wait according to saved urgency, due tick and stable priority. No partially expanded A* frontier persists across ticks initially.

Results are Complete, Partial, BudgetExhausted or NoKnownRoute. Partial requires a physically valid route segment to a certified nearer portal or explicit progress waypoint, with a stable progress measure. Simply exhausting the budget does not prove progress or unreachability. Save pending requests, retry history, priority and returned paths. A repeated request must advance, choose another destination or enter bounded recovery; the same unsuccessful search cannot restart forever. Adjust an insufficient budget only with operation and hardware evidence.

Cache corridors over published topology only. A private cache may use a structural hash of the actor-known subgraph and traversal policy, or remain actor-local. Do not compute an omniscient corridor and merely hide invalid segments afterward: concealed topology could already have changed route choice, failure or timing. Every route and cost field must depend only on the actor's known terrain, reported hazards and public future law geometry. Hidden-route mutation tests cover paths, reasons and scheduling, not only visible destination coordinates. Use the same lawful geometry model for execution and invalidate only the affected regions after construction.

Dynamic construction updates only affected regions and fine cells. The authoritative placement validator checks the full geometry for valid work positions and exits, including hidden obstacles; its denial response exposes only the relevant obstruction at the attempted site. It cannot close the last legal corridor or let a campsite become a sealed population trap. Generated sites must accommodate all valid socket combinations under the GDD's building rules.

### Local movement and congestion

Actors use continuous integer positions, the addendum D05 TUNE 0.3 m collision radius, and a kinematic disc motor. Sweep the intended displacement against obstacles; subdivide only for collision precision with a fixed count derived from distance. Use deterministic neighboring-disc avoidance with candidate velocities: forward, left, right, slow, and stop. Rank candidates by progress, clearance, and collision risk; resolve reservations in a rotating run-seeded priority order.

Short passage reservations coordinate opposing traffic at gates and bottlenecks. After two seconds without progress, yield or request a different local route; after five seconds, reconsider destination or activity; after ten seconds, emit a stuck diagnostic unless the actor is intentionally waiting with a deadline. Never teleport, omit a collision, or eliminate an actor to clear a queue.

The crowded-refuge fixture must place all 100 contestants on converging legal routes. Inspect density, passage throughput, attack access, retreat options, and storm exposure. If the motor cannot resolve crowding, widen authored corridors or improve navigation before adding another biome. Cooperative pathfinding across the entire island is deferred unless this specific fixture demonstrates a need.

## 6 Perception and actor knowledge

An AI actor receives an ActorKnowledgeView, not WorldState. Compile-time project boundaries and restricted interfaces make accidental omniscience difficult. The authoritative world can reject an illegal interaction without telling the planner who is hiding behind a wall.

A broad-phase spatial hash finds nearby candidates. Exact queries apply sight distance, field of view, height-field LOS, concealment, light, hearing, and sleep modifiers from the GDD. Every actor runs an urgent nearby-threat check each tick. Ordinary scene inspection may be staggered, but a threat newly within a legitimate sensory channel must reach the interrupt queue within the 0.5 simulation second bound.

| Belief field | Purpose |
| --- | --- |
| Fact key and value | Typed proposition such as LastSeenPosition, FoodBand, KnownRecipe, or TreatyNotice |
| Subject and source IDs | Separate who the fact concerns from who observed or reported it |
| Observed tick and received tick | A late report does not become a fresh observation |
| Confidence and uncertainty | Preserve a hearing region or doubtful report rather than invent a precise coordinate |
| Provenance chain | Identify direct observation, report, or public arena notice and the originating event |
| Expiry policy | Enemy position, camp food, and durable recipe knowledge age differently |
| Supersedes or contradicts | Retain consequential contradictions for trust and explanation |

Use the GDD's 10-second tactical enemy-position staleness and 30-second camp-food-band staleness. Known static sites remain known; inventory quantities do not. A remembered location remains a place to investigate after its tactical precision expires. Two clan members share information through an actual conversation or delivered report; membership alone does not merge all knowledge.

Keep up to 256 active nonessential beliefs per contestant initially, plus pinned active obligations, public law notices, and prerequisite knowledge. This is an engineering storage target, not permission to erase an active rescue promise. Evict stale low-value observations deterministically. Archive significant personal events separately. The 100 by 100 relationship matrix is small enough to keep directly; the core challenge is truthful provenance, not storage capacity.

### Information isolation test

Run a fixture twice with identical visible facts and random states, but move a hidden enemy and alter a hidden stockpile. Until a legitimate sensory event occurs, the tested actor's decisions and explanation inputs must match. Also change camera position, player forecasts, and UI selection: all authoritative hashes must remain unchanged. These tests catch hidden-state leaks that attractive gameplay footage cannot reveal.

## 7 Goals planning and visible adaptation

Use **utility goal selection, authored hierarchical task methods, and a compact execution state machine**. Utility compares competing intentions; hierarchical methods decompose an intention into practical steps; the executor handles progress and interrupts. This is more controllable for the initial finite action catalog than an unrestricted planner searching every possible social and economic sequence.

Utility methods follow the GDD's normalized benefits and costs, eight temperament dimensions, bounded quirks, commitment bonus, and switch threshold. The approach is informed by David Graham's utility-theory chapter; the exact scoring and scheduling below are project decisions. [An Introduction to Utility Theory](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter09_An_Introduction_to_Utility_Theory.pdf).

### Decision sequence

1. Apply hard interrupts: incapacitation, illegal action, immediate observed danger, essential need, or invalid lease.
2. Generate feasible goal families from needs, remembered opportunities, obligations, clan proposals, and announced phases.
3. Cheap-filter impossible candidates, retaining a rejection reason for inspection.
4. Score up to twelve viable candidates with bounded considerations. Expensive plan expansion occurs for the best three.
5. Continue a valid committed plan unless the GDD's switching rule or an emergency justifies replacement.
6. Select an authored task method, reserve its next scarce prerequisite, and start the first action.
7. Record the chosen candidate, actual alternatives evaluated, evidence ages, score contributions, deadline, and interrupt reason.

Ordinary task reconsideration runs every 20 ticks per actor, strategic reconsideration every 100 ticks, and urgent checks every tick. Stagger ordinary work by actor ID. An event invalidating many plans creates an urgent queue; every affected actor must at least stop illegal behavior immediately, then obtain a defensible action within the GDD's response bound. Waiting for the ordinary ten-second strategic update is unacceptable.

### Bounded task methods

Initial planning limits are twelve primitive steps, six decomposition levels, and 128 method expansions per actor per reconsideration. Budgets count operations, never elapsed milliseconds. When exhausted, keep a valid plan or take a short safe fallback, and emit BudgetExhausted. The exact limits are tuning data measured in the stress fixtures.

For AcquireFood, methods include eat carried food, obtain an allowed shared item, request a useful trade, gather at a known patch, hunt a feasible known prey, or explore a promising known region. Prerequisites include knowledge, travel time, permission, tools, inventory capacity, daylight, hunger deadline, and expected danger. Each method expansion is atomic within its operation budget; scratch frontiers are discarded after returning a valid method or explicit exhaustion. A committed plan and its action progress remain saved. A method stores what would invalidate it. It does not reserve every downstream item for several minutes.

For RescueFriend, methods compare direct aid, obtain a bandage locally, request a nearby medic, escort after revival, and decline with a concrete reason. Estimate arrival plus interaction duration against the remaining bleed timer. A plan promising a rescue after the patient will certainly die is rejected before movement begins.

### Temporal reasoning

Represent public law intervals as start-inclusive and end-exclusive. Plans can ask whether an action may start at a future tick, but execution always rechecks current permission. Store event ID, event version, earliest legal start, expected completion, latest useful start, and a fallback. Waiting is a real action with a reason, watched dependency, and deadline.

A patient raider may wait for protection to expire if food, exposure, route, and target confidence allow it. A hungry raider may gather instead. If the event is legally amended, the version changes, invalidating dependent waits. The planner evaluates only the next one to three announced events according to the GDD's horizon trait; imminent lethal danger is never omitted by that limit.

### Adaptation without uncontrolled learning

Standard contestants adapt through within-run memories, beliefs, trust, morale, failed-plan cooldowns, and known procedures. Authored traits and skill bands remain fixed. Remember a dangerous passage, earlier hunger, a broken promise, or a successful trade with a source and expiry policy. Such memories change relevant considerations; they do not silently rewrite the actor into a stronger profile between runs.

Evaluate profile pairs using the same visible state and controlled random streams. Measure whether one trait changes the relevant tradeoff while basic survival competence remains intact. Across batches, compare delay to shelter, retreat frequency, rescues attempted, information sharing, and commitment stability. Different win rates alone do not prove distinct personalities.

Keep a small GOAP alternative only in the planner feasibility fixture, as the GDD requests. Compare completed tasks, debugging effort, expansion cost, and recovery under interrupted crafting and rescue. Adopt GOAP only if it demonstrates a concrete advantage over the authored methods. There is no requirement to maintain two planning systems in production.

## 8 Actions reservations and the economy

Every action is a transaction with a visible execution state. Use one contract for contestants, wildlife where applicable, and guests. A content definition selects an implemented action kind and parameters; it cannot execute arbitrary code.

| Action field | Required content |
| --- | --- |
| Identity | Stable action ID, definition version, actor, target, plan, and causal parent |
| Preconditions | Actor state, actor knowledge, distance, procedure, tools, permissions, and timing |
| Resources | Inputs, output capacity, ownership policy, and reservation keys |
| Execution | Duration in ticks, work position, progress milestones, animation cue, and sound cue |
| Revalidation | Dependencies checked each tick and immediately on a relevant event |
| Interruption | Consumed versus unconsumed inputs, retained progress, lease release, and cooldown |
| Completion | Atomic effects, output location, knowledge effects, and committed event types |
| Failure | Typed reason, player-readable intent template, and possible recovery methods |

The executor uses Pending, Travelling, Ready, Working, Interrupted, Completed, and Failed states. These states map to GDD presentation cues; Working without a work animation, valid position, or progress source is a content error. Gameplay progress belongs to the simulation clock. An animation event may play a sound but cannot grant a crafted item or apply damage.

### Reservation service

Reservations refer to a resource stack, quantity, work slot, passage, or interaction partner. Leases last 50 ticks and renew every ten ticks only with valid progress. Death, departure, invalid ownership, plan cancellation, or target destruction releases them immediately. A requester can observe its own denial reason without receiving the entire stockpile.

Acquire multiple reservation keys in a canonical order as one atomic operation, or acquire none. Avoid holding one scarce item while waiting indefinitely for another. Requests age to prevent starvation; a request that repeatedly fails must change method, destination, or priority. Clan leaders may propose priorities, but the reservation service still checks actual membership, consent, and ownership.

### Conservation and production

Inventory transfers use a single commit that debits the source and credits the destination. Consumption debits a real stack; production requires a named recipe, renewable-node rule, or explicit intervention source. The event includes before and after quantities for audit builds. Failed actions cannot mint replacement inputs.

Construction consumes the GDD's first portion at 50 percent progress and the remainder on completion. Save a consumed-input ledger per build. Interruptions return only unconsumed reservations. Dismantling and destruction calculate salvage from actually consumed inputs, including unfinished structures; they never reconstruct an assumed full recipe cost. PropertyProtected remains attached to ownership of the resulting cache.

Support the complete 28-recipe manifest through shared primitives: gather, consume, transform at a station, build at a socket, repair, teach, dismantle, and use an item. Validate dependency cycles, worksite availability, advanced-knowledge distribution, and baseline survival without advanced recipes. Content expansion must add a tested action method and presentation mapping, not only an icon.

## 9 Clans diplomacy and social commitments

A clan is a durable ID with a membership history, leadership state, inventory permissions, known customs, and social agreements. It is not a shared AI brain. Each contestant begins in a one-member clan; membership changes require explicit actor decisions and respect the eight-living-member cap, with downed members included.

Represent invitations, votes, treaties, duties, and promises as explicit records. A Promise stores issuer, recipients, terms, created tick, expiry, notification evidence, and fulfillment or breach events. Knowledge of an obligation is part of breach eligibility. A contestant cannot knowingly violate a custom they have never been told about.

Clan proposals ask for roles such as gatherer, builder, guard, medic, or expedition partner. Each actor evaluates the request using its own needs, knowledge, and personality. Accepted assignments reference a concrete plan and lease. A leader's death cancels or reassigns coordination ownership, while already valid individual actions may continue. Succession follows the GDD's deputy and joining-order policy.

Votes store the fixed electorate at creation and explicit votes received within 20 seconds. Missing members are not treated as consenting. The adopted result becomes known through public local announcement or a later valid report. Keep at most two active customs. Fellowship, alliance, and treaty graphs remain independent of clan membership and victory eligibility.

### Atomic membership changes

Departure is a ten-second action before the 50-minute freeze. Joining validates the current destination roster, consent, and capacity at completion. Two candidates competing for the last slot cannot both succeed. Install the freeze before same-tick completion checks. Mutual protection after departure lasts up to 15 seconds but truncates at the freeze; the 120-second rejoin lock remains a separate timer.

Trade is a four-second interaction whose final transfer is atomic. Both parties must remain eligible and within reach. Unauthorized withdrawal from another clan's store is theft; a permitted trade is not. Treaties can be broken when hard laws permit the underlying action, but the breach event records the known commitment and actual violator. Leaving during a battle without an explicit duty is not automatically betrayal.

## 10 Law engine and match director

Laws are data interpreted by one PermissionService used by AI planning, action start, action progress where relevant, and final effect resolution. It returns Allowed or Denied plus rule ID, version, scope, and reason. The AI cannot bypass it; story logic cannot bypass it; visual effects cannot bypass it.

Hard permissions cover sentient harm, hostile structure damage, property withdrawal, and protected spatial scopes. Environmental modifiers cover cold, abundance, and temporary storm geometry. Social commandments and religious teachings affect decisions and records, never the hard permission result.

### Intervention scheduling

An intervention stores its immutable ID, version, type, committed cost, commit tick, activation tick, end tick, geometry or selected Hearth ID, and cancellation history. Validate the six-point budget, 60-second notice, three-active-modifier cap, category overlap rules, start by 48:00, and end by 50:00 before commitment. Evaluate concurrency across the complete future schedule, not only the current tick.

A legal amendment retains its ID, increments its version, and generates a notice. The replacement schedule must pass all checks; failure leaves the previous event intact. Cancellation and amendment windows compare against the currently committed activation tick. Spent Influence is never silently refunded. The UI previews the authoritative denial reason before the player confirms a placement.

Sanctuary and Truce apply to sentient actors, including the guest. Sanctuary tests both attacker and target center points, with boundaries inclusive. Projectiles require permission at launch and impact. When protection activates, cancel hostile preparations, clear covered harmful statuses, and pause covered sentient-origin bleed timers under the GDD policy. Wildlife attacks and environmental hazards remain governed by their own permissions.

Herald captures the selected Hearth ID at commitment, then resolves its current location and authorized coarse food band at activation. A destroyed or abandoned Hearth yields the explicit unavailable result. Never retarget to a new camp or expose exact hidden inventory through a general debug event.

### Match phase data

| Simulation time | Tick | Director action |
| --- | --- | --- |
| 10:00 | 6,000 | Open sentient harm and theft |
| 15:00 | 9,000 | Open hostile structure damage |
| 25:00 and 36:00 | 15,000 and 21,600 | Apply outer Fog contractions |
| 40:00 | 24,000 | Open the three connected staging areas |
| 48:00 | 28,800 | Close outer staging toward the final refuge |
| 50:00 | 30,000 | Freeze membership, end temporary protections, contract refuge |
| 54:00 and 56:00 | 32,400 and 33,600 | Contract refuge again |
| 58:00 | 34,800 | Enable global healing prohibition and terminal pulses |
| 60:00 | 36,000 | Resolve final elimination and result after the full tick |

A phase definition includes announced geometry, safe connected components, escape paths, damage policy, and applicable ending evaluator. Day/night is a separate public calendar using the GDD's five 12-minute days; visual twilight does not shift mechanical boundaries. Storm overlap applies the maximum relevant hazard rate, not summed duplicate damage.

Winner evaluation uses eligible contestant clans only. A sole remaining clan needs a standing member; an all-downed clan does not win early. Guest presence never creates a second competitor. Standard has no refuge-occupancy shortcut. The Story Coexistence evaluator is selected before the run and uses its own terminal policy; spawning Christ during a competitive run does not silently replace the chosen victory rules.

## 11 Combat wildlife and factual attribution

Use kinematic combat with explicit aim, wind-up, recovery, contact, and damage events. The simulation knows weapon reach, projectile path, target geometry, shields, and armor. Animation follows the confirmed action phase. There is no dependence on engine rigid-body contacts, ragdoll collisions, or frame-timed animation callbacks.

Bow projectiles move through an integer segment sweep each tick. At 18 m/s, a projectile travels 1.8 m per tick, so point-at-end collision is insufficient. Resolve the first intersection against authoritative obstacles and actor shapes, with stable ties. Include height along the shot so slopes and cover agree with the visible island. Launch spread comes from the combat stream; cosmetic arrow wobble does not.

All damage proposals capture source, target, amount after mitigation, weapon, action, position, permission evidence, and combat episode. Evaluate against a consistent resolution boundary. Accumulate same-tick damage before health transitions. A standing target can become downed once in that batch; a second contributor in the same batch cannot also eliminate them. Later legal damage, bleed expiry, or a terminal policy can eliminate a downed target.

Revival resets the combat attribution episode as the GDD requires. Ordinary standing episodes also reset after 30 seconds without damage. Kill credit and assists are deterministic projections of committed damage events, with the documented largest-contribution tie-break for simultaneous sources. A tie-break assigns credit; it cannot change who lives. Wildlife and terminal damage retain their actual source categories. Guest harm generates no contestant kill or assist reward.

### Wildlife uses the same world

Deer and wolves have lighter species policies but full movement, perception, needs where defined, collisions, and damage. Four wolf packs have three members each and the GDD's den leash; public hard laws about sentient harm do not disable wildlife danger. Spawn validation enforces safe starting and camp distances. There is no respawn, breeding, or predator-luring mechanic in this scope.

Use separate fixture profiles for flee, fight, nearby-group response, hunting, and interrupted harvesting. Species policies query their own sensory evidence. A wolf does not learn a hidden contestant's position from the player's selected portrait. Dead animals produce the exact declared resource stacks once, linked to the elimination event.

### Death and result cleanup

Elimination releases leases, cancels tasks, records cause, resolves carried inventory once, updates clan eligibility, and emits a single stable event. Withdrawal uses its own permanent action and receives no kill attribution. Rescue commendations require useful aid and exclude the culpable source; repeated revive loops cannot farm credit. Finalization operates only on the committed result package described in Section 15.

## 12 Content schemas and authoring tools

Keep definitions separate from runtime instances. Definitions are immutable, versioned, and hashable. Instances contain changing state and reference definition IDs. Display names and localized text never serve as identifiers. The content compiler emits a canonical catalog with sorted IDs, reference indices, unit conversion, and validation errors that identify the source file and field.

| Catalog | Required validation |
| --- | --- |
| Contestants | Profile-dependent counts: Fixture declared subset, Prototype8, Trial24, Standard100; valid skills/traits/appearance and no career-stat initialization dependency |
| Actions and intents | Preconditions, failure codes, effects, interrupt policy, and every player-facing state mapped |
| Recipes and items | Standard requires exactly 28 GDD recipes; prototype/Trial declare closed subsets; all profiles validate conservation, stations, knowledge, capacity and salvage |
| Laws and phases | Legal timing, scope, overlap, cost, spatial validity, and ending compatibility |
| Maps and camp sockets | Reachable starts, work positions, exits, resource supply, knowledge distribution, and Fog escape |
| Social definitions | Typed terms, notification rules, fixed vote eligibility, breach conditions, and expiry |
| Story and teaching | Guest permissions, source references, quotation labels, reaction methods, and coda conditions |
| Forecasts | Subject type, precondition, event matcher, deadline policy, and resolution text |
| Presentation | Rig, clip, material, icon, sound, text key, and fallback mapping |

### Representative runtime contracts

The following C# shapes define boundaries rather than a complete implementation. Use compact numeric IDs in hot state and durable IDs in files.

```csharp
public readonly record struct ActionRequest(
    int ActorId, int ActionDefId, int TargetId,
    long PlanId, long RequestedTick, int ExpectedLawVersion);

public readonly record struct PermissionResult(
    bool Allowed, int ReasonCode, int RuleId, int RuleVersion);

public readonly record struct EventHeader(
    long EventId, long Tick, int EventType,
    int ActorId, int TargetId, long CausalParentId);
```

Runtime action state additionally stores start tick, remaining work, input-consumption ledger, dependency versions, reservation handles, and interrupted state. Events use typed payloads; do not store essential meaning only in prose. Reason codes such as WaitingForLaw, RouteBlocked, MissingProcedure, ReservationLost, InsufficientTime, and TargetUnobserved have localized player text and detailed debug fields.

### Authoring workflow

Start with schema-validated text catalogs, a CLI content compiler and deterministic preview fixtures. Keep count requirements in explicit profiles; fixture overrides cannot write canonical careers or certify full-game gates. Every catalog has an intentionally reviewed golden hash. Defer the editor dock and node editors until repeated authoring friction justifies a separate packet.

Balance reloads happen between runs. A developer can apply a live edit only by creating a labeled Custom debugging branch with a new content hash. Standard saves never absorb a newly edited recipe or trait halfway through a competition. Store the source manifest and compiled catalog hash alongside each run.

## 13 Presentation pipeline and contestant identity

Use the GDD's stylized mythic tabletop direction: readable silhouettes, restrained materials, a near-isometric perspective camera, and close views of recognizable people. The first scene needs believable gathering, carrying, resting, waiting, and helping before it needs a large terrain library.

Use code-authored scenes, a C# palette/theme, text shader files and a minimal root.tscn. Deterministically generated/imported scenes and text-authored .tscn files are allowed when reproducible and diffable. Build polished modular primitive meshes and procedural motion behind AppearanceRecipe first. P4 refines the production kit; a shared rig and GLB replacement is optional if visual evidence shows a benefit. Script Blender generation/export if used, retain source and checked-in exports, and avoid making a human editor session the only path to a build. [Godot 3D asset formats](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/available_formats.html).

The client capture mode accepts fixture, confirmed tick, camera preset, resolution, text scale and output path. It waits for import and snapshot readiness, renders warm-up frames, and writes PNG plus build/tick/renderer metadata. Missing GPU/display/backend is BLOCKED_RENDER. A verified software backend can validate layout but cannot establish gaming-hardware GPU budgets. Automated capture success and human/vision visual acceptance are separate evidence.

### Character kit and animation

Implement the GDD's three builds, four head families, ten headwear options, and six accessory families through an AppearanceRecipe. Cache assembled meshes and material combinations, share the skeleton layout, and drive clan color through a limited palette. An actor's authored appearance does not modify their skills or traits. Portraits render from the same recipe and lighting setup, preserving identity across runs.

The initial shared clips cover idle/scan, walk, run, work, rest, aim, melee, exchange, guard, downed, revive, and surrender. Tools and action overlays distinguish shared motions. Blend visual locomotion to confirmed speed; authoritative foot positions do not use root motion. A missed hit can still finish a swing, but it cannot play an impact or damage number without a committed contact event.

Proposed character budgets are 8,000 triangles near, 3,000 mid, and 800 far, with one body material and a small number of equipment materials. These are content targets to test, not engine limits. Begin with procedural assembled character instances; use ordinary skinned instances if the rigged pipeline is adopted, with animation update throttling by visual distance. Far or occluded animation can update less often; AI and combat cannot. Do not assume MultiMesh automatically batches independently animated skeletons.

Use spatially chunked MultiMeshes for repeated static trees, rocks, and grass. Godot's documented limitation is group-level culling rather than per-instance culling, so partition the island into visible chunks and avoid one island-wide vegetation batch. The documentation flags some 4.7 material as awaiting review; verify behavior in the selected build. [Godot MultiMesh guidance](https://docs.godotengine.org/en/stable/tutorials/performance/using_multimesh.html).

### Lighting sound and camera

Begin with a directional sun/moon, baked or inexpensive ambient treatment, limited shadow distance, and a small visible-light budget for fires. Time of day drives a visual curve from the authoritative clock. Essential danger and lawful boundaries remain legible in night, rain, forest, and reduced-effects mode. Avoid volumetric fog as a prerequisite for understanding gameplay Fog.

The default camera uses the GDD's 45-degree pitch, allowed 35–65-degree range, orbit, zoom, and occluder fading. Selection raycasts can use presentation geometry to propose an entity ID, but the simulation validates any resulting action or power target. Audio follows committed events with the GDD's four music priorities and release delay. Cosmetic random variation uses a separate renderer-only generator.

## 14 Observer interface and forecasts

Create event-driven view models for the timeline, selected contestant, clan, chronicle, forecasts, and match summary. The simulation publishes compact data changes; a panel does not scan every actor each rendered frame. Virtualize long chronicle and roster lists. Update numeric inspection panels at up to 5 Hz, while urgent notices arrive immediately after tick commitment.

The main observation view follows the GDD's dimensions, five followed contestants, one Focus, and scalable text. Intent labels distinguish travelling, collecting, working, waiting for a rule, seeking a missing prerequisite, resting, retreating, and blocked. The Why panel shows the chosen action and up to two alternatives that were actually evaluated, with the data age and uncertainty behind each. It must not invent a more elegant justification after the outcome is known.

### Forecasts are an independent event consumer

Forecast records store template, subject, target, creation tick, immutable deadline, evidence events, resolution, and influence status. Evaluate only events strictly after creation and through the deadline inclusive. Use the GDD's eight templates and three-active-slot limit. The event matcher has no write access to actors, random streams, utility scores, or phase scheduling.

An accepted post-creation simulation-affecting player input marks active forecasts Influenced, including future interventions and guest arrival. Rejected inputs have no effect because they change no simulation state. UI notes, camera movement, pausing, and forecast creation do not influence outcomes. A previously committed schedule remains part of the forecast's original context. Store influence events outside the actor state but in the durable observer journal. Merge sticky influence and resolution records from the profile when loading an older checkpoint; rolling the simulation back cannot erase an intervention or earn the same forecast credit again.

Resolve Correct, Incorrect, Canceled, and Voided separately. Accuracy excludes canceled and voided predictions. Early natural match completion makes unfulfilled future events Incorrect under the GDD; abandoned or unsupported-edited runs void applicable forecasts. The actual resolution and evidence event remain visible after reload.

### Accessibility and readability

Use shared text styles, keyboard focus order, remappable commands, pause, event severity controls, and 100/150-percent text-scale fixtures. Color is supplemented with shape and labels for clan, hostility, law, and selection states. Test long names and localized text expansion even though English is the initial language. A crowded finale prioritizes selected and urgent identities rather than drawing 100 overlapping labels.

The optional camera director consumes observed events, respects manual movement, and uses the GDD's dwell and priority rules. It can reveal a real off-camera incident to the player; it cannot create an incident or feed that event into a bot's knowledge.

## 15 Saves replay and career persistence

Use three related stores: a versioned run snapshot, an append-only input and event journal, and a SQLite career database. A snapshot restores execution. The event journal proves facts. The career database makes finalization idempotent and supplies fast roster history queries. High-level story events alone cannot reconstruct the world.

### Snapshot contents

A snapshot includes run and branch IDs, tick, build and content hashes, mode provenance, phase and law schedules, Influence, all entity components, inventory and consumed-input ledgers, geometry mutations, complete random states, beliefs, relationships, pending messages, active plans, executor state, queued route requests, retry state and committed routes, reservations, passage queues, combat episodes, guest state, ending state, and event sequence counters. Observer state has a separate section and hash. Pending accepted commands and their sequence positions are explicit.

Use a schema-versioned binary container built with fixed little-endian primitive encodings, length-prefixed sections, per-section checksums, and standard compression. The first implementation may use canonical JSON payloads inside that container for easier inspection; migration to packed arrays requires a codec version and round-trip tests. Do not serialize a live Godot scene or arbitrary object graph.

Take a checkpoint every 60 simulation seconds and on manual save. Copy or serialize from a completed tick into an immutable buffer; the storage worker writes it without blocking actor updates. Keep the initial checkpoint and three rolling checkpoints plus the complete input stream for replay seeking. Snapshot size, retention, and compression time are measured in Gate G2; the initial engineering ceiling is 32 MB compressed per full snapshot and 250 MB per retained run bundle.

### Crash-safe writes and recovery

Write a new generation to a temporary file in the destination directory, flush it, validate its checksum, then atomically replace the manifest pointer while preserving the prior valid generation. Use the supported Windows filesystem replacement API and test actual power-loss and process-kill points. If replacement fails, the previous save remains authoritative and the UI reports the failed save. Never claim success before durable completion.

SQLite has one writer and uses explicit transactions for career changes. Microsoft.Data.Sqlite supports transaction isolation and commit/rollback behavior; use a transaction around the result record and its derived career increments. [Microsoft.Data.Sqlite transactions](https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/transactions).

### Exactly-once career finalization

1. The simulation creates an immutable ResultPackage with run ID, branch ID, mode provenance, finalized tick, event range, result hash, and per-contestant records.
2. Persist that package before applying career changes. It becomes a recoverable finalization request.
3. In one database transaction, insert a unique result key and the derived career entries. If the key already exists with the same hash, return AlreadyApplied; a different hash is a conflict to investigate.
4. Commit the database, then mark the run manifest finalized. A crash between steps 3 and 4 retries safely because the unique key prevents repeated increments.
5. Reopening an earlier checkpoint consults the durable finalized-run registry. Continuing creates a new Custom Practice branch with its own ID and no additional Standard credit.

Separate survival wins from championships based on the GDD's locked roster. Store life and combat-episode IDs for kills, assists, rescues, withdrawal, and notable events. Mode flags are sticky; an episode that has ended does not convert its run back to Standard. Cross-clan fellowship never changes the winner roster.

Local integrity prevents accidental duplication within the maintained profile. It is not online anti-cheat: a player who deliberately copies or edits every offline file can bypass local history. No leaderboard or competitive attestation is promised.

### Replay and branching

Replay starts from a complete snapshot, applies the recorded ordered commands, and checks canonical subsystem hashes every 100 ticks. Exact replay is scoped to the same simulation build, content catalog, and validated runtime/platform combination. Cross-platform or cross-version bitwise equivalence is an additional gate, not a product promise.

When a hash differs, compare actor, law, inventory, spatial, AI, and random-state hashes to locate the first subsystem. Development replay can seek from the nearest checkpoint. A counterfactual branch changes one declared input, law, or trait and is labeled as a new experiment; it does not overwrite the original chronology or credit. Full player-facing cinematic rewind remains outside v1.

Migrations transform known old schemas into a new version with a backup and validation. A rules-changing update may preserve a career archive while making an in-progress old run read-only or playable only in its matching build. The load screen must say which case applies; never silently reinterpret an old competition under new rules.

## 16 Guest framework and the Christ episode

The guest framework introduces a sentient actor with ordinary needs and movement, its own policy, and explicit exclusion from contestant membership, elimination counts, wins, kills, and assists. Use a neutral hermit fixture to prove the framework before adding the authored Christ material. Enabling no guest module must leave core random streams, event sequence, and results unchanged.

Guest arrival is an authoritative command. Validate legal ground, available guest slot, and scenario policy, then create the guest and mark the run Story in one transaction. The 100 contestants remain present. Benchmark the resulting 137-actor workload. A private debug flag cannot spawn the guest without recording mode provenance.

### Christ behavior and content

Christ uses authored policies for teaching, helping, mediation, prayer, rest, refusing conquest, and responding to danger. Teaching records reference a stable lesson ID, source passage, wording category, and witnessed audience. The GDD's Gospel references and quotation, paraphrase, and island-adaptation labels remain content requirements. His awareness of the simulation is part of the fictional episode, and the player remains the Overseer rather than God the Father.

Listeners independently weigh needs, risk, trust, values, prior experience, and opportunity. Attendance is interruptible. Fellowship is a separate voluntary relationship and cannot grant shared inventory, hidden knowledge, automatic loyalty, or clan membership. Useful aid and religious affiliation are evaluated independently. Skepticism is a valid reaction without a hostility modifier baked into the trait.

The one healing encounter is an action with a six-second duration, range, interruption conditions, and an allowance consumed only after valid completion. It can restore a living downed actor under the GDD's health policy, but cannot resurrect an eliminated contestant or override the terminal healing ban. Its allowance and causal event survive save/load.

### Persecution and ending logic

Persecution uses the existing accusation, hostility, approach, attack, and interruption services. The exceptional crucifixion attempt requires the GDD's explicit lethal intent, downed target, valid reachable initiator, and uninterrupted 20-second action. The ordinary bleed timer continues. A truce, rescue, death by another cause, lost reach, or incapacitated initiator cancels it. Only its actual completed event can produce that outcome label. There is no prison system, guaranteed persecution arc, or reward for harming the guest.

Competitive Story runs retain the selected last-clan evaluator and Story records. Preselected Coexistence runs stop Fog progression at the defined boundary, disable the terminal competition policy, and evaluate the public Accord at 60:00. Store acceptances, withdrawals, hostile initiations, and useful cross-clan aid as typed events. Evaluate the full qualifying set and distinct unordered clan pairs exactly as the GDD requires; do not search for a hidden favorable subset.

The conditional resurrection coda is a post-finalization presentation event. It can reference the guest's recorded death but cannot restore a competitor, change the winner, or rerun career accounting. Episode-disabled, guest-alive, guest-dead, interrupted-persecution, and Coexistence fixtures all gate the module separately from the core game.

## 17 Optional local conversations

Ship the core game and Christ episode with authored contextual dialogue. Treat local LLM interviews as a separate feature gate after the simulation and memory records are reliable. The candidate runtime is llama.cpp, whose project provides local inference and grammar-constrained output mechanisms. Those mechanisms can constrain output shape; they do not guarantee factual or scriptural accuracy. [llama.cpp project](https://github.com/ggml-org/llama.cpp) and [JSON schema grammar tooling](https://github.com/ggml-org/llama.cpp/blob/master/examples/json_schema_to_grammar.py).

The player pauses and selects one contestant for an interview. Build a bounded MemoryPacket containing the actor's identity, authored voice, selected verified career events, current beliefs with their uncertainty, and a small set of relevant memories. Never pass the full world state, other contestants' private plans, unrestricted local files, or raw developer commands.

### Inference boundary

Run a pinned local sidecar process on demand. Prefer a narrow process adapter with structured input and output. If its supported interface requires HTTP, bind only to loopback, require a per-launch token, and expose no arbitrary file or model paths. Package an allowlisted model manifest with checksum, license metadata, memory estimate, and supported runtime build. An optional model download shows its size and location; there is no silent cloud fallback.

The response schema includes text, referenced memory IDs, uncertainty category, and optional authored quotation ID. Validate every referenced ID against the packet. Render canonical statistics from database fields, not generated text. Scripture quotations are selected by validated authored ID and inserted verbatim by the game; the model cannot create a new quotation and label it canonical. Free-form claims remain subject to factual evaluation and a visible uncertainty policy.

Generated text has no action schema and no write route into Sim.Core. Attempts to give orders remain conversation. Cancel generation on resume, model failure, or a changed selected subject; tag packets with run, actor, and snapshot tick to reject stale responses. Save transcript text separately from canonical memories. An unsupported claim must not become a remembered event merely because it appeared in dialogue.

### Go or defer criteria

Evaluate a small set of openly distributable local models after checking their actual licenses and hardware behavior. Do not select a model by parameter count alone. Proposed targets are first useful text within three seconds, a short answer within ten seconds, and peak memory within a separately declared allowance while the game is loaded. These are evaluation goals, not a claim that current models meet them.

Run at least the GDD's 100 factual probes, including false premises, unknown incidents, identity confusion, invented scripture, hidden-information questions, and attempted state mutation. Require zero canonical-stat mismatches and zero unauthorized simulation changes. Human review assesses character consistency and unsupported memories. If the feature fails, retain authored dialogue; the core game and optional Christ episode still function offline.

## 18 Performance budgets and measurement

Freeze one reference configuration for reproducible measurements: proposed Windows 11 x64, Ryzen 5 5600, GeForce GTX 1660 Super 6 GB, 16 GB RAM, SSD, 1920 by 1080, release export, 1x speed. This is a benchmark target selection, not a measured minimum specification or a hardware purchase recommendation. Record exact driver, engine, runtime, content hash, power settings, and capture method with every result.

| Budget | Proposed target | Measurement rule |
| --- | --- | --- |
| Presented frame time | P95 at or below 16.7 ms | Measure ordinary observation and the crowded finale independently |
| Main-thread CPU | P95 at or below 6.5 ms per rendered frame | Include UI, scene updates, animation submission, and presentation work |
| Complete simulation tick | P95 at or below 9 ms; P99 at or below 20 ms | All 136 actors; repeat with 137 and guest effects |
| AI decision and coordination | P95 at or below 5 ms per simulation tick | Include urgent bursts, ordinary decisions, planning, and clan proposals |
| Aggregate CPU work | P95 at or below 16.7 ms per 16.7 ms observation window | Sum tagged main and worker CPU work in actual windows; do not add independently measured percentiles |
| GPU time | P95 at or below 14 ms | Leaves presentation headroom; inspect shadows, skinning, and transparency separately |
| Resident process memory | At or below 3 GB after a complete match | Excludes optional LLM; track peak and repeated-run growth |
| GPU memory | At or below 3.5 GB on the reference GPU | Include textures, shadows, terrain, and character variants |
| Urgent response | At most 5 ticks after valid threat evidence | Report maximum and distribution, not only average |
| Law recovery | At most 10 ticks after relevant notice or transition | Illegal execution stops immediately; useful replanning has the bounded latency |

The five-millisecond AI target is deliberately applied to each full simulation tick, including a synchronized event burst. Offloading it to another thread does not make its CPU cost disappear. The aggregate CPU metric preserves the GDD's overall budget, while frame time and GPU time capture the player's visible experience. Budget allocations may change after profiling; the required behavior does not.

### Workload matrix

Measure quiet gathering, night preparation, six busy camps, a wolf encounter, a multi-clan raid, a public law amendment affecting all actors, dense staging migration, all 100 contestants in the refuge, active Story teaching, and checkpoint/finalization. Include the maximum legal camp/socket fill, not only a sparse test island.

Run five repeated captures after warm-up for each expensive scene and report median, P95, P99, worst sustained slowdown, allocations, queue depth, and decision latency. Compare 1x, 2x, and 4x using identical inputs and hashes. Four-times speed is exposed only when the current workload can deliver complete steps; otherwise show actual acceleration. A smooth camera over a lagging simulation is a failed performance result.

### Deterministic CI ceilings

Record route expansions, LOS rays/cells, planner method expansions, candidates scored and reservation attempts per tick and fixture. Version measured accepted ceilings and fail unexplained regressions on any runner. Bootstrap ceilings are proposed until evidence establishes them; do not invent golden numbers. Allocation bytes and elapsed time remain diagnostics, not assumed deterministic counters. Budget caps never justify delaying urgent observations beyond the GDD limit. Performance acceptance still requires identified reference-hardware captures.

### Data and optimization order

Store hot position, velocity, health, needs, action state, and clan membership in compact indexed arrays. Use generation-tagged entity handles when reusing slots. Keep dictionaries for cold lookup and tooling, with sorted iteration where consequential. Avoid per-tick LINQ, closures, temporary lists, and string formatting in hot loops; allocate explanation text only when displayed.

First profile broad-phase queries, LOS, route expansions, planner fan-out, interop, and animation. Then cache stable computations, pool scratch buffers, reduce duplicate work, and chunk static rendering. Change expensive visual effects before degrading semantic correctness. A native spatial extension or specialized job scheduler is a measured later option, not the opening architecture.

Initial internal memory envelopes are 32 MB for actor and relationship state, 64 MB for beliefs/plans/traces, 128 MB for world/navigation, and 64 MB for active journals and handoff buffers. These total 288 MB before assets and engine overhead. Keep long debug traces in bounded rings and spill selected evidence to disk. Stress save size and memory after ten consecutive matches to catch retention leaks.

## 19 Simulation laboratory and developer tools

Build an in-game developer view and a headless runner around the same diagnostic contracts. The lab should answer four practical questions: what happened, what did the actor know, why was this plan chosen, and where did execution diverge from expectation?

The selected-actor inspector shows live intent, candidate scores, perception evidence, plan steps, dependencies, reservations, path, danger estimate, law permissions, and recent failures. Overlay modes show only one relationship at a time: actor vision, route and work positions, legal scopes, or belief locations. Display unknown and stale information explicitly.

### Failure package

A failing invariant writes a bounded package containing build and content identity, fixture and seed, the last valid snapshot, subsequent ordered inputs, relevant committed events, subsystem hashes, the tested actor's decision trace, and profiler counters. Attach a screenshot only when a rendering failure is relevant. A developer should be able to open the package directly in the lab and reach the failure without manually recreating the island.

Use a small intended CLI contract:

```text
clanlab run --fixture law-impact --seed 4107 --max-ticks 12000
clanlab batch --suite standard-release --seeds seeds-v1.json
clanlab replay --bundle failure.tlc --until-tick 10800
clanlab compare --left baseline.tlc --right experiment.tlc
```

These commands are planned interfaces, not existing tools. Their machine-readable output includes success status, result, first failed invariant, first divergent tick, actor IDs, response latencies, and evidence paths. Parallel batch execution launches separate isolated matches with separate output directories and career databases.

### Counterfactual investigation

From a checkpoint, branch with one changed law or one swapped trait and rerun with the same other inputs. Show the first changed decision, its consideration values, and subsequent outcome differences. Because a changed decision can alter future random consumption and encounters, this is a controlled experiment, not proof that the changed factor alone explains every later event.

Also provide decision-local comparison: score the same frozen knowledge snapshot under two profiles without advancing the world. That isolates a temperament multiplier more cleanly than comparing two entire matches. Keep experiment results out of canonical careers and ordinary player forecasts.

### Useful batch metrics

Track avoidable opening deaths, resource shortages, idle time by reason, reservation contention, repeated route failure, task completion, deliberate waiting, abandoned rescues, known versus unknown treaty breaches, law violations, and final result classification. Group by contestant, spawn region, clan size, equipment, alliance size, and intervention pattern. Averages must link to individual runs; the aggregate should help find a story or bug, not hide it.

## 20 Verification and GDD traceability

Verification is layered by risk. Fast contract tests cover legality, arithmetic, conservation, attribution, and persistence transactions. Headless scenario tests cover decisions and interacting systems. Rendered tests cover visual alignment, input, animation, UI, and packaging. Human sessions test whether actual behavior creates understandable, memorable contestants.

Property-based tests generate competing transfers, interrupted construction, overlapping laws, and simultaneous damage. Assert invariant properties rather than repeating the implementation's formula in another method. Metamorphic tests change entity iteration order, render speed, camera position, observer activity, or hidden information and check the required invariance. Use recorded seeds whenever a generated case fails.

### All 51 GDD acceptance scenes have a test home

GDD_TRACEABILITY.md provides every original setup/pass condition, completing packet, owner and first full gate; state/acceptance_map.json is the machine-readable version. G1 proves the initial food/navigation/threat/law foundations; complete missing-tool planning, legal paid amendments, social behavior, careers and forecasts close at G2. Full Standard ending/clock/Influence boundaries, building conservation and 100-person traffic close at G3. Presentation closes at G4 and all Story scenes at GS. GR reruns the complete 51-scene set against the integrated release candidate. Foundational partial evidence never substitutes for a later full scene.

G0 is toolchain feasibility, G1 first playable, G2 Trial and comprehension, G3 Standard/Custom, G4 content/presentation, GS shipping Story, GR release candidate and GL optional local conversations. G4 and GS are required before GR; GL may remain deferred. Story-disabled equivalence must hold for the final core, not merely a stub guest prototype.

### Batch release contract

Run at least 100 varied fixed-seed Standard matches using scripted legal intervention schedules. Require zero illegal damage, duplicated resources, duplicated career results, or unresolved simulation deadlocks. Investigate every avoidable opening death and unexplained stuck duration over ten simulation seconds. All runs must terminate within 36,000 ticks with an explicit result.

The GDD's baseline target of at least 95 percent winners before the cutoff is a tuning hypothesis, not a universal assertion about all legal schedules. Report passive and coalition-heavy stress sets separately. A legitimate draw can pass correctness while still identifying a pacing or balance problem. Never alter the winner evaluator to make a test percentage look better.

For every release candidate, run the full suite with both Story disabled and enabled fixtures, verify replay hashes at all supported speeds, and perform repeated save/load/finalization fault injection. A nonzero invariant violation blocks release regardless of average frame rate or win rate.

### Player evidence

At the Trial slice, test with ten new players and seek the GDD's eight-of-ten comprehension result: recall three contestants, explain two consequential decisions, and identify the next law transition without coaching. Ask which contestant they want to follow again. Record when they misread deliberate waiting as a broken bot. Fix presentation or behavior based on that evidence before increasing content variety.

Story testing additionally checks voluntary participation, different listener reactions, the distinction between a teaching and a hard law, and the selected ending. The player must understand that guest arrival is optional. LLM factual probes cannot substitute for this authored-episode test.

## 21 Repository build and distribution

Use one repository with clear assembly dependencies. Keep the simulation compiling without the Godot SDK, graphics libraries, SQLite, or dialogue runtime. The client and tools depend inward on contracts and simulation assemblies. A static dependency test rejects accidental engine references in core projects.

| Repository area | Contents |
| --- | --- |
| src/Sim.Contracts | IDs, commands, events, snapshots, units, and result contracts |
| src/Sim.Core | Tick systems, economy, laws, social state, combat, and result evaluation |
| src/Sim.Spatial and src/Sim.AI | Pure world queries, navigation, beliefs, goals, and planning |
| src/Sim.Story | Guest policy and episode evaluator |
| src/Persistence | Snapshot codecs, journal recovery, SQLite projection |
| game/ | Godot project, C# presentation adapters, scenes, themes, shaders, imported assets |
| content/ | Source definitions, localization keys, schema versions, map recipes |
| art/ | Source Blender files, textures, rig, animation, export scripts |
| tools/ | Content compiler, fixture runner, replay tools, build scripts |
| tests/ | Contract tests, scenario fixtures, seed sets, golden outputs, migration cases |
| docs/adr | Architecture decisions, benchmark evidence, rules clarifications |

Pin the SDK in global.json, packages through central package management and lock files, and engine/template binaries by version and checksum. Store importer settings and generated catalog hashes. Asset sources and exports use stable IDs so renaming a mesh does not break a saved appearance. Content and build versions appear in every diagnostic bundle.

### Continuous integration

Every change runs compilation, static checks, content validation, and the short invariant suite. Changes to laws, movement, actions, AI, or serialization additionally run their affected scenario fixtures and a seeded smoke batch. Nightly builds run the larger Standard batch, replay comparison, and package export. Dedicated reference hardware runs performance and visual captures; a variable hosted runner cannot establish the shipping frame-time budget.

Automate Godot import and release export from the command line with pinned templates. Godot documents headless operation and export commands; the build script must use the verified syntax for the selected version and fail when import or C# compilation fails. [Godot command-line workflow](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html).

Release artifacts include the executable, content package, required runtime/native dependencies, licenses, and build manifest. Test them on a clean offline machine. Store saves in a per-user writable location with backups and clear delete/export controls. A Steam build is the proposed eventual distribution package, with local save and career storage continuing to work without platform services. Store integration, achievements, cloud saves, and signing are later release tasks, not prerequisites for the first playable.

### Bounded trust surface

Validate lengths, counts, IDs, decompressed sizes, and schema versions when loading saves or content. Never deserialize executable types from files. LLM output is inert data. The base game makes no required network calls. Crash-report export is user-initiated and previews the data included; local diagnostics do not upload automatically. Modding is data-only experimentation in Custom branches until a separate mod contract exists.

## 22 The first playable scene

The first playable should make the central idea understandable in a few minutes: recognizable people pursue survival, the player sees an announced rule, and personalities produce different sensible reactions. Build one authored 180 by 180 m coastal valley using the production data and simulation systems. It contains two camp sites, a wooded route, berry patches, a shallow crossing, and one deliberately testable bottleneck.

Eight named contestants use distinct silhouettes and the initial shared animation kit. They acquire food, carry materials, build a Hearth and shelter, exchange an item, react to a visible wolf, and respond to a scheduled truce. The scene runs through a short authored calendar intended for demonstration and diagnostics; it is visibly labeled a development scenario, not Standard.

### A coherent viewing sequence

The opening camera shows a cook taking food toward a camp and a builder gathering at a work site. Selecting either reveals a short intent, current need, and two real considerations. A cautious contestant avoids the wolf route; a better-equipped contestant can approach with a different risk estimate. In this Fixture-profile demonstration, the player submits a supported truce with sixty-second notice (the full paid-power scheduler follows in P2), sees the countdown, and follows a patient contestant waiting for its expiry while another uses the time to prepare.

These are fixture opportunities, not forced outcomes. If a contestant is already hungry or injured, the relevant alternative must remain possible. The developer can reset the seed to make comparison useful, but the presentation cannot script an apparently autonomous rescue or fight.

### Exit criteria

- Eight contestants finish meaningful survival and work sequences without fabricated resources, teleportation, or unexplained inactivity.
- One obstacle change, one scarce-input conflict, one threat interrupt, and one law-boundary impact pass their fixtures.
- Selection, follow, pause, speed control, timeline, intent, Why, and the committed-event feed work in the exported build.
- Character identity, carrying, tool use, waiting, and danger are readable at the default camera distance.
- Save/load restores the same next 600 ticks in the exact build; a failure package opens in the lab.
- The separate 136/137-actor fixture has measured CPU, GPU, memory, and response latency. It need not yet contain the complete economy, but its workload omissions are listed.

G1 follows the accepted P0 and P1 packets; no calendar duration is promised before measured throughput exists. It is a reviewable executable with a small evidence report. A video alone is insufficient because the next step depends on inspectable decisions and repeatable runs.

## 23 Agent delivery roadmap and approval gates

Use The_Last_Clan_Agent_Work_Phases_v2.md and state/workboard.json as the complete execution breakdown. P0/G0 proves tooling; P1/G1 proves the first playable; P2/G2 proves Trial and player comprehension; P3/G3 proves Standard and Custom; P4/G4 completes presentation/history; P5/GS completes the opt-in Story; P6/GR proves the release candidate. PX/GL is optional and never blocks release.

One work packet is the unit of an agent session, not a whole milestone. Each has one owner, dependencies, source references, observable acceptance checks and an independent reviewer. A0 controls contracts, baseline integration and dispatch. Default concurrency is four disjoint builders with a bounded review queue. P4 and P5 can overlap after G3 when their exact dependencies and file ownership allow it. Integrate each guest increment disabled by default rather than maintaining a long-lived divergent phase branch.

Each agent returns actual source, checksums, a handoff and exact test evidence. A0 integrates against the dispatched baseline, resolves stale returns, verifies the merged build and records acceptance. Jani then authorizes the next packet. At milestone boundaries, Jani approves the next phase only after concrete gate evidence. A repair plan does not waive failed comprehension, missing GPU validation or incorrect simulation behavior.

Replace the former human staffing calendar with measured throughput after P0 and P1: accepted packets per week, median and slow-tail review time, rework ratio, blocked-tool time, unresolved integration queue and human test availability. Estimate remaining work by packet complexity and dependency critical path; raw packet count alone is not a schedule. Keep a contingency range grounded in observed rework. No model-brand price assumption determines game scope.

If a packet exceeds context, checkpoint code and exact resume instructions and continue the same authorized packet in a fresh chat. Split the remaining work into numbered children if needed without removing aggregate acceptance criteria. Quality is preserved by smaller scope and evidence, not by a promise that a context cutoff cannot happen.

## 24 Implementation packets and definition of done

The complete packet catalog lives in work/ and state/workboard.json, with phase summaries in phases/. The initial dispatch is P0-01 only after Jani pastes the bootstrap prompt. Follow dependency acceptance, shared contract version and file ownership. The eight agent briefs contain role-specific prompts and complete phase queues.

Done means the intended behavior exists in the actual returned files; meaningful relevant fixtures and contract checks ran; failure modes and state serialization are covered; source/contract/content hashes are stated; no unavailable check is labeled passed; independent review succeeded; and the merged baseline was validated. The author says READY_FOR_REVIEW, never unilaterally ACCEPTED.

The fixture DSL and JSON schema are supplied in contracts/. Five selected replay seeds run for consequential changes; random-tick save/load checks compare uninterrupted continuation; checkpoint-frequency invariance runs at integrated gates; malformed input fuzz, semantic assembly rules, reason-code text coverage, intentional catalog goldens and truthful Why alternatives have named regression homes. Human visual and player-comprehension checks remain explicit. Code-only or content-only changes use relevant validation rather than redundant tests that mirror implementation.

No prototype profile, FakeSim, synthetic stress fixture, unrun screenshot or author assertion can stand in for the production providers required by a later gate. On final release, every one of the GDD's 51 acceptance scenes has a test home and complete evidence, plus the additional architecture/save/performance/Custom/history tests in this kit.

## 25 Risk register and technical decisions

| Risk | Earliest evidence | Response and accountable role |
| --- | --- | --- |
| Godot and .NET packaging mismatch | G0 clean-machine export | Client engineer verifies exact versions or revises ADR 001 before production growth |
| Custom navigation consumes too much effort | G1 bottleneck and full socket fixture | Spatial engineer tightens geometry scope and compares a pure-library route implementation before extending algorithms |
| AI plans are valid but uninteresting | G2 player recall and decision traces | Designer and AI engineer adjust incentives, opportunities, and presentation together |
| Law changes create expensive replan bursts | G0/G2 synchronized-boundary profile | AI engineer budgets urgent queues and caches future permissions without delaying hard cancellation |
| Hidden-state leaks undermine trust | G1/G2 metamorphic tests | Simulation lead narrows knowledge interfaces and rejects omniscient convenience queries |
| Save and career duplication | G2 crash matrix | Persistence owner fixes transaction and branch registry before any public test with valued careers |
| Full-cast finale becomes unreadable or jammed | G3 100-person convergence | Spatial and client owners fix route capacity, labels, camera, and animation budgets |
| Story adds a second rules engine | Neutral guest fixture and GS regression | Simulation lead requires the shared action/permission path; designer owns authored episode rules |
| LLM invents memories or consumes too much RAM | GL factual and loaded-game hardware probes | Keep authored dialogue; LLM remains optional |
| Content workload outpaces tools | G2 authoring throughput | Designer and technical artist prioritize validators and previews for repeated work |

### Architecture decision records

| ADR | Decision for the first implementation | Revisit trigger |
| --- | --- | --- |
| 001 | Godot .NET plus pure C# core; bounded TypeScript comparison | Measured export, workflow, or performance failure in G0 |
| 002 | One simulation writer and fixed 10 Hz ticks | Correct full-population profile proves a specific need for deterministic parallel jobs |
| 003 | Shared height field, grid navigation, kinematic collision | A required GDD mechanic cannot be represented without an explicit scope change |
| 004 | Utility plus authored task methods and executor states | Controlled GOAP comparison shows better completion, recovery, and authoring cost |
| 005 | Snapshot/input replay plus transactional career projection | Measured save size, migration, or recovery constraints |
| 006 | Authored episode independent of optional LLM | A separately passed GL gate justifies adding conversation |

### Adopted GDD clarifications

The_Last_Clan_GDD_v1_1_Addendum.md records D01 support-before-damage, D02 tick rounding, D03 single-skill bow handling, D04 rejected-command forecast semantics, D05 body size and strategic travel validation, D06 asset-technique-independent visual acceptance, D07 catalog profiles, D08 the Trial calendar and D09 exclusive closing windows. These are explicit adopted design records, not facts retroactively attributed to the original GDD. GDD_TRACEABILITY.md resolves the review's sixteen provenance questions and maps all 51 scenes to owners and gates.

### Additional agent-delivery risks

Contract drift across chats is controlled by A0-owned versions and consumer samples. Stale archives are controlled by exact base hashes and staged integration. Review overload is controlled by a four-return queue and dispatch throttling. Unavailable rendering/hardware remains a visible blocker with reproducible capture instructions. Procedural art quality is controlled by the same visual gate as imported assets. Context loss is controlled by durable code checkpoints and explicit incomplete status. None of these controls guarantees a schedule; they make failures visible and recoverable.

## 26 Sources

The original technology references were checked on 10 September 2026; the Godot 4.7.2 maintenance archive was checked on 11 September 2026. Linked sources support platform capabilities and implementation constraints; the game's architecture, budgets, estimates, and acceptance choices are project recommendations. Pin the exact engine, runtime, and package versions after the feasibility export rather than treating a moving documentation page as a dependency lock.

| Source | Used for |
| --- | --- |
| [Godot 4.7.2 stable archive](https://godotengine.org/download/archive/4.7.2-stable/) | Available .NET desktop builds and matching export templates |
| [Godot C# documentation](https://docs.godotengine.org/en/stable/tutorials/scripting/c_sharp/c_sharp_basics.html) | SDK setup, desktop/web scope, and C# interop considerations |
| [Godot thread-safe APIs](https://docs.godotengine.org/en/stable/tutorials/performance/thread_safe_apis.html) | Scene-thread ownership and engine API constraints |
| [Godot MultiMesh documentation](https://docs.godotengine.org/en/stable/tutorials/performance/using_multimesh.html) | Static-instance batching and group culling limitation |
| [Godot 3D asset formats](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/available_formats.html) | GLB/glTF pipeline and Blender import behavior |
| [Godot command-line workflow](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html) | Headless tooling and automated export |
| [Microsoft .NET support policy](https://dotnet.microsoft.com/en-us/platform/support/policy) | Runtime support horizon and SDK selection |
| [Microsoft.Data.Sqlite transactions](https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/transactions) | Transactional career persistence |
| [David Graham on utility theory](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter09_An_Introduction_to_Utility_Theory.pdf) | Utility-based decision-making background |
| [llama.cpp](https://github.com/ggml-org/llama.cpp) and [schema tooling](https://github.com/ggml-org/llama.cpp/blob/master/examples/json_schema_to_grammar.py) | Optional local inference and constrained output shape |
