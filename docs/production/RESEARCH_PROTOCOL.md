# Research protocol — two builds of the same game

Two independent developers build The Last Clan from the same design: GPT-6 Astra on Godot .NET (Development Kit v2) and a Claude model on the web stack (this kit). Same GDD, same 51 acceptance scenes, same gates, same fixture DSL. Different stack, different model, different sandbox. To learn anything, both tracks must record the same things.

## What each track records, per session (in its STATUS.md session log)

| Field | Meaning |
| --- | --- |
| packet | ID worked on |
| session # for packet | 1 for the first session on that packet, 2 for a resume, … |
| status at end | ACCEPTED / READY_FOR_REVIEW / IN_PROGRESS / BLOCKED |
| tests added | count of new unit/contract/property tests |
| fixtures authored / failing / passing | fixture DSL scenes by lifecycle state, cumulative |
| blocked checks | checks that could not run in the sandbox (BLOCKED_TOOL / BLOCKED_RENDER) |
| rework after review | did the fresh-context review find a material issue (yes/no; what) |
| human needed | did the session need Jani for anything (yes/no; what) |
| context cut | did the session end early for context (yes/no) |

## What each track records, per gate

- Packets accepted; sessions per packet by size class; packets that needed splitting.
- Calendar days from phase start to gate candidate, and Jani-hours spent (dispatch, PC checklist, playtest).
- Time to first runnable slice (first session in which something executed end to end).
- Fixture counts by state; operation-count ceilings recorded; wall-time numbers on Jani's PC.
- Playtest brief answers, verbatim, plus the "who would you follow again" answer.
- Gate criteria PASS / FAIL / BLOCKED / HUMAN_REQUIRED, and what was carried as not done.

## What to compare, and what not to

Compare per gate: sessions per accepted packet, rework rate, blocked-check rate, human-hours per gate, readability and believability answers from the same playtest brief, and defects found by the phase-end external review. Do not compare raw calendar time without the human-hours column: the Godot track needs Jani's PC for every render and the web track does not, and that is a property of the environment, not the model.

Keep the two tracks blind to each other's code. Sharing design clarifications (addendum-style decisions) across tracks is fine and should be logged; sharing implementation is not, or the comparison collapses.

## Confounds to name in the write-up

Model, stack, sandbox capabilities, kit version (v2 vs web v1), and the fact that the web kit was written after the Godot kit and with its feedback. Any conclusion about "which model is better" is bounded by all five.
