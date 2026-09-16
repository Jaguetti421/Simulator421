# Handoff — P1-31 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `280b79c` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: a why panel built only from evaluated trace entries, an explicit explanation when there is nothing to show, and a one-way event feed.

Changed files: `apps/web/src/view/why.ts` (new) — `buildWhyPanel`, `shouldRefresh`, `EventFeed`; `apps/web/src/view/why.test.ts` (13 tests).

**The design question I escalated in P1-29 was already answered in the GDD, and I should have found it there before escalating.** §16: "The player has an omniscient observer view, but inspecting it never updates a contestant's knowledge." So the panel may show what the simulation knows; what it may not do is invent. §13.4 gives the rest of the specification, including "up to two considered alternatives" and "if an alternative was not evaluated this cycle, say so; do not invent a counterfactual".

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. Displayed alternatives are exactly a subset of evaluated trace entries | `why.test.ts` | **PASS** — every alternative is checked against the trace's own candidate set, the chosen one is excluded, and the cap is the GDD's two. Each carries **one real reason** derived from the consideration where it fell furthest behind the winner, not a summary. `buildWhyPanel` takes the trace and options and nothing else, so a counterfactual has no source to come from. Scores, facts and the decision tick appear only in the developer view |
| 2. No evaluated alternative means an explicit unavailable explanation | `why.test.ts` | **PASS** — one candidate evaluated: "no alternative was evaluated this cycle: the only candidate was the one chosen". None evaluated: "no alternatives were evaluated this cycle". The field is absent when alternatives exist, so it cannot be mistaken for a permanent caption. A cached panel reports its age in ticks and `shouldRefresh` is true when the tick or the choice changes |
| 3. Off-camera events enter the feed without changing bot knowledge | `why.test.ts` | **PASS** — off-camera events are admitted exactly as on-camera ones and counted, with `onCamera` stored and never consulted when admitting. The feed's entire method surface is `append`, `recent`, `size`, `offCameraCount` — **nothing a simulation could consume** — and `recent` hands out copies, so tampering with a displayed entry cannot reach the feed. A belief store and a feed fed the same events share no reference and the store stays empty |

Commands executed: `npm run verify` → **0** (build, lint, **936/936** vitest across 60 files — 923 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Three notes.
1. **"Do not invent a counterfactual" is structural here.** The trace is the only input, so there is no branch that could synthesise an alternative. That is worth more than a rule, because the tempting version of this panel — "it probably considered fleeing" — is exactly what a designer would ask for when the real trace looks thin.
2. **One reason, chosen by the largest gap.** The alternative's reason names the consideration where the winner beat it hardest, which is a fact about the scoring rather than a narrative. When there is no winner, the phrasing changes to say so.
3. **I escalated a question the GDD had already answered.** It cost a turn and it was avoidable: the answer was two sections from the ones I had been reading. Recorded here rather than quietly fixed, because the lesson is to search the design document before declaring something undecided.

Deferred and out of scope: nothing renders the panel or the feed — this is the content, and the DOM belongs with the app packet that draws it. Also absent: the plain-language intent sentence ("preparing to leave before the storm") and its expansion, which need the content catalog's text templates; the feed's own event vocabulary, which will come from whatever the kernel actually commits; and any filtering or grouping of the feed, which is a presentation decision I would rather make against a real match than invent now.
