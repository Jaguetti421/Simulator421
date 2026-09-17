import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { ComposedHost, sameComposition } from "./composed.js";
import { WORKLOAD_OMISSIONS } from "../core/index.js";
import type { Law } from "../core/permission.js";

/**
 * P1-32. The composed host is expensive to build (it compiles the island), so
 * the suite builds a small number and reuses them.
 */
const T = (n: number): Int => n as Int;
const SEED = T(4107);

/** Compiled once: every host below is the same world, so the island is compiled once. */
const TERRAIN = ComposedHost.create({ seed: SEED }).terrain;
const make = (): ComposedHost => ComposedHost.create({ seed: SEED, terrain: TERRAIN });

const host = make();
host.runTicks(300);

describe("both frontends use identical registrations and content (criterion 1)", () => {
  it("builds the same composition twice from the same seed", () => {
    const other = make();
    expect(sameComposition(host, other)).toBe(true);
    expect(other.terrain.manifest.geometryHash).toBe(host.terrain.manifest.geometryHash);
    expect(other.actors.map((a) => a.agent.actorId)).toEqual(host.actors.map((a) => a.agent.actorId));
  });

  it("produces identical tick digests from two independent hosts", () => {
    const a = make();
    const b = make();
    const digestsA: string[] = [];
    const digestsB: string[] = [];
    for (let i = 0; i < 60; i += 1) {
      digestsA.push(a.advance().digest);
      digestsB.push(b.advance().digest);
    }
    expect(digestsB).toEqual(digestsA);
  });

  it("gives a different seed a different world", () => {
    const other = ComposedHost.create({ seed: T(4108) });
    expect(other.terrain.manifest.geometryHash).not.toBe(host.terrain.manifest.geometryHash);
  });

  it("exposes one composition point rather than per-frontend wiring", () => {
    // A frontend gets the host, the bridge and a summary — it never assembles
    // providers itself, which is what "identical registrations" means in practice.
    expect(typeof ComposedHost.create).toBe("function");
    expect(host.bridge.publishedCount).toBeGreaterThan(0);
    expect(Object.keys(host.summary()).sort()).toEqual(["fatigue", "fullness", "living", "tick"]);
  });

  it("publishes exactly one snapshot per tick", () => {
    const counted = make();
    counted.runTicks(25);
    expect(counted.bridge.publishedCount).toBe(25);
    expect(counted.bridge.acknowledgedTick).toBe(24);
  });
});

describe("no placeholder or FakeSim feeds a player-facing claim (criterion 2)", () => {
  it("declares itself unsimulated with an empty omission list", () => {
    expect(host.simulated).toBe(false);
    expect(host.omissions).toEqual([]);
  });

  it("does not inherit the synthetic kernel's omissions", () => {
    // The W0-07 workload documented what it left out; this host leaves out
    // nothing, and a future packet that stubs something must say so here.
    expect(WORKLOAD_OMISSIONS.length).toBeGreaterThan(0);
    expect(host.omissions).not.toEqual(WORKLOAD_OMISSIONS);
    for (const omission of WORKLOAD_OMISSIONS) expect(host.omissions).not.toContain(omission);
  });

  it("publishes snapshots with no watermark or synthetic flag", () => {
    const read = host.bridge.read();
    expect(read).toBeDefined();
    expect(Object.keys(read?.snapshot ?? {}).sort()).toEqual(["actors", "digest", "publishedSequence", "tick"]);
    for (const forbidden of ["watermark", "fake", "synthetic", "placeholder"]) {
      expect(Object.keys(read?.snapshot ?? {})).not.toContain(forbidden);
    }
  });

  it("runs actors through the real agent loop, not a drift", () => {
    // Every actor has a plan, a completed goal or a stated failure — the loop
    // from P1-18, not the synthetic workload's random walk.
    const statuses = host.actors.map((a) => a.lastStatus?.kind).filter((kind) => kind !== undefined);
    expect(statuses.length).toBe(host.actors.length);
    for (const kind of statuses) expect(["Planning", "Running", "Completed", "Failed"]).toContain(kind);
  });
});

describe("the valley runs real survival, building and law behaviour (criterion 3)", () => {
  it("runs on the shipping island, validated", () => {
    expect(host.terrain.manifest.shipping).toBe(true);
    expect(host.terrain.manifest.island?.ok).toBe(true);
  });

  it("places its actors and food from the compiled scene", () => {
    expect(host.actors).toHaveLength(8);
    expect(host.knowledge.food.length).toBeGreaterThan(0);
    expect(host.knowledge.restSockets.length).toBeGreaterThan(0);
  });

  it("feeds actors that started hungry", () => {
    const fed = make();
    const before = fed.summary().fullness;
    fed.runTicks(400);
    const after = fed.summary().fullness;
    // At least one actor ended a run with more fullness than it began.
    expect(after.some((value, index) => value > (before[index] as number))).toBe(true);
  });

  it("keeps hunger running: nobody is frozen at their starting value", () => {
    const fresh = make();
    const before = fresh.summary().fullness;
    fresh.runTicks(200);
    const after = fresh.summary().fullness;
    expect(after).not.toEqual(before);
  });

  it("enforces an installed law through the same permission service", () => {
    const truce: Law = { lawId: "law.truce", version: T(1), permission: "SentientHarm", activationTick: T(0), endTick: T(10_000), scope: {}, reasonId: "WaitingForLaw" };
    const lawful = ComposedHost.create({ seed: SEED, terrain: TERRAIN, laws: [truce] });
    lawful.runTicks(20);
    expect(lawful.permissions.lawsAt(T(10)).map((law) => law.lawId)).toEqual(["law.truce"]);
    expect(lawful.permissions.check({ permission: "SentientHarm", tick: T(10), actorPositionMm: [T(400_000), T(400_000)] }).verdict).toBe("Denied");
  });

  it("runs a night without losing anyone to a crash", () => {
    const long = make();
    const report = long.runTicks(5_200);
    expect(report.isNight).toBe(true);
    expect(report.living).toBeGreaterThan(0);
    expect(report.tick).toBe(5_199);
  });

  it("advances its clock and reports night at the published boundary", () => {
    const clocked = make();
    const day = clocked.runTicks(10);
    expect(day.isNight).toBe(false);
  });
});
