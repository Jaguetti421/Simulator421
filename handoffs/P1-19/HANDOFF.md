# Handoff — P1-19 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `ccfce71` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: waits that only patient, unpressed actors may take, invalidation when a law is amended, and an opening that grants no head start.

Changed files: `packages/sim/core/waiting.ts` (new) — `mayWait`, `beginWait` / `stepWait`, `checkOverdue`, `actOnPermissionOpening`; `packages/sim/core/index.ts`; `packages/sim/core/waiting.test.ts` (15 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. A patient actor may wait while an immediate-need profile selects a feasible alternative | `evidence/waiting.txt`, `waiting.test.ts` | **PASS** — fed and patient: `MayWait`. Starving and patient: `MustAct`, because an immediate need overrides patience. Fed with no patience trait: `MustAct`. The same situation gives different answers to different profiles, which is what makes patience a trait rather than a bug, and a wait that outlives its patience is **Abandoned** rather than held forever |
| 2. Amended expiry invalidates the old wait within ten ticks | `evidence/waiting.txt`, `waiting.test.ts` | **PASS** — the law is re-read every check rather than trusted from when the wait began, so an extension (500 → 900) or a shortening (500 → 200) both invalidate, naming the old and new expiry and the version change. The ten ticks are a **cadence**: an actor checking at least that often notices within ten, and `checkOverdue` reports a wait that has drifted past it rather than letting the bound quietly become untrue |
| 3. Permission opening still requires the normal attack wind-up | `evidence/waiting.txt`, `waiting.test.ts` | **PASS** — attacking at 499 is refused; at 500 the swing begins at 500 and lands at 506, the full six-tick wind-up. An actor that waited 500 ticks and one that just arrived get **identical** contact ticks. The path routes through P1-22's `beginAttack` rather than reimplementing the rule, and a bow's different wind-up comes through with it |

Commands executed: `npm run verify` → **0** (build, lint, **998/998** vitest across 64 files — 983 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Three notes.
1. **My first version measured the wrong latency.** It reported the gap since the actor's *last check*, which made a lazily-checking actor look compliant while it was nineteen ticks behind an amendment. The bound is really a cadence requirement, so there is now `checkOverdue` to report drift — the same shape as `ThreatQueue.overdue` in P1-15. Caught by a test I had written to pass, which is the useful kind of failure.
2. **The wait re-reads the law every tick.** Caching the end tick from when the wait began would be faster and would produce an actor waiting for a moment that will never come — the exact failure LAW 03 names.
3. **Acting routes through the combat module.** Reimplementing "serve the wind-up" here would give two places for the rule to live and one of them would eventually drift. The test asserting a patient actor and a newcomer get the same contact tick is what proves the shared path.

Deferred and out of scope: nothing schedules the check — `stepWait` is called by whoever owns the actor's tick, and `checkOverdue` is how that caller learns it is late. Also absent: waiting for anything other than a law (a reservation, a companion, a time of day), the social side of announcing a wait, and any link to P1-16's switching delay — a wait is a plan an actor holds, and joining the two belongs where plans are scheduled.
