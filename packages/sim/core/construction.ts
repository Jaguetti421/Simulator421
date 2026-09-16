/**
 * Socket construction and input milestones (P1-20; TP v1.1 §8, BUILD 01,
 * ECON 01 foundation).
 *
 * A construction socket consumes its inputs in **milestones**, not all at once
 * and not at the end. That choice is what makes the three rules here meaningful:
 *
 *   - **Conservation, including through abandonment.** A build stopped halfway
 *     has consumed some inputs; salvaging it returns a stated fraction and the
 *     rest is genuinely gone. Every item is accounted for — returned, consumed,
 *     or still standing in the structure — and the test adds them up.
 *   - **One claimant.** A socket is leased like any other scarce thing (P1-08),
 *     so two actors cannot build the same wall and discover it at the end.
 *   - **Filling a socket must not seal the camp.** A structure that blocks the
 *     only route to the water or the only exit from a camp is a build that looks
 *     fine until nobody can get out, so placement is checked against the routes
 *     that must survive it.
 */
import { sub } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";
import type { ReservationBook } from "./reservation.js";

/** Fraction of consumed inputs returned by salvaging an unfinished build, in thousandths. TUNE. */
export const SALVAGE_RETURN_MILLI = 500;

export interface Milestone {
  /** Progress at which this milestone's inputs are consumed, in thousandths. */
  readonly atProgressMilli: number;
  /** Item definition ID → whole items consumed at this milestone. */
  readonly consumes: Readonly<Record<string, number>>;
  readonly label: string;
}

export interface SocketDefinition {
  readonly socketDefId: string;
  readonly label: string;
  readonly durationTicks: number;
  readonly milestones: readonly Milestone[];
  /** The footprint the finished structure occupies, in cells. */
  readonly footprintCells: readonly (readonly [number, number])[];
  readonly reservationKey: string;
}

export interface BuildSite {
  readonly siteId: string;
  readonly socketDefId: string;
  readonly builderId: string;
  readonly startedAtTick: Int;
  readonly progressMilli: number;
  /** Item definition ID → whole items already consumed. */
  readonly consumed: Readonly<Record<string, number>>;
  readonly milestonesPassed: number;
  readonly finished: boolean;
}

export type BuildStep =
  | { readonly kind: "Building"; readonly site: BuildSite; readonly consumedNow: Readonly<Record<string, number>> }
  | { readonly kind: "Finished"; readonly site: BuildSite }
  | { readonly kind: "Refused"; readonly reason: "SocketTaken" | "NotTheBuilder"; readonly detail: string };

function merge(a: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [item, count] of Object.entries(b)) out[item] = (out[item] ?? 0) + count;
  return out;
}

/**
 * Claim a socket and start building.
 *
 * The lease is taken first, so a second claimant is refused **before** any input
 * is spent rather than after a trip and a milestone.
 */
export function claimSocket(definition: SocketDefinition, siteId: string, builderId: string, reservations: ReservationBook, tick: Int): BuildStep {
  const granted = reservations.grant(definition.reservationKey, "Station", builderId, tick);
  if (!granted.ok) {
    return { kind: "Refused", reason: "SocketTaken", detail: granted.detail };
  }
  return {
    kind: "Building",
    consumedNow: {},
    site: { siteId, socketDefId: definition.socketDefId, builderId, startedAtTick: tick, progressMilli: 0, consumed: {}, milestonesPassed: 0, finished: false },
  };
}

/**
 * Advance a build one tick, consuming any milestone it passes.
 *
 * Inputs are consumed **as the milestone is reached**, which is what gives a
 * half-finished build a real cost and makes salvage a decision rather than a
 * formality.
 */
export function stepBuild(site: BuildSite, definition: SocketDefinition, builderId: string, tick: Int): BuildStep {
  if (site.builderId !== builderId) {
    return { kind: "Refused", reason: "NotTheBuilder", detail: `${site.siteId} is being built by ${site.builderId}` };
  }

  const elapsed = (sub(tick, site.startedAtTick) as number) + 1;
  const progressMilli = Math.min(100_000, Math.trunc((elapsed * 100_000) / definition.durationTicks));

  let consumedNow: Record<string, number> = {};
  let milestonesPassed = site.milestonesPassed;
  for (const [index, milestone] of definition.milestones.entries()) {
    if (index < site.milestonesPassed) continue;
    if (milestone.atProgressMilli > progressMilli) continue;
    consumedNow = merge(consumedNow, milestone.consumes);
    milestonesPassed = index + 1;
  }

  const next: BuildSite = {
    ...site,
    progressMilli,
    consumed: merge(site.consumed, consumedNow),
    milestonesPassed,
    finished: progressMilli >= 100_000,
  };

  return next.finished ? { kind: "Finished", site: next } : { kind: "Building", site: next, consumedNow };
}

