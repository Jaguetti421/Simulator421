# Handoff — P1-07 / attempt 1

Status: **READY_FOR_REVIEW**.
Base: `f9b53ae` (P1-06 ACCEPTED) → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: typed item stacks with weights, stack limits and carry capacity, atomic transfers, and an inventory state section that round-trips canonically.

Changed files: `packages/sim/core/inventory.ts` (new) — `transfer`, `weightGrams`, `totalItems`, `captureInventories` / `restoreInventories`; `packages/sim/core/index.ts`; `packages/sim/core/inventory.test.ts` (13 tests).

| Acceptance criterion | Evidence path | Executed result |
| --- | --- | --- |
| 1. Competing transfers cannot duplicate or overdraw a stack | `evidence/inventory.txt`, `inventory.test.ts` | **PASS** — two transfers computed against the same starting inventory both look valid in isolation; applied in sequence, as a tick actually does, the second is refused with `InsufficientSource`, and five berries remain five. Overdraw by one, exceeding a stack limit, and exceeding carry capacity are each refused with a typed reason and a detail naming the numbers. A twelve-round chain of transfers back and forth conserves the item count exactly |
| 2. Failed transfer changes neither inventory | `evidence/inventory.txt`, `inventory.test.ts` | **PASS** — a failed transfer returns **no inventories at all**, so there is nothing half-applied to reconcile: the test asserts `"from" in result` and `"to" in result` are both false, then that the originals capture byte-identically to before and weights are unchanged. This is stronger than a rollback, which is a second chance to get it wrong |
| 3. Inventory state round-trips through its owned state section | `evidence/inventory.txt`, `inventory.test.ts` | **PASS** — capture → restore → capture is identical, including after a transfer. Capture is **canonical**: owners sorted, items sorted within an owner, and a zero count removed rather than stored, so two worlds holding the same items cannot serialize differently and disagree on a save hash. A section written by a future version is refused rather than guessed at |

Commands executed: `npm run verify` → **0** (build, lint, **663/663** vitest across 41 files — 650 at the packet baseline; 6 python; workboard PASS).

Design decisions within scope:
1. **A failed transfer never writes.** Every check runs before any value is produced, and success returns a *new pair* of inventories rather than mutating. The half-applied state between a write and its rollback is exactly where duplication comes from.
2. **A zero count is absent, not stored.** Otherwise an inventory that once held berries and an inventory that never did would serialize differently while holding the same items, and the save hash would report a difference that is not one.
3. **Whole items and grams only.** No fractional quantity exists, so no rounding rule can create or destroy an item — the conservation property is structural rather than tested into place.
4. **Capacity is checked on the destination's total weight**, not on the delta, so an inventory can never be pushed over its limit by a transfer that looked small.

Contract proposals or deferred work outside scope: this is the data structure and its transfer rule. **Not here:** reservations (the `ReservationKey` record from P1-01 is unused by this packet), ownership policy enforcement — `ActionResources.ownershipPolicy` exists in the contract and nothing consults it yet — containers and ground stacks as entities, item durability or spoilage, and any wiring into the tick kernel's transaction stage. Two actors cannot yet contend for the same stack *within one tick* because nothing schedules transfers; the sequencing test shows the rule holds when they are applied in order, which is what stage 6 will do.

Remaining risks: the inventory section is not yet registered with the W0-08 container as a real `IStateSectionCodec`, so criterion 3 is proved against the capture/restore pair rather than through a written save file. That wiring belongs with the packet that adds inventory to the snapshot set. Reproduce with `npm run verify` and the script in `evidence/inventory.txt`.

Reviewer request: reproduce the acceptance evidence and record findings in REVIEW.md.
