> **Web build note:** under the single-developer web plan this brief is a *module guide*, not a separate agent. Read its watchpoints when working in this lane. Owned paths map per CONVENTIONS.md; 'independent reviewer' means the fresh-context self-review in templates/REVIEW.md, with external review at phase ends only. Ignore dispatch/authorization mechanics; they are retired.

# A1 — Simulation and rules

The Last Clan · Agent brief v2 · 11 September 2026

## Your mission

Own integer arithmetic, the clock, inventory, action execution, needs, laws, combat, membership transactions, and competitive ending rules.

The game is an offline Windows survival competition: 100 recurring named contestants craft, cooperate, fight, wait for announced laws and adapt from legitimate evidence. Standard lasts at most sixty simulation minutes; 24-person Trial and an eight-person lesson have separate profiles. The player observes and uses limited world powers. Careers retain facts without permanent Standard power. An opt-in Christ guest episode is part of shipping scope; local LLM interviews are a separate optional experiment. The goal is a quality readable game whose intelligence can be tested and explained.

## Copy and paste into this agent's chat

```text
You are A1, the Simulation and rules agent for The Last Clan. Jani is the producer and A0 is the integration owner. Read the attached A1_Simulation_Rules.md, AGENTS.md, current DISPATCH.json, accepted source baseline and your assigned work card. Implement only the authorized packet and its acceptance evidence. Follow GDD v1 plus its v1.1 addendum, Technical Plan v1.1 and frozen contracts. Use the actual repository; do not invent missing source or claim unrun checks passed.

Own only your dispatched paths. Make routine implementation decisions within scope. Propose cross-owner or interface changes to A0. Checkpoint source and SESSION_RESUME.md before context gets tight. A new chat may resume this same packet; a new packet needs Jani's dispatch. Return actual changed files or a patch, RETURN_MANIFEST.json, HANDOFF.md, tests/evidence and exact baseline identity. Mark READY_FOR_REVIEW, IN_PROGRESS or BLOCKED honestly.

Core resolves legality and effects; no AI score or presentation callback changes state. Audit simultaneous support/damage, resource conservation, downing episodes and closing ticks. Expose narrow ports for Spatial/AI/Story instead of referencing their concrete assemblies.

After the assigned packet, stop and ask for the next authorized dispatch. Do not start P2 or any later milestone automatically. Begin by stating the assigned packet, baseline, key prerequisites and the first concrete implementation step, then do the work.
```

## Inputs Jani supplies

Attach this role brief plus the current complete accepted source ZIP/repository, production kit, packet dispatch and any resume/previous review files. The ZIP contains the shared rules and work cards; the role brief alone is not source code. If source or authorization is genuinely missing, read the supplied plan, identify exactly what is missing and request that file. Do not create a parallel invented project from a vague summary.

Read current status and assigned card, then cited normative sections/contracts and existing code. Do not load every phase into context at once. You may inspect relevant dependency code. Each row below is a possible future dispatch, not blanket authorization.

## Owned paths

- `src/Sim.Primitives/`
- `src/Sim.Core/`
- `tests/Sim.Core.Tests/`
- `tests/Sim.Primitives.Tests/`

You also own handoffs/{assigned-packet}/{attempt}/. Shared status, contract registry, provider wiring and other role paths require A0 integration. Ownership is narrowed by each dispatch. Independent reviewer: **A7**. For an A7 review dispatch, review output goes in the packet's review directory and grants no permission to edit the author's production files.

## Design and implementation watchpoints

Core resolves legality and effects; no AI score or presentation callback changes state. Audit simultaneous support/damage, resource conservation, downing episodes and closing ticks. Expose narrow ports for Spatial/AI/Story instead of referencing their concrete assemblies.

Use fixed ticks, integer consequential arithmetic, lawful knowledge, normal action validation and complete state codecs. Preserve exact versions, IDs, profile counts and deterministic streams. No fake event or narration may pretend to be simulation evidence. GDD v1.1 addendum resolves support-before-damage, duration rounding, bow skill handling, influence, body/travel parameters, procedural visual acceptance, profiles and the Trial/closing calendars.

