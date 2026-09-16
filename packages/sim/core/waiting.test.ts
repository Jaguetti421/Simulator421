import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { actOnPermissionOpening, AMENDMENT_NOTICE_TICKS, beginWait, checkOverdue, mayWait, stepWait } from "./waiting.js";
import { PermissionService } from "./permission.js";
import type { Law } from "./permission.js";
import { MELEE } from "./combat.js";
import type { Attacker, AttackTarget } from "./combat.js";

/** P1-19. */
const T = (n: number): Int => n as Int;
const at = (x: number, y: number): readonly [Int, Int] => [T(x), T(y)];

const truce: Law = { lawId: "law.truce", version: T(1), permission: "SentientHarm", activationTick: T(0), endTick: T(500), scope: {}, reasonId: "WaitingForLaw" };

function service(law: Law = truce): PermissionService {
  const s = new PermissionService();
  s.install(law);
  return s;
}

const attacker: Attacker = { actorId: "C003", positionMm: at(400_000, 400_000), facingMm: at(1_000, 0), staminaMilli: T(100_000), arrows: 3 };
const target: AttackTarget = { actorId: "C009", positionMm: at(401_000, 400_000) };

describe("a patient actor may wait while an urgent one may not (criterion 1)", () => {
  it("lets a fed, patient actor wait", () => {
    const decision = mayWait({ fullnessPoints: 70, urgentBelow: 25, patient: true });
    expect(decision.kind).toBe("MayWait");
    if (decision.kind !== "MayWait") return;
    expect(decision.patienceTicks).toBeGreaterThan(0);
  });

  it("refuses the same wait to an actor with an immediate need", () => {
    const decision = mayWait({ fullnessPoints: 12, urgentBelow: 25, patient: true });
    expect(decision.kind).toBe("MustAct");
    if (decision.kind !== "MustAct") return;
    expect(decision.reason).toContain("below the urgent threshold");
  });

  it("refuses it to an actor with no patience, however well fed", () => {
    expect(mayWait({ fullnessPoints: 95, urgentBelow: 25, patient: false }).kind).toBe("MustAct");
  });

  it("gives the two profiles different answers to the same situation", () => {
    const situation = { fullnessPoints: 18, urgentBelow: 25 };
    expect(mayWait({ ...situation, patient: true }).kind).toBe("MustAct");
    expect(mayWait({ ...situation, patient: false }).kind).toBe("MustAct");
    const fed = { fullnessPoints: 60, urgentBelow: 25 };
    expect(mayWait({ ...fed, patient: true }).kind).toBe("MayWait");
    expect(mayWait({ ...fed, patient: false }).kind).toBe("MustAct");
  });

  it("abandons a wait when patience runs out, rather than waiting forever", () => {
    const svc = service();
    const wait = beginWait("w.1", "C003", truce, T(0), 50);
    const step = stepWait(wait, svc, T(50));
    expect(step.outcome).toBe("Abandoned");
    expect(step.detail).toContain("ran out of patience");
  });
});