export interface SalvageResult {
  /** Items handed back to the salvager. */
  readonly returned: Readonly<Record<string, number>>;
  /** Items destroyed by the abandonment — the cost of stopping. */
  readonly lost: Readonly<Record<string, number>>;
  readonly releasedKey: string;
}

/**
 * Abandon an unfinished build and salvage what can be recovered.
 *
 * Returned plus lost always equals consumed — the test adds them up, because
 * "some of it comes back" is exactly the kind of rule that quietly creates or
 * destroys items when the fraction rounds.
 */
export function salvage(site: BuildSite, definition: SocketDefinition, reservations: ReservationBook, tick: Int): SalvageResult {
  const returned: Record<string, number> = {};
  const lost: Record<string, number> = {};
  for (const [item, count] of Object.entries(site.consumed)) {
    const back = Math.trunc((count * SALVAGE_RETURN_MILLI) / 1_000);
    if (back > 0) returned[item] = back;
    const gone = count - back;
    if (gone > 0) lost[item] = gone;
  }
  reservations.complete(definition.reservationKey, site.builderId, tick);
  return { returned, lost, releasedKey: definition.reservationKey };
}

/** Total items across a bag — used to check conservation. */
export function totalItems(bag: Readonly<Record<string, number>>): number {
  return Object.values(bag).reduce((sum, count) => sum + count, 0);
}

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

export interface RouteRequirement {
  readonly label: string;
  /** Cells the route passes through; a structure may not sit on any of them. */
  readonly cells: readonly (readonly [number, number])[];
}

export interface PlacementFinding {
  readonly rule: string;
  readonly ok: boolean;
  readonly detail: string;
}

/**
 * May this structure stand here?
 *
 * Checks the footprint against the routes that must survive construction. A
 * camp whose only exit is built over is a camp nobody can leave, and that is a
 * failure a player experiences as the AI being stupid rather than as a level
 * design bug.
 */
export function checkPlacement(
  definition: SocketDefinition,
  originCell: readonly [number, number],
  required: readonly RouteRequirement[],
): { readonly findings: readonly PlacementFinding[]; readonly ok: boolean } {
  const occupied = new Set(definition.footprintCells.map(([dx, dy]) => `${originCell[0] + dx},${originCell[1] + dy}`));
  const findings: PlacementFinding[] = required.map((route) => {
    const blocked = route.cells.filter(([x, y]) => occupied.has(`${x},${y}`));
    return {
      rule: `${definition.label} leaves ${route.label} open`,
      ok: blocked.length === 0,
      detail: blocked.length === 0 ? "clear" : `blocks ${blocked.length} cell(s) of it`,
    };
  });
  return { findings, ok: findings.every((f) => f.ok) };
}

/** The prototype camp's socket definitions. */
export const PROTOTYPE_SOCKETS: readonly SocketDefinition[] = [
  {
    socketDefId: "socket.firepit",
    label: "Firepit",
    durationTicks: 120,
    reservationKey: "socket.firepit.01",
    footprintCells: [[0, 0]],
    milestones: [
      { atProgressMilli: 33_000, label: "cleared", consumes: { "item.stone": 2 } },
      { atProgressMilli: 66_000, label: "ringed", consumes: { "item.stone": 2 } },
      { atProgressMilli: 100_000, label: "laid", consumes: { "item.branch": 3 } },
    ],
  },
  {
    socketDefId: "socket.shelter",
    label: "Shelter",
    durationTicks: 300,
    reservationKey: "socket.shelter.01",
    footprintCells: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    milestones: [
      { atProgressMilli: 25_000, label: "frame", consumes: { "item.branch": 4 } },
      { atProgressMilli: 60_000, label: "walls", consumes: { "item.branch": 4, "item.rope": 1 } },
      { atProgressMilli: 100_000, label: "roof", consumes: { "item.hide": 2 } },
    ],
  },
];
