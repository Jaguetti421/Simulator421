# Handoff — P1-27 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `8ee458c` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: one published snapshot slot the core never blocks on, interpolation owned by the view, and a pause that settles on the acknowledged tick with the data age visible.

Changed files: `packages/sim/host/bridge.ts` (new) — `SnapshotBridge`, `InterpolationCache`, `settlePause`, `dataAgeLabel`; `packages/sim/host/index.ts`; `packages/sim/host/bridge.test.ts` (14 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. Renderer holds one shared read buffer and a local previous-sample cache | `evidence/bridge.txt`, `bridge.test.ts` | **PASS** — 100 publishes leave exactly one snapshot; the reader gets the newest and is told it skipped 99. The snapshot and its actor array are **frozen**, and a view attempting to write into one throws: it holds a value, not a handle. The previous-sample cache lives on the view side and stores copies, so mutating a source sample afterwards cannot reach it |
| 2. Slow rendering cannot mutate or block the core through a held buffer | `evidence/bridge.txt`, `bridge.test.ts` | **PASS** — 1,000 ticks published with nobody reading: the core never blocks and acknowledges tick 999. A reader that missed 500 frames gets the newest and an honest `skipped: 499`. An interpolated actor is a **different type** from a published sample — plain numbers, an `interpolated` flag, no `facingMm` — so a smoothed position does not satisfy the shape the core publishes and cannot be written back |
| 3. Pause settles to the acknowledged tick; data age is visible | `evidence/bridge.txt`, `bridge.test.ts` | **PASS** — a pause after 43 publishes settles on tick 42, the tick the core acknowledged, rather than wherever the view was mid-interpolation. `dataAgeLabel` renders `tick 7 (current)` and `tick 12 (current), 4 skipped`. Before the first publish the bridge returns **nothing** rather than an empty frame a view might draw |

Commands executed: `npm run verify` → **0** (build, lint, **906/906** vitest across 58 files — 892 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Three notes.
1. **Ownership is enforced by two different types, not by discipline.** `ActorSample` is what the core publishes; `InterpolatedActor` is what the view draws. A smoothed value cannot be handed back because it does not fit the input, which is stronger than any rule about not doing it.
2. **One slot, never a queue.** A queue would let a slow renderer cost the core unbounded memory and eventually attention. Overwriting means a slow reader's only penalty is missing frames, and `skipped` makes that visible instead of silent.
3. **Alpha is clamped rather than extrapolated.** Extrapolating past the newest snapshot invents a position the simulation never produced — cheap to do, and exactly the kind of thing that later gets mistaken for a physics bug.

Deferred and out of scope: nothing publishes into this bridge yet — the kernel's tick loop wiring is the transaction stage's job, and `apps/web` still reads its own worker protocol. Also absent: snapshot compression or delta encoding (one slot of full state is fine at this size and a premature optimisation otherwise), multiple named channels, and the interpolation of anything but position — facing, actions and cues will each need their own rule, and guessing at them now would be inventing requirements.
