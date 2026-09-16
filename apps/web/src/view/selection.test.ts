import { describe, expect, it } from "vitest";
import type { Int } from "@lastclan/sim";
import {
  changeClan,
  checkLayout,
  CRITICAL_ELEMENTS,
  cycleSelection,
  personalMarks,
  PICK_RADIUS_PX,
  resolvePick,
  sameIndividual,
  scaleBox,
  stepFollow,
  ticksToCatch,
} from "./selection.js";
import type { ActorIdentity, FollowState, LayoutBox, ScreenActor } from "./selection.js";

/** P1-29. */
const T = (n: number): Int => n as Int;

const onScreen: readonly ScreenActor[] = [
  { actorId: "C003", screenXPx: 100, screenYPx: 100, depth: 10, selectable: true },
  { actorId: "C009", screenXPx: 108, screenYPx: 100, depth: 5, selectable: true },
  { actorId: "C017", screenXPx: 400, screenYPx: 300, depth: 8, selectable: true },
  { actorId: "C022", screenXPx: 402, screenYPx: 300, depth: 2, selectable: false },
];

describe("keyboard and pointer select the same entity (criterion 1)", () => {
  it("resolves both input paths through one function and agrees", () => {
    const pointer = resolvePick(onScreen, 400, 300, "Pointer");
    const keyboard = cycleSelection(onScreen, "C009");
    expect(pointer.actorId).toBe("C017");
    expect(keyboard.actorId).toBe("C017");
    expect(keyboard.source).toBe("Keyboard");
  });

  it("breaks a tie by camera depth, then by ID, so the same screen always resolves the same way", () => {
    // The cursor sits exactly between two overlapping actors.
    const tie = resolvePick(onScreen, 104, 100, "Pointer");
    expect(tie.actorId).toBe("C009");
    expect(resolvePick([...onScreen].reverse(), 104, 100, "Pointer").actorId).toBe("C009");
  });

  it("never selects something marked unselectable, from either path", () => {
    expect(resolvePick(onScreen, 402, 300, "Pointer").actorId).toBe("C017");
    const ids: string[] = [];
    let current: string | undefined;
    for (let i = 0; i < 4; i += 1) {
      current = cycleSelection(onScreen, current).actorId;
      if (current !== undefined) ids.push(current);
    }
    expect(ids).not.toContain("C022");
  });

  it("selects nothing, with a reason, when the pick is empty", () => {
    const empty = resolvePick(onScreen, 900, 900, "Pointer");
    expect(empty.actorId).toBeUndefined();
    expect(empty.reason).toContain("nothing selectable within");
  });

  it("cycles forward and backward through a stable order", () => {
    const first = cycleSelection(onScreen, undefined).actorId;
    const second = cycleSelection(onScreen, first).actorId;
    expect(cycleSelection(onScreen, second, -1).actorId).toBe(first);
  });

  it("grows the pick radius with the interface scale", () => {
    const justOutside = PICK_RADIUS_PX + 8;
    expect(resolvePick(onScreen, 400 + justOutside, 300, "Pointer").actorId).toBeUndefined();
    expect(resolvePick(onScreen, 400 + justOutside, 300, "Pointer", 1_500).actorId).toBe("C017");
  });
});

describe("personal identity survives a clan colour change (criterion 2)", () => {
  const identity: ActorIdentity = {
    actorId: "C003",
    clanColorIndex: 2,
    accentColorIndex: 11,
    build: "heavy",
    head: "square",
    headwear: "helm",
    accessory: "belt",
  };

  it("changes the clan colour and nothing else", () => {
    const moved = changeClan(identity, 7);
    expect(moved.clanColorIndex).toBe(7);
    expect(personalMarks(moved)).toEqual(personalMarks(identity));
    expect(sameIndividual(identity, moved)).toBe(true);
  });

  it("stays the same individual across several clan changes", () => {
    let current = identity;
    for (const clan of [5, 1, 9, 3]) current = changeClan(current, clan);
    expect(current.clanColorIndex).toBe(3);
    expect(sameIndividual(identity, current)).toBe(true);
  });

  it("notices when a personal mark really does change", () => {
    expect(sameIndividual(identity, { ...identity, accentColorIndex: 12 })).toBe(false);
    expect(sameIndividual(identity, { ...identity, headwear: "hood" })).toBe(false);
    expect(sameIndividual(identity, { ...identity, actorId: "C009" })).toBe(false);
  });

  it("lists the personal marks explicitly, so a new field must be classified", () => {
    expect(Object.keys(personalMarks(identity)).sort()).toEqual(["accentColorIndex", "accessory", "build", "head", "headwear"]);
    expect(Object.keys(personalMarks(identity))).not.toContain("clanColorIndex");
  });
});

