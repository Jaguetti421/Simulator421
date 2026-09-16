/**
 * Action executor lifecycle (P1-17; TP v1.1 §8).
 *
 * This is the packet where P1-01's action records stop being declarations and
 * start running. An action here has one path through the world and no other:
 *
 *     start → (revalidate each tick) → milestones → complete
 *                     ↓
 *                  failure, with a typed reason and nothing applied
 *
 * Three rules it is built to enforce:
 *
 *   - **Range, permission and lease are revalidated, not merely checked once.**
 *     An action that was legal when it started can become illegal while it runs:
 *     a truce installs, a lease expires, the target walks away. TP §8 asks for
 *     revalidation on a cadence, and an executor that only checks at the start
 *     is how an actor finishes a blow that a law forbade halfway through.
 *   - **Effects come from the executor, never from a cue.** `animationCue` and
 *     `soundCue` are identifiers for the presentation layer. A milestone can
 *     *name* an event type; the event is committed here, on the authoritative
 *     tick, whether or not anything is being drawn. Addendum D06 is explicit
 *     that presentation is never the only evidence of a legal action, and the
 *     inverse matters just as much: presentation is never the *cause* of one.
 *   - **Everything an active action holds is in its state section.** A save
 *     taken mid-action restores an action mid-way — same progress, same consumed
 *     inputs, same leases — or the actor forgets what it was doing, which a
 *     player reads as a bug in the AI.
 */
import { add, asInt, isqrt, sub } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";
import type { PermissionService } from "./permission.js";
import type { ReservationBook } from "./reservation.js";

/** How often a running action rechecks its own legality (TP §8). TUNE. */
export const DEFAULT_REVALIDATE_TICKS = 10;

export type ActionState = "Running" | "Paused" | "AwaitingResource" | "Interrupted";

export type FailureReason =
  | "OutOfRange"
  | "PermissionDenied"
  | "LeaseLost"
  | "InputsMissing"
  | "TargetGone"
  | "Cancelled";

export interface ActionMilestone {
  readonly atProgressMilli: number;
  readonly label: string;
  /** The event type committed when this milestone passes. Named here, emitted by the executor. */
  readonly committedEventType?: string;
}

export interface ActionDefinition {
  readonly actionDefId: string;
  readonly durationTicks: number;
  /** Maximum distance from the work position, in millimetres. */
  readonly rangeMm: Int;
  /** Whether this action is harm between actors, and therefore subject to law. */
  readonly isSentientHarm: boolean;
  readonly milestones: readonly ActionMilestone[];
  /** Reservation keys the action must hold for its whole duration. */
  readonly requiredLeases: readonly string[];
  readonly consumesInputs: Readonly<Record<string, number>>;
  readonly producesOutputs: Readonly<Record<string, number>>;
  /** Presentation only. Never consulted when deciding an effect. */
  readonly animationCue?: string;
  readonly soundCue?: string;
}

export interface RunningAction {
  readonly instanceId: string;
  readonly actorId: string;
  readonly actionDefId: string;
  readonly startedAtTick: Int;
  readonly progressMilli: number;
  readonly state: ActionState;
  readonly lastMilestoneIndex?: number;
  readonly consumedInputs: Readonly<Record<string, number>>;
  readonly heldReservations: readonly string[];
  readonly revalidateEveryTicks: number;
  readonly lastRevalidatedTick: Int;
  readonly workPositionMm: readonly [Int, Int];
  readonly targetActorId?: string;
}

export interface CommittedEventRecord {
  readonly type: string;
  readonly tick: Int;
  readonly actorId: string;
  readonly instanceId: string;
}

export interface ActionFailureRecord {
  readonly instanceId: string;
  readonly actorId: string;
  readonly reason: FailureReason;
  readonly atTick: Int;
  readonly detail: string;
  /** Inputs already spent, which an interruption decides the fate of (P1-01). */
  readonly consumedInputs: Readonly<Record<string, number>>;
  readonly releasedReservations: readonly string[];
  readonly retainedProgressMilli: number;
}

