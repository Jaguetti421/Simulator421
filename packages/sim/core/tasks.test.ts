import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { ARRIVAL_MM, candidatesFor, newAgent, PLAN_TICK_BUDGET, planFor, stepAgent, straightLineMover } from "./tasks.js";
import type { ActorKnowledge, Agent, AgentStatus, TaskServices } from "./tasks.js";
import { PROTOTYPE8_FOOD, startingNeeds } from "./needs.js";
import { startingExertion } from "./exertion.js";
import { ReservationBook } from "./reservation.js";

/** P1-18. */
const T = (n: number): Int => n as Int;
const at = (x: number, y: number): readonly [Int, Int] => [T(x), T(y)];

const near = { sourceId: "bush.near", positionMm: at(404_000, 400_000), itemDefId: "item.berry", reservationKey: "stack.bush.near" };
const far = { sourceId: "bush.far", positionMm: at(440_000, 400_000), itemDefId: "item.berry", reservationKey: "stack.bush.far" };
const decoy = { sourceId: "bush.decoy", positionMm: at(400_000, 430_000), itemDefId: "item.berry", reservationKey: "stack.bush.decoy" };
const knowledge: ActorKnowledge = { food: [far, decoy, near], restSockets: [] };

function hungry(fullnessMilli = 30_000): Agent {
  return newAgent("C003", at(400_000, 400_000), { ...startingNeeds(), fullnessMilli: T(fullnessMilli) }, startingExertion());
}

function services(book = new ReservationBook()): TaskServices & { reservations: ReservationBook } {
  return { reservations: book, nutrition: PROTOTYPE8_FOOD, moveToward: straightLineMover(350) };
}

function runToEnd(agent: Agent, know: ActorKnowledge, svc: TaskServices, maxTicks = 2_000): { agent: Agent; status: AgentStatus; path: (readonly [Int, Int])[]; ticks: number } {
  let current = agent;
  let status: AgentStatus = { kind: "Running", step: { kind: "Explore", targetId: "none", positionMm: agent.positionMm } };
  const path: (readonly [Int, Int])[] = [agent.positionMm];
  for (let tick = 0; tick < maxTicks; tick += 1) {
    const outcome = stepAgent(current, know, svc, T(tick));
    current = outcome.agent;
    status = outcome.status;
    path.push(current.positionMm);
    if (status.kind === "Completed" || status.kind === "Failed") return { agent: current, status, path, ticks: tick };
  }
  return { agent: current, status, path, ticks: maxTicks };
}

describe("a hungry actor gathers and eats without detours (criterion 1)", () => {
  it("plans to eat, walks to the nearest food and finishes fuller", () => {
    const before = hungry();
    const { agent, status } = runToEnd(before, knowledge, services());
    expect(status.kind).toBe("Completed");
    if (status.kind !== "Completed") return;
    expect(status.goalId).toBe("goal.eat");
    expect(agent.needs.fullnessMilli).toBeGreaterThan(before.needs.fullnessMilli);
  });

  it("chooses the nearest source and never visits the others", () => {
    const { path } = runToEnd(hungry(), knowledge, services());
    for (const point of path) {
      expect(Math.abs((point[1] as number) - 400_000), "the actor wandered toward the decoy").toBeLessThan(1_000);
      expect(point[0] as number, "the actor walked past the near bush toward the far one").toBeLessThanOrEqual(405_000);
    }
  });

  it("moves monotonically toward its target — no step increases the distance", () => {
    const { path } = runToEnd(hungry(), knowledge, services());
    let previous = Number.MAX_SAFE_INTEGER;
    for (const point of path) {
      const remaining = Math.abs((point[0] as number) - 404_000) + Math.abs((point[1] as number) - 400_000);
      expect(remaining).toBeLessThanOrEqual(previous);
      previous = remaining;
    }
  });

  it("plans exactly the steps eating needs, and no others", () => {
    const plan = planFor("goal.eat", hungry(), knowledge, new ReservationBook(), T(0));
    expect(plan.steps.map((s) => s.kind)).toEqual(["Reserve", "GoTo", "PickUp", "Eat"]);
    expect(new Set(plan.steps.map((s) => s.targetId))).toEqual(new Set(["stack.bush.near", "bush.near"]));
    expect(plan.rationale).toContain("nearest unreserved food is bush.near");
  });

  it("does not want food when it is not hungry", () => {
    const full = newAgent("C003", at(400_000, 400_000), startingNeeds(), startingExertion());
    expect(candidatesFor(full, knowledge).map((c) => c.candidateId)).toEqual([]);
  });
});