describe("an amended expiry invalidates the old wait within ten ticks (criterion 2)", () => {
  it("notices an extended truce on the very next check", () => {
    const svc = service();
    const wait = beginWait("w.1", "C003", truce, T(10), 2_000);
    expect(stepWait(wait, svc, T(11)).outcome).toBe("Waiting");

    svc.install({ ...truce, version: T(2), endTick: T(900) });
    const step = stepWait({ ...wait, lastCheckedTick: T(11) }, svc, T(12));
    expect(step.outcome).toBe("Invalidated");
    expect(step.noticeLatencyTicks).toBe(1);
    expect(step.noticeLatencyTicks as number).toBeLessThanOrEqual(AMENDMENT_NOTICE_TICKS);
    expect(step.detail).toContain("expiry 500 is now 900");
  });

  it("notices a shortened truce too, not only an extension", () => {
    const svc = service();
    const wait = beginWait("w.1", "C003", truce, T(10), 2_000);
    svc.install({ ...truce, version: T(2), endTick: T(200) });
    const step = stepWait(wait, svc, T(15));
    expect(step.outcome).toBe("Invalidated");
    expect(step.detail).toContain("is now 200");
  });

  it("notices within the bound as long as the actor keeps the check cadence", () => {
    // The bound is a cadence requirement: check at least every ten ticks and an
    // amendment is noticed within ten. `checkOverdue` is what tells a caller it
    // has drifted, rather than the bound quietly becoming untrue.
    const svc = service();
    let wait = beginWait("w.1", "C003", truce, T(0), 2_000);
    for (let tick = AMENDMENT_NOTICE_TICKS; tick <= 40; tick += AMENDMENT_NOTICE_TICKS) {
      expect(checkOverdue(wait, T(tick))).toBe(false);
      const step = stepWait(wait, svc, T(tick));
      expect(step.outcome).toBe("Waiting");
      wait = step.wait;
    }
    svc.install({ ...truce, version: T(2), endTick: T(900) });
    const noticed = stepWait(wait, svc, T(40 + AMENDMENT_NOTICE_TICKS));
    expect(noticed.outcome).toBe("Invalidated");
    expect(noticed.noticeLatencyTicks).toBe(AMENDMENT_NOTICE_TICKS);
  });

  it("reports a wait that has drifted past the cadence instead of pretending it is current", () => {
    const wait = beginWait("w.1", "C003", truce, T(0), 2_000);
    expect(checkOverdue(wait, T(AMENDMENT_NOTICE_TICKS))).toBe(false);
    expect(checkOverdue(wait, T(AMENDMENT_NOTICE_TICKS + 1))).toBe(true);
  });

  it("keeps waiting while nothing has changed", () => {
    const svc = service();
    let wait = beginWait("w.1", "C003", truce, T(0), 2_000);
    for (let tick = 1; tick < 300; tick += 7) {
      const step = stepWait(wait, svc, T(tick));
      expect(step.outcome).toBe("Waiting");
      wait = step.wait;
    }
  });

  it("reports Ready once the law really has lapsed", () => {
    const svc = service();
    const wait = beginWait("w.1", "C003", truce, T(0), 2_000);
    expect(stepWait(wait, svc, T(499)).outcome).toBe("Waiting");
    expect(stepWait(wait, svc, T(500)).outcome).toBe("Ready");
  });
});

describe("a permission opening still requires the full wind-up (criterion 3)", () => {
  it("refuses to begin while the truce holds", () => {
    const result = actOnPermissionOpening(attacker, target, "Melee", service(), T(499));
    expect(result.began).toBe(false);
    expect(result.refusal).toContain("PermissionDenied");
  });

  it("begins at the opening tick and lands a full wind-up later", () => {
    const svc = service();
    const wait = beginWait("w.1", "C003", truce, T(0), 2_000);
    expect(stepWait(wait, svc, T(500)).outcome).toBe("Ready");

    const acted = actOnPermissionOpening(attacker, target, "Melee", svc, T(500));
    expect(acted.began).toBe(true);
    expect(acted.beganAtTick).toBe(500);
    expect(acted.earliestContactTick).toBe(500 + MELEE.windUpTicks);
  });

  it("gives a long wait no advantage over an actor that just arrived", () => {
    const svc = service();
    const patient = actOnPermissionOpening(attacker, target, "Melee", svc, T(500));
    const newcomer = actOnPermissionOpening({ ...attacker, actorId: "C022" }, target, "Melee", svc, T(500));
    expect(patient.earliestContactTick).toBe(newcomer.earliestContactTick);
  });

  it("routes through the combat module rather than reimplementing the rule", () => {
    // A bow's wind-up differs from a melee one; both come from P1-22's profiles.
    const melee = actOnPermissionOpening(attacker, target, "Melee", service({ ...truce, endTick: T(1) }), T(10));
    const bow = actOnPermissionOpening(attacker, { ...target, positionMm: at(420_000, 400_000) }, "Bow", service({ ...truce, endTick: T(1) }), T(10));
    expect((melee.earliestContactTick as number) - 10).toBe(MELEE.windUpTicks);
    expect(bow.earliestContactTick).not.toBe(melee.earliestContactTick);
  });
});