export interface CompletionRecord {
  readonly instanceId: string;
  readonly actorId: string;
  readonly atTick: Int;
  readonly outputs: Readonly<Record<string, number>>;
  readonly committedEventTypes: readonly string[];
}

export type StepOutcome =
  | { readonly kind: "Running"; readonly action: RunningAction; readonly events: readonly CommittedEventRecord[] }
  | { readonly kind: "Completed"; readonly completion: CompletionRecord; readonly events: readonly CommittedEventRecord[] }
  | { readonly kind: "Failed"; readonly failure: ActionFailureRecord; readonly events: readonly CommittedEventRecord[] };

export interface WorldView {
  /** Where the actor is now — actions revalidate range against the real position. */
  readonly actorPositionMm: readonly [Int, Int];
  readonly targetPositionMm?: readonly [Int, Int];
  /** Does the target still exist? A target that left is not a permission problem. */
  readonly targetPresent?: boolean;
}

function distanceMm(a: readonly [Int, Int], b: readonly [Int, Int]): number {
  const dx = (a[0] as number) - (b[0] as number);
  const dy = (a[1] as number) - (b[1] as number);
  return isqrt(asInt(dx * dx + dy * dy, "range")) as number;
}

export function startAction(
  instanceId: string,
  actorId: string,
  definition: ActionDefinition,
  workPositionMm: readonly [Int, Int],
  tick: Int,
  options: { readonly targetActorId?: string; readonly revalidateEveryTicks?: number } = {},
): RunningAction {
  return {
    instanceId,
    actorId,
    actionDefId: definition.actionDefId,
    startedAtTick: tick,
    progressMilli: 0,
    state: "Running",
    consumedInputs: { ...definition.consumesInputs },
    heldReservations: [...definition.requiredLeases],
    revalidateEveryTicks: options.revalidateEveryTicks ?? DEFAULT_REVALIDATE_TICKS,
    lastRevalidatedTick: tick,
    workPositionMm,
    ...(options.targetActorId === undefined ? {} : { targetActorId: options.targetActorId }),
  };
}

function fail(action: RunningAction, reason: FailureReason, detail: string, tick: Int): StepOutcome {
  return {
    kind: "Failed",
    events: [],
    failure: {
      instanceId: action.instanceId,
      actorId: action.actorId,
      reason,
      atTick: tick,
      detail,
      consumedInputs: action.consumedInputs,
      releasedReservations: action.heldReservations,
      retainedProgressMilli: action.progressMilli,
    },
  };
}

/**
 * Advance a running action by one tick.
 *
 * Revalidation runs on the action's own cadence and on the completing tick,
 * because the last tick is the one that applies the effect and is exactly when
 * an expired lease or a fresh truce matters most.
 */
