# Handoff — P1-21 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `e2dc197` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: projectile flight as a swept segment, stable first-contact ordering, and a collision result that applies nothing.

Changed files: `packages/sim/core/projectile.ts` (new) — `sweepProjectile`, `flyUntilContact`, `velocityToward`, `Contact`; `packages/sim/core/index.ts`; `packages/sim/core/projectile.test.ts` (14 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. An 18 m/s arrow cannot tunnel through an actor between ticks | `evidence/projectile.txt`, `projectile.test.ts` | **PASS** — 18 m/s is 1,800 mm per tick against an actor 900 mm across, so an endpoint test would miss most of the step. A target is placed at **every 100 mm across a full step** and hit every time; the 900 mm case is called out separately because neither endpoint is inside the target's radius — that is the tunnelling case exactly. Tested again at 60 and 240 m/s: still no tunnelling, because the test is against the segment rather than against a step size |
| 2. First obstacle/contact ordering is stable | `evidence/projectile.txt`, `projectile.test.ts` | **PASS** — the nearest contact is first; reversing the candidate order gives the identical answer; an exact tie breaks on target ID; an obstacle in front of an actor wins. Repeated identical sweeps serialize identically |
| 3. Collision output alone applies no damage | `evidence/projectile.txt`, `projectile.test.ts` | **PASS** — `Contact.appliesDamage` is the literal `false`, and the result carries no `hpMilli` or `damage` field for a caller to reach for. A hit landing under a truce is demonstrated end to end: the contact is found, and `resolveHarm` still refuses with `law.truce`. The projectile advances to the end of its segment whether or not it met anything, because stopping it is a decision that belongs after permission |

Commands executed: `npm run verify` → **0** (build, lint, **756/756** vitest across 48 files — 742 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Three notes.
1. **The tunnelling test enumerates the step rather than sampling it.** Checking one mid-step position would pass against an implementation that happened to test the midpoint. Every 100 mm across 1,800 mm, plus three speeds, is what makes "cannot tunnel" a claim about the algorithm rather than about one arrangement.
2. **`appliesDamage: false` is a literal type, not a flag someone sets.** A `Contact` cannot be constructed claiming otherwise, so "collision applies no damage" is enforced by the type rather than by callers remembering. The permission test beside it shows the real path: geometry, then the service, then damage.
3. **The projectile is advanced even on contact.** It would be tidier to stop it, and wrong: whether an arrow stops depends on what it hit and whether the hit was permitted, and geometry does not know either.

Deferred and out of scope: gravity, drag, arcing flight and elevation — this is a flat segment in two dimensions, which is what the collision question needs and not what a ballistics model would be. Also absent: permission asked at launch (TP §11 wants it at both ends, and the launch half belongs with the action that fires); penetration, deflection and cover damage; projectile ownership decay; and any wiring into the kernel, so nothing yet fires one.
