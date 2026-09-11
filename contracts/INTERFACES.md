> **Web build note (v2.0):** paths and stack terms map per CONVENTIONS.md (C# assemblies → TypeScript packages; SQLite → IndexedDB; Godot capture → `/capture` under Playwright; `clanlab` is a Node CLI). Semantics are unchanged.

# Shared interface contract — design version 0

This is the contract to implement and freeze in P0-04/P1-01; it is not a claim that code already exists. A0 owns accepted interface versions. Each incompatible change requires a reviewed contract-change record and affected consumer tests before integration.

## Compile-time dependency direction

| Assembly | May reference | Must not reference |
| --- | --- | --- |
| Sim.Primitives | Platform base library | Any project assembly or Godot |
| Sim.Contracts | Sim.Primitives | Core, AI, Spatial, Story, client, persistence |
| Sim.Core | Primitives, Contracts | AI/Spatial/Story concrete implementations or Godot |
| Sim.Spatial | Primitives, Contracts | Core mutable state, AI, Godot |
| Sim.AI | Primitives, Contracts | Core/Spatial implementation, observer, careers, Godot |
| Sim.Story | Primitives, Contracts | Godot, careers or unrestricted mutable Core |
| Observer | Primitives, Contracts | Mutable simulation implementations |
| Persistence | Primitives, Contracts | Scene objects or live arrays |
| Sim.Host | Core, Spatial, AI, optional Story, Contracts | Godot scene tree |
| Godot composition / ClanLab | Host and relevant read/persistence adapters | Different gameplay implementations |

Core invokes registered ports; Host constructs and injects providers. World state lives in Core-owned components and provider-owned sections with one authoritative simulation-thread writer. Contracts expose immutable records or carefully scoped query ports. No “temporary” global service locator returns World to AI. ContentCompiler emits immutable contract definitions, so Core never depends on the authoring tool.

## Boundary records and owners

| Record/port | Required contract | Owner / first freeze |
| --- | --- | --- |
| PlayerCommand | Client sequence, run ID, expected rule version, operation, typed payload; assigned execution tick in journal | A0 / P0-04 |
| CommandAck | Sequence, accepted/rejected, assigned tick, reason ID, resulting rules version; no false successful UI state | A0 / P0-04 |
| ActionRequest / Result | Actor, plan, action definition, target, dependencies, lease handles; typed failure, no direct mutation access | A0 / P1-01 |
| ActorKnowledgeView | Self state plus public notices and observed/reported facts with observed tick, source, uncertainty, expiry | A0 / P0-04, refined P1-01 |
| IPerceptionQuery | Queries authorized for an observer, physically evaluated in Spatial; returns evidence records, not a global entity list | A0 / P1-01 |
| IRouteQuery | Actor-known graph/public graph context, start/destination, budget; Complete/Partial/BudgetExhausted/NoKnownRoute | A0 / P1-01 |
| RouteResult | Path geometry/version, certified portal for Partial, progress witness, reason; queued-before-service is separate from search result | A0 / P1-01 |
| DamageProposal | Source actor/hazard, episode, victim, amount, damage class, permission evidence and contact tick | A0 / P1-01 |
| DecisionTrace | Candidate IDs actually evaluated, scored considerations, chosen ID, evidence references/ages and rejection reasons | A0 / P0-04 |
| CommittedEvent | Run/branch, monotonic sequence, tick/stage, typed payload, actor/target IDs, causal parents; factual versus reported status | A0 / P0-04 |
| RenderSnapshot | Confirmed tick, transforms, identity/action/law views; explicit buffer ownership; no mutation callback | A0 / P0-04 |
| IStateSectionCodec | Stable section ID/version, capture/restore, canonical hash contribution, validation, required/optional flag | A0 / P0-04 |
| ContentProfile | Fixture/Prototype8/Trial24/Standard100, declared actor/recipe sets, capabilities, provenance | A0 / P0-04 |
| FinalResult | Unique run/branch result key, payload hash, mode, roster, outcome, event range and contributor facts | A0 / P0-04 |

Mandatory IDs for v0 reason registry include WaitingForLaw, RouteBlocked, BudgetExhausted, NoKnownRoute, MissingProcedure, ReservationLost, InsufficientTime, TargetUnobserved, MembershipLocked, StaleRules, InsufficientInfluence, NoticeTooShort and ProfileUnsupported. The final registry is compiled from implemented definitions; every reason needs player text and required debug fields. Neither this minimum nor a stub reason silently satisfies an unimplemented action.

## Required boundary samples and fakes

P0-04 writes valid command/ack/event/trace/snapshot/result samples plus rejection and unknown-version samples in contracts/samples/. Samples have schema versions and canonical expected encodings produced and independently reviewed during implementation; this kit supplies no invented runtime hash. FakeSim uses the same frozen view records, carries an unmistakable FAKE watermark, and cannot supply gameplay or career acceptance evidence. The minimal real G0 kernel covers only its declared synthetic fields.

Provider contracts are frozen incrementally before consumers: P1 first playable; P2 social/Trial; P3 Standard/Custom; P4 observer/content; P5 guest. A missing interface becomes an A0 contract-change packet, with consumers blocked until integration. This keeps role ownership meaningful instead of giving every agent permission to rewrite the shared model.

## Search, snapshot and information rules

Route search and method expansion complete atomically inside their deterministic per-tick budget. Partial is allowed only for a valid traversable segment reaching a certified nearer portal or other explicit progress waypoint, with a stable progress measure. Mere budget exhaustion is BudgetExhausted and cannot masquerade as a useful Partial path. The scheduler saves queued requests and retry history, not an active A* frontier. Repeated requests must progress, select an alternative or produce bounded recovery; an insufficient budget is a measured engineering defect.

Share only corridors computed from published topology. Validate that public-only construction itself never consulted concealed graph information. Private routes use known-subgraph content hashes and traversal policy, or remain actor-local. A hidden route changing must not change a bot's path, failure, choice or visible scheduling before lawful observation. Cache hit timing cannot alter simulation decisions. Static terrain data means height, openness and cover; LOS is queried on demand with counted work.

Snapshots include all provider-owned consequential state, random streams, input order, routes already returned, queue/retry state, beliefs, messages, leases and progress. Planner search scratch is transient because each search is atomic. Same-build exact replay covers the validated runtime/platform family; cross-version or cross-platform equivalence is a separate measured capability.
