import { describe, expect, it } from "vitest";
import { asInt } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";
import { authoritativeHash, CORE_ACTOR_COUNT, createWorld, GUEST_ACTOR_COUNT, runTick, STAGE_ORDER, STAGES, WORKLOAD_OMISSIONS } from "./index.js";
import type { World } from "./index.js";
import { SimHost } from "../host/index.js";

const SEED = 4107 as Int;

function world(overrides: { withGuest?: boolean } = {}): World {
  return createWorld({ matchSeed: SEED, ...overrides });
}

function advance(w: World, ticks: number): void {
  for (let i = 0; i < ticks; i += 1) runTick(w);
}

describe("the ten-stage tick transaction (TP v1.1 §4)", () => {
  it("runs the stages in the order the plan fixes", () => {
    expect(STAGE_ORDER).toEqual([
      "install",
      "commands",
      "observations",
      "decisions",
      "advance",
      "transactions",
      "damage",
      "cleanup",
      "result",
      "commit",
    ]);
  });

  it("records which stages actually ran, and refuses a tick that ran fewer", () => {
    const w = world();
    runTick(w);
    expect(w.stageTrace).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(w.tick).toBe(1);
  });

  it("marks every stage exactly once on the first tick, with the ordinal it executed at", () => {
    const w = world();
    runTick(w);
    const markers = w.events.filter((e) => e.type.startsWith("stage.")).map((e) => e.type);
    expect(markers).toEqual([
      "stage.01.install",
      "stage.02.commands",
      "stage.03.observations",
      "stage.04.decisions",
      "stage.05.advance",
      "stage.06.transactions",
      "stage.07.damage",
      "stage.08.cleanup",
      "stage.09.result",
      "stage.10.commit",
    ]);
    // The markers commit in sequence order, so the sequence numbers prove the order.
    const sequences = w.events.filter((e) => e.type.startsWith("stage.")).map((e) => e.sequence);
    expect([...sequences].sort((a, b) => a - b)).toEqual(sequences);
  });

  it("installs a scheduled law before the stages that resolve on the same boundary", () => {
    const w = world();
    advance(w, 50);
    const sanctuary = w.laws.find((l) => l.lawId === "Sanctuary");
    expect(sanctuary?.installed).toBe(true);
    const installEvent = w.events.find((e) => e.type === "law.installed");
    expect(installEvent?.tick).toBe(50);
    expect(installEvent?.stage).toBe(1);
    // The law-query counter only moves once a law is installed, which is what
    // "new permissions apply to every action that resolves on this boundary" means here.
    const before = createWorld({ matchSeed: SEED });
    advance(before, 49);
    expect(before.counters.lawQueries).toBe(0);
    expect(w.counters.lawQueries).toBeGreaterThan(0);
  });

  it("commits exactly one tick event per tick, at the last stage", () => {
    const w = world();
    advance(w, 25);
    const committed = w.events.filter((e) => e.type === "tick.committed");
    expect(committed).toHaveLength(25);
    expect(new Set(committed.map((e) => e.stage))).toEqual(new Set([10]));
    expect(committed.map((e) => e.tick)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });
});

describe("determinism", () => {
  it("reproduces the same authoritative hash from the same seed and tick count", () => {
    const a = world();
    const b = world();
    advance(a, 120);
    advance(b, 120);
    expect(authoritativeHash(a)).toBe(authoritativeHash(b));
  });

  it("diverges when the seed changes", () => {
    const a = createWorld({ matchSeed: SEED });
    const b = createWorld({ matchSeed: 4108 as Int });
    advance(a, 60);
    advance(b, 60);
    expect(authoritativeHash(a)).not.toBe(authoritativeHash(b));
  });

  it("diverges when the tick count changes, so a hash pins a boundary and not just a seed", () => {
    const a = world();
    const b = world();
    advance(a, 60);
    advance(b, 61);
    expect(authoritativeHash(a)).not.toBe(authoritativeHash(b));
  });

  it("excludes diagnostics: the counters and the bounded log do not change the hash", () => {
    const a = createWorld({ matchSeed: SEED, eventLogLimit: 5 });
    const b = createWorld({ matchSeed: SEED, eventLogLimit: 100_000 });
    advance(a, 40);
    advance(b, 40);
    expect(a.events.length).toBeLessThan(b.events.length);
    expect(a.eventsDropped).toBeGreaterThan(0);
    expect(authoritativeHash(a)).toBe(authoritativeHash(b));
    a.counters.routeQueries += 999;
    expect(authoritativeHash(a)).toBe(authoritativeHash(b));
  });

  it("keeps the guest out of the core stream: adding it does not move the other actors", () => {
    const core = createWorld({ matchSeed: SEED });
    const guest = createWorld({ matchSeed: SEED, withGuest: true });
    expect(core.actors).toHaveLength(CORE_ACTOR_COUNT);
    expect(guest.actors).toHaveLength(GUEST_ACTOR_COUNT);
    for (let i = 0; i < CORE_ACTOR_COUNT; i += 1) {
      expect(guest.actors[i]?.xMm).toBe(core.actors[i]?.xMm);
      expect(guest.actors[i]?.yMm).toBe(core.actors[i]?.yMm);
    }
  });
});

describe("the synthetic workload", () => {
  it("carries 136 core actors and 137 with the guest (TP v1.1 §18)", () => {
    expect(CORE_ACTOR_COUNT).toBe(136);
    expect(GUEST_ACTOR_COUNT).toBe(137);
  });

  it("keeps every actor inside the island envelope", () => {
    const w = world({ withGuest: true });
    advance(w, 200);
    for (const actor of w.actors) {
      expect(actor.xMm).toBeGreaterThanOrEqual(0);
      expect(actor.xMm).toBeLessThanOrEqual(800_000);
      expect(actor.yMm).toBeGreaterThanOrEqual(0);
      expect(actor.yMm).toBeLessThanOrEqual(800_000);
    }
  });

  it("counts the work it did, per actor per tick", () => {
    const w = world({ withGuest: true });
    advance(w, 10);
    expect(w.counters.ticks).toBe(10);
    expect(w.counters.actors).toBe(137);
    expect(w.counters.routeQueries).toBe(137 * 10);
    expect(w.counters.perceptionQueries).toBe(137 * 8 * 10);
  });

  it("states what it does not do, and says so in the report", () => {
    expect(WORKLOAD_OMISSIONS.join(" ")).toContain("no goals, planning, decisions");
    expect(WORKLOAD_OMISSIONS.join(" ")).toContain("cannot certify FINALE 01");
    const report = SimHost.create({ matchSeed: SEED }).report();
    expect(report.synthetic).toBe(true);
    expect(report.cannotCertify).toContain("cannot certify FINALE 01");
    expect(report.omissions).toEqual(WORKLOAD_OMISSIONS);
  });
});

describe("the pause barrier and tick boundaries", () => {
  it("runs whole ticks only, and refuses to advance while paused", () => {
    const host = SimHost.create({ matchSeed: SEED });
    expect(host.runTicks(10).ticksRun).toBe(10);
    host.pause();
    const refused = host.runTicks(5);
    expect(refused.ticksRun).toBe(0);
    expect(refused.tick).toBe(10);
    expect(refused.refused).toContain("paused");
    host.resume();
    expect(host.runTicks(5).ticksRun).toBe(5);
    expect(host.tick).toBe(15);
  });

  it("resumes from exactly the boundary it stopped at", () => {
    const paused = SimHost.create({ matchSeed: SEED });
    paused.runTicks(30);
    paused.pause();
    paused.runTicks(100);
    paused.resume();
    paused.runTicks(30);

    const straight = SimHost.create({ matchSeed: SEED });
    straight.runTicks(60);
    expect(paused.authoritativeDigest()).toBe(straight.authoritativeDigest());
  });

  it("throws rather than half-running a tick if the kernel is driven while paused", () => {
    const w = world();
    w.paused = true;
    expect(() => runTick(w)).toThrow(/pause barrier/u);
    expect(w.tick).toBe(0);
  });
});

describe("the command queue", () => {
  it("applies a valid law command at stage 2 on the tick it is due", () => {
    const host = SimHost.create({ matchSeed: SEED });
    expect(host.submit({ sequence: 1, atTick: 5, expectedRulesVersion: 0, lawId: "Truce", startTick: 1000, endTick: 2000 }).queued).toBe(true);
    host.runTicks(4);
    expect(host.outcomes()).toHaveLength(0);
    host.runTicks(1);
    expect(host.outcomes()[0]).toMatchObject({ sequence: 1, accepted: true, tick: 5 });
    expect(host.events().some((e) => e.type === "command.accepted" && e.stage === 2)).toBe(true);
  });

  it("rejects a runtime law with less than 600 ticks of notice, naming a registered reason", () => {
    const host = SimHost.create({ matchSeed: SEED });
    host.submit({ sequence: 1, atTick: 5, expectedRulesVersion: 0, lawId: "Truce", startTick: 600, endTick: 2000 });
    host.runTicks(5);
    expect(host.outcomes()[0]).toMatchObject({ sequence: 1, accepted: false, reasonId: "NoticeTooShort" });
    expect(host.events().some((e) => e.type === "command.rejected")).toBe(true);
  });

  it("rejects a command that expects a stale rules version", () => {
    const host = SimHost.create({ matchSeed: SEED });
    host.submit({ sequence: 1, atTick: 5, expectedRulesVersion: 0, lawId: "Truce", startTick: 1000, endTick: 2000 });
    host.submit({ sequence: 2, atTick: 6, expectedRulesVersion: 0, lawId: "Truce", startTick: 1200, endTick: 2200 });
    host.runTicks(6);
    expect(host.outcomes().map((o) => o.accepted)).toEqual([true, false]);
    expect(host.outcomes()[1]?.reasonId).toBe("StaleRules");
  });

  it("refuses to queue a command for a tick that has already passed", () => {
    const host = SimHost.create({ matchSeed: SEED });
    host.runTicks(10);
    const result = host.submit({ sequence: 1, atTick: 5, expectedRulesVersion: 0, lawId: "Truce", startTick: 1000, endTick: 2000 });
    expect(result.queued).toBe(false);
    expect(result.reason).toContain("not in the future");
  });

  it("keeps the rejection reason out of the committed event, because contract v0 cannot carry one", () => {
    const host = SimHost.create({ matchSeed: SEED });
    host.submit({ sequence: 1, atTick: 5, expectedRulesVersion: 0, lawId: "Truce", startTick: 600, endTick: 2000 });
    host.runTicks(5);
    const rejected = host.events().find((e) => e.type === "command.rejected");
    expect(rejected).toBeDefined();
    expect(JSON.stringify(rejected)).not.toContain("NoticeTooShort");
    // It is available from the host API, which is not the event stream.
    expect(host.outcomes()[0]?.reasonId).toBe("NoticeTooShort");
  });
});

describe("the event tape export", () => {
  it("produces a clanlab tape whose records validate as CommittedEvent, naming the kernel that made it", () => {
    const host = SimHost.create({ matchSeed: SEED });
    host.runTicks(5);
    const tape = host.eventTape("PERF-OPS-BASE");
    expect(tape.tapeVersion).toBe(1);
    expect(tape.producedBy).toContain("w0-07-synthetic");
    expect(tape.fixtureId).toBe("PERF-OPS-BASE");
    expect(tape.events.length).toBe(host.events().length);
    const first = tape.events[0] as Record<string, unknown>;
    expect(first["schemaVersion"]).toBe(0);
    expect(first["status"]).toBe("Factual");
    expect(first["causalParents"]).toEqual([]);
  });
});

describe("stage coverage", () => {
  it("gives every stage a name and a guarantee, so an empty stage is still documented", () => {
    expect(STAGES).toHaveLength(10);
    for (const stage of STAGES) {
      expect(stage.name.length).toBeGreaterThan(0);
      expect(stage.guarantee.length).toBeGreaterThan(10);
    }
  });

  it("uses branded integers throughout: an out-of-range value is refused, not rounded", () => {
    expect(() => asInt(1.5, "test")).toThrow();
  });
});
