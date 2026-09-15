import { describe, expect, it } from "vitest";
import { contracts } from "../index.js";
import type { Int } from "../primitives/index.js";
import { isActiveAt, PermissionService, resolveEffect } from "./permission.js";
import type { Law } from "./permission.js";

/** P1-12. */
const T = (n: number): Int => n as Int;
const at = (x: number, y: number): readonly [Int, Int] => [T(x), T(y)];

const truce: Law = {
  lawId: "law.truce",
  version: T(1),
  permission: "SentientHarm",
  activationTick: T(100),
  endTick: T(200),
  scope: {},
  reasonId: "WaitingForLaw",
};

const sanctuary: Law = {
  lawId: "law.sanctuary",
  version: T(1),
  permission: "SentientHarm",
  activationTick: T(0),
  endTick: T(1_000),
  scope: { centreMm: at(400_000, 400_000), radiusMm: T(100_000) },
  reasonId: "WaitingForLaw",
};

describe("boundaries are start-inclusive and end-exclusive (criterion 1)", () => {
  it("covers the activation tick and not the end tick", () => {
    expect(isActiveAt(truce, T(99))).toBe(false);
    expect(isActiveAt(truce, T(100))).toBe(true);
    expect(isActiveAt(truce, T(199))).toBe(true);
    expect(isActiveAt(truce, T(200))).toBe(false);
  });

  it("gives the service the same boundaries as the predicate, with no off-by-one between them", () => {
    const service = new PermissionService();
    service.install(truce);
    const ask = (tick: number): string => service.check({ permission: "SentientHarm", tick: T(tick), actorPositionMm: at(1_000, 1_000) }).verdict;
    expect(ask(99)).toBe("Allowed");
    expect(ask(100)).toBe("Denied");
    expect(ask(199)).toBe("Denied");
    expect(ask(200)).toBe("Allowed");
    for (let tick = 90; tick < 210; tick += 1) {
      expect(ask(tick) === "Denied", `tick ${tick}`).toBe(isActiveAt(truce, T(tick)));
    }
  });

  it("treats a zero-length interval as covering nothing", () => {
    const instant: Law = { ...truce, lawId: "law.instant", activationTick: T(50), endTick: T(50) };
    expect(isActiveAt(instant, T(49))).toBe(false);
    expect(isActiveAt(instant, T(50))).toBe(false);
  });

  it("includes the boundary of a spatial scope, both for the actor and the target", () => {
    const service = new PermissionService();
    service.install(sanctuary);
    // Exactly on the radius: inclusive.
    const onEdge = service.check({ permission: "SentientHarm", tick: T(10), actorPositionMm: at(500_000, 400_000) });
    expect(onEdge.verdict).toBe("Denied");
    // Outside, reaching in: the target's point is tested too.
    const reachingIn = service.check({ permission: "SentientHarm", tick: T(10), actorPositionMm: at(700_000, 400_000), targetPositionMm: at(420_000, 400_000) });
    expect(reachingIn.verdict).toBe("Denied");
    // Both outside: allowed.
    expect(service.check({ permission: "SentientHarm", tick: T(10), actorPositionMm: at(700_000, 400_000), targetPositionMm: at(720_000, 400_000) }).verdict).toBe("Allowed");
  });
});

describe("a new law wins over same-tick resolution (criterion 2)", () => {
  it("denies an effect resolving on the very tick the law activates", () => {
    const service = new PermissionService();
    const request = { permission: "SentientHarm" as const, tick: T(100), actorPositionMm: at(1_000, 1_000) };
    expect(resolveEffect(service, request, { kind: "damage", magnitude: T(30) }).applied).toBe(true);

    // Stage 1 installs; the effect resolves later in the same tick.
    service.install(truce);
    const outcome = resolveEffect(service, request, { kind: "damage", magnitude: T(30) });
    expect(outcome.applied).toBe(false);
    expect(outcome.denial?.ruleId).toBe("law.truce");
  });

  it("applies an amendment's new window from its own activation tick", () => {
    const service = new PermissionService();
    service.install(truce);
    service.install({ ...truce, version: T(2), activationTick: T(150), endTick: T(300) });
    const ask = (tick: number): string => service.check({ permission: "SentientHarm", tick: T(tick), actorPositionMm: at(1_000, 1_000) }).verdict;
    expect(ask(120)).toBe("Allowed");
    expect(ask(150)).toBe("Denied");
    expect(ask(299)).toBe("Denied");
    expect(ask(300)).toBe("Allowed");
  });

  it("refuses an amendment that does not increment the version", () => {
    const service = new PermissionService();
    service.install(truce);
    expect(() => service.install({ ...truce, endTick: T(9_999) })).toThrow(/increments the version/u);
    // The previous law is intact: a failed amendment leaves it alone (TP §10).
    expect(service.check({ permission: "SentientHarm", tick: T(500), actorPositionMm: at(1_000, 1_000) }).verdict).toBe("Allowed");
  });
});

describe("a denial produces no effect and a truthful reason (criterion 3)", () => {
  it("returns no effect at all, not a reduced one", () => {
    const service = new PermissionService();
    service.install(truce);
    const outcome = resolveEffect(service, { permission: "SentientHarm", tick: T(150), actorPositionMm: at(1_000, 1_000) }, { kind: "damage", magnitude: T(30) });
    expect(outcome.applied).toBe(false);
    expect(outcome.effect).toBeUndefined();
  });

  it("names the rule, its version, its scope and a registered reason", () => {
    const service = new PermissionService();
    service.install(sanctuary);
    const denial = service.check({ permission: "SentientHarm", tick: T(10), actorPositionMm: at(400_000, 400_000) });
    expect(denial.ruleId).toBe("law.sanctuary");
    expect(denial.ruleVersion).toBe(1);
    expect(denial.scope).toBe("Region");
    expect(contracts.MANDATORY_V0_REASON_IDS).toContain(denial.reasonId);
    expect(denial.detail).toContain("active [0, 1000)");
  });

  it("names the same law every time when several would deny, so two runs agree", () => {
    const service = new PermissionService();
    service.install({ ...sanctuary, lawId: "law.zeta" });
    service.install({ ...sanctuary, lawId: "law.alpha" });
    const request = { permission: "SentientHarm" as const, tick: T(10), actorPositionMm: at(400_000, 400_000) };
    expect(service.check(request).ruleId).toBe("law.alpha");
    expect(service.check(request).ruleId).toBe(service.check(request).ruleId);
  });

  it("allows what no law forbids, without inventing a refusal of its own", () => {
    const service = new PermissionService();
    service.install(sanctuary);
    const allowed = service.check({ permission: "PropertyWithdrawal", tick: T(10), actorPositionMm: at(400_000, 400_000) });
    expect(allowed.verdict).toBe("Allowed");
    expect(allowed.ruleId).toBeUndefined();
    expect(allowed.reasonId).toBeUndefined();
  });
});
