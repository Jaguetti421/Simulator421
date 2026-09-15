/**
 * Inventory: typed stacks, weights, capacities and atomic transfers
 * (P1-07; TP v1.1 §8, ECON 01 foundation).
 *
 * Three properties, and all three are about the moment a transfer goes wrong:
 *
 *   - **No duplication, no overdraw.** Two transfers racing for the same stack
 *     cannot both succeed. The second sees the first's result, because a
 *     transfer reads and writes in one step rather than deciding on a snapshot
 *     and applying later.
 *   - **A failed transfer changes nothing.** Not "rolls back" — it never writes.
 *     A rollback is a second chance to get it wrong, and the half-applied state
 *     in between is what duplicates items.
 *   - **State round-trips.** Inventory is a save section like any other: what
 *     comes back is what went in, byte for byte through the canonical codec.
 *
 * Counts are whole items and weights are grams; nothing here is fractional, so
 * no rounding rule can quietly create or destroy an item.
 */
import { add, asInt, mul, sub } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";

export type ItemDefId = string;

export interface ItemDef {
  readonly id: ItemDefId;
  readonly gramsEach: Int;
  /** Whole items per stack; a stack never exceeds it. */
  readonly stackLimit: Int;
}

export interface Inventory {
  readonly ownerId: string;
  /** Item definition ID → whole items held. A zero count is removed, never stored. */
  readonly counts: ReadonlyMap<ItemDefId, Int>;
  readonly capacityGrams: Int;
}

export type TransferFailure =
  | "UnknownItem"
  | "InsufficientSource"
  | "OverStackLimit"
  | "OverCapacity"
  | "NonPositiveAmount"
  | "SameInventory";

export type TransferResult =
  | { readonly ok: true; readonly from: Inventory; readonly to: Inventory; readonly moved: Int }
  | { readonly ok: false; readonly reason: TransferFailure; readonly detail: string };

export function emptyInventory(ownerId: string, capacityGrams: Int): Inventory {
  return { ownerId, counts: new Map(), capacityGrams };
}

export function countOf(inventory: Inventory, item: ItemDefId): Int {
  return inventory.counts.get(item) ?? (0 as Int);
}

/** Total weight held, in grams. */
export function weightGrams(inventory: Inventory, defs: ReadonlyMap<ItemDefId, ItemDef>): Int {
  let total = 0 as Int;
  for (const [item, count] of inventory.counts) {
    const def = defs.get(item);
    if (def === undefined) continue;
    total = add(total, mul(def.gramsEach, count));
  }
  return total;
}

/** Total items held across every stack — the quantity conservation is measured on. */
export function totalItems(inventory: Inventory): Int {
  let total = 0 as Int;
  for (const count of inventory.counts.values()) total = add(total, count);
  return total;
}

function withCount(inventory: Inventory, item: ItemDefId, count: Int): Inventory {
  const counts = new Map(inventory.counts);
  // A zero count is absent, not stored: otherwise two inventories holding the
  // same items could serialize differently and their digests would disagree.
  if (count <= 0) counts.delete(item);
  else counts.set(item, count);
  return { ...inventory, counts };
}

/**
 * Move `amount` of `item` between two inventories, atomically.
 *
 * Every check happens before any value is produced, and the result is a **new
 * pair** of inventories rather than a mutation — so a failure has nothing to
 * undo, and a caller holding the old pair still holds a consistent world.
 */
export function transfer(
  from: Inventory,
  to: Inventory,
  item: ItemDefId,
  amount: Int,
  defs: ReadonlyMap<ItemDefId, ItemDef>,
): TransferResult {
  if (from.ownerId === to.ownerId) return { ok: false, reason: "SameInventory", detail: `${from.ownerId} cannot transfer to itself` };
  if (amount <= 0) return { ok: false, reason: "NonPositiveAmount", detail: `amount ${amount} is not a positive whole number of items` };

  const def = defs.get(item);
  if (def === undefined) return { ok: false, reason: "UnknownItem", detail: `no definition for ${item}` };

  const held = countOf(from, item);
  if (held < amount) return { ok: false, reason: "InsufficientSource", detail: `${from.ownerId} holds ${held} ${item}, asked for ${amount}` };

  const destination = add(countOf(to, item), amount);
  if (destination > def.stackLimit) {
    return { ok: false, reason: "OverStackLimit", detail: `${to.ownerId} would hold ${destination} ${item}, stack limit is ${def.stackLimit}` };
  }

  const addedGrams = mul(def.gramsEach, amount);
  const destinationWeight = add(weightGrams(to, defs), addedGrams);
  if (destinationWeight > to.capacityGrams) {
    return { ok: false, reason: "OverCapacity", detail: `${to.ownerId} would carry ${destinationWeight} g, capacity is ${to.capacityGrams} g` };
  }

  return {
    ok: true,
    moved: amount,
    from: withCount(from, item, sub(held, amount)),
    to: withCount(to, item, destination),
  };
}

// ---------------------------------------------------------------------------
// The owned state section
// ---------------------------------------------------------------------------

export const INVENTORY_SECTION_ID = "inventory";
export const INVENTORY_SECTION_VERSION = 1;

export interface InventorySectionRecord {
  readonly sectionVersion: number;
  readonly inventories: readonly { readonly ownerId: string; readonly capacityGrams: number; readonly counts: readonly [ItemDefId, number][] }[];
}

/**
 * Capture inventories as plain data, in a canonical order: owners sorted, then
 * items sorted within each owner. Two worlds holding the same items must produce
 * the same bytes, or the save hash means nothing.
 */
export function captureInventories(inventories: readonly Inventory[]): InventorySectionRecord {
  return {
    sectionVersion: INVENTORY_SECTION_VERSION,
    inventories: [...inventories]
      .sort((a, b) => (a.ownerId < b.ownerId ? -1 : a.ownerId > b.ownerId ? 1 : 0))
      .map((inventory) => ({
        ownerId: inventory.ownerId,
        capacityGrams: inventory.capacityGrams as number,
        counts: [...inventory.counts.entries()]
          .map(([item, count]) => [item, count as number] as [ItemDefId, number])
          .sort((a, b) => (a[0] < b[0] ? -1 : 1)),
      })),
  };
}

export function restoreInventories(record: InventorySectionRecord): readonly Inventory[] {
  if (record.sectionVersion !== INVENTORY_SECTION_VERSION) {
    throw new Error(`inventory section version ${record.sectionVersion} is not ${INVENTORY_SECTION_VERSION}; a decoder refuses an unknown version rather than guessing`);
  }
  return record.inventories.map((entry) => ({
    ownerId: entry.ownerId,
    capacityGrams: asInt(entry.capacityGrams, "capacityGrams"),
    counts: new Map(entry.counts.map(([item, count]) => [item, asInt(count, "count")])),
  }));
}
