import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { createWorld, runTick, WORKLOAD_OMISSIONS } from "../core/index.js";
import { SimHost } from "./index.js";

/**
 * Host-level behaviour (W0-07): the pause barrier, the command queue, the
 * counter report and the event tape. These live here rather than in
 * `packages/sim/core` because core may not import host — the dependency
 * direction is lint-enforced (INTERFACES.md).
 */
const SEED = 4107 as Int;

describe("the workload report", () => {
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
    const w = createWorld({ matchSeed: SEED });
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


