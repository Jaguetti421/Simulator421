# Review request 01 — to the reviewing agent, from the web-track developer

**Date:** 12 September 2026 · **Build:** tag `test-build-01` = `f42e343` on `main`, `github.com/Jaguetti421/Simulator421`
**Delivered by:** Jani. Return your documents to Jani; he passes them back to me.

You worked on the technical plan, so I will skip the introductions and give you the state, the job, and the places I think I am most likely to be wrong.

---

## 1. Status

The web track is 15 packets deep: **W0-01 … W0-11 accepted** (gate **G0 approved** on tag `w0-baseline`, with two human checks deferred), **P1-01 … P1-03 accepted**, **P1-04 awaiting acceptance**, plus two producer-directed debt passes. `npm run verify` → 570 tests across 35 files; `npm run test:e2e` → 17 Playwright tests; CI green on both jobs on a clean runner.

What exists, honestly stated:

- **Deterministic core.** Branded integer primitives, checked arithmetic, sfc32 streams with labelled derivation, two-domain FNV-1a hashing, canonical LE serialization. No floats, clock or RNG on consequential paths — lint-enforced.
- **Contracts.** 23 frozen records, digest `sha256:3fe2ced1…`. Sixteen from W0-04; P1-01 added five action-lifecycle records completing TP v1.1 §8, plus `StateSectionSet` and `AppearanceRecipe`.
- **Tick kernel.** Ten-stage transaction, pause barrier, authoritative command queue, synthetic 136/137-actor workload. Identical authoritative digests in Node's main thread, a `worker_threads` worker, and a **browser Worker** (`4d0bd28a` at 137 actors / 600 ticks).
- **Persistence.** Versioned section container, two-generation durable saves with fallback, world snapshot codec, exactly-once results. One contract suite over memory, fake-indexeddb and the browser's own IndexedDB.
- **Lab.** `clanlab validate / run / inspect / render`, fixture DSL **v2**, a kernel host, reproducible failure bundles, a 2D readability renderer with PNG provenance.
- **Web.** Vite static site, kernel in a Worker at 1×/2×/4× with pause, Three.js tabletop scene, eight procedural identities, a `/capture` route with in-image FakeSim watermark.
- **P1 so far.** Terrain and fine geometry compiler (one hash for render and simulation), spatial hash and height-field line of sight, knowledge-limited routes with certified partial progress.

What does **not** exist: any gameplay. No goals, decisions, actions, crafting, combat, inventory, clans or economy. The kernel's stage 4 runs and decides nothing, deliberately. Terrain, sight and routes are built but **not wired into the kernel** — the app still runs the synthetic workload.

---

## 2. The job I need from you

**Independent, fresh-context reviews of packets W0-06 through P1-04, and of the two debt passes.**

AGENTS.md requires a fresh-context self-review before a packet is accepted. Only **one** review in the whole project met that bar (W0-05, written in a new session with no memory of authoring it). Every other review — fourteen of them — was written in the same session as the code, under a relaxation Jani approved. Each one declares that in its own file, and G0's gate evidence names it as the gate's largest caveat. I cannot fix it from inside my own session: asserting freshness does not create it. That is the entire reason you are being asked.

### Scope, in priority order

| Priority | Packets | Why this order |
| --- | --- | --- |
| 1 | **P1-01** (contracts), **P1-02** (terrain), **P1-03** (sight), **P1-04** (routes) | Everything in P1 builds on these. A wrong shape here is expensive later. |
| 2 | **W0-06** (lab runner), **W0-07** (tick kernel), **W0-08** (persistence) | The determinism and evidence machinery the whole project's claims rest on. |
| 3 | **DEBT-01, DEBT-02** | They changed accepted behaviour after the fact — reviewing a correction is as important as reviewing the original. |
| 4 | **W0-09** (renderer), **W0-10** (web app), **W0-11** (gate) | Lower risk; review if you have room. |

### How to read it

Clone at tag `test-build-01`. For each packet: `handoffs/<ID>/HANDOFF.md`, `handoffs/<ID>/REVIEW.md` (mine — read it **after** forming your own view), the diff for that packet's commits, and the code it touched. `state/STATUS.md` has the decision log and the session table. `AGENTS.md` and `CONVENTIONS.md` are the rules I am supposed to have followed.

### What to produce

One file per packet: **`handoffs/<ID>/REVIEW-EXTERNAL-01.md`**, using `templates/REVIEW.md`. In each:

1. Declare yourself and that this **is** a fresh-context review.
2. A findings table: severity (High / Medium / Low / Info), file and behaviour, the evidence you checked, and the required correction.
3. A verdict per acceptance criterion: PASS / FAIL / BLOCKED / HUMAN_REQUIRED — with the artifact you checked, not the one the handoff claims.
4. An overall verdict. **Never mark a packet ACCEPTED** — that is Jani's, and it is the one rule I would ask you to hold hardest.

Plus one summary file, **`handoffs/REVIEW-EXTERNAL-01-SUMMARY.md`**: the findings you would fix before G1, ranked, and anything you think the technical plan itself got wrong in light of what the implementation turned out to need.

### Rules that bind you as they bind me

- An unrun check is never PASS. If you cannot run something, say BLOCKED and name what would unblock it.
- No invented hashes, screenshots, fixture results or quotes.
- If a claim in my handoff is not supported by the artifact it cites, that is a **High** finding and I want it stated bluntly.
- Disagreeing with my design is in scope. So is telling me a packet should not have been accepted.

---

## 3. Where I think I am most likely to be wrong

Not a checklist to confirm — these are my own suspicions, and I would rather you find them than miss them.

1. **I authored an escarpment into the valley template so the `Cliff` traversal class would have instances** (P1-02). I judged that a world whose class table includes a class no cell uses is untested by construction. It is also, read unkindly, changing the world to make a test meaningful. Decide which it is.
2. **Two packets test on the `ridge` template rather than the shipping `valley`** (P1-03 sight, P1-04 routes), because the valley's floor is mostly water and its terrain never occludes. I documented it each time. It still means the route and sight suites have never run against the map the game would ship.
3. **The valley compiles to 149k shallow and 71k deep water cells out of 640k.** That is a consequence of TUNE constants I chose (`WATER.deepMm`, `CLIFF_STEP_MM`, the escarpment height) and nobody has looked at it as a design question. It may be badly wrong for the game.
4. **Every TUNE constant.** Eye height 1.6 m, obstacle sight height 2.2 m, route budget 4,000 expansions, portal repeat limit 2, readability thresholds (0.35 overlap, 3:1 contrast). All set by me to make the systems behave sensibly on synthetic data.
5. **Seven contract records are declared and nothing executes them.** Their refinements are proven by samples only. The first packet to implement an action will find shapes that cannot express one. Tell me which ones you think will break.
6. **`AppearanceRecipe` carries palette indices rather than colours.** My call, to keep colour app-side. TP v2.0 referred to this contract as already existing when it did not.
7. **Fixture DSL v2 extends a supplied kit schema** (`contracts/fixture.schema.json`). I added the `ToolCheck` kind and documented it as a dated addendum in both the schema and `FIXTURE_DSL.md`. If the kit is meant to be immutable, this is a High finding and I would want to know now.
8. **The kernel host submits only `ScheduleLaw`.** Any other scheduled operation is reported as unsubmitted rather than run. Fixtures relying on other operations will read as Blocked indefinitely.
9. **A* admissibility.** `findRoute` uses `isqrt(d)*1000` as the heuristic and `1_000_000 / speedMultiplier` as step cost (1,000 on ground, 1,250 in shallow water). I believe the heuristic is admissible and consistent. Check me — a subtly inadmissible heuristic produces plausible but wrong routes, which is the worst kind of bug to find later.
10. **My own process failures.** Four scripted edits in this project silently did nothing before I caught them, and I pushed one commit while lint was failing. Both are recorded in STATUS. If you see evidence of a fifth I have not noticed, that is worth more than any design opinion.

---

## 4. What I do **not** need

Not gameplay design feedback, not scope suggestions, not P2+ planning. Jani owns those, and the GDD is his. I need the reviews.

---

## 5. If you have capacity beyond the reviews

In descending order of usefulness to me:

1. **A type-aware ESLint rule banning bare arithmetic on branded `Int` in `packages/sim`.** Deferred four times. The gap is precise: `const x: Int = a + b` already fails to compile because the brand is lost, so what remains uncaught is arithmetic consumed as a plain `number` — comparisons, array indices, `number` parameters. If you deliver the rule as a reviewable file, I will wire and test it.
2. **A second opinion on TP v1.1 §8's action table** against the five records P1-01 added, since you helped write it. Is anything missing that the first action implementation will need?
3. **Anything in the technical plan that the implementation has already proven wrong.** I have found three: `AppearanceRecipe` was cited as an existing contract and was not; `CommittedEvent` cannot carry a rejection reason, which the supplied example fixture assumes; and two cards' environment assumptions (`BLOCKED_RENDER` in the sandbox) were stale. There are probably more.
