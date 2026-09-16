/**
 * Food and rest task methods (P1-18; AI 01, AI 11).
 *
 * This is the packet where the pieces stop being a library. Needs (P1-09),
 * fatigue (P1-10), utility scoring (P1-16), routes (P1-04), movement (P1-05),
 * reservations (P1-08), inventory (P1-07) and the action executor (P1-17) are
 * joined into one loop an actor actually lives in:
 *
 *     sense need → score goals → expand a method into a plan → walk it → act
 *
 * The three rules that decide whether that loop is worth having:
 *
 *   - **No unrelated detours.** A plan to eat visits the food and nothing else.
 *     An actor that wanders past two other sockets on the way to a berry is the
 *     thing players notice first and forgive last.
 *   - **A blocked source yields an alternative, not a shrug.** If the nearest
 *     food is reserved by someone else, the method re-plans to the next known
 *     source; if nothing is known, it produces an explicit `Explore` plan.
 *   - **Every plan ends.** Completed, or failed with a typed reason. There is no
 *     idle state a plan can fall into, because "the actor just stood there" is
 *     the failure mode nobody can debug afterwards.
 */
import { asInt, isqrt, sub } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";
import { beginEating, continueEating, fullnessPoints, tickNeeds } from "./needs.js";
import type { EatProgress, ItemNutrition, NeedsState } from "./needs.js";
import { EXERTION, fatiguePoints, tickExertion, tickRest } from "./exertion.js";
import type { ExertionState, RestIntent } from "./exertion.js";
import { decide } from "./decision.js";
import type { Candidate, DecisionTraceRecord, TraitId } from "./decision.js";
import type { ReservationBook } from "./reservation.js";

/** Fullness below which eating becomes a candidate at all. TUNE. */
export const HUNGRY_BELOW = 60;
/** Millimetres an actor may be from a target and count as arrived. TUNE. */
export const ARRIVAL_MM = 1_200;
/** Ticks a plan may run before it is abandoned as a failure rather than left hanging. TUNE. */
export const PLAN_TICK_BUDGET = 3_000;

export type GoalId = "goal.eat" | "goal.rest" | "goal.explore";

export type StepKind = "GoTo" | "Reserve" | "PickUp" | "Eat" | "Rest" | "Explore";

export interface PlanStep {
  readonly kind: StepKind;
  readonly targetId: string;
  readonly positionMm: readonly [Int, Int];
  readonly itemDefId?: string;
}

export interface Plan {
  readonly goalId: GoalId;
  readonly steps: readonly PlanStep[];
  readonly createdAtTick: Int;
  /** Why this plan and not another — kept so a failure can be explained. */
  readonly rationale: string;
}

export interface KnownFood {
  readonly sourceId: string;
  readonly positionMm: readonly [Int, Int];
  readonly itemDefId: string;
  /** Reservation key for the source, so two actors cannot strip the same bush. */
  readonly reservationKey: string;
}

export interface KnownRestSocket {
  readonly socketId: string;
  readonly positionMm: readonly [Int, Int];
  readonly reservationKey: string;
}

export interface ActorKnowledge {
  readonly food: readonly KnownFood[];
  readonly restSockets: readonly KnownRestSocket[];
}

export type PlanFailureReason = "SourceGone" | "NoRouteToTarget" | "BudgetExhausted" | "Interrupted" | "NothingKnown";

export interface Agent {
  readonly actorId: string;
  readonly traits: readonly TraitId[];
  readonly positionMm: readonly [Int, Int];
  readonly needs: NeedsState;
  readonly exertion: ExertionState;
  readonly carrying: Readonly<Record<string, number>>;
  readonly plan?: Plan;
  readonly stepIndex: number;
  readonly planStartedAtTick?: Int;
  readonly eating?: EatProgress;
  readonly resting?: RestIntent;
  readonly heldReservations: readonly string[];
}

export type AgentStatus =
  | { readonly kind: "Planning"; readonly trace: DecisionTraceRecord }
  | { readonly kind: "Running"; readonly step: PlanStep }
  | { readonly kind: "Completed"; readonly goalId: GoalId }
  | { readonly kind: "Failed"; readonly goalId: GoalId; readonly reason: PlanFailureReason; readonly detail: string };

