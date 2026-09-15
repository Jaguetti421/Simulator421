import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { captureInventories, countOf, emptyInventory, restoreInventories, totalItems, transfer, weightGrams } from "./inventory.js";
import type { Inventory, ItemDef, ItemDefId } from "./inventory.js";

/** P1-07. Every test constructs the moment a transfer goes wrong. */
const I = (n: number): Int => n as Int;

const defs = new Map<ItemDefId, ItemDef>([
  ["item.berry", { id: "item.berry", gramsEach: I(50), stackLimit: I(20) }],
  ["item.axe", { id: "item.axe", gramsEach: I(1_200), stackLimit: I(1) }],
  ["item.stone", { id: "item.stone", gramsEach: I(900), stackLimit: I(10) }],
]);

function stocked(ownerId: string, counts: [ItemDefId, number][], capacityGrams = 30_000): Inventory {
  return { ownerId, capacityGrams: I(capacityGrams), counts: new Map(counts.map(([item, n]) => [item, I(n)])) };
}

describe("competing transfers cannot duplicate or overdraw (criterion 1)", () => {
  it("lets only the first of two transfers spending the same stack succeed", () => {
    const source = stocked("C003", [["item.berry", 5]]);
    const alice = emptyInventory("C009", I(30_000));
    const bob = emptyInventory("C017", I(30_000));

    // Both are computed against the same starting inventory — the race.
    const first = transfer(source, alice, "item.berry", I(5), defs);
    const second = transfer(source, bob, "item.berry", I(5), defs);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    // Applying the second against the first's result — which is what a tick
    // actually does — refuses, because the stack is gone.
    const afterFirst = first.from;
    const applied = transfer(afterFirst, bob, "item.berry", I(5), defs);
    expect(applied.ok).toBe(false);
    if (applied.ok) return;
    expect(applied.reason).toBe("InsufficientSource");

    // Conservation: five berries existed and five exist.
    expect(totalItems(afterFirst) + totalItems(first.to) + totalItems(bob)).toBe(5);
  });

  it("refuses to overdraw a stack by one", () => {
    const result = transfer(stocked("C003", [["item.berry", 3]]), emptyInventory("C009", I(30_000)), "item.berry", I(4), defs);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("InsufficientSource");
    expect(result.detail).toContain("holds 3");
  });

  it("refuses a transfer that would exceed the destination's stack limit", () => {
    const result = transfer(stocked("C003", [["item.axe", 1]]), stocked("C009", [["item.axe", 1]]), "item.axe", I(1), defs);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("OverStackLimit");
  });

  it("refuses a transfer that would exceed the destination's carry capacity", () => {
    const light = emptyInventory("C009", I(2_000));
    const result = transfer(stocked("C003", [["item.stone", 5]]), light, "item.stone", I(3), defs);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("OverCapacity");
    expect(result.detail).toContain("capacity is 2000 g");
  });

  it("conserves items across a long chain of transfers", () => {
    let a = stocked("C003", [["item.berry", 12], ["item.stone", 4]]);
    let b = emptyInventory("C009", I(30_000));
    const before = totalItems(a) + totalItems(b);
    for (let i = 0; i < 12; i += 1) {
      const forward = transfer(a, b, "item.berry", I(1), defs);
      if (forward.ok) {
        a = forward.from;
        b = forward.to;
      }
      const back = transfer(b, a, "item.stone", I(1), defs);
      if (back.ok) {
        b = back.from;
        a = back.to;
      }
    }
    expect(totalItems(a) + totalItems(b)).toBe(before);
  });

  it("refuses a non-positive amount and a transfer to the same owner", () => {
    const a = stocked("C003", [["item.berry", 2]]);
    expect(transfer(a, emptyInventory("C009", I(100)), "item.berry", I(0), defs).ok).toBe(false);
    expect(transfer(a, emptyInventory("C009", I(100)), "item.berry", I(-1), defs).ok).toBe(false);
    expect(transfer(a, stocked("C003", []), "item.berry", I(1), defs).ok).toBe(false);
  });
});

describe("a failed transfer changes neither inventory (criterion 2)", () => {
  it("returns no inventories at all on failure, so there is nothing to half-apply", () => {
    const from = stocked("C003", [["item.stone", 5]]);
    const to = emptyInventory("C009", I(1_000));
    const before = { from: captureInventories([from]), to: captureInventories([to]) };

    const result = transfer(from, to, "item.stone", I(3), defs);
    expect(result.ok).toBe(false);
    expect("from" in result).toBe(false);
    expect("to" in result).toBe(false);

    // The originals are untouched — they were never written to.
    expect(captureInventories([from])).toEqual(before.from);
    expect(captureInventories([to])).toEqual(before.to);
    expect(countOf(from, "item.stone")).toBe(5);
    expect(countOf(to, "item.stone")).toBe(0);
  });

  it("leaves weights unchanged when a transfer fails", () => {
    const from = stocked("C003", [["item.stone", 5]]);
    const to = emptyInventory("C009", I(1_000));
    const weightBefore = weightGrams(from, defs);
    transfer(from, to, "item.stone", I(99), defs);
    expect(weightGrams(from, defs)).toBe(weightBefore);
    expect(weightGrams(to, defs)).toBe(0);
  });

  it("never leaves a zero-count stack behind after a successful emptying transfer", () => {
    const result = transfer(stocked("C003", [["item.berry", 2]]), emptyInventory("C009", I(30_000)), "item.berry", I(2), defs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.from.counts.has("item.berry")).toBe(false);
    expect(captureInventories([result.from]).inventories[0]?.counts).toEqual([]);
  });
});

describe("inventory round-trips through its state section (criterion 3)", () => {
  const world = [stocked("C009", [["item.stone", 2], ["item.berry", 7]]), stocked("C003", [["item.axe", 1]]), emptyInventory("C017", I(12_000))];

  it("restores exactly what was captured", () => {
    const restored = restoreInventories(captureInventories(world));
    expect(captureInventories(restored)).toEqual(captureInventories(world));
    expect(restored.map((i) => i.ownerId)).toEqual(["C003", "C009", "C017"]);
    expect(countOf(restored[1] as Inventory, "item.berry")).toBe(7);
  });

  it("captures canonically: owner and item order cannot change the bytes", () => {
    const shuffled = [world[2], world[0], world[1]] as Inventory[];
    expect(JSON.stringify(captureInventories(shuffled))).toBe(JSON.stringify(captureInventories(world)));
  });

  it("survives a transfer and a round trip with items conserved", () => {
    const moved = transfer(world[0] as Inventory, world[1] as Inventory, "item.berry", I(3), defs);
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    const after = [moved.from, moved.to, world[2] as Inventory];
    const restored = restoreInventories(captureInventories(after));
    expect(restored.reduce((sum, i) => sum + (totalItems(i) as number), 0)).toBe(world.reduce((sum, i) => sum + (totalItems(i) as number), 0));
    expect(captureInventories(restored)).toEqual(captureInventories(after));
  });

  it("refuses a section written by a future version rather than guessing its shape", () => {
    const record = { ...captureInventories(world), sectionVersion: 99 };
    expect(() => restoreInventories(record)).toThrow(/refuses an unknown version/u);
  });
});
