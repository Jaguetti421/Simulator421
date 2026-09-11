# The Last Clan — Development Kit v2 Feedback

**Reviewed:** The_Last_Clan_Development_Kit_v2.zip (201 files; Technical Plan v1.1, GDD v1.1 addendum, Work Phases v2, 8 role briefs, 145 work packets, contracts, templates, state, tools)
**Date:** 11 September 2026
**For:** the developer who started A0. Feedback to adopt where it fits; nothing here is a change order.

**The operating model this feedback assumes** (Jani's decisions):

- **One developer does all the work** — GPT-6 Astra, working in a browser-based chat window. Every packet, every phase, every lane. The eight role briefs remain useful as module guides, not as separate agents.
- **No per-packet authorization.** The developer runs a phase's packets in sequence and **stops at the end of each phase** (P0, P1, P2 …) to wait for Jani's possible playtest or feedback before continuing.
- **External review — Jani or other AI agents — happens only at the end of each major phase.** Between phase ends, quality rests on the developer's own fresh-context review, fixtures and CI.

**What I checked myself.** Read all top-level documents, the eight briefs, contracts and templates, every P0 packet, the P1 packet graph and GDD_TRACEABILITY.md; spot-checked the sixteen provenance claims against reference/GDD_v1.md (they hold); verified all 200 manifest hashes; ran `tools/kit_check.py` (PASS: 145 packets, 51 scenes, 633 links), the eight tool tests (pass) and `next_work.py` in both modes. I also computed the dependency graph from `state/workboard.json`; those numbers appear in F2.

---

## 1. Summary

The kit is well built. It adopted the two design reviews carefully, corrected errors in them (the fixture's profile/unit/notice mistakes, a route-cache information leak, non-progressing partial routes), closed the GDD provenance question with real section references, and added evidence-maturity labels, the D01–D09 addendum, catalog profiles and an honest gate protocol. The engineering baseline underneath is sound. **Build it as written.**

What the kit designed for is eight agents in separate chats with Jani carrying files between them and authorizing every packet. Under one developer with no per-packet authorization, most of that machinery — dispatch throttling, four-builder waves, per-owner locks, per-file hash manifests, an A0 chat merging other agents' returns — solves problems that no longer exist. Some of it should be kept in simplified form (state files, handoffs, fixtures, gates), some retired, and two things become *more* important than the kit assumed: fresh-context self-review, because nobody else looks at the code until a phase ends, and Jani's phase-end playtest, because it is now the main human signal.

One consequence of the developer's environment needs to be said plainly: **a browser chat sandbox can build and test the C# simulation core, fixtures and persistence, but almost certainly cannot run the Godot editor, produce a Windows export, or render a frame.** The kit already handles this correctly — BLOCKED_TOOL and BLOCKED_RENDER are first-class results — but it means every Godot build, export, screenshot and hardware measurement will be executed by Jani on his PC, following instructions the developer writes. That is not a defect; it is the division of labor, and it should be designed for (F4, F8).

Ranked by consequence:

1. **Continuity across sessions: a repository if the chat can reach one, otherwise a disciplined single-archive protocol.** (F1)
2. **139 packets in series. Measure P0, order each phase to reach a runnable slice early, cut one backwards dependency, and time-box the TypeScript spike.** (F2)
3. **Review with no second builder: fresh-context self-review per packet; phase-end external review with a priority list.** (F3)
4. **Jani's phase-end playtest and his PC as the build-and-capture machine: define exactly what he receives and what he runs.** (F4)
5. **The G2 "ten new viewers" criterion cannot be met by Jani alone; decide now how to carry it.** (F5)
6. Work cards, fixture-first, capture runner, hygiene. (F6–F9)

---

## 2. What to protect

- **Evidence maturity labels** (proposed target / synthetic / production fixture / reference hardware / real human); FakeSim watermarked and never able to pass a production gate.
- **"An unrun test is never PASS"**, BLOCKED_TOOL / BLOCKED_RENDER / HUMAN_REQUIRED as first-class results, no generic waiver state.
- **Fixture DSL v1**: Fixture profile, thousandths units, precommitted setup laws separate from runtime commands, `EventCountGte` minimum ≥ 1, unsupported assertions failing loudly.
- **Addendum D01–D09**, especially D05's anchor-set route test and D08's Trial calendar.
- **INTERFACES.md** dependency-direction table and the reason-ID registry.
- **GDD_TRACEABILITY.md** — every scene has a completing packet and a first full gate.
- **The state files** (`STATUS.md`, `workboard.json`, `ACCEPTED_BASELINE.json`, `gates.json`) as the single source of truth. Under one developer in a chat window they are the developer's memory across sessions; they matter more, not less.

---

## 3. What changes under one developer

| Kit assumption | Now | Keep / simplify / retire |
| --- | --- | --- |
| Eight owners with exclusive paths | One owner. Briefs become module guides: read the relevant brief's "watchpoints" when working in that lane | Keep as guides; retire exclusivity |
| One active packet per owner; max four builders | Serial by decision | Retire |
| DISPATCH.json per packet, authorized by Jani | Self-issued at packet start as "what I am doing and what is in scope" | Simplify |
| A0 chat integrates other agents' returns | Nothing to integrate. The "A0" hat is: update state files, record the baseline, write the phase report | Simplify |
| A7 independent review per packet in a fresh context | Fresh-context self-review per packet; external review at phase ends only | Simplify (F3) |
| RETURN_MANIFEST with per-file SHA-256, `changed/` ZIP | Needed only if no repository is reachable (F1); otherwise a commit and HANDOFF.md | Conditional |
| Jani authorizes every packet | No authorization. Developer stops at phase ends and waits | Retire |
| SESSION_RESUME.md for cross-chat handover | Same purpose, handover to the developer's own next session | Keep |
| "Attach the kit ZIP to every chat" | If a repository is reachable, the kit lives in `docs/production/`; otherwise one canonical archive (F1) | Conditional |
| Phase approvals presented by A0 with a candidate | Unchanged, plus the playtest package in F4 | Keep |

A short "single-developer operating note" at the top of AGENTS.md listing the retired rules is enough; there is no need to rewrite 145 cards.

---

## 4. Findings

### F1 — Continuity across sessions

**The risk.** With one developer in a browser chat, the failure mode is not merge conflicts; it is losing the thread between sessions — which archive is current, which tests last ran, what the next step was.

**If the chat window can reach a repository** (a GitHub connector, or pushing from its sandbox — confirm in P0-01): use it. Branch per packet, squash on completion, tag each phase baseline and record the SHA in `ACCEPTED_BASELINE.json` (the field exists). CI on every push: build, short suite, affected fixtures, kit_check. The kit lives in `docs/production/`; nothing is attached to chats.

**If it cannot:** keep the kit's archive protocol but simplify it for one developer. One canonical archive per completed packet, named by packet and attempt (`lastclan-P0-03-a01.zip`), containing the full source tree, `state/` and `handoffs/`. Jani stores every archive; the developer uploads only the latest at session start. RETURN_MANIFEST's per-file hashing shrinks to one whole-archive SHA-256 recorded in `STATUS.md`. Never two archives called "latest".

**Either way, confirm in P0-01's environment evidence:** whether uploaded files are inlined into context or mounted on disk (if inlined, a 1.5 MB kit costs tens of thousands of tokens at every session start — keep the working set small: kit in the archive, reference/ out of it); whether `dotnet` is available in the sandbox and which version; whether Godot is (almost certainly not — record BLOCKED_TOOL and hand the Godot steps to Jani, F4).

### F2 — Serial order and throughput

**What the workboard says.** 139 shipping packets, executed one at a time. The longest dependency chain is 72 packets, but under serial execution the chain no longer matters; the count does. P0 is 17 packets (12 percent of the plan). Its measured cost per packet — sessions, rework, blocked time — is the only honest input to any schedule, and the plan rightly refuses to name one before that.

**Order within a phase for an early runnable slice.** For P0: 01 → 02 → 03 → 04 → 10 (headless kernel) → 05 → 06 (runner) → 07 → 08 → 09 → 14a (real client composed) → 11 → 12 → 13 → 14 (spike) → 15 → 16. This needs one dependency edge cut: **P0-14a should not depend on P0-14.** Today the real Godot composition waits for the TypeScript comparison, which is backwards for a plan that already prefers Godot. For P1: get P1-01 → 07 → 09 → 12 → 14 → 16 → 17 → 18 (one actor eats) running end to end before widening.

**The TypeScript spike (P0-14).** Jani has no preference. Recommendation: keep it, time-boxed to one session, last in P0 — for a reason specific to this developer's environment. A Babylon/Electron candidate can be built, run and screenshotted inside a browser sandbox; the Godot candidate cannot. The spike is therefore unusually cheap evidence for ADR 001's agent-verifiability criterion, and it will show honestly how much of the Godot lane will depend on Jani's PC. Whichever runtime wins, Windows packaging and GPU measurements still happen on Jani's machine.

**Optional chain simplifications** (each removes a wait): P1-10 and P1-11 branch from P1-07 rather than P1-09; P0-05 drops its dependency on P0-03 if the fixture parser does not hash.

### F3 — Review with no second builder

**The problem.** The kit's quality model rests on A7 reproducing checks in a fresh context per packet. Now nobody but the developer sees a packet until the phase ends, so the same context that wrote the code approves it — where agent-built code fails quietly.

**Suggestion, three layers.**

1. **Fresh-context self-review per packet.** After the packet's commit or archive, open a new session with only REVIEW.md, HANDOFF.md and the diff (or the changed files); reproduce the acceptance checks; record findings. The kit's rule "reviewer must inspect actual files and reproduce checks" stays exactly as written; it is simply the developer in a new session. Mark REVIEW.md `freshContext: true, reviewer: self`.
2. **Phase-end external review with a priority list.** Jani or an external agent reviews the phase candidate. Give them a "review these first" list so a bounded review lands where self-review is weakest — subtle failure modes in: contracts (P0-04, P1-01), permission service (P1-12/13), damage batch and elimination (P1-23/24), save/replay (P1-33), career finalization (P2-20), law budgets (P3-08). Put that list in each phase's GATE_EVIDENCE.md.
3. **Fixtures and CI as the reviewer that never sleeps** (F7). If the fixture is written before the implementation, review becomes "does it pass and does it prove the right thing" rather than "does the code look right."

### F4 — Jani's phase-end playtest, and Jani's PC as the build machine

**Two jobs Jani does at each phase end**, and both need a written package from the developer:

**A. Build, export, capture, measure** — the checks the sandbox cannot do. A `docs/production/JANI_PC_CHECKLIST.md` per phase: exact commands to build the Godot project, export the Windows candidate, run `--capture-fixture` for the listed fixtures, run the reference-hardware fixtures, and where to put the results (PNGs, summaries, timings) so the developer can attach them to GATE_EVIDENCE.md in the next session. Until Jani runs it, those criteria are BLOCKED_RENDER / BLOCKED_TOOL, not PASS. Make the checklist copy-paste-runnable; Jani should not need to interpret.

**B. Playtest** — the human signal. In addition to GATE_EVIDENCE.md:

- A runnable export for the phase's profile (G1: eight-person valley; G2: 30-minute Trial; G3: Standard).
- A **one-page viewing script**: what to look at in the first ten minutes, which contestant to follow, which law to try, what "working as intended" looks like versus a bug. Without this an observer game's playtest yields "I watched people walk around."
- Known limitations by evidence maturity, so Jani does not report known gaps.
- A **short feedback form**: readability (who was who, what were they doing?), believability (which decision looked stupid?), the law (did you understand what the countdown would do?), bugs (what, when, seed), and *who would you follow again?*
- Seed and build hash, so anything Jani sees is replayable in the lab.

Suggest `templates/PLAYTEST_BRIEF.md` with those sections, filled by every "Integrate and request approval" packet (P0-16, P1-35, P2-26, …). The developer then **stops and waits**; if Jani returns nothing, the next phase starts on the developer's own evidence, with the human criteria still marked as not done.

### F5 — The G2 "ten new viewers" criterion

**What it means.** Gate G2 (end of P2) says: ten real new viewers watch a Trial; at least eight recall three contestants, explain two decisions and understand the next law. This is a *human* test — whether strangers can read the game — and it cannot be automated or produced by an agent; the kit correctly forbids inventing it. "HUMAN_REQUIRED" is simply the kit's label for "only a person can do this check."

**Can it be avoided?** Not honestly: the pillar "A cast worth remembering" has no machine test. But it does not have to block P3. Options:

- **(a) Recruit.** Ten people (friends, colleagues, students from a workshop) each watch one 30-minute Trial and answer three questions. Half a day of Jani's organizing; the strongest evidence.
- **(b) Carry it.** Approve G2 with the criterion recorded as HUMAN_REQUIRED and not done; run the study later, before G4 (presentation) where it matters most. Nothing is faked; the gap stays visible in `gates.json`.
- **(c) Partial.** Jani plus whoever is available now, recorded as partial evidence with the count.

Recommendation: (b) as the default, with (c) whenever people are around, and (a) once before G4. Decide before P2 ends so it is not discovered at the gate. The same applies to G4's readability review and GR's release evidence.

### F6 — Work cards: three fields

Cards are ~370 words, ~250 of them boilerplate identical across all 145; the unique content is a one-sentence goal, a `refs` string and three acceptance lines. Add per card: the fixture and regression IDs to create or extend (the acceptance map knows the GDD scene; add the SAVE-ROUNDTRIP / WHY-TRACE style IDs); an explicit in-scope path list (today only `FILL_FROM_ROLE_AND_PACKET` in DISPATCH.json); a complexity tag in `workboard.json` (the plan says to track simple/medium/complex separately, but no field exists). Move the boilerplate into AGENTS.md by reference and generate `phases/*.md` from the workboard so nothing drifts. Reading a card should take a minute and answer "what files, what tests, how big."

### F7 — Fixture-first

P0-05/06 build the parser and runner early, but the first behavioral fixtures (AI-03, LAW-01) are executed only by the packets that implement the behavior (P1-19, P1-22). Write the scene's fixture JSON *before* starting its implementation packet — it is the spec — and make "fixture X executes in the runner (may fail)" an acceptance line from the first packet that touches the system. Extend `evidenceStatus` into a lifecycle — `SCHEMA_EXAMPLE_UNEXECUTED` → `AUTHORED_UNEXECUTED` → `EXECUTED_FAILING` → `EXECUTED_PASSING` — so `STATUS.md` reports fixtures by state. With no A7, this is what keeps "automated tests wherever possible" true.

### F8 — Capture runner on Jani's PC

P0-09 correctly reports BLOCKED_RENDER without a GPU, and with this developer that will be every session. If Jani is willing to leave a small self-hosted runner on the reference PC (Windows, the GPU §18 benchmarks), it can build the export, run `--capture-fixture` for the listed fixtures and place PNGs and summaries where the developer picks them up next session — replacing most of checklist A in F4 with an automatic step. One packet's worth of work; the highest-return infrastructure in the kit. If not, checklist A stays manual and is still fine.

### F9 — Hygiene

- `tools/kit_check.py` fails with a bare `No module named 'jsonschema'` when the dependency is missing (reproduced). Ship `requirements.txt` and an install hint; pin it in P0-01.
- Move `reference/` (two superseded reviews, the historical tech plan) to `docs/production/history/` — and out of any archive uploaded to chats — so the working set does not carry documents the cards say to ignore.
- One developer, one model: record the model and date in REVIEW.md only for external phase-end reviews.
- P0-14a → P0-14 dependency (F2); P1-10/11 → P1-09 (F2).
- Add `complexity` to `workboard.json` (F6) now; a one-line schema change today, painful later.

---

## 5. Decision table

| ID | Suggestion | Effort | Adopt? |
| --- | --- | --- | --- |
| §3 | Single-developer operating note at the top of AGENTS.md listing retired rules | S | |
| F1 | Repository if reachable from the chat; otherwise one canonical archive per packet with whole-archive hash; record sandbox capabilities in P0-01 | S–M | |
| F2a | Cut P0-14a → P0-14; early-runnable order within P0 and P1 | S | |
| F2b | TypeScript spike kept, time-boxed to one session, last in P0 | S | |
| F2c | Optional chain splits (P1-10/11 from P1-07; P0-05 from P0-03) | S | |
| F3 | Fresh-context self-review per packet; phase-end "review these first" list in GATE_EVIDENCE.md | S | |
| F4 | JANI_PC_CHECKLIST.md and PLAYTEST_BRIEF.md per phase; stop and wait at phase ends | S | |
| F5 | Carry the G2 viewer study as HUMAN_REQUIRED by default; partial when possible; full study before G4 | — | |
| F6 | Fixture IDs, in-scope paths, complexity per card; generate phase docs from workboard | S–M | |
| F7 | Fixture-first; `evidenceStatus` lifecycle | S | |
| F8 | Self-hosted capture runner on Jani's PC (optional; manual checklist otherwise) | M | |
| F9 | requirements.txt; move reference/; retire per-file hashing where a repo exists | S | |

*Feedback ends. The kit's engineering baseline, gate discipline and evidence rules are right and should be built as written. Under one developer in a chat window, the orchestration layer simplifies, the sandbox handles the simulation while Jani's PC handles Godot, and fresh-context review plus Jani's phase-end playtests become the quality signal that eight agents were meant to provide.*
