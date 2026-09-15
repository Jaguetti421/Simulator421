# Handoff — P1-13 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `88ac72d` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: sanctuary blocking sentient harm from either side with inclusive boundaries, wildlife and needs left running, and hostile bleed timers paused while covered.

Changed files: `packages/sim/core/sanctuary.ts` (new) — `resolveHarm`, `tickBleed`, `isCovered`, `newBleed`, `applyDamage`; `packages/sim/core/index.ts`; `packages/sim/core/sanctuary.test.ts` (12 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. Attacker or target inside sanctuary blocks sentient harm | `evidence/sanctuary.txt`, `sanctuary.test.ts` | **PASS** — blocked with the target inside and the attacker outside, blocked with the attacker inside and the target outside, allowed with both outside. The denial names the law, because it comes from P1-12's service rather than from a second rule written here |
| 2. Boundary points are included | `evidence/sanctuary.txt`, `sanctuary.test.ts` | **PASS** — a point exactly on the radius is covered; one millimetre past it is not. Harm is refused with **either** party exactly on the boundary |
| 3. Wildlife and needs remain active while covered hostile bleed timers pause | `evidence/sanctuary.txt`, `sanctuary.test.ts` | **PASS** — a wolf bites a protected actor for full damage; starvation inside a sanctuary costs the full 8 HP/minute, so a sanctuary is not a larder. A hostile bleed with 6,000 milli left spends 50 ticks covered and still has **exactly 6,000** left, with 50 paused ticks recorded; stepping out resumes on the same amount. A test runs the same wound with and without shelter and requires the **total damage paid to be identical** — shelter changes when, never how much |

Commands executed: `npm run verify` → **0** (build, lint, **727/727** vitest across 46 files — 715 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Three notes.
1. **The sentient/non-sentient split rides on one field, not a list.** `resolveHarm` asks the permission service only when the attempt is hostile *and* has an attacker; everything else is applied directly. A new damage source declares what it is once, in `DamageEvent`, and every law that will ever care reads the same flag — which is why P1-09 tagging starvation was worth doing then rather than now.
2. **Asking the service about a wolf would be the bug.** A sanctuary that stopped wildlife would make the safest place on the island the one where nothing can happen at all, which is the opposite of the GDD's "a protected contestant seeing a wolf must still choose fight, flee, or seek nearby allies".
3. **Paused means `remainingMilli` is untouched**, not reduced slowly. The test asserts the exact number before and after fifty covered ticks, because a pause implemented as a very slow drain would look identical for short shelters and wrong for long ones.

Deferred and out of scope: Herald's Hearth capture and the sanctuary sockets themselves (a sanctuary here is any law with a scope, and nothing places one on the map); cancellation of hostile preparations when protection activates, and the clearing of covered statuses when it ends — GDD §10 asks for both and they need an action system to cancel; bleed sources other than the ones P1-09 declares; and any wiring into the kernel, so nothing yet creates a bleed from a blow.
