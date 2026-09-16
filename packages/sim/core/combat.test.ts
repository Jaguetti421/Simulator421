import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { advanceSwing, beginAttack, BOW, earliestContactTick, isFacing, MELEE, swingTotalTicks } from "./combat.js";
import type { Attacker, AttackTarget } from "./combat.js";
import { PermissionService } from "./permission.js";
import type { Law } from "./permission.js";

/** P1-22. */
const T = (n: number): Int => n as Int;
const at = (x: number, y: number): readonly [Int, Int] => [T(x), T(y)];

const attacker: Attacker = { actorId: "C003", positionMm: at(400_000, 400_000), facingMm: at(1_000, 0), staminaMilli: T(100_000), arrows: 5 };
const target: AttackTarget = { actorId: "C009", positionMm: at(401_000, 400_000) };

function truceUntil(endTick: number, from = 0): Law {
  return { lawId: "law.truce", version: T(1), permission: "SentientHarm", activationTick: T(from), endTick: T(endTick), scope: {}, reasonId: "WaitingForLaw" };
}

function service(law?: Law): PermissionService {
  const s = new PermissionService();
  if (law !== undefined) s.install(law);
  return s;
}

describe("a prohibited attack cannot precharge an instant hit (criterion 1)", () => {
  it("refuses to begin at all while the truce holds", () => {
    const result = beginAttack(attacker, target, "Melee", service(truceUntil(100)), T(50));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal).toBe("PermissionDenied");
    expect(result.detail).toContain("law.truce");
  });

  it("makes an actor waiting out a truce serve the full wind-up afterwards", () => {
    const svc = service(truceUntil(100));
    // Refused at 60, 80, 99 — nothing is stored, nothing accrues.
    for (const tick of [60, 80, 99]) expect(beginAttack(attacker, target, "Melee", svc, T(tick)).ok).toBe(false);

    const begun = beginAttack(attacker, target, "Melee", svc, T(100));
    expect(begun.ok).toBe(true);
    if (!begun.ok) return;
    expect(begun.swing.beganAtTick).toBe(100);
    // The blow lands a full wind-up later, not at the moment the truce lapsed.
    expect(earliestContactTick("Melee", T(100))).toBe(100 + MELEE.windUpTicks);
    expect(advanceSwing(begun.swing, attacker, target, svc, T(100)).kind).toBe("WindingUp");
    expect(advanceSwing(begun.swing, attacker, target, svc, T(100 + MELEE.windUpTicks - 1)).kind).toBe("WindingUp");
    expect(advanceSwing(begun.swing, attacker, target, svc, T(100 + MELEE.windUpTicks)).kind).toBe("Hit");
  });

  it("refuses a second swing while one is in progress, so wind-ups cannot be stacked", () => {
    const svc = service();
    const first = beginAttack(attacker, target, "Melee", svc, T(0));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = beginAttack(attacker, target, "Melee", svc, T(1), first.swing);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.refusal).toBe("AlreadySwinging");
  });

  it("gives no swing a contact tick earlier than its wind-up allows, for either weapon", () => {
    expect(earliestContactTick("Melee", T(500))).toBe(500 + MELEE.windUpTicks);
    expect(earliestContactTick("Bow", T(500))).toBe(500 + BOW.windUpTicks);
    expect(swingTotalTicks("Bow")).toBe(BOW.windUpTicks + BOW.recoveryTicks);
  });
});

