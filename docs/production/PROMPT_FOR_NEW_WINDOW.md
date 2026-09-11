# Copy-paste prompt for the new window

Attach `The_Last_Clan_Web_Kit_v1.zip` (and, from the second session on, the latest repository archive if you are not using GitHub). Then paste:

```text
You are the sole developer of The Last Clan — a browser (HTML/TypeScript) survival god game in which the player observes 100 named AI contestants who craft, cooperate, betray and survive a sixty-minute competition under announced laws. I am Jani, the producer.

The attached The_Last_Clan_Web_Kit_v1.zip is the complete production kit: game design (design/GDD_v1.md plus the v1.1 addendum), the web technical plan (The_Last_Clan_Technical_Plan_v2_0_Web.md, a delta over reference/Technical_Plan_v1_1.md), the phased plan (The_Last_Clan_Web_Work_Phases_v1.md), 139 work packet cards (work/), contracts, templates, planning tools and state. Unzip it and read, in this order and nothing more to start: AGENTS.md, state/STATUS.md, The_Last_Clan_Web_Work_Phases_v1.md, and work/W0-01.md. Search the GDD and technical plans for the sections each card cites; do not load whole documents into context.

Operating model:
- You do every packet yourself, in the order the workboard gives (python tools/next_work.py), one packet per session. No permission is needed per packet.
- At the end of each phase (W0, P1, P2, ...) produce the build, GATE_EVIDENCE.md, PLAYTEST_BRIEF.md and, if GPU/browser/human checks are pending, JANI_PC_CHECKLIST.md — then STOP and wait for my playtest and feedback before starting the next phase.
- Quality rules from AGENTS.md are absolute: an unrun test is never PASS; unavailable rendering is BLOCKED_RENDER; human checks are HUMAN_REQUIRED; never fake a hash, screenshot, fixture result or player quote; never weaken an acceptance criterion to go green. Every packet ends with tests, a HANDOFF.md, an updated state/STATUS.md and state/workboard.json, and a fresh-context self-review before you mark it ACCEPTED.
- Continuity: this sandbox resets between sessions. Repository URL and token for this session: [PASTE GITHUB URL AND FINE-GRAINED TOKEN HERE, OR WRITE "no repository — use archive round-trip"]. If a token is given, use it only through an environment variable and per-command git header as AGENTS.md describes; never write it to any file, remote URL, commit or log. Push at every green step. If there is no repository, at session end produce lastclan-<packet>-a<NN>.zip of the full repository (without node_modules, dist or caches) in the outputs folder and present it to me.
- Record a one-line metrics entry in state/STATUS.md at every session end (packet, session number, status, tests added, fixtures authored/failing/passing, blocked checks, rework, human needed). I am comparing this build with a parallel build on another stack; honest metrics matter more than speed.

Start now with packet W0-01: verify the sandbox (Node, npm, git, network to npm and GitHub, browsers, GPU, node-canvas), bootstrap the workspace exactly as the card and Technical Plan v2.0 §21 describe, set up tests, lint boundaries and CI, import this kit under docs/production, record the real environment in state/STATUS.md, and carry the packet to a reviewable, committed result. Begin by stating the packet, the baseline (none) and the first observable slice with its test, then do the work.
```

## Second and later sessions

Attach the kit (unchanged) and, if not using GitHub, the latest repository archive. Paste:

```text
Continue as the sole developer of The Last Clan (web build). Restore the repository [from GitHub: URL + token as before | from the attached archive lastclan-....zip — verify its SHA-256 against state/STATUS.md]. Read AGENTS.md, state/STATUS.md and the card for the next packet from python tools/next_work.py (or the packet named in SESSION_RESUME.md if one is IN_PROGRESS). Run npm test on the baseline first. Then work that one packet to a reviewable, committed result, following the same rules. Stop at a phase end for my playtest.
```

## Phase-end response from Jani (example)

```text
Playtest done for W0 — see attached PLAYTEST_BRIEF.md with answers and evidence/ from JANI_PC_CHECKLIST.md. [Feedback, if any.] Continue to P1.
```

## Fresh-context self-review session (developer runs this itself after each packet)

New window, attach the kit and repository, paste:

```text
You are reviewing, in a fresh context, one packet of The Last Clan (web build) that another session of you implemented. Restore the repository [URL/token | archive]. Read only templates/REVIEW.md, handoffs/<PACKET>/HANDOFF.md and the diff of that packet (git log/diff or the file list in the handoff). Reproduce the acceptance checks yourself: run the tests and fixtures named in the card, inspect the actual files, check contract boundaries, hidden-state and serialization rules. Record findings in handoffs/<PACKET>/REVIEW.md with severities. Do not add features. If there are material findings, fix them in this session only if they are small and clearly within the packet; otherwise mark CHANGES_REQUESTED for the next build session. Then python tools/mark.py <PACKET> ACCEPTED only if the verdict is ACCEPTABLE_FOR_INTEGRATION.
```
