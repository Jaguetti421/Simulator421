import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { ComposedHost } from "./composed.js";
import { digestsOver, REQUIRED_SECTIONS, replayDivergence, restoreHost, SAVE_FORMAT_VERSION, saveHost } from "./persistence.js";

/**
 * P1-33.
 *
 * Every `ComposedHost.create` compiles the 640,000-cell island, which takes
 * about three seconds on this sandbox's single CPU. The replay tests build
 * several hosts each, so they carry explicit timeouts — the cost is real work,
 * not a hang, and cutting save points to fit a default would have traded
 * coverage for a number.
 */
const T = (n: number): Int => n as Int;
const SEED = T(4107);
/** Compiled once and shared: the island is the same world in every one of these hosts. */
const TERRAIN = ComposedHost.create({ seed: SEED }).terrain;
const make = (): ComposedHost => ComposedHost.create({ seed: SEED, terrain: TERRAIN });

describe("save and load reproduce the next 600 ticks (criterion 1)", () => {
  it("runs 600 identical ticks after a restore", { timeout: 120_000 }, () => {
    expect(replayDivergence(SEED, 120, 600, TERRAIN)).toBeNull();
  });

  it("restores the tick and the actor state, not just the world", () => {
    const original = make();
    original.runTicks(200);
    const restored = restoreHost(saveHost(original, SEED), SEED, TERRAIN);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.host.tick).toBe(original.tick);
    expect(restored.host.summary()).toEqual(original.summary());
  });

  it("keeps a mid-plan actor mid-plan", () => {
    const original = make();
    original.runTicks(60);
    const planning = original.actors.filter((a) => a.agent.plan !== undefined);
    expect(planning.length).toBeGreaterThan(0);

    const restored = restoreHost(saveHost(original, SEED), SEED, TERRAIN);
    if (!restored.ok) throw new Error("expected a restore");
    for (const actor of planning) {
      const same = restored.host.actors.find((a) => a.agent.actorId === actor.agent.actorId);
      expect(same?.agent.plan?.goalId).toBe(actor.agent.plan?.goalId);
      expect(same?.agent.stepIndex).toBe(actor.agent.stepIndex);
    }
  });

  it("keeps a held reservation with its own expiry", () => {
    const original = make();
    original.runTicks(60);
    const held = original.actors.flatMap((a) => original.reservations.heldBy(a.agent.actorId));
    expect(held.length).toBeGreaterThan(0);

    const restored = restoreHost(saveHost(original, SEED), SEED, TERRAIN);
    if (!restored.ok) throw new Error("expected a restore");
    for (const lease of held) {
      expect(restored.host.reservations.leaseFor(lease.key)?.expiresAtTick).toBe(lease.expiresAtTick);
    }
  });
});

describe("arbitrary checkpoint ticks preserve hashes (criterion 2)", () => {
  it("diverges at no save point across a scatter of ticks", { timeout: 180_000 }, () => {
    for (const at of [1, 17, 50, 73, 199, 377]) {
      expect(replayDivergence(SEED, at, 120, TERRAIN), `save at ${at}`).toBeNull();
    }
  });

  it("gives the same result saving every 100 ticks as saving once", { timeout: 120_000 }, () => {
    const straight = make();
    straight.runTicks(100);
    const expected = digestsOver(straight, 300);

    // Restore, run 100, restore again, and again — three checkpoints.
    let host = make();
    host.runTicks(100);
    const actual: string[] = [];
    for (let round = 0; round < 3; round += 1) {
      const restored = restoreHost(saveHost(host, SEED), SEED, TERRAIN);
      if (!restored.ok) throw new Error("expected a restore");
      host = restored.host;
      actual.push(...digestsOver(host, 100));
    }
    expect(actual).toEqual(expected);
  });

  it("gives the same result at 10-second and 60-second save cadences", { timeout: 180_000 }, () => {
    const run = (everyTicks: number, total: number): readonly string[] => {
      let host = make();
      const digests: string[] = [];
      while (digests.length < total) {
        const restored = restoreHost(saveHost(host, SEED), SEED, TERRAIN);
        if (!restored.ok) throw new Error("expected a restore");
        host = restored.host;
        digests.push(...digestsOver(host, Math.min(everyTicks, total - digests.length)));
      }
      return digests;
    };
    expect(run(600, 600)).toEqual(run(100, 600));
  });
});

describe("a missing section fails instead of loading defaults (criterion 3)", () => {
  const original = make();
  original.runTicks(30);
  const save = saveHost(original, SEED);

  it("names every section it requires", () => {
    expect([...REQUIRED_SECTIONS].sort()).toEqual(["actors", "exertion", "exposure", "health", "meta", "needs", "reservations"]);
    for (const section of REQUIRED_SECTIONS) expect(Object.keys(save.sections)).toContain(section);
  });

  it("refuses a save with any single section removed", () => {
    for (const section of REQUIRED_SECTIONS) {
      const damaged = { ...save, sections: { ...save.sections } };
      delete (damaged.sections as Record<string, unknown>)[section];
      const result = restoreHost(damaged, SEED, TERRAIN);
      expect(result.ok, `${section} was allowed to be missing`).toBe(false);
      if (result.ok || result.reason !== "MissingSections") throw new Error(`${section}: expected MissingSections`);
      expect(result.missing).toContain(section);
      expect(result.detail).toContain("refuses rather than substituting defaults");
    }
  });

  it("refuses a save from a future format version", () => {
    const result = restoreHost({ ...save, formatVersion: SAVE_FORMAT_VERSION + 1 }, SEED, TERRAIN);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("UnknownFormatVersion");
  });

  it("refuses a save taken on a different seed rather than loading it into the wrong world", () => {
    const result = restoreHost(save, T(4108), TERRAIN);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("SeedMismatch");
    expect(result.detail).toContain("4107");
  });

  it("names more than one missing section when more than one is gone", () => {
    const damaged = { ...save, sections: { ...save.sections } };
    delete (damaged.sections as Record<string, unknown>)["needs"];
    delete (damaged.sections as Record<string, unknown>)["health"];
    const result = restoreHost(damaged, SEED, TERRAIN);
    if (result.ok) throw new Error("expected a refusal");
    if (result.reason !== "MissingSections") throw new Error("expected MissingSections");
    expect([...result.missing].sort()).toEqual(["health", "needs"]);
  });
});
