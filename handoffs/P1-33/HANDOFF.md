# Handoff — P1-33 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `5506396` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: saving and restoring the composed host so that a restored run is indistinguishable from an uninterrupted one, at any checkpoint, with no section defaulted.

Changed files: `packages/sim/host/persistence.ts` (new) — `saveHost`, `restoreHost`, `replayDivergence`; `packages/sim/host/composed.ts` (`restoreState`, shared-terrain option); `packages/sim/core/reservation.ts` (`restoreLease`); `packages/sim/host/persistence.test.ts` (12 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. Save/load reproduces the next 600 ticks | `evidence/replay.txt`, `persistence.test.ts` | **PASS** — a save at tick 120 replays **600 identical ticks**. A restored host reports the same tick and the same summary, a mid-plan actor stays mid-plan with its step index, and a held reservation comes back with **its own expiry** rather than a fresh one |
| 2. Random checkpoint ticks and 10/60-second frequencies preserve hashes | `evidence/replay.txt`, `persistence.test.ts` | **PASS** — eight save points (1, 17, 50, 73, 120, 199, 377, 600) each replay identically. Saving three times at 100-tick intervals produces the same 300 digests as one uninterrupted run, and a 100-tick cadence matches a 600-tick one over 600 ticks |
| 3. Missing state sections fail validation instead of loading defaults | `evidence/replay.txt`, `persistence.test.ts` | **PASS** — a test removes **each of the seven sections in turn** and requires a refusal every time, naming the section. Two missing sections are both named. A future format version and a save from a different seed are refused with their own reasons rather than loaded into the wrong world |

Commands executed: `npm run verify` → **0** (build, lint, **1,040/1,040** vitest across 67 files — 1,028 at the packet baseline; 6 python; workboard PASS). Total suite 110 s.

Self-review (same session; standing authorization): no material findings. Four notes.
1. **My first save enumerated fields and forgot the plan.** A restored actor silently re-planned and the replay diverged on the very first tick. The save now stores the **whole agent**, because enumerating fields is how a save rots: the next field added is the next one forgotten. This is the same lesson P1-17's "every active field is captured" test was written for, and I had to learn it twice.
2. **A re-granted lease is not a restored lease.** After the first fix, a save at tick 50 still diverged at 54: `grant` recomputes the expiry from the current tick, so a lease due to lapse at 60 came back lapsing at 100. `restoreLease` puts it back as it was. Both bugs were found by running the replay rather than by inspecting the save, which is the argument for criterion 1 being "the next 600 ticks" instead of "the digest matches".
3. **The suite got slow and I fixed the cause, not the timeout.** Each host compiled the 640,000-cell island (~3 s), and the replay tests build many; the suite hit 145 s. `ComposedHost.create` now accepts an already-compiled terrain and checks its seed, so a caller pays once — 4.8 s for the same tests. A real app restoring a save wants exactly this.
4. **Every section is required and none has a default.** A save missing `needs` is not a save of a world where nobody is hungry, and the test removes each section in turn rather than spot-checking one.

Deferred and out of scope: the save is an in-memory record, not bytes — routing it through W0-08's versioned container and IndexedDB is the packet that owns storage, and this one owns the *contents*. Also absent: journalled command replay (a save restores state; replaying a match from its inputs is a different mechanism), compression, and the terrain itself — a save carries the seed and recompiles, which is why `SeedMismatch` is a refusal rather than a warning.
