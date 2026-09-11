# Start here — The Last Clan, web build kit v1

12 September 2026. This kit is everything needed to build the HTML/browser version of The Last Clan: the game design, the web technical plan, the phased work breakdown with 139 packets, contracts, templates, planning tools and the history of decisions. No game code exists yet.

## For Jani — how to run this

1. Open a new chat window in this Project. Attach `The_Last_Clan_Web_Kit_v1.zip`. Paste the prompt from `PROMPT_FOR_NEW_WINDOW.md`.
2. The developer works one packet per session, in order, starting with W0-01. It does not ask you for permission per packet.
3. At the end of each session it either pushes to the GitHub repository (if you gave it one) or hands you a zip archive of the whole repository. Keep the latest; upload it at the next session start together with the kit.
4. At the end of each phase (W0, P1, P2 …) it stops and gives you: a build, `PLAYTEST_BRIEF.md`, `GATE_EVIDENCE.md`, and — when something needs a real GPU or a real browser — `JANI_PC_CHECKLIST.md`. Play, fill the brief, run the checklist if there is one, send both back. Then say "continue to P1" (or give feedback first).
5. External review (you, or another agent) happens only at phase ends. `templates/REVIEW.md` is the form; the gate evidence lists which packets to look at first.

**Continuity decision (make it before the first session).** The sandbox resets between sessions. Best: create a private GitHub repository and a fine-grained personal access token (Contents: read/write, that repository only); paste the repo URL and the token into each session's first message. The developer uses the token only in memory and never writes it anywhere. Alternative: the zip round-trip in step 3. Both work; GitHub costs you less per session.

**Which model.** This kit is model-neutral. My recommendation for the developer is **Claude Fable 5.1**: the published evidence favors it on long-horizon, multi-file work and on frontend and design quality, which is most of this build; it also makes the research comparison flagship-to-flagship against the GPT-6 Astra track. Use **Claude Opus 5** for the phase-end external reviews (cheaper, and a different model catches different mistakes). If cost dominates, Opus 5 as the developer is a reasonable alternative; then the comparison is no longer flagship-to-flagship. Disclosure: this recommendation was written by Fable 5.1.

**Research comparison.** `RESEARCH_PROTOCOL.md` lists what both tracks should record so the Godot/Astra build and the web/Claude build can be compared honestly.

## For the developer — reading order

1. `AGENTS.md` — the operating contract. Read fully once; skim at every session start.
2. `state/STATUS.md` — where things stand; the session log; what is next.
3. `The_Last_Clan_Web_Work_Phases_v1.md` — the plan: phases, W0 packets, carried packets, adaptations, session protocol.
4. `The_Last_Clan_Technical_Plan_v2_0_Web.md` — the stack and the sections it overrides; `reference/Technical_Plan_v1_1.md` for everything else (it is the fuller document; the web plan is a delta on it).
5. `design/GDD_v1.md` + `design/GDD_v1_1_Addendum.md` — the game. Search sections as cards cite them; do not read the whole GDD into a session.
6. `contracts/` — interface boundaries and the fixture DSL, with schema and examples.
7. `work/W0-01.md` — the first packet.
8. When working in a lane: the matching guide in `agents/` (module guides, not separate agents) and `CONVENTIONS.md` for the path map.
9. `reference/reviews/` — why things are the way they are. Optional reading.

## Map of the kit

| Path | What |
| --- | --- |
| `AGENTS.md`, `CLAUDE.md`, `CONVENTIONS.md` | Operating contract, entry pointer, repository conventions |
| `The_Last_Clan_Technical_Plan_v2_0_Web.md` | Web technical plan (delta over v1.1, same section numbers) |
| `The_Last_Clan_Web_Work_Phases_v1.md` | Phases, packets, order, session protocol, metrics |
| `design/` | GDD v1, v1.1 addendum, traceability of all 51 acceptance scenes |
| `contracts/` | INTERFACES.md, FIXTURE_DSL.md, fixture.schema.json, three example fixtures |
| `work/` | 139 packet cards: W0-01…W0-11 (new), P1-01…PX-06 (carried from Development Kit v2 with web notes) |
| `state/` | STATUS.md, workboard.json (source of truth for packet state), gates.json, acceptance_map.json, ACCEPTED_BASELINE.json |
| `templates/` | HANDOFF, REVIEW, SESSION_RESUME, GATE_EVIDENCE, PLAYTEST_BRIEF, JANI_PC_CHECKLIST |
| `agents/` | Eight module guides (from the kit's role briefs) |
| `tools/` | check_workboard.py, next_work.py, mark.py, tests |
| `reference/` | Technical Plan v1.1 (Godot), the kit's phase docs, operating contract and review decisions, and the five review documents |
| `PROMPT_FOR_NEW_WINDOW.md` | The copy-paste prompt |
| `RESEARCH_PROTOCOL.md` | What to measure in both tracks |
| `MANIFEST.json` | SHA-256 of every file in this kit |

## What this kit does not claim

No performance figure has been measured, no fixture has been executed, no screenshot exists. Every target is a hypothesis for the W0 gate. The environment notes in AGENTS.md were observed once in this Project's sandbox and must be re-verified at W0-01.