export function stepAction(
  action: RunningAction,
  definition: ActionDefinition,
  world: WorldView,
  services: { readonly permission: PermissionService; readonly reservations: ReservationBook },
  tick: Int,
): StepOutcome {
  const progressMilli = Math.min(100_000, Math.trunc(((sub(tick, action.startedAtTick) as number) + 1) * (100_000 / definition.durationTicks)));
  const completing = progressMilli >= 100_000;
  const due = (sub(tick, action.lastRevalidatedTick) as number) >= action.revalidateEveryTicks;

  if (due || completing) {
    if (world.targetPresent === false) {
      return fail(action, "TargetGone", `${action.instanceId}: the target left before the action finished`, tick);
    }

    const reference = world.targetPositionMm ?? action.workPositionMm;
    const distance = distanceMm(world.actorPositionMm, reference);
    if (distance > (definition.rangeMm as number)) {
      return fail(action, "OutOfRange", `${action.instanceId}: ${distance} mm from its work position, range is ${definition.rangeMm} mm`, tick);
    }

    for (const key of action.heldReservations) {
      if (services.reservations.holderOf(key) !== action.actorId) {
        return fail(action, "LeaseLost", `${action.instanceId}: no longer holds ${key}`, tick);
      }
    }

    if (definition.isSentientHarm) {
      const permission = services.permission.check({
        permission: "SentientHarm",
        tick,
        actorPositionMm: world.actorPositionMm,
        ...(world.targetPositionMm === undefined ? {} : { targetPositionMm: world.targetPositionMm }),
      });
      if (permission.verdict === "Denied") {
        return fail(action, "PermissionDenied", `${action.instanceId}: ${permission.detail ?? "forbidden"}`, tick);
      }
    }
  }

  // Milestones that have been passed this tick commit their events **here**, on
  // the authoritative tick — not from an animation callback.
  const events: CommittedEventRecord[] = [];
  let lastMilestoneIndex = action.lastMilestoneIndex;
  for (const [index, milestone] of definition.milestones.entries()) {
    if (milestone.atProgressMilli > progressMilli) continue;
    if (lastMilestoneIndex !== undefined && index <= lastMilestoneIndex) continue;
    lastMilestoneIndex = index;
    if (milestone.committedEventType !== undefined) {
      events.push({ type: milestone.committedEventType, tick, actorId: action.actorId, instanceId: action.instanceId });
    }
  }

  if (completing) {
    return {
      kind: "Completed",
      events,
      completion: {
        instanceId: action.instanceId,
        actorId: action.actorId,
        atTick: tick,
        outputs: { ...definition.producesOutputs },
        committedEventTypes: events.map((e) => e.type),
      },
    };
  }

  return {
    kind: "Running",
    events,
    action: {
      ...action,
      progressMilli,
      ...(lastMilestoneIndex === undefined ? {} : { lastMilestoneIndex }),
      lastRevalidatedTick: due || completing ? tick : action.lastRevalidatedTick,
    },
  };
}

/** Cancel a running action: a typed failure, with what it had spent and held. */
export function cancelAction(action: RunningAction, tick: Int, detail = "cancelled"): ActionFailureRecord {
  return {
    instanceId: action.instanceId,
    actorId: action.actorId,
    reason: "Cancelled",
    atTick: tick,
    detail,
    consumedInputs: action.consumedInputs,
    releasedReservations: action.heldReservations,
    retainedProgressMilli: action.progressMilli,
  };
}

// ---------------------------------------------------------------------------
// State section
// ---------------------------------------------------------------------------

export const ACTIONS_SECTION_ID = "actions";
export const ACTIONS_SECTION_VERSION = 1;

/** Every field of a running action, in a canonical order. */
export interface ActionsSectionRecord {
  readonly sectionVersion: number;
  readonly actions: readonly RunningAction[];
}

export function captureActions(actions: readonly RunningAction[]): ActionsSectionRecord {
  return {
    sectionVersion: ACTIONS_SECTION_VERSION,
    actions: [...actions]
      .sort((a, b) => (a.instanceId < b.instanceId ? -1 : 1))
      .map((action) => ({
        ...action,
        consumedInputs: Object.fromEntries(Object.entries(action.consumedInputs).sort(([a], [b]) => (a < b ? -1 : 1))),
        heldReservations: [...action.heldReservations].sort(),
      })),
  };
}

export function restoreActions(record: ActionsSectionRecord): readonly RunningAction[] {
  if (record.sectionVersion !== ACTIONS_SECTION_VERSION) {
    throw new Error(`actions section version ${record.sectionVersion} is not ${ACTIONS_SECTION_VERSION}; a decoder refuses an unknown version rather than guessing`);
  }
  return record.actions.map((action) => ({ ...action, startedAtTick: asInt(action.startedAtTick as number, "startedAtTick"), lastRevalidatedTick: asInt(action.lastRevalidatedTick as number, "lastRevalidatedTick") }));
}

/** The field names a section must carry — used by a test to catch a field added and not captured. */
export function activeActionFields(action: RunningAction): readonly string[] {
  return Object.keys(action).sort();
}

export { add };
