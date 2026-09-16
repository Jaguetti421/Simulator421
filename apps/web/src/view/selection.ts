/**
 * Selection, follow and inspection (P1-29; GDD §13–14).
 *
 * The player's view of an actor, and three properties it has to keep:
 *
 *   - **Keyboard and pointer select the same thing.** Two input paths that pick
 *     different entities from the same screen is a bug a player experiences as
 *     the game arguing with them. Both resolve through one function.
 *   - **Personal identity survives a clan change.** GDD 14.1 separates the
 *     shared clan colour from the personal accent, build, head and headwear
 *     precisely so an actor stays recognisable when it changes sides. If a
 *     player loses track of someone the moment they switch clans, the story
 *     stops being followable.
 *   - **150 % scaling keeps the critical labels and controls.** Not "mostly
 *     fits": the named critical set is either present at 150 % or the layout is
 *     wrong.
 */
import { asInt, isqrt, sub } from "@lastclan/sim";
import type { Int } from "@lastclan/sim";

/** Screen-space pick radius at 100 % scale, in pixels. TUNE. */
export const PICK_RADIUS_PX = 22;

export interface ScreenActor {
  readonly actorId: string;
  readonly screenXPx: number;
  readonly screenYPx: number;
  /** Nearer actors win a tie; a caller supplies camera depth. */
  readonly depth: number;
  readonly selectable: boolean;
}

export type SelectionSource = "Pointer" | "Keyboard";

export interface SelectionResult {
  readonly actorId?: string;
  readonly source: SelectionSource;
  readonly reason: string;
}

/**
 * Resolve a pick to an actor.
 *
 * **Both** input paths call this: the pointer passes its cursor position, the
 * keyboard passes the position of the actor it is cycling to. Two code paths
 * would eventually disagree about ties, occlusion or the pick radius, and a
 * player would call that the game ignoring them.
 */
export function resolvePick(actors: readonly ScreenActor[], xPx: number, yPx: number, source: SelectionSource, scaleMilli = 1_000): SelectionResult {
  const radius = Math.trunc((PICK_RADIUS_PX * scaleMilli) / 1_000);
  const candidates = actors
    .filter((actor) => actor.selectable)
    .map((actor) => ({ actor, distance: isqrt(asInt(Math.trunc((actor.screenXPx - xPx) ** 2 + (actor.screenYPx - yPx) ** 2), "pick")) as number }))
    .filter(({ distance }) => distance <= radius)
    // Nearest to the cursor, then nearest to the camera, then by ID: fully
    // ordered, so the same screen always resolves the same way.
    .sort((a, b) => (a.distance !== b.distance ? a.distance - b.distance : a.actor.depth !== b.actor.depth ? a.actor.depth - b.actor.depth : a.actor.actorId < b.actor.actorId ? -1 : 1));

  const best = candidates[0];
  return best === undefined
    ? { source, reason: `nothing selectable within ${radius} px` }
    : { actorId: best.actor.actorId, source, reason: `${best.distance} px from the pick point` };
}

