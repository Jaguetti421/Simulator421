# Handoff — P1-20 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `c1a3a86` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: construction sockets that consume inputs at milestones, conserve them through salvage, admit one builder, and refuse a placement that would seal a required route.

Changed files: `packages/sim/core/construction.ts` (new) — `claimSocket`, `stepBuild`, `salvage`, `checkPlacement`, `PROTOTYPE_SOCKETS`; `packages/sim/core/index.ts`; `packages/sim/core/construction.test.ts` (14 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. Half-progress consumption and unfinished salvage conserve inputs | `evidence/construction.txt`, `construction.test.ts` | **PASS** — a firepit consumes 2 stone at 33 %, 2 more at 66 % and 3 branches at completion, **as each milestone is reached**. Abandoned at 85 ticks having consumed 4 stone, salvage returns 2 and destroys 2. A test abandons a shelter at **five different points** and requires returned + lost to equal consumed every time, because "some of it comes back" is exactly the rule that quietly creates or destroys items when a fraction rounds |
| 2. Two actors cannot claim the same socket | `evidence/construction.txt`, `construction.test.ts` | **PASS** — the lease is taken **before** any input is spent, so the second claimant is refused with `SocketTaken` naming the holder rather than discovering it after a trip and a milestone. A non-builder cannot advance someone else's site. Abandoning releases the socket so another actor may try, and two different sockets can be built at once |
| 3. Filling prototype sockets preserves the required work routes and exits | `evidence/construction.txt`, `construction.test.ts` | **PASS** — a shelter on clear ground is allowed; one on the water path or across the camp exit is refused **naming the route and how many of its cells it blocks**. The check covers the whole 2×2 footprint, not just its origin: a placement whose corner clips the path is caught. The shipped sockets' milestones are ordered, end at 100 %, and consume whole items |

Commands executed: `npm run verify` → **0** (build, lint, **1,012/1,012** vitest across 65 files — 998 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Three notes.
1. **Conservation is tested at five abandonment points, not one.** A halving that rounds correctly at 4 stone can lose an item at 5, and a single spot check would miss it. This is the same shape as P1-07's conservation chain.
2. **The lease comes before the first input.** Claiming after starting work would let two actors each spend a milestone before one of them loses — a wasted trip the player reads as stupidity, and the exact thing P1-18 avoided by reserving before walking.
3. **Placement checks the footprint, not the origin.** A 2×2 shelter whose corner clips the only path to water is the failure case, and testing the origin alone would pass it happily.

Deferred and out of scope: nothing moves items in or out of a P1-07 inventory — `stepBuild` reports what a milestone consumed and `salvage` reports what comes back, and the caller performs the transfer in the tick's transaction stage. Also absent: the finished structure as a world entity (nothing occupies the footprint afterwards), repair and decay, build skill affecting duration, and the route requirements themselves — `checkPlacement` grades a proposal against routes a caller supplies, and generating those from the compiled map belongs with world generation.
