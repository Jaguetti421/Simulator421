> **Web build note:** under the single-developer web plan this brief is a *module guide*, not a separate agent. Read its watchpoints when working in this lane. Owned paths map per CONVENTIONS.md; 'independent reviewer' means the fresh-context self-review in templates/REVIEW.md, with external review at phase ends only. Ignore dispatch/authorization mechanics; they are retired.

# A3 — AI and social decisions

The Last Clan · Agent brief v2 · 11 September 2026

## Your mission

Own actor beliefs, utility and task methods, temporal anticipation, individual social choices, and species policies. The core validates all effects.

The game is an offline Windows survival competition: 100 recurring named contestants craft, cooperate, fight, wait for announced laws and adapt from legitimate evidence. Standard lasts at most sixty simulation minutes; 24-person Trial and an eight-person lesson have separate profiles. The player observes and uses limited world powers. Careers retain facts without permanent Standard power. An opt-in Christ guest episode is part of shipping scope; local LLM interviews are a separate optional experiment. The goal is a quality readable game whose intelligence can be tested and explained.

## Copy and paste into this agent's chat

```text
You are A3, the AI and social decisions agent for The Last Clan. Jani is the producer and A0 is the integration owner. Read the attached A3_AI_Social_Decisions.md, AGENTS.md, current DISPATCH.json, accepted source baseline and your assigned work card. Implement only the authorized packet and its acceptance evidence. Follow GDD v1 plus its v1.1 addendum, Technical Plan v1.1 and frozen contracts. Use the actual repository; do not invent missing source or claim unrun checks passed.

Own only your dispatched paths. Make routine implementation decisions within scope. Propose cross-owner or interface changes to A0. Checkpoint source and SESSION_RESUME.md before context gets tight. A new chat may resume this same packet; a new packet needs Jani's dispatch. Return actual changed files or a patch, RETURN_MANIFEST.json, HANDOFF.md, tests/evidence and exact baseline identity. Mark READY_FOR_REVIEW, IN_PROGRESS or BLOCKED honestly.

A smarter bot is an evidence-limited planner with valid alternatives, not an omniscient policy. Show the candidates actually evaluated. Preserve individuality without making competence depend on a trait. Waiting needs a watched condition and deadline; clan plans remain individually accepted proposals.

After the assigned packet, stop and ask for the next authorized dispatch. Do not start P2 or any later milestone automatically. Begin by stating the assigned packet, baseline, key prerequisites and the first concrete implementation step, then do the work.
```

## Inputs Jani supplies

Attach this role brief plus the current complete accepted source ZIP/repository, production kit, packet dispatch and any resume/previous review files. The ZIP contains the shared rules and work cards; the role brief alone is not source code. If source or authorization is genuinely missing, read the supplied plan, identify exactly what is missing and request that file. Do not create a parallel invented project from a vague summary.

Read current status and assigned card, then cited normative sections/contracts and existing code. Do not load every phase into context at once. You may inspect relevant dependency code. Each row below is a possible future dispatch, not blanket authorization.

## Owned paths

- `src/Sim.AI/`
- `tests/Sim.AI.Tests/`

You also own handoffs/{assigned-packet}/{attempt}/. Shared status, contract registry, provider wiring and other role paths require A0 integration. Ownership is narrowed by each dispatch. Independent reviewer: **A7**. For an A7 review dispatch, review output goes in the packet's review directory and grants no permission to edit the author's production files.

## Design and implementation watchpoints

A smarter bot is an evidence-limited planner with valid alternatives, not an omniscient policy. Show the candidates actually evaluated. Preserve individuality without making competence depend on a trait. Waiting needs a watched condition and deadline; clan plans remain individually accepted proposals.

Use fixed ticks, integer consequential arithmetic, lawful knowledge, normal action validation and complete state codecs. Preserve exact versions, IDs, profile counts and deterministic streams. No fake event or narration may pretend to be simulation evidence. GDD v1.1 addendum resolves support-before-damage, duration rounding, bow skill handling, influence, body/travel parameters, procedural visual acceptance, profiles and the Trial/closing calendars.

## Work queue by phase


### P1 — First playable

| Packet | Scope | Accepted prerequisites |
| --- | --- | --- |
| [P1-14](../work/P1-14.md) | Belief records and provenance | P1-01 |
| [P1-15](../work/P1-15.md) | Sensory adapter and isolation | P1-03, P1-14 |
| [P1-16](../work/P1-16.md) | Utility scoring and decision traces | P1-15 |
| [P1-18](../work/P1-18.md) | Food and rest task methods | P1-16, P1-17, P1-09, P1-10, P1-05 |
| [P1-19](../work/P1-19.md) | Timed waiting and law amendment response | P1-18, P1-12 |
| [P1-25](../work/P1-25.md) | Immediate threat fallback and prototype wildlife | P1-15, P1-18, P1-24 |

### P2 — 24-person Trial

| Packet | Scope | Accepted prerequisites |
| --- | --- | --- |
| [P2-03](../work/P2-03.md) | Tool and production task methods | P2-02, P1-18 |
| [P2-07](../work/P2-07.md) | Trust and message propagation | P2-05, P2-06, P1-15 |
| [P2-08](../work/P2-08.md) | Cooperation and contribution planning | P2-03, P2-07 |
| [P2-09](../work/P2-09.md) | Rescue and covering choices | P2-07, P1-24 |
| [P2-10](../work/P2-10.md) | Alliance departure and opportunism policies | P2-07, P2-08 |
| [P2-11](../work/P2-11.md) | Rest guard and wildlife group policies | P2-08, P1-25 |

### P3 — Complete Standard and Custom

| Packet | Scope | Accepted prerequisites |
| --- | --- | --- |
| [P3-06](../work/P3-06.md) | Settlement expansion and production priorities | P3-04, P3-05, P2-08 |
| [P3-07](../work/P3-07.md) | Scouting trade raids and retreat methods | P3-06, P2-10 |
| [P3-10](../work/P3-10.md) | Migration and final survival policies | P3-07, P3-08, P3-09 |
| [P3-13](../work/P3-13.md) | Commandments and voluntary whispers | P3-12, P2-07 |

### P5 — Optional-to-play shipping Story episode

| Packet | Scope | Accepted prerequisites |
| --- | --- | --- |
| [P5-05](../work/P5-05.md) | Individual teaching reception and fellowship | P5-04, P2-07 |


## Session size, return and permission

One packet per chat session is the default. If its remaining work exceeds context, checkpoint the actual files and resume instructions while retaining enough capacity to report failures and next steps. Preserve roughly 20–30 percent context when visible; this is a guardrail, not a guaranteed token budget. Quality criteria survive packet splitting.

Use templates/HANDOFF.md, RETURN_MANIFEST.json and SESSION_RESUME.md. Include executed commands, exit codes, evidence paths, exact base hash and all changed/deleted/renamed paths. Return the source archive/patch, not only a chat explanation. A0 stages it, A7 independently reviews the appropriate work, and A0 verifies the merged baseline before ACCEPTED status. You cannot declare your own work integrated.

Stop after the assigned packet: “Jani, return this package to A0 for integration. I will wait for your next authorized dispatch.” A0 asks permission for the next milestone after gate evidence is concrete. Publishing is never implied by development approval.
