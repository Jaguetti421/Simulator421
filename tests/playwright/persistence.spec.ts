import { expect, test } from "@playwright/test";
import type * as SimPackage from "../../packages/sim/index.js";

/**
 * The browser IndexedDB adapter (W0-08, acceptance criterion 3).
 *
 * The same storage contract the Node adapters satisfy, executed against the
 * browser's own IndexedDB through the same `IndexedDbStorage` class — the module
 * is imported over HTTP from `packages/sim/dist`, so these are the shipped bytes,
 * not a re-implementation.
 *
 * The kit expected this to be BLOCKED in the sandbox. It is not: Playwright's
 * Chromium is installed here (state/STATUS.md), so the check runs. What it does
 * NOT prove is anything about rendering or performance.
 */
/**
 * `indexedDB` exists in the page, not in this file: everything below that touches
 * it runs inside `page.evaluate`. The declaration keeps the spec type-checked by
 * the same tsc project as the rest of the repo without pulling the DOM lib in.
 */
declare const indexedDB: unknown;

const HARNESS = "http://127.0.0.1:4173/tests/playwright/blank.html";
const MODULE = "http://127.0.0.1:4173/packages/sim/dist/index.js";

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
});

test("the browser's IndexedDB satisfies the storage contract", async ({ page }) => {
  const result = await page.evaluate(async (moduleUrl) => {
    const sim = (await import(moduleUrl)) as typeof SimPackage;
    const storage = await sim.persistence.IndexedDbStorage.open(indexedDB as never, `lastclan-contract-${Date.now()}`);

    const bytes = (...v: number[]): Uint8Array => new Uint8Array(v);
    const out: Record<string, unknown> = {};

    out["absentIsUndefined"] = (await storage.get("meta", "absent")) === undefined;

    await storage.put("snapshots", "run-a/gen2", bytes(2, 2));
    await storage.put("snapshots", "run-a/gen1", bytes(1));
    out["roundTrip"] = Array.from((await storage.get("snapshots", "run-a/gen1")) ?? []);
    out["keys"] = await storage.keys("snapshots");

    await storage.add("results", "key", bytes(1));
    try {
      await storage.add("results", "key", bytes(2));
      out["addConflict"] = "no error";
    } catch (e) {
      out["addConflict"] = (e as Error).message;
    }

    return out;
  }, MODULE);

  expect(result["absentIsUndefined"]).toBe(true);
  expect(result["roundTrip"]).toEqual([1]);
  expect(result["keys"]).toEqual(["run-a/gen1", "run-a/gen2"]);
  expect(String(result["addConflict"])).toMatch(/ResultConflict/u);
});

test("generations, fallback and exactly-once finalization behave as they do in Node", async ({ page }) => {
  const result = await page.evaluate(async (moduleUrl) => {
    const sim = (await import(moduleUrl)) as typeof SimPackage;
    const p = sim.persistence;
    const storage = await p.IndexedDbStorage.open(indexedDB as never, `lastclan-generations-${Date.now()}`);
    const container = (marker: number): Uint8Array => p.writeContainer([{ name: "world", formatVersion: 1, bytes: new Uint8Array([marker]) }]);

    await p.saveCheckpoint(storage, "run-a", container(1));
    await p.saveCheckpoint(storage, "run-a", container(2));
    const newest = await p.loadLatest(storage, "run-a");

    const corrupt = (await storage.get("snapshots", "run-a/gen2")) as Uint8Array;
    corrupt[corrupt.byteLength - 1] = (corrupt[corrupt.byteLength - 1] ?? 0) ^ 0xff;
    await storage.put("snapshots", "run-a/gen2", corrupt);
    const fallback = await p.loadLatest(storage, "run-a");

    const record = {
      resultKey: p.resultKeyFor("run-a", 36000, "4d0bd28a"),
      runId: "run-a",
      finalTick: 36000,
      winnerActorId: "C017",
      authoritativeDigest: "4d0bd28a",
    };
    const first = await p.applyResult(storage, record);
    const second = await p.applyResult(storage, record);
    let conflict = "no error";
    try {
      await p.applyResult(storage, { ...record, winnerActorId: "C042" });
    } catch (e) {
      conflict = (e as Error).message;
    }

    return {
      newestGeneration: newest.generation,
      fallbackGeneration: fallback.generation,
      fallbackCode: fallback.fellBackFrom?.code ?? null,
      fallbackBytes: Array.from(fallback.sections[0]?.bytes ?? []),
      firstApplied: first.applied,
      secondApplied: second.applied,
      appliedCount: second.appliedCount,
      conflict,
    };
  }, MODULE);

  expect(result.newestGeneration).toBe(2);
  expect(result.fallbackGeneration).toBe(1);
  expect(result.fallbackCode).toBe("ChecksumMismatch");
  expect(result.fallbackBytes).toEqual([1]);
  expect(result.firstApplied).toBe(true);
  expect(result.secondApplied).toBe(false);
  expect(result.appliedCount).toBe(1);
  expect(result.conflict).toMatch(/ResultConflict/u);
});

test("a kernel save survives a round trip through browser storage and continues identically", async ({ page }) => {
  const result = await page.evaluate(async (moduleUrl) => {
    const sim = (await import(moduleUrl)) as typeof SimPackage;
    const storage = await sim.persistence.IndexedDbStorage.open(indexedDB as never, `lastclan-kernel-${Date.now()}`);

    const uninterrupted = sim.host.SimHost.create({ matchSeed: 4107 as never, withGuest: true });
    uninterrupted.runTicks(400);

    const first = sim.host.SimHost.create({ matchSeed: 4107 as never, withGuest: true });
    first.runTicks(200);
    await sim.persistence.saveCheckpoint(storage, "run-browser", first.save());

    const loaded = await sim.persistence.loadLatest(storage, "run-browser");
    const bytes = (await storage.get("snapshots", `run-browser/gen${loaded.generation}`)) as Uint8Array;
    const restored = sim.host.SimHost.restore(bytes);
    restored.runTicks(200);

    return { restored: restored.authoritativeDigest(), uninterrupted: uninterrupted.authoritativeDigest(), tick: restored.tick };
  }, MODULE);

  expect(result.tick).toBe(400);
  expect(result.restored).toBe(result.uninterrupted);
});