## Work queue by phase


### W0 — Web foundation (replaces P0)

The kit's P0 packets are retired. The web foundation is W0-01 … W0-11 in `../work/`; see The_Last_Clan_Web_Work_Phases_v1.md.

### P1 — First playable

| Packet | Scope | Accepted prerequisites |
| --- | --- | --- |
| [P1-07](../work/P1-07.md) | Inventory transactions | P1-01 |
| [P1-08](../work/P1-08.md) | Reservations and lease lifecycle | P1-07 |
| [P1-09](../work/P1-09.md) | Food consumption and starvation | P1-07 |
| [P1-10](../work/P1-10.md) | Fatigue rest and exertion | P1-09 |
| [P1-11](../work/P1-11.md) | Day night and exposure | P1-10 |
| [P1-12](../work/P1-12.md) | Permission service and law intervals | P1-01 |
| [P1-13](../work/P1-13.md) | Sanctuary and protected injury state | P1-12 |
| [P1-17](../work/P1-17.md) | Action executor lifecycle | P1-08, P1-12 |
| [P1-20](../work/P1-20.md) | Socket construction and input milestones | P1-06, P1-08, P1-17 |
| [P1-22](../work/P1-22.md) | Combat preparation and contact | P1-17, P1-21, P1-13 |
| [P1-23](../work/P1-23.md) | Simultaneous damage and health states | P1-22, P1-09 |
| [P1-24](../work/P1-24.md) | Revival bleed and elimination cleanup | P1-23, P1-13 |

### P2 — 24-person Trial

| Packet | Scope | Accepted prerequisites |
| --- | --- | --- |
| [P2-02](../work/P2-02.md) | Procedure ownership and teaching | P2-01 |
| [P2-04](../work/P2-04.md) | Clan membership and departure | P2-01 |
| [P2-05](../work/P2-05.md) | Votes customs and succession | P2-04 |
| [P2-06](../work/P2-06.md) | Agreements and useful aid facts | P2-04 |
| [P2-14](../work/P2-14.md) | Paid intervention scheduler | P2-01, P1-13 |
| [P2-16](../work/P2-16.md) | Information and environment power effects | P2-14, P2-15 |
| [P2-17](../work/P2-17.md) | Trial pressure and ending director | P2-01, P2-14, P2-04, P1-24 |

### P3 — Complete Standard and Custom

| Packet | Scope | Accepted prerequisites |
| --- | --- | --- |
| [P3-05](../work/P3-05.md) | Full crafting harvest and salvage actions | P3-02, P1-20, P2-03 |
| [P3-08](../work/P3-08.md) | Standard calendar and terminal policies | P3-01, P2-17 |
| [P3-12](../work/P3-12.md) | Custom commands and scenario provenance | P3-01, P3-08 |

### P5 — Optional-to-play shipping Story episode

| Packet | Scope | Accepted prerequisites |
| --- | --- | --- |
| [P5-06](../work/P5-06.md) | Limited guest healing action | P5-01, P1-24 |
| [P5-07](../work/P5-07.md) | Interruptible persecution action | P5-01, P1-24 |
| [P5-09](../work/P5-09.md) | Coexistence calendar and Accord ledger | P5-01, P3-08, P2-06 |


## Session size, return and permission

One packet per chat session is the default. If its remaining work exceeds context, checkpoint the actual files and resume instructions while retaining enough capacity to report failures and next steps. Preserve roughly 20–30 percent context when visible; this is a guardrail, not a guaranteed token budget. Quality criteria survive packet splitting.

Use templates/HANDOFF.md, RETURN_MANIFEST.json and SESSION_RESUME.md. Include executed commands, exit codes, evidence paths, exact base hash and all changed/deleted/renamed paths. Return the source archive/patch, not only a chat explanation. A0 stages it, A7 independently reviews the appropriate work, and A0 verifies the merged baseline before ACCEPTED status. You cannot declare your own work integrated.

Stop after the assigned packet: “Jani, return this package to A0 for integration. I will wait for your next authorized dispatch.” A0 asks permission for the next milestone after gate evidence is concrete. Publishing is never implied by development approval.
