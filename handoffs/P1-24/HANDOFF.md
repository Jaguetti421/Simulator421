# Handoff — P1-24 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `573e2e0` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: bleed pausing restricted to covered sentient-origin wounds, revives that consume a bandage only on completion, and elimination cleanup that runs exactly once.

Changed files: `packages/sim/core/elimination.ts` (new) — `bleedPauses`, `tickBleedSource`, `beginRevive` / `stepRevive`, `EliminationRegistry`; `packages/sim/core/index.ts`; `packages/sim/core/elimination.test.ts` (17 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. Protection pauses only covered sentient-origin bleed | `evidence/elimination.txt`, `elimination.test.ts` | **PASS** — hostile and covered pauses; hostile and uncovered does not; environment, exposure and starvation are never paused even while covered, because GDD §9.2 says protection "does not … stabilize wildlife injuries". A hostile wound with 4,000 left spends 40 covered ticks and still has **exactly 4,000**, then resumes at the full rate. A wildlife wound bleeds out completely inside protection |
| 2. Revival consumes one bandage at completion and resets the episode | `evidence/elimination.txt`, `elimination.test.ts` | **PASS** — six seconds of work, then `Completed` naming `item.bandage`; the bandage appears in **no other outcome**, so a caller cannot spend it on a failure. Interrupted one tick from done: `bandageConsumed: false` — time lost, nothing else. A new episode starts from zero, and a revive refuses to proceed without a bandage rather than finishing for free. The revived actor carries a temporary wound penalty (×700/1000) that expires on its own tick |
| 3. Elimination releases leases and produces carried drops once | `evidence/elimination.txt`, `elimination.test.ts` | **PASS** — cleanup releases both of the actor's leases, drops both carried stacks in canonical order, and leaves another actor's lease alone. **150 further calls from a tick loop produce zero additional drops.** An actor carrying nothing still has its leases released |

Commands executed: `npm run verify` → **0** (build, lint, **877/877** vitest across 56 files — 860 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Three notes.
1. **Idempotence lives in a registry, not on the actor.** The tick loop will call cleanup again next tick, and by then the actor record may have been copied or replaced — a flag on the record would survive only by luck. Asking a registry "have I done this one" is reliable in a way asking a copied record is not.
2. **The bandage is named only in the `Completed` variant.** That is the type doing the work: there is no branch where a caller could consume it on an interruption, so "consumed at completion" is not a rule anyone has to remember.
3. **A wound's pause leaves `remainingMilli` untouched**, and the test asserts the exact number before and after 40 covered ticks. This is the same shape as P1-13's bleed and P1-23's bleed-out deadline — three packets now express "paused, not healed" the same way, which is worth keeping consistent.

Deferred and out of scope: nothing creates a bleed from a blow, and nothing spends the bandage out of a P1-07 inventory — `Completed` names the item and the caller removes it, which is the tick transaction stage's job. Also absent: the wound penalty is exposed as a multiplier and nothing yet applies it to movement or work; drops are records rather than world entities (no ground container exists to put them in); and revive eligibility rules — anyone with a bandage may revive anyone downed, with no clan, distance or law check yet.