export interface AgentOutcome {
  readonly agent: Agent;
  readonly status: AgentStatus;
}

/**
 * Drop a plan and its per-plan state. `exactOptionalPropertyTypes` refuses
 * `plan: undefined` on a field declared optional, which is the compiler making a
 * real point: "absent" and "present and undefined" are different, and a saved
 * agent should not carry a key whose value is nothing.
 */
function withoutPlan(agent: Agent): Agent {
  const { plan: _plan, planStartedAtTick: _started, eating: _eating, resting: _resting, ...rest } = agent;
  return { ...rest, stepIndex: 0 };
}

function distance(a: readonly [Int, Int], b: readonly [Int, Int]): number {
  const dx = (a[0] as number) - (b[0] as number);
  const dy = (a[1] as number) - (b[1] as number);
  return isqrt(asInt(dx * dx + dy * dy, "distance")) as number;
}

/** Candidates from the actor's own state. Nothing external suggests a goal. */
export function candidatesFor(agent: Agent, knowledge: ActorKnowledge): readonly Candidate[] {
  const candidates: Candidate[] = [];
  const fullness = fullnessPoints(agent.needs);
  const fatigue = fatiguePoints(agent.exertion);

  if (fullness < HUNGRY_BELOW) {
    const hunger = Math.min(1_000, (HUNGRY_BELOW - fullness) * 20);
    candidates.push({
      candidateId: "goal.eat",
      considerations: [{ id: "hunger", inputMilli: hunger, weightMilli: 1_000 }],
      ...(fullness <= 5 ? { emergency: true as const } : {}),
    });
  }
  if (fatigue > (EXERTION.restPriorityThreshold as number)) {
    candidates.push({
      candidateId: "goal.rest",
      considerations: [{ id: "fatigue", inputMilli: Math.min(1_000, (fatigue - 50) * 20), weightMilli: 1_000 }],
    });
  }
  if (candidates.length > 0 && knowledge.food.length === 0 && knowledge.restSockets.length === 0) {
    candidates.push({ candidateId: "goal.explore", considerations: [{ id: "curiosity", inputMilli: 300, weightMilli: 1_000 }] });
  }
  return candidates;
}

/**
 * Expand a goal into a plan.
 *
 * Food sources are considered **nearest first**, skipping any whose reservation
 * is held by somebody else — that is criterion 2's "alternative", and it is a
 * plan-time decision rather than a surprise on arrival.
 */
export function planFor(goalId: GoalId, agent: Agent, knowledge: ActorKnowledge, reservations: ReservationBook, tick: Int): Plan {
  if (goalId === "goal.eat") {
    const reachable = [...knowledge.food]
      .filter((food) => {
        const holder = reservations.holderOf(food.reservationKey);
        return (holder === undefined || holder === agent.actorId) && !reservations.isInvalidated(food.reservationKey);
      })
      .sort((a, b) => {
        const byDistance = distance(agent.positionMm, a.positionMm) - distance(agent.positionMm, b.positionMm);
        return byDistance !== 0 ? byDistance : a.sourceId < b.sourceId ? -1 : 1;
      });

    const target = reachable[0];
    if (target === undefined) {
      return {
        goalId: "goal.explore",
        createdAtTick: tick,
        rationale: knowledge.food.length === 0 ? "no food is known" : "every known food source is reserved by someone else",
        steps: [{ kind: "Explore", targetId: "explore.outward", positionMm: agent.positionMm }],
      };
    }

    return {
      goalId,
      createdAtTick: tick,
      rationale: `nearest unreserved food is ${target.sourceId} at ${distance(agent.positionMm, target.positionMm)} mm`,
      steps: [
        { kind: "Reserve", targetId: target.reservationKey, positionMm: target.positionMm },
        { kind: "GoTo", targetId: target.sourceId, positionMm: target.positionMm },
        { kind: "PickUp", targetId: target.sourceId, positionMm: target.positionMm, itemDefId: target.itemDefId },
        { kind: "Eat", targetId: target.sourceId, positionMm: target.positionMm, itemDefId: target.itemDefId },
      ],
    };
  }

  if (goalId === "goal.rest") {
    const socket = [...knowledge.restSockets].sort((a, b) => distance(agent.positionMm, a.positionMm) - distance(agent.positionMm, b.positionMm))[0];
    if (socket === undefined) {
      return { goalId: "goal.explore", createdAtTick: tick, rationale: "no rest socket is known", steps: [{ kind: "Explore", targetId: "explore.outward", positionMm: agent.positionMm }] };
    }
    return {
      goalId,
      createdAtTick: tick,
      rationale: `nearest rest socket is ${socket.socketId}`,
      steps: [
        { kind: "Reserve", targetId: socket.reservationKey, positionMm: socket.positionMm },
        { kind: "GoTo", targetId: socket.socketId, positionMm: socket.positionMm },
        { kind: "Rest", targetId: socket.socketId, positionMm: socket.positionMm },
      ],
    };
  }

  return { goalId: "goal.explore", createdAtTick: tick, rationale: "nothing else to do", steps: [{ kind: "Explore", targetId: "explore.outward", positionMm: agent.positionMm }] };
}

