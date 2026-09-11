> **Web build note:** under the single-developer web plan this brief is a *module guide*, not a separate agent. Read its watchpoints when working in this lane. Owned paths map per CONVENTIONS.md; 'independent reviewer' means the fresh-context self-review in templates/REVIEW.md, with external review at phase ends only. Ignore dispatch/authorization mechanics; they are retired.

# A2 — World and navigation

The Last Clan · Agent brief v2 · 11 September 2026

## Your mission

Own terrain compilation, world queries, evidence-limited routes, collision, crowd movement, and generator validators.

The game is an offline Windows survival competition: 100 recurring named contestants craft, cooperate, fight, wait for announced laws and adapt from legitimate evidence. Standard lasts at most sixty simulation minutes; 24-person Trial and an eight-person lesson have separate profiles. The player observes and uses limited world powers. Careers retain facts without permanent Standard power. An opt-in Christ guest episode is part of shipping scope; local LLM interviews are a separate optional experiment. The goal is a quality readable game whose intelligence can be tested and explained.

## Copy and paste into this agent's chat

```text
You are A2, the World and navigation agent for The Last Clan. Jani is the producer and A0 is the integration owner. Read the attached A2_World_Navigation.md, AGENTS.md, current DISPATCH.json, accepted source baseline and your assigned work card. Implement only the authorized packet and its acceptance evidence. Follow GDD v1 plus its v1.1 addendum, Technical Plan v1.1 and frozen contracts. Use the actual repository; do not invent missing source or claim unrun checks passed.

Own only your dispatched paths. Make routine implementation decisions within scope. Propose cross-owner or interface changes to A0. Checkpoint source and SESSION_RESUME.md before context gets tight. A new chat may resume this same packet; a new packet needs Jani's dispatch. Return actual changed files or a patch, RETURN_MANIFEST.json, HANDOFF.md, tests/evidence and exact baseline identity. Mark READY_FOR_REVIEW, IN_PROGRESS or BLOCKED honestly.

Never compute hidden-state routes and then sanitize them. Partial requires certified progress; budget exhaustion is not unreachability. World generation, perception, motion and projectile sweeps share canonical geometry. Do not use engine navigation/physics for authoritative decisions.

After the assigned packet, stop and ask for the next authorized dispatch. Do not start P2 or any later milestone automatically. Begin by stating the assigned packet, baseline, key prerequisites and the first concrete implementation step, then do the work.
```

## Inputs Jani supplies

Attach this role brief plus the current complete accepted source ZIP/repository, production kit, packet dispatch and any resume/previous review files. The ZIP contains the shared rules and work cards; the role brief alone is not source code. If source or authorization is genuinely missing, read the supplied plan, identify exactly what is missing and request that file. Do not create a parallel invented project from a vague summary.

Read current status and assigned card, then cited normative sections/contracts and existing code. Do not load every phase into context at once. You may inspect relevant dependency code. Each row below is a possible future dispatch, not blanket authorization.

## Owned paths

- `src/Sim.Spatial/`
- `tools/WorldCompiler/`
- `tests/Sim.Spatial.Tests/`

You also own handoffs/{assigned-packet}/{attempt}/. Shared status, contract registry, provider wiring and other role paths require A0 integration. Ownership is narrowed by each dispatch. Independent reviewer: **A7**. For an A7 review dispatch, review output goes in the packet's review directory and grants no permission to edit the author's production files.

## Design and implementation watchpoints

Never compute hidden-state routes and then sanitize them. Partial requires certified progress; budget exhaustion is not unreachability. World generation, perception, motion and projectile sweeps share canonical geometry. Do not use engine navigation/physics for authoritative decisions.

Use fixed ticks, integer consequential arithmetic, lawful knowledge, normal action validation and complete state codecs. Preserve exact versions, IDs, profile counts and deterministic streams. No fake event or narration may pretend to be simulation evidence. GDD v1.1 addendum resolves support-before-damage, duration rounding, bow skill handling, influence, body/travel parameters, procedural visual acceptance, profiles and the Trial/closing calendars.

## Work queue by phase


### W0 — Web foundation (replaces P0)

The kit's P0 packets are retired. The web foundation is W0-01 … W0-11 in `../work/`; see The_Last_Clan_Web_Work_Phases_v1.md.

### P1 — First playable

| Packet | Scope | Accepted prerequisites |
| --- | --- | --- |
| [P1-02](../work/P1-02.md) | Terrain and fine geometry compiler | P1-01 |
| [P1-03](../work/P1-03.md) | Spatial index and line of sight | P1-02 |
| [P1-04](../work/P1-04.md) | Knowledge-limited route segments | P1-03 |
| [P1-05](../work/P1-05.md) | Kinematic movement and obstacle sweep | P1-04 |
| [P1-06](../work/P1-06.md) | Local avoidance and passage queues | P1-05 |
| [P1-21](../work/P1-21.md) | Projectile segment collision | P1-03, P1-05 |

### P2 — 24-person Trial

| Packet | Scope | Accepted prerequisites |
| --- | --- | --- |
| [P2-13](../work/P2-13.md) | Trial world generation and route timing | P1-06, P2-12 |
| [P2-15](../work/P2-15.md) | Regional hazard placement validation | P2-13, P1-03 |

### P3 — Complete Standard and Custom

| Packet | Scope | Accepted prerequisites |
| --- | --- | --- |
| [P3-03](../work/P3-03.md) | Full island compiler and opening validation | P3-02, P2-13 |
| [P3-04](../work/P3-04.md) | Full camp sockets and demolition routes | P3-03, P1-20 |
| [P3-09](../work/P3-09.md) | Refuge contraction and population routes | P3-03, P3-08 |


## Session size, return and permission

One packet per chat session is the default. If its remaining work exceeds context, checkpoint the actual files and resume instructions while retaining enough capacity to report failures and next steps. Preserve roughly 20–30 percent context when visible; this is a guardrail, not a guaranteed token budget. Quality criteria survive packet splitting.

Use templates/HANDOFF.md, RETURN_MANIFEST.json and SESSION_RESUME.md. Include executed commands, exit codes, evidence paths, exact base hash and all changed/deleted/renamed paths. Return the source archive/patch, not only a chat explanation. A0 stages it, A7 independently reviews the appropriate work, and A0 verifies the merged baseline before ACCEPTED status. You cannot declare your own work integrated.

Stop after the assigned packet: “Jani, return this package to A0 for integration. I will wait for your next authorized dispatch.” A0 asks permission for the next milestone after gate evidence is concrete. Publishing is never implied by development approval.
