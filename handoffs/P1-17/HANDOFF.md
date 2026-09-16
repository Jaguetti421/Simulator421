# Handoff — P1-17 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `e485123` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: an action executor that revalidates range, permission and leases while it runs, commits effects itself rather than through cues, and captures every field of a running action in its state section.

Changed files: `packages/sim/core/action.ts` (new) — `startAction`, `stepAction`, `cancelAction`, `captureActions` / `restoreActions`; `packages/sim/core/index.ts`; `packages/sim/core/action.test.ts` (17 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. Invalid range, permission or lease cancels with a typed failure | `evidence/action.txt`, `action.test.ts` | **PASS** — walking away gives `OutOfRange` with the distance and the limit; losing the reservation gives `LeaseLost` naming the key; a truce installed while a blow is swinging gives `PermissionDenied` naming `law.truce`; a target that leaves gives `TargetGone` rather than blaming a law for it. Each failure carries what the action had **spent and held**, so an interruption can decide their fate rather than guessing |
| 2. Actions do not apply effects through animation events | `evidence/action.txt`, `action.test.ts` | **PASS** — milestone events are committed by the executor on the authoritative tick. A failed action commits **zero** events however far its cue had played. Removing `animationCue` and `soundCue` entirely produces identical events and outputs, which is the strongest available statement that cues are not inputs. A milestone fires once, not on every tick after it |
| 3. Every active field is captured by its state-section codec | `evidence/action.txt`, `action.test.ts` | **PASS** — a save taken 12 ticks into a 20-tick craft restores **identically** (60,000 milli of progress, still holding `station.bench`) and then completes at exactly the tick an uninterrupted run would. A test compares the field list of the captured record against the live one, so a field added later and not captured fails here rather than in a playtest. Capture is canonical; a future section version is refused |

Commands executed: `npm run verify` → **0** (build, lint, **773/773** vitest across 49 files — 756 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Three notes.
1. **Revalidation runs on the completing tick as well as on its cadence.** The cadence is every ten ticks; a truce arriving at tick 9, one tick before a ten-tick strike lands, falls between two cadence points. The evidence shows it caught — because the tick that applies the effect is exactly the tick where a stale check is most expensive.
2. **`isSentientHarm` is a property of the action definition**, so the executor asks the permission service only for actions that are harm between actors. Crafting never consults a truce, which is both correct and the reason a law change does not stall every workbench on the island.
3. **Failure retains progress rather than zeroing it.** A craft interrupted at 90 % reports 90,000 milli retained; whether the actor may resume is the interruption's decision, and P1-01's `ActionInterruption` record already has the field for it.

Deferred and out of scope: this executes an action, it does not **schedule** one — nothing chooses actions, and the utility scoring that will is P1-16. Inputs are recorded as consumed at start but not removed from a P1-07 inventory, and outputs are named but not added: joining the two is the packet that owns a tick's transaction stage. Also absent: the `ActionInstance` contract record is mirrored by `RunningAction` rather than used directly — binding them needs the codec work that registers this section with the W0-08 container; resource acquisition (`AwaitingResource` is declared and never entered); and cooldowns after an interruption.
