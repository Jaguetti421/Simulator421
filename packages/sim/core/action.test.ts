import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { activeActionFields, cancelAction, captureActions, restoreActions, startAction, stepAction } from "./action.js";
import type { ActionDefinition, RunningAction, StepOutcome, WorldView } from "./action.js";
import { PermissionService } from "./permission.js";
import type { Law } from "./permission.js";
import { ReservationBook } from "./reservation.js";

/** P1-17. */
const T = (n: number): Int => n as Int;
const at = (x: number, y: number): readonly [Int, Int] => [T(x), T(y)];

const craft: ActionDefinition = {
  actionDefId: "action.craft.axe",
  durationTicks: 20,
  rangeMm: T(2_000),
  isSentientHarm: false,
  milestones: [
    { atProgressMilli: 50_000, label: "milestone.shaped" },
    { atProgressMilli: 100_000, label: "milestone.finished", committedEventType: "action.completed" },
  ],
  requiredLeases: ["station.bench"],
  consumesInputs: { "item.flint": 1 },
  producesOutputs: { "item.axe": 1 },
  animationCue: "cue.craft.loop",
  soundCue: "cue.craft.tap",
};

const strike: ActionDefinition = { ...craft, actionDefId: "action.strike", durationTicks: 10, isSentientHarm: true, requiredLeases: [], consumesInputs: {}, producesOutputs: {}, milestones: [{ atProgressMilli: 100_000, label: "milestone.hit", committedEventType: "damage.dealt" }] };

function services(law?: Law): { permission: PermissionService; reservations: ReservationBook } {
  const permission = new PermissionService();
  if (law !== undefined) permission.install(law);
  const reservations = new ReservationBook();
  reservations.grant("station.bench", "Station", "C003", T(0));
  return { permission, reservations };
}

const here: WorldView = { actorPositionMm: at(400_000, 400_000) };

function run(definition: ActionDefinition, world: WorldView, svc = services(), ticks = 40, mutate?: (tick: number) => void): { outcome: StepOutcome; ticks: number } {
  let action = startAction("act.1", "C003", definition, at(400_000, 400_000), T(0));
  let outcome: StepOutcome = { kind: "Running", action, events: [] };
  for (let tick = 0; tick < ticks; tick += 1) {
    mutate?.(tick);
    outcome = stepAction(action, definition, world, svc, T(tick));
    if (outcome.kind !== "Running") return { outcome, ticks: tick };
    action = outcome.action;
  }
  return { outcome, ticks };
}

describe("invalid range, permission or lease cancels with a typed failure (criterion 1)", () => {
  it("completes when nothing goes wrong", () => {
    const { outcome } = run(craft, here);
    expect(outcome.kind).toBe("Completed");
    if (outcome.kind !== "Completed") return;
    expect(outcome.completion.outputs).toEqual({ "item.axe": 1 });
  });

  it("fails with OutOfRange when the actor walks away mid-action", () => {
    const { outcome } = run(craft, { actorPositionMm: at(410_000, 400_000) });
    expect(outcome.kind).toBe("Failed");
    if (outcome.kind !== "Failed") return;
    expect(outcome.failure.reason).toBe("OutOfRange");
    expect(outcome.failure.detail).toContain("range is 2000 mm");
  });

  it("fails with LeaseLost when the reservation is taken away", () => {
    const svc = services();
    const { outcome } = run(craft, here, svc, 40, (tick) => {
      if (tick === 12) svc.reservations.releaseAllHeldBy("C003", "Death", T(12));
    });
    expect(outcome.kind).toBe("Failed");
    if (outcome.kind !== "Failed") return;
    expect(outcome.failure.reason).toBe("LeaseLost");
    expect(outcome.failure.detail).toContain("station.bench");
  });

  it("fails with PermissionDenied when a truce installs while a blow is swinging", () => {
    const svc = services();
    const truce: Law = { lawId: "law.truce", version: T(1), permission: "SentientHarm", activationTick: T(5), endTick: T(500), scope: {}, reasonId: "WaitingForLaw" };
    const { outcome } = run(strike, { actorPositionMm: at(400_000, 400_000), targetPositionMm: at(401_000, 400_000) }, svc, 40, (tick) => {
      if (tick === 5) svc.permission.install(truce);
    });
    expect(outcome.kind).toBe("Failed");
    if (outcome.kind !== "Failed") return;
    expect(outcome.failure.reason).toBe("PermissionDenied");
    expect(outcome.failure.detail).toContain("law.truce");
  });

  it("revalidates on the completing tick, not only on its cadence", () => {
    const svc = services();
    // The action's cadence is every ten ticks; the truce arrives at tick 9, one
    // tick before the strike lands, and between two cadence points.
    const truce: Law = { lawId: "law.truce", version: T(1), permission: "SentientHarm", activationTick: T(9), endTick: T(500), scope: {}, reasonId: "WaitingForLaw" };
    const { outcome, ticks } = run(strike, { actorPositionMm: at(400_000, 400_000), targetPositionMm: at(401_000, 400_000) }, svc, 40, (tick) => {
      if (tick === 9) svc.permission.install(truce);
    });
    expect(outcome.kind).toBe("Failed");
    expect(ticks).toBe(9);
  });

  it("fails with TargetGone rather than blaming a law when the target leaves", () => {
    const { outcome } = run(strike, { actorPositionMm: at(400_000, 400_000), targetPositionMm: at(401_000, 400_000), targetPresent: false });
    expect(outcome.kind).toBe("Failed");
    if (outcome.kind !== "Failed") return;
    expect(outcome.failure.reason).toBe("TargetGone");
  });

  it("reports what a failed action had spent and held, so an interruption can decide", () => {
    const { outcome } = run(craft, { actorPositionMm: at(410_000, 400_000) });
    if (outcome.kind !== "Failed") throw new Error("expected a failure");
    expect(outcome.failure.consumedInputs).toEqual({ "item.flint": 1 });
    expect(outcome.failure.releasedReservations).toEqual(["station.bench"]);
    // The failure is caught at the first revalidation, ten ticks in, so half the
    // work survives for an interruption to decide the fate of — which is the
    // point of retaining it rather than a rounding artefact.
    expect(outcome.failure.retainedProgressMilli).toBe(50_000);
  });

  it("cancels with a typed failure carrying the progress it had made", () => {
    let action = startAction("act.1", "C003", craft, at(400_000, 400_000), T(0));
    const svc = services();
    for (let tick = 0; tick < 5; tick += 1) {
      const outcome = stepAction(action, craft, here, svc, T(tick));
      if (outcome.kind === "Running") action = outcome.action;
    }
    const failure = cancelAction(action, T(5));
    expect(failure.reason).toBe("Cancelled");
    expect(failure.retainedProgressMilli).toBeGreaterThan(0);
    expect(failure.releasedReservations).toEqual(["station.bench"]);
  });
});