/** Cycle to the next selectable actor in a stable order — the keyboard path. */
export function cycleSelection(actors: readonly ScreenActor[], currentId: string | undefined, direction: 1 | -1 = 1): SelectionResult {
  const ordered = actors.filter((a) => a.selectable).sort((a, b) => (a.actorId < b.actorId ? -1 : 1));
  if (ordered.length === 0) return { source: "Keyboard", reason: "nothing selectable" };
  const index = currentId === undefined ? -1 : ordered.findIndex((a) => a.actorId === currentId);
  const next = ordered[(index + direction + ordered.length * 2) % ordered.length] as ScreenActor;
  // Resolved through the same pick function, at the actor's own position, so
  // the keyboard cannot select something the pointer would not.
  return resolvePick(ordered, next.screenXPx, next.screenYPx, "Keyboard");
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export interface ActorIdentity {
  readonly actorId: string;
  /** Shared, and changes when the actor changes clan. */
  readonly clanColorIndex: number;
  /** Personal, and never changes (GDD 14.1). */
  readonly accentColorIndex: number;
  readonly build: string;
  readonly head: string;
  readonly headwear: string;
  readonly accessory: string;
}

/** Everything about an identity that a clan change must not touch. */
export function personalMarks(identity: ActorIdentity): Readonly<Record<string, string | number>> {
  return Object.freeze({
    accentColorIndex: identity.accentColorIndex,
    build: identity.build,
    head: identity.head,
    headwear: identity.headwear,
    accessory: identity.accessory,
  });
}

/**
 * Move an actor to another clan.
 *
 * Returns a new identity with the clan colour replaced and **nothing else
 * touched**. Written as one function so there is a single place a future field
 * has to be classified as shared or personal.
 */
export function changeClan(identity: ActorIdentity, clanColorIndex: number): ActorIdentity {
  return { ...identity, clanColorIndex };
}

/** Is this still recognisably the same person? */
export function sameIndividual(before: ActorIdentity, after: ActorIdentity): boolean {
  if (before.actorId !== after.actorId) return false;
  const a = personalMarks(before);
  const b = personalMarks(after);
  return Object.keys(a).every((key) => a[key] === b[key]);
}

// ---------------------------------------------------------------------------
// Inspection and scaling
// ---------------------------------------------------------------------------

/** The labels and controls that must survive any supported scale. */
export const CRITICAL_ELEMENTS = ["nameplate", "health", "needs", "currentAction", "selectionRing", "followToggle", "pauseControl"] as const;
export type CriticalElement = (typeof CRITICAL_ELEMENTS)[number];

export interface LayoutBox {
  readonly element: string;
  readonly xPx: number;
  readonly yPx: number;
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface LayoutCheck {
  readonly scaleMilli: number;
  readonly viewport: { readonly widthPx: number; readonly heightPx: number };
  readonly missing: readonly string[];
  readonly clipped: readonly string[];
  readonly overlapping: readonly string[];
  readonly ok: boolean;
}

/** Scale a layout box by a thousandths factor. */
export function scaleBox(box: LayoutBox, scaleMilli: number): LayoutBox {
  const scale = (value: number): number => Math.trunc((value * scaleMilli) / 1_000);
  return { element: box.element, xPx: scale(box.xPx), yPx: scale(box.yPx), widthPx: scale(box.widthPx), heightPx: scale(box.heightPx) };
}

function overlaps(a: LayoutBox, b: LayoutBox): boolean {
  return a.xPx < b.xPx + b.widthPx && b.xPx < a.xPx + a.widthPx && a.yPx < b.yPx + b.heightPx && b.yPx < a.yPx + a.heightPx;
}

/**
 * Check a layout at a scale.
 *
 * Reports what is **missing**, what is **clipped** by the viewport and what
 * **overlaps** something else, rather than a single boolean — a layout that
 * fails should say which element and how, or the next person just scales it
 * again and hopes.
 */
export function checkLayout(boxes: readonly LayoutBox[], scaleMilli: number, viewport: { readonly widthPx: number; readonly heightPx: number }): LayoutCheck {
  const scaled = boxes.map((box) => scaleBox(box, scaleMilli));
  const present = new Set(scaled.map((box) => box.element));
  const missing = CRITICAL_ELEMENTS.filter((element) => !present.has(element));

  const clipped = scaled
    .filter((box) => CRITICAL_ELEMENTS.includes(box.element as CriticalElement))
    .filter((box) => box.xPx < 0 || box.yPx < 0 || box.xPx + box.widthPx > viewport.widthPx || box.yPx + box.heightPx > viewport.heightPx)
    .map((box) => box.element);

  const overlapping: string[] = [];
  for (let i = 0; i < scaled.length; i += 1) {
    for (let j = i + 1; j < scaled.length; j += 1) {
      const a = scaled[i] as LayoutBox;
      const b = scaled[j] as LayoutBox;
      if (!CRITICAL_ELEMENTS.includes(a.element as CriticalElement) || !CRITICAL_ELEMENTS.includes(b.element as CriticalElement)) continue;
      if (overlaps(a, b)) overlapping.push(`${a.element}/${b.element}`);
    }
  }

  return { scaleMilli, viewport, missing, clipped, overlapping: overlapping.sort(), ok: missing.length === 0 && clipped.length === 0 && overlapping.length === 0 };
}

// ---------------------------------------------------------------------------
// Follow
// ---------------------------------------------------------------------------

export interface FollowState {
  readonly actorId?: string;
  readonly cameraMm: readonly [Int, Int];
}

/** Camera millimetres per tick while following. TUNE. */
export const FOLLOW_SPEED_MM_PER_TICK = 900;

/**
 * Step a following camera toward its subject.
 *
 * The camera chases rather than snapping, and it is a **view** value: nothing in
 * the simulation reads it, which is why it lives here and takes the subject's
 * position as an argument instead of reaching for it.
 */
export function stepFollow(state: FollowState, subjectMm: readonly [Int, Int] | undefined): FollowState {
  if (state.actorId === undefined || subjectMm === undefined) return state;
  const dx = (subjectMm[0] as number) - (state.cameraMm[0] as number);
  const dy = (subjectMm[1] as number) - (state.cameraMm[1] as number);
  const remaining = isqrt(asInt(dx * dx + dy * dy, "follow")) as number;
  if (remaining === 0) return state;
  const travel = Math.min(FOLLOW_SPEED_MM_PER_TICK, remaining);
  return {
    ...state,
    cameraMm: [
      asInt((state.cameraMm[0] as number) + Math.trunc((dx * travel) / remaining), "cx"),
      asInt((state.cameraMm[1] as number) + Math.trunc((dy * travel) / remaining), "cy"),
    ],
  };
}

/** Ticks until a following camera catches its subject, at the current distance. */
export function ticksToCatch(state: FollowState, subjectMm: readonly [Int, Int]): number {
  const dx = sub(asInt(subjectMm[0] as number, "sx"), asInt(state.cameraMm[0] as number, "cx")) as number;
  const dy = sub(asInt(subjectMm[1] as number, "sy"), asInt(state.cameraMm[1] as number, "cy")) as number;
  return Math.ceil((isqrt(asInt(dx * dx + dy * dy, "catch")) as number) / FOLLOW_SPEED_MM_PER_TICK);
}