describe("a reserved or missing source yields an alternative (criterion 2)", () => {
  it("plans for the next source when the nearest is reserved by someone else", () => {
    const book = new ReservationBook();
    book.grant("stack.bush.near", "ItemStack", "C009", T(0));
    const plan = planFor("goal.eat", hungry(), knowledge, book, T(0));
    expect(plan.goalId).toBe("goal.eat");
    expect(plan.rationale).toContain("bush.decoy");
  });

  it("explores, with a reason, when every known source is taken", () => {
    const book = new ReservationBook();
    for (const food of knowledge.food) book.grant(food.reservationKey, "ItemStack", "C009", T(0));
    const plan = planFor("goal.eat", hungry(), knowledge, book, T(0));
    expect(plan.goalId).toBe("goal.explore");
    expect(plan.rationale).toBe("every known food source is reserved by someone else");
  });

  it("explores when nothing at all is known", () => {
    const plan = planFor("goal.eat", hungry(), { food: [], restSockets: [] }, new ReservationBook(), T(0));
    expect(plan.goalId).toBe("goal.explore");
    expect(plan.rationale).toBe("no food is known");
  });

  it("re-plans rather than waiting when a source is taken between planning and arriving", () => {
    const svc = services();
    let agent = hungry();
    // First tick plans; then someone else grabs the reservation.
    agent = stepAgent(agent, knowledge, svc, T(0)).agent;
    svc.reservations.grant("stack.bush.near", "ItemStack", "C009", T(1));
    const outcome = stepAgent(agent, knowledge, svc, T(1));
    expect(outcome.status.kind).toBe("Failed");
    if (outcome.status.kind !== "Failed") return;
    expect(outcome.status.reason).toBe("SourceGone");
    expect(outcome.status.detail).toContain("leased to C009");
    // And the actor is free to plan again next tick, holding nothing.
    expect(outcome.agent.plan).toBeUndefined();
  });

  it("releases its reservation when it finishes eating, so the bush is not locked forever", () => {
    const svc = services();
    const { agent } = runToEnd(hungry(), knowledge, svc);
    expect(agent.heldReservations).toEqual([]);
    expect(svc.reservations.holderOf("stack.bush.near")).toBeUndefined();
  });
});

describe("plans finish or fail meaningfully — there is no idle loop (criterion 3)", () => {
  it("ends every run in Completed or Failed, never Running out of ticks", () => {
    const worlds: { label: string; know: ActorKnowledge; agent: Agent }[] = [
      { label: "food nearby", know: knowledge, agent: hungry() },
      { label: "no food known", know: { food: [], restSockets: [] }, agent: hungry() },
      { label: "starving", know: knowledge, agent: hungry(0) },
      { label: "not hungry", know: knowledge, agent: newAgent("C003", at(400_000, 400_000), startingNeeds(), startingExertion()) },
    ];
    for (const world of worlds) {
      const { status } = runToEnd(world.agent, world.know, services());
      expect(["Completed", "Failed"], `${world.label} never terminated`).toContain(status.kind);
    }
  });

  it("gives a failure a typed reason and a sentence, never a bare flag", () => {
    const { status } = runToEnd(hungry(), { food: [], restSockets: [] }, services());
    expect(status.kind).toBe("Failed");
    if (status.kind !== "Failed") return;
    expect(status.reason).toBe("NothingKnown");
    expect(status.detail.length).toBeGreaterThan(5);
  });

  it("abandons a plan that overruns its budget instead of running forever", () => {
    // A mover that never moves: the actor can never arrive.
    const stuck: TaskServices = { ...services(), moveToward: (from) => from };
    const { status, ticks } = runToEnd(hungry(), knowledge, stuck, PLAN_TICK_BUDGET + 100);
    expect(status.kind).toBe("Failed");
    if (status.kind !== "Failed") return;
    expect(status.reason).toBe("BudgetExhausted");
    expect(ticks).toBeGreaterThan(PLAN_TICK_BUDGET);
  });

  it("reports no route rather than standing still when movement is impossible", () => {
    const blocked: TaskServices = { ...services(), moveToward: () => undefined };
    const { status } = runToEnd(hungry(), knowledge, blocked);
    expect(status.kind).toBe("Failed");
    if (status.kind !== "Failed") return;
    expect(status.reason).toBe("NoRouteToTarget");
  });

  it("keeps getting hungrier while it walks, so the world does not pause for the plan", () => {
    // The long walk to the far bush, with no eating at the end: fullness must
    // fall during it. A plan that suspended the world would leave it unchanged.
    const before = hungry(40_000);
    const blocked: TaskServices = { ...services(), moveToward: straightLineMover(20) };
    const { agent, ticks } = runToEnd(before, { food: [far], restSockets: [] }, blocked, 600);
    expect(ticks).toBeGreaterThan(300);
    expect(agent.needs.fullnessMilli).toBeLessThan(before.needs.fullnessMilli);
  });

  it("arrives within the arrival radius rather than requiring an exact position", () => {
    const { agent } = runToEnd(hungry(), knowledge, services());
    const remaining = Math.abs((agent.positionMm[0] as number) - 404_000);
    expect(remaining).toBeLessThanOrEqual(ARRIVAL_MM);
  });
});