describe("effects never come from an animation event (criterion 2)", () => {
  it("commits a milestone's event on the authoritative tick", () => {
    const { outcome } = run(craft, here);
    if (outcome.kind !== "Completed") throw new Error("expected completion");
    expect(outcome.events.map((e) => e.type)).toEqual(["action.completed"]);
    expect(outcome.events[0]?.tick).toBe(19);
  });

  it("commits nothing when the action fails, however far the cue had played", () => {
    const { outcome } = run(craft, { actorPositionMm: at(410_000, 400_000) });
    if (outcome.kind !== "Failed") throw new Error("expected a failure");
    expect(outcome.events).toEqual([]);
  });

  it("emits the same events with the cues removed, because cues are not inputs", () => {
    const { animationCue: _cue, soundCue: _sound, ...withoutCues } = craft;
    const silent: ActionDefinition = withoutCues;
    const withCues = run(craft, here).outcome;
    const without = run(silent, here).outcome;
    if (withCues.kind !== "Completed" || without.kind !== "Completed") throw new Error("expected completions");
    expect(without.events.map((e) => e.type)).toEqual(withCues.events.map((e) => e.type));
    expect(without.completion.outputs).toEqual(withCues.completion.outputs);
  });

  it("passes a milestone once, not on every tick after it", () => {
    let action = startAction("act.1", "C003", craft, at(400_000, 400_000), T(0));
    const svc = services();
    const seen: string[] = [];
    for (let tick = 0; tick < 20; tick += 1) {
      const outcome = stepAction(action, craft, here, svc, T(tick));
      for (const event of outcome.events) seen.push(`${event.type}@${event.tick}`);
      if (outcome.kind !== "Running") break;
      action = outcome.action;
    }
    expect(seen).toEqual(["action.completed@19"]);
  });
});

describe("every active field is captured by the state section (criterion 3)", () => {
  it("captures and restores a mid-action instance exactly", () => {
    let action = startAction("act.1", "C003", craft, at(400_000, 400_000), T(0));
    const svc = services();
    for (let tick = 0; tick < 12; tick += 1) {
      const outcome = stepAction(action, craft, here, svc, T(tick));
      if (outcome.kind === "Running") action = outcome.action;
    }
    const restored = restoreActions(captureActions([action]));
    expect(restored).toHaveLength(1);
    expect(restored[0]).toEqual(action);
    expect((restored[0] as RunningAction).progressMilli).toBeGreaterThan(0);
  });

  it("captures every field the running action has, so a new field cannot be forgotten", () => {
    const action = startAction("act.1", "C003", craft, at(400_000, 400_000), T(0));
    const captured = captureActions([action]).actions[0] as RunningAction;
    expect(activeActionFields(captured)).toEqual(activeActionFields(action));
  });

  it("restores an action that then completes exactly as an uninterrupted one would", () => {
    const svc = services();
    let action = startAction("act.1", "C003", craft, at(400_000, 400_000), T(0));
    for (let tick = 0; tick < 12; tick += 1) {
      const outcome = stepAction(action, craft, here, svc, T(tick));
      if (outcome.kind === "Running") action = outcome.action;
    }
    let resumed = restoreActions(captureActions([action]))[0] as RunningAction;
    let finished;
    for (let tick = 12; tick < 40 && finished === undefined; tick += 1) {
      const outcome = stepAction(resumed, craft, here, svc, T(tick));
      if (outcome.kind === "Running") resumed = outcome.action;
      else finished = outcome;
    }
    expect(finished?.kind).toBe("Completed");
    if (finished?.kind !== "Completed") return;
    expect(finished.completion.atTick).toBe(19);
    expect(finished.completion.outputs).toEqual({ "item.axe": 1 });
  });

  it("captures canonically, so instance order cannot change the bytes", () => {
    const a = startAction("act.a", "C003", craft, at(400_000, 400_000), T(0));
    const b = startAction("act.b", "C009", craft, at(400_000, 400_000), T(0));
    expect(JSON.stringify(captureActions([b, a]))).toBe(JSON.stringify(captureActions([a, b])));
  });

  it("refuses a section from a future version rather than guessing", () => {
    const record = { ...captureActions([]), sectionVersion: 99 };
    expect(() => restoreActions(record)).toThrow(/refuses an unknown version/u);
  });
});