describe("150 percent scaling preserves critical labels and controls (criterion 3)", () => {
  const layout: readonly LayoutBox[] = [
    { element: "nameplate", xPx: 20, yPx: 20, widthPx: 160, heightPx: 24 },
    { element: "health", xPx: 20, yPx: 50, widthPx: 160, heightPx: 16 },
    { element: "needs", xPx: 20, yPx: 72, widthPx: 160, heightPx: 16 },
    { element: "currentAction", xPx: 20, yPx: 94, widthPx: 220, heightPx: 20 },
    { element: "selectionRing", xPx: 20, yPx: 120, widthPx: 40, heightPx: 40 },
    { element: "followToggle", xPx: 20, yPx: 170, widthPx: 120, heightPx: 32 },
    { element: "pauseControl", xPx: 20, yPx: 210, widthPx: 120, heightPx: 32 },
  ];
  const viewport = { widthPx: 1_920, heightPx: 1_080 };

  it("passes at 100 and at 150 percent", () => {
    for (const scale of [1_000, 1_250, 1_500]) {
      const check = checkLayout(layout, scale, viewport);
      expect(check.missing, `missing at ${scale}`).toEqual([]);
      expect(check.clipped, `clipped at ${scale}`).toEqual([]);
      expect(check.overlapping, `overlapping at ${scale}`).toEqual([]);
      expect(check.ok).toBe(true);
    }
  });

  it("names every critical element, so a missing one is a failure rather than an omission", () => {
    const withoutNeeds = layout.filter((box) => box.element !== "needs");
    const check = checkLayout(withoutNeeds, 1_500, viewport);
    expect(check.ok).toBe(false);
    expect(check.missing).toEqual(["needs"]);
    expect(CRITICAL_ELEMENTS).toContain("pauseControl");
  });

  it("reports which element is clipped, not just that something is", () => {
    const tall = [...layout, { element: "pauseControl", xPx: 20, yPx: 1_000, widthPx: 120, heightPx: 200 }];
    const check = checkLayout(tall.filter((b, i) => b.element !== "pauseControl" || i > 0), 1_500, viewport);
    expect(check.clipped).toContain("pauseControl");
    expect(check.ok).toBe(false);
  });

  it("reports an overlap between two critical elements by name", () => {
    const collided = layout.map((box) => (box.element === "health" ? { ...box, yPx: 30 } : box));
    const check = checkLayout(collided, 1_000, viewport);
    expect(check.overlapping).toEqual(["nameplate/health"]);
  });

  it("scales a box by thousandths without drifting", () => {
    expect(scaleBox({ element: "x", xPx: 20, yPx: 20, widthPx: 160, heightPx: 24 }, 1_500)).toEqual({ element: "x", xPx: 30, yPx: 30, widthPx: 240, heightPx: 36 });
  });
});

describe("following is a view value the simulation never reads", () => {
  it("chases its subject rather than snapping", () => {
    let state: FollowState = { actorId: "C003", cameraMm: [T(400_000), T(400_000)] };
    const subject: readonly [Int, Int] = [T(409_000), T(400_000)];
    expect(ticksToCatch(state, subject)).toBe(10);
    state = stepFollow(state, subject);
    expect(state.cameraMm[0]).toBe(400_900);
    for (let i = 0; i < 20; i += 1) state = stepFollow(state, subject);
    expect(state.cameraMm[0]).toBe(409_000);
  });

  it("does nothing when nothing is followed or the subject is unknown", () => {
    const idle: FollowState = { cameraMm: [T(400_000), T(400_000)] };
    expect(stepFollow(idle, [T(500_000), T(400_000)])).toEqual(idle);
    const following: FollowState = { actorId: "C003", cameraMm: [T(400_000), T(400_000)] };
    expect(stepFollow(following, undefined)).toEqual(following);
  });
});
