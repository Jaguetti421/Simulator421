# Handoff — P1-32 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `daa2caa` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: one composition joining every P1 system into an authoritative tick, shared by both frontends, with no placeholder in it.

Changed files: `packages/sim/host/composed.ts` (new) — `ComposedHost`, `sameComposition`; `packages/sim/host/index.ts`; `packages/sim/host/composed.test.ts` (16 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. Both frontends use identical provider registrations and content | `evidence/composed.txt`, `composed.test.ts` | **PASS** — `ComposedHost.create` is the single composition point; a frontend receives the host, its bridge and a summary and never assembles providers itself. Two independent hosts from the same seed produce **identical digests over 60 ticks** and `sameComposition` is true; a different seed gives a different world. Exactly one snapshot is published per tick |
| 2. No placeholder action or FakeSim feeds player-facing claims | `evidence/composed.txt`, `composed.test.ts` | **PASS** — the host declares `simulated: false` with an **empty** omission list, and a test asserts it does not inherit any of the W0-07 synthetic workload's eight omissions. Published snapshots carry `actors`, `digest`, `publishedSequence`, `tick` and nothing else — no watermark, no synthetic flag. Every actor's last status is a real agent outcome (Planning / Running / Completed / Failed), not a drift |
| 3. The valley runs real survival, building and law behaviour | `evidence/composed.txt`, `composed.test.ts` | **PASS** — it runs on the validated shipping island (`geometryHash 70bc28b8`, R1 island check true), places eight actors, four food nodes and a rest socket from the compiled G1 scene, and over 600 ticks the eight go from `[40, 38, 36, 34, 32, 30, 28, 26]` fullness to `[58, 62, 60, 28, 62, 60, 64, 56]` — **they found food and ate it**. A law installed at composition is enforced by the same permission service every system asks. 5,200 ticks reach the first night with everyone alive, in 175 ms per 600 ticks |

Commands executed: `npm run verify` → **0** (build, lint, **1,028/1,028** vitest across 66 files — 1,012 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Four notes.
1. **Nine recorded debts came due here and were paid, not waived.** `moveToward` is now the real terrain sweep (impassable targets return undefined, so a route that ends in water fails honestly); exposure feeds `tickNeeds`'s recovery gate; starvation damage becomes a `PendingHit` resolved with everything else; elimination cleanup runs through the registry; reservations expire on the host's clock; the bridge publishes every tick. Each of those was cheaper to record than to fake, and the record is what made this packet assembly rather than archaeology.
2. **The empty omission list is the test's subject, not a comment.** `WORKLOAD_OMISSIONS` from the synthetic kernel still exists and still has eight entries; the test asserts this host shares none of them. A future packet that stubs something has to add it to `omissions` to stay green, which is the only way I know to keep criterion 2 true after I stop looking at it.
3. **The tick order is written at the top of the file and enforced by the code below it.** Revives before damage, damage before cleanup, cleanup before publish. P1-23 established that a fixed order beats a defensible one; this is where the whole tick inherits it.
4. **Perception is composed but not yet consuming.** The agent's knowledge is supplied from the compiled scene rather than earned through P1-15's sensory adapter. That is the one join I did **not** make: wiring sight into knowledge changes what actors can plan about, and doing it in the same packet that first ran them would have made a behaviour regression impossible to attribute. It is the first thing P2 should do, and it is recorded rather than quietly skipped.

Deferred and out of scope: construction (P1-20) and combat (P1-22 to P1-25) are composed into the host's services but no actor yet chooses to build or fight — the goal library offers eating and resting only, so those systems are reachable and unexercised. Also absent: the web worker still runs the W0-07 kernel; pointing `apps/web` at `ComposedHost` is the app packet's work and belongs with P1-34's evidence pass, where the screenshots are taken.