describe("launch and impact both enforce current rules (criterion 2)", () => {
  it("aborts a swing when a truce installs during the wind-up", () => {
    const svc = service();
    const begun = beginAttack(attacker, target, "Melee", svc, T(0));
    if (!begun.ok) throw new Error("expected a legal start");
    expect(advanceSwing(begun.swing, attacker, target, svc, T(2)).kind).toBe("WindingUp");

    svc.install(truceUntil(500, 3));
    const contact = advanceSwing(begun.swing, attacker, target, svc, T(MELEE.windUpTicks));
    expect(contact.kind).toBe("Aborted");
    if (contact.kind !== "Aborted") return;
    expect(contact.refusal).toBe("PermissionDenied");
    // The effort was still spent: the actor really did swing.
    expect(contact.staminaSpentMilli).toBe(MELEE.staminaCostMilli);
  });

  it("aborts when the target steps out of reach before contact", () => {
    const svc = service();
    const begun = beginAttack(attacker, target, "Melee", svc, T(0));
    if (!begun.ok) throw new Error("expected a legal start");
    const fled: AttackTarget = { ...target, positionMm: at(410_000, 400_000) };
    const contact = advanceSwing(begun.swing, attacker, fled, svc, T(MELEE.windUpTicks));
    expect(contact.kind).toBe("Aborted");
    if (contact.kind !== "Aborted") return;
    expect(contact.refusal).toBe("OutOfRange");
  });

  it("lands when both checks pass, and then recovers before the actor can act again", () => {
    const svc = service();
    const begun = beginAttack(attacker, target, "Melee", svc, T(0));
    if (!begun.ok) throw new Error("expected a legal start");
    const hit = advanceSwing(begun.swing, attacker, target, svc, T(MELEE.windUpTicks));
    expect(hit.kind).toBe("Hit");
    if (hit.kind !== "Hit") return;
    expect(hit.damageMilli).toBe(MELEE.damageMilli);

    expect(advanceSwing(begun.swing, attacker, target, svc, T(MELEE.windUpTicks + 1)).kind).toBe("Recovering");
    expect(advanceSwing(begun.swing, attacker, target, svc, T(swingTotalTicks("Melee"))).kind).toBe("Done");
  });

  it("does not let a truce that lapses mid-swing rescue an illegal beginning", () => {
    const svc = service(truceUntil(3));
    // Illegal at tick 0: there is no swing to rescue.
    expect(beginAttack(attacker, target, "Melee", svc, T(0)).ok).toBe(false);
    // Legal only from tick 3, and the wind-up starts there.
    const begun = beginAttack(attacker, target, "Melee", svc, T(3));
    expect(begun.ok).toBe(true);
    if (!begun.ok) return;
    expect(begun.swing.beganAtTick).toBe(3);
  });
});

describe("stamina, arrows, range and facing follow the GDD (criterion 3)", () => {
  it("refuses a swing the actor has no stamina for", () => {
    const tired: Attacker = { ...attacker, staminaMilli: T(1_000) };
    const result = beginAttack(tired, target, "Melee", service(), T(0));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal).toBe("NoStamina");
  });

  it("refuses a shot with no arrows and spends one when it looses", () => {
    const empty: Attacker = { ...attacker, arrows: 0 };
    const refused = beginAttack(empty, { ...target, positionMm: at(420_000, 400_000) }, "Bow", service(), T(0));
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.refusal).toBe("NoArrows");

    const shot = beginAttack(attacker, { ...target, positionMm: at(420_000, 400_000) }, "Bow", service(), T(0));
    expect(shot.ok).toBe(true);
    if (!shot.ok) return;
    expect(shot.swing.arrowsSpent).toBe(BOW.arrowsPerShot);
  });

  it("uses melee reach and bow range, refusing what is beyond each", () => {
    expect(beginAttack(attacker, { ...target, positionMm: at(401_800, 400_000) }, "Melee", service(), T(0)).ok).toBe(true);
    expect(beginAttack(attacker, { ...target, positionMm: at(401_900, 400_000) }, "Melee", service(), T(0)).ok).toBe(false);
    expect(beginAttack(attacker, { ...target, positionMm: at(445_000, 400_000) }, "Bow", service(), T(0)).ok).toBe(true);
    expect(beginAttack(attacker, { ...target, positionMm: at(446_000, 400_000) }, "Bow", service(), T(0)).ok).toBe(false);
  });

  it("refuses a target outside the forward arc", () => {
    const behind = { ...target, positionMm: at(399_000, 400_000) };
    const result = beginAttack(attacker, behind, "Melee", service(), T(0));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal).toBe("NotFacing");
    expect(isFacing(attacker, behind.positionMm, MELEE.facingCos1e5)).toBe(false);
    expect(isFacing(attacker, target.positionMm, MELEE.facingCos1e5)).toBe(true);
  });

  it("reports refusals in a fixed order, so two runs agree on why", () => {
    const hopeless: Attacker = { ...attacker, staminaMilli: T(0), arrows: 0 };
    const far = { ...target, positionMm: at(500_000, 400_000) };
    const result = beginAttack(hopeless, far, "Bow", service(truceUntil(100)), T(0));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Stamina is checked first and is the reason reported, every time.
    expect(result.refusal).toBe("NoStamina");
  });
});
