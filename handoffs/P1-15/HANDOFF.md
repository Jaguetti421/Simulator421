# Handoff — P1-15 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `60ec248` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: the one door between the world and an actor's head — sight, hearing and awareness channels at the GDD's numbers, producing evidence records and nothing else, with threats delivered inside TP §6's half-second bound.

Changed files: `packages/sim/core/sensory.ts` (new) — `perceive`, `sightRangeMm`, `beliefFrom`, `ThreatQueue`; `packages/sim/core/index.ts`; `packages/sim/core/sensory.test.ts` (15 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. Hidden enemies, stores and concealed routes do not change decisions | `evidence/sensory.txt`, `sensory.test.ts` | **PASS** — a stand-in decision layer is fed evidence and nothing else. Adding three hostiles the observer cannot perceive — one far away, one behind it, one fully concealed — produces **byte-identical** evidence and therefore an identical decision. A blocked line of sight produces no evidence at all. Every evidence field is a value; there is no array of the world, no actor object and no terrain handle in the result |
| 2. Sight, light, concealment, sleep and hearing channels match the GDD | `evidence/sensory.txt`, `sensory.test.ts` | **PASS** — 30 m in front is `Sight`; 90 degrees to the side and 30 m behind are **not perceived**; 7 m behind is `Awareness`, the GDD's 8-metre unobstructed radius that ignores facing. Sleep scales range (60,000 → 15,000 mm) rather than switching it off, so an alarm close enough is still heard. Light and concealment scale the same way. A heard sound carries a position and uncertainty of 12 m and **no `subjectId` at all** — "sound reveals an approximate event location, not a perfect enemy inventory" |
| 3. Urgent threat evidence is delivered within five ticks | `evidence/sensory.txt`, `sensory.test.ts` | **PASS** — a threat sensed at tick 100 and delivered at 103 records a latency of 3 against the bound of 5, and nothing is overdue. A threat still undelivered at tick 106 is **reported as overdue with its latency**, not silently dropped. A hundred-tick run draining on every fourth tick keeps `overdue` empty throughout and a worst latency inside the bound. Evidence that is not a threat is never queued |

Commands executed: `npm run verify` → **0** (build, lint, **742/742** vitest across 47 files — 727 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Three notes.
1. **The field of view is a dot product, not an angle.** My first version used `atan2` and the float ban caught it, correctly: perception decides what an actor knows, so it is consequential. `Observer` now carries a facing **vector**, the test is `dot ≥ |d| · cos 80°` rearranged into integers, and there is no trigonometry anywhere near a decision. A caller with a movement delta already has the vector.
2. **Isolation is structural, not promised.** `perceive` takes the candidates a caller chose to offer, a line-of-sight predicate and nothing else — no world, no terrain, no store of what exists. An unperceived thing produces no evidence, so there is no field a decision layer could read it from. The test proves it by adding hidden hostiles and requiring the output to be unchanged.
3. **`overdue` exists so the bound is measurable rather than assumed.** A queue that quietly delivered late would pass a test that only checked delivered items. This one reports what it is still holding and how long it has held it.

Deferred and out of scope: the sensory adapter is not wired to the P1-03 line-of-sight implementation — the caller supplies the predicate, and joining them belongs with the packet that owns an actor's tick. Also absent: smell and tracks, the belief-field table's confidence bands, recent-damage attention turning, staggered inspection scheduling (this provides the bound, not the scheduler), and the three registered `ToolCheck` names that still have no CLI provider — `SightIgnoresUnobservedTerrain` in particular is exactly what criterion 1 demonstrates, and wiring the provider is a lab packet.
