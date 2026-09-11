# The Last Clan — shared agent operating contract

Version 2.0 · 11 September 2026 · planning baseline, not implemented software.

Jani commissions a quality offline survival god game. The player observes a persistent cast of 100 named contestants adapting to announced laws, crafting, cooperating, betraying and surviving a sixty-minute Standard competition. Conventional deterministic game AI is the core. An optional-to-play Christ guest episode ships independently of any optional local language model. Your task is one authorized work packet, not the entire game or milestone.

## Authority and reading order

Follow Jani's current explicit instructions. For project work, use the accepted dispatch and baseline, GDD v1 plus the v1.1 addendum for game behavior, Technical Plan v1.1 for implementation, shared contracts for interfaces, then your work packet and role brief. Reviews in reference/ are historical feedback, not a second competing specification. If two normative requirements truly conflict, preserve working code and record the conflict for A0; do not silently pick a convenient rule. Internal reversible implementation choices within your packet need no additional approval.

First read your role file, DISPATCH.json, state/STATUS.md, and the assigned work card. Search the cited source sections, relevant contracts and existing code. Read further when needed. Do not paste the whole GDD, repository, logs or all 145 work cards into a chat. This restriction is about working context, never a prohibition on necessary investigation.

## Dispatch and ownership

A0 is the integration owner. Only A0 updates shared status, accepted-baseline manifests, contract versions, gate records, project wiring and dispatch. Other agents own the paths in their role brief and handoffs/{packet}/{attempt}/. Read dependencies freely; change another owner's files only through an explicit A0 dispatch amendment with that lane idle. A4 owns game/project.godot after bootstrap; A0 owns provider composition and shared .csproj/package/reference wiring. Initial scaffold creation is explicitly part of P0-01; subsequent module implementation follows role ownership. A0 integrates interface changes before dependent builders start. A contract change is a proposal with affected consumers, schema examples and migration/test consequences; it is not permission to edit shared contracts immediately.

One active packet per owner; default maximum four builders at once. A7's review queue should stay at four or fewer. Two packets sharing an owned file cannot run concurrently. Phase approval opens a phase, but each packet still needs a dispatch. Dependency ACCEPTED means independently reviewed and integrated, not an agent saying finished. Cross-phase dependencies in the workboard are binding. Jani may resume an unfinished authorized packet without repeating permission; a fresh packet or phase needs a new dispatch.

## Nonnegotiable engineering boundaries

- The pure C# core owns consequential state at 10 Hz with integer units, explicit remainders, stable order and versioned random streams. Godot owns presentation. AI receives evidence-limited views and proposes actions; the core validates effects.
- No Godot types, wall clock, engine physics, camera selection, unseeded randomness, generated text or career stat buffs may determine Standard outcomes. Render-only floats and cosmetic LOD are allowed.
- Hard laws cannot be broken. Social commandments and teachings may be refused. Check harm at legal start and effect; no precharged prohibited attack, one-way sanctuary, false betrayal or invented memory.
- Use the same production providers in client, lab and replay. FakeSim is visibly labeled, excluded from career persistence, and never passes a production gameplay gate.
- Every consequential extension includes its state-section codec, truthful failure reasons and meaningful outcome/invariant verification. Docs-only changes need relevant validation, not tests that mirror prose.
- Do not suppress urgent sensing, omit distant damage, teleport stuck actors, fabricate benchmark output or relax roster/catalog requirements to make a test green. Diagnose the cause.
- No external publishing, paid purchases, account changes or model downloads outside the authorized packet. Keep secrets out of archives and logs. Do not message others on Jani's behalf.

## Working within a chat window

Milestones deliberately span many packets. No plan can guarantee a model's context limit. Start one packet by identifying a small observable slice and the exact tests. Work in readable modules; 400–600 lines can be a review signal, never a hard cap or reason to fragment cohesive code. Keep roughly 20–30 percent context capacity for validation and handoff when usage is visible. When it is not visible, checkpoint after each coherent green slice and before a large investigation or log read.

If the remaining work no longer fits safely, save a local checkpoint commit or recovery ZIP with complete changed files, update your own SESSION_RESUME.md, and stop as IN_PROGRESS. Record exact baseline, changed paths, last executed command/result, known failures and the next concrete step. Do not mark the packet complete. Jani can hand those files and your role brief to a fresh chat. After two failed approaches to the same blocker, explain the root cause or narrow an investigation; do not churn the same patch or reduce required quality. Ask A0 to split an oversized packet into numbered children with unchanged aggregate acceptance criteria. No token prediction is a delivery guarantee.

## Verification and truthful reporting

Run the prescribed baseline build first when tools are available. Diagnose existing failures and distinguish them from your changes. Relevant unavailable tools are BLOCKED_TOOL; unavailable rendering is BLOCKED_RENDER; required observation/hardware work is HUMAN_REQUIRED. An unrun test is never PASS. A screenshot must be produced by the real renderer from a confirmed fixture tick, with capture metadata. A verified software renderer can support visual checks when identified; it does not certify the reference gaming GPU budget.

On consequential changes, run relevant unit/contract fixtures, five selected replay seeds, a random-tick save round trip and affected operation-count ceilings. Run the complete batch at the designated phase gate or when a specific regression requires it. Checkpoint-frequency invariance, corruption fuzz and full visual matrices have explicit gate homes; do not waste every small packet rerunning unrelated multi-hour suites. Record exact commands, exit codes, build/content identity, executed counts and artifact paths in files, with a short chat summary.

## Return protocol and independent acceptance

Never return code only in chat. Supply source changes plus HANDOFF.md, RETURN_MANIFEST.json, SESSION_RESUME.md and relevant evidence under your handoff path. For Git, prefer a patch series or bundle based on the dispatched commit plus a human-readable change list. For archive-only work, return complete changed files at repository-relative paths, SHA-256 before/after hashes, explicit deletions/renames, and a zip rooted at changed/. Include generated artifacts only where the repository contract requires reproducible exports. No dependency caches or credentials. Use attempt numbers rather than overwriting a previously reviewed handoff.

A0 stages a return against the specified baseline. A stale base requires rebase/reapplication and affected tests, not copying its ZIP over newer work. A7 independently reviews ordinary packets in a fresh context; A0 reviews A7-authored infrastructure. Reviewer must inspect actual files, reproduce relevant checks and record findings. Another brand/model is optional; independence and evidence matter. The author fixes material findings before acceptance. A0 then verifies the integrated result and records the new baseline. An individual pass never implies the combined build passed.

At completion say: “Jani, return this package to A0 for integration. I will wait for your next authorized dispatch.” At a phase boundary A0 presents concrete files, gate evidence and blockers, then asks approval for the named next phase and baseline. This pause is Jani's requested orchestration policy. Do not ask permission for each normal command inside an already authorized packet.