export interface TaskServices {
  readonly reservations: ReservationBook;
  readonly nutrition: readonly ItemNutrition[];
  /** Move one tick toward a target; the caller owns the terrain. */
  readonly moveToward: (from: readonly [Int, Int], to: readonly [Int, Int]) => readonly [Int, Int] | undefined;
}

/**
 * Advance one actor by one tick.
 *
 * Needs and fatigue always tick — an actor is hungry whether or not it is doing
 * anything about it. Then either the plan advances a step, or a new plan is
 * made. There is no branch that does nothing and says nothing.
 */
export function stepAgent(agent: Agent, knowledge: ActorKnowledge, services: TaskServices, tick: Int): AgentOutcome {
  const needs = tickNeeds(agent.needs, tick).state;
  const restingNow = agent.resting !== undefined;
  const exertion = restingNow ? tickRest(agent.exertion, agent.resting as RestIntent).state : tickExertion(agent.exertion, "Walking").state;
  const current: Agent = { ...agent, needs, exertion };

  if (current.plan === undefined) {
    const candidates = candidatesFor(current, knowledge);
    const decision = decide({ actorId: current.actorId, traits: current.traits, candidates, evidence: [] }, tick);
    if (decision.chosenCandidateId === undefined) {
      // Nothing is wanted. That is a completed state, not an idle one.
      return { agent: current, status: { kind: "Completed", goalId: "goal.explore" } };
    }
    const plan = planFor(decision.chosenCandidateId as GoalId, current, knowledge, services.reservations, tick);
    return { agent: { ...current, plan, stepIndex: 0, planStartedAtTick: tick }, status: { kind: "Planning", trace: decision.trace } };
  }

  const plan = current.plan;
  const elapsed = sub(tick, current.planStartedAtTick ?? plan.createdAtTick) as number;
  if (elapsed > PLAN_TICK_BUDGET) {
    return {
      agent: withoutPlan(current),
      status: { kind: "Failed", goalId: plan.goalId, reason: "BudgetExhausted", detail: `${plan.goalId} ran ${elapsed} ticks without finishing (${plan.rationale})` },
    };
  }

  const step = plan.steps[current.stepIndex];
  if (step === undefined) {
    return { agent: withoutPlan(current), status: { kind: "Completed", goalId: plan.goalId } };
  }

  switch (step.kind) {
    case "Reserve": {
      const granted = services.reservations.grant(step.targetId, "ItemStack", current.actorId, tick);
      if (!granted.ok) {
        // Someone took it between planning and arriving: re-plan rather than wait.
        return {
          agent: withoutPlan(current),
          status: { kind: "Failed", goalId: plan.goalId, reason: "SourceGone", detail: `${step.targetId}: ${granted.detail}` },
        };
      }
      return {
        agent: { ...current, stepIndex: current.stepIndex + 1, heldReservations: [...current.heldReservations, step.targetId] },
        status: { kind: "Running", step },
      };
    }

    case "GoTo": {
      if (distance(current.positionMm, step.positionMm) <= ARRIVAL_MM) {
        return { agent: { ...current, stepIndex: current.stepIndex + 1 }, status: { kind: "Running", step } };
      }
      const moved = services.moveToward(current.positionMm, step.positionMm);
      if (moved === undefined) {
        return {
          agent: withoutPlan(current),
          status: { kind: "Failed", goalId: plan.goalId, reason: "NoRouteToTarget", detail: `no route from ${current.positionMm.join(",")} to ${step.targetId}` },
        };
      }
      return { agent: { ...current, positionMm: moved }, status: { kind: "Running", step } };
    }

    case "PickUp": {
      const itemDefId = step.itemDefId as string;
      return {
        agent: {
          ...current,
          stepIndex: current.stepIndex + 1,
          carrying: { ...current.carrying, [itemDefId]: (current.carrying[itemDefId] ?? 0) + 1 },
        },
        status: { kind: "Running", step },
      };
    }

    case "Eat": {
      const itemDefId = step.itemDefId as string;
      const progress = current.eating ?? beginEating(itemDefId, tick);
      const outcome = continueEating(current.needs, progress, services.nutrition);
      if (outcome.status === "Eating") return { agent: { ...current, eating: outcome.progress }, status: { kind: "Running", step } };
      if (outcome.status === "Failed") {
        return {
          agent: withoutPlan(current),
          status: { kind: "Failed", goalId: plan.goalId, reason: "Interrupted", detail: `eating ${itemDefId}: ${outcome.reason}` },
        };
      }
      const carrying = { ...current.carrying };
      carrying[itemDefId] = Math.max(0, (carrying[itemDefId] ?? 1) - 1);
      if (carrying[itemDefId] === 0) delete carrying[itemDefId];
      for (const key of current.heldReservations) services.reservations.complete(key, current.actorId, tick);
      return {
        agent: { ...withoutPlan(current), needs: outcome.state, carrying, heldReservations: [] },
        status: { kind: "Completed", goalId: plan.goalId },
      };
    }

    case "Rest": {
      const intent: RestIntent = current.resting ?? { reason: "FatigueAboveThreshold", targetSocketId: step.targetId, startedAtTick: tick };
      const outcome = tickRest(current.exertion, intent);
      if (outcome.endedBecause === "ReachedRestEnd") {
        for (const key of current.heldReservations) services.reservations.complete(key, current.actorId, tick);
        return {
          agent: { ...withoutPlan(current), exertion: outcome.state, heldReservations: [] },
          status: { kind: "Completed", goalId: plan.goalId },
        };
      }
      return { agent: { ...current, exertion: outcome.state, resting: intent }, status: { kind: "Running", step } };
    }

    case "Explore": {
      // Explicit, and explicitly finite: exploring is a plan that ends, not a
      // place to park an actor with nothing to do.
      return {
        agent: withoutPlan(current),
        status: { kind: "Failed", goalId: "goal.explore", reason: "NothingKnown", detail: plan.rationale },
      };
    }

    default:
      return { agent: current, status: { kind: "Failed", goalId: plan.goalId, reason: "Interrupted", detail: `unknown step kind` } };
  }
}

export function newAgent(actorId: string, positionMm: readonly [Int, Int], needs: NeedsState, exertion: ExertionState, traits: readonly TraitId[] = []): Agent {
  return { actorId, traits, positionMm, needs, exertion, carrying: {}, stepIndex: 0, heldReservations: [] };
}

/** Straight-line stepper for callers without terrain — the shape `moveToward` expects. */
export function straightLineMover(mmPerTick: number): TaskServices["moveToward"] {
  return (from, to) => {
    const dx = (to[0] as number) - (from[0] as number);
    const dy = (to[1] as number) - (from[1] as number);
    const length = isqrt(asInt(dx * dx + dy * dy, "length")) as number;
    if (length === 0) return from;
    const travel = Math.min(mmPerTick, length);
    return [asInt((from[0] as number) + Math.trunc((dx * travel) / length), "x"), asInt((from[1] as number) + Math.trunc((dy * travel) / length), "y")];
  };
}
