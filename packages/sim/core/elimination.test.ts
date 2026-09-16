import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import {
  BANDAGE_ITEM_ID,
  beginRevive,
  bleedPauses,
  EliminationRegistry,
  stepRevive,
  tickBleedSource,
  woundMultiplierMilli,
  WOUND_PENALTY_MILLI,
  WOUND_PENALTY_TICKS,
} from "./elimination.js";
import type { BleedSource, ReviveEpisode } from "./elimination.js";
import { REVIVE_TICKS } from "./health.js";
import { ReservationBook } from "./reservation.js";

/** P1-24. */
const T = (n: number): Int => n as Int;
const at = (x: number, y: number): readonly [Int, Int] => [T(x), T(y)];

function bleed(source: BleedSource["source"], remaining = 6_000): BleedSource {
  return { id: `bleed.${source}`, source, remainingMilli: T(remaining), perTickMilli: T(1_000), pausedTicks: 0 };
}

describe("protection pauses only covered sentient-origin bleed (criterion 1)", () => {
  it("pauses a hostile bleed only while the bearer is covered", () => {
    expect(bleedPauses(bleed("Hostile"), true)).toBe(true);
    expect(bleedPauses(bleed("Hostile"), false)).toBe(false);
  });

  it("never pauses a wound that did not come from another actor", () => {
    for (const source of ["Environment", "Exposure", "Starvation"] as const) {
      expect(bleedPauses(bleed(source), true), `${source} was paused by protection`).toBe(false);
    }
  });

  it("leaves the remaining damage untouched while paused, and resumes on the same amount", () => {
    let wound = bleed("Hostile");
    for (let i = 0; i < 2; i += 1) wound = tickBleedSource(wound, false).bleed;
    expect(wound.remainingMilli).toBe(4_000);

    for (let i = 0; i < 40; i += 1) {
      const step = tickBleedSource(wound, true);
      expect(step.paused).toBe(true);
      expect(step.appliedMilli).toBe(0);
      wound = step.bleed;
    }
    expect(wound.remainingMilli).toBe(4_000);
    expect(wound.pausedTicks).toBe(40);
    expect(tickBleedSource(wound, false).appliedMilli).toBe(1_000);
  });

  it("keeps a wildlife wound bleeding at full rate inside protection", () => {
    let wound = bleed("Environment", 3_000);
    let applied = 0;
    for (let i = 0; i < 3; i += 1) {
      const step = tickBleedSource(wound, true);
      applied += step.appliedMilli as number;
      wound = step.bleed;
    }
    expect(applied).toBe(3_000);
    expect(wound.remainingMilli).toBe(0);
  });

  it("never pays more than the wound has left", () => {
    const small: BleedSource = { ...bleed("Hostile"), remainingMilli: T(400) };
    const step = tickBleedSource(small, false);
    expect(step.appliedMilli).toBe(400);
    expect(step.bleed.remainingMilli).toBe(0);
    expect(tickBleedSource(step.bleed, false).appliedMilli).toBe(0);
  });
});

describe("a revive consumes one bandage at completion (criterion 2)", () => {
  const world = { targetStillDowned: true, rescuerHasBandage: true };

  function runRevive(ticks: number, episode: ReviveEpisode = beginRevive("ep.1", "C009", "C003", T(0))): ReturnType<typeof stepRevive> {
    let current = episode;
    let step = stepRevive(current, world, T(0));
    for (let tick = 1; tick < ticks; tick += 1) {
      if (step.kind !== "Working") return step;
      current = step.episode;
      step = stepRevive(current, world, T(tick));
    }
    return step;
  }

  it("works for exactly the GDD's six seconds and then consumes the bandage", () => {
    const partway = runRevive(REVIVE_TICKS - 1);
    expect(partway.kind).toBe("Working");
    const done = runRevive(REVIVE_TICKS);
    expect(done.kind).toBe("Completed");
    if (done.kind !== "Completed") return;
    expect(done.consumed).toBe(BANDAGE_ITEM_ID);
    expect(REVIVE_TICKS).toBe(60);
  });

  it("consumes nothing when interrupted, however far along it was", () => {
    let episode = beginRevive("ep.1", "C009", "C003", T(0));
    for (let tick = 0; tick < REVIVE_TICKS - 1; tick += 1) {
      const step = stepRevive(episode, world, T(tick));
      if (step.kind !== "Working") throw new Error("expected to still be working");
      episode = step.episode;
    }
    const interrupted = stepRevive(episode, { ...world, interrupted: true }, T(REVIVE_TICKS - 1));
    expect(interrupted.kind).toBe("Ended");
    if (interrupted.kind !== "Ended") return;
    expect(interrupted.reason).toBe("Interrupted");
    expect(interrupted.bandageConsumed).toBe(false);
  });

  it("resets the episode after an interruption — the next attempt starts from zero", () => {
    const fresh = beginRevive("ep.2", "C009", "C003", T(500));
    expect(fresh.ticksDone).toBe(0);
    expect(stepRevive(fresh, world, T(500)).kind).toBe("Working");
  });

  it("ends without consuming anything when the target is no longer downed", () => {
    const step = stepRevive(beginRevive("ep.1", "C009", "C003", T(0)), { targetStillDowned: false, rescuerHasBandage: true }, T(10));
    expect(step.kind).toBe("Ended");
    if (step.kind !== "Ended") return;
    expect(step.reason).toBe("TargetGone");
    expect(step.bandageConsumed).toBe(false);
  });

  it("refuses to proceed without a bandage rather than finishing for free", () => {
    const step = stepRevive(beginRevive("ep.1", "C009", "C003", T(0)), { targetStillDowned: true, rescuerHasBandage: false }, T(0));
    expect(step.kind).toBe("Ended");
    if (step.kind !== "Ended") return;
    expect(step.detail).toContain(BANDAGE_ITEM_ID);
  });

  it("returns the revived actor with a temporary wound penalty", () => {
    const done = runRevive(REVIVE_TICKS);
    if (done.kind !== "Completed") throw new Error("expected completion");
    const until = done.woundPenaltyUntilTick;
    expect(until).toBe(REVIVE_TICKS - 1 + WOUND_PENALTY_TICKS);
    expect(woundMultiplierMilli(until, T(REVIVE_TICKS))).toBe(WOUND_PENALTY_MILLI);
    expect(woundMultiplierMilli(until, until)).toBe(1_000);
  });
});

describe("elimination cleanup runs exactly once (criterion 3)", () => {
  function setup(): { registry: EliminationRegistry; book: ReservationBook } {
    const book = new ReservationBook();
    book.grant("station.bench", "Station", "C003", T(0));
    book.grant("stack.flint", "ItemStack", "C003", T(0));
    book.grant("station.fire", "Station", "C009", T(0));
    return { registry: new EliminationRegistry(), book };
  }

  const carried = { "item.axe": 1, "item.berry": 4 };

  it("releases every lease and drops everything carried", () => {
    const { registry, book } = setup();
    const result = registry.cleanup("C003", carried, at(400_000, 400_000), book, T(50));
    expect(result.performed).toBe(true);
    expect([...result.releasedKeys].sort()).toEqual(["stack.flint", "station.bench"]);
    expect(result.drops.map((d) => `${d.itemDefId}x${d.count}`)).toEqual(["item.axex1", "item.berryx4"]);
    expect(book.heldBy("C003")).toEqual([]);
    // Another actor's lease is untouched.
    expect(book.holderOf("station.fire")).toBe("C009");
  });

  it("produces nothing at all on a second call", () => {
    const { registry, book } = setup();
    registry.cleanup("C003", carried, at(400_000, 400_000), book, T(50));
    const again = registry.cleanup("C003", carried, at(400_000, 400_000), book, T(51));
    expect(again.performed).toBe(false);
    expect(again.drops).toEqual([]);
    expect(again.releasedKeys).toEqual([]);
  });

  it("stays idempotent across a tick loop that keeps calling it", () => {
    const { registry, book } = setup();
    let drops = 0;
    for (let tick = 50; tick < 200; tick += 1) drops += registry.cleanup("C003", carried, at(400_000, 400_000), book, T(tick)).drops.length;
    expect(drops).toBe(2);
    expect(registry.cleanedCount).toBe(1);
  });

  it("drops nothing for an actor carrying nothing, and still releases its leases", () => {
    const { registry, book } = setup();
    const result = registry.cleanup("C003", {}, at(400_000, 400_000), book, T(50));
    expect(result.drops).toEqual([]);
    expect(result.releasedKeys).toHaveLength(2);
    expect(result.performed).toBe(true);
  });

  it("orders drops canonically, so two runs produce the same pile", () => {
    const { registry, book } = setup();
    const result = registry.cleanup("C003", { "item.zeta": 1, "item.alpha": 2 }, at(400_000, 400_000), book, T(50));
    expect(result.drops.map((d) => d.itemDefId)).toEqual(["item.alpha", "item.zeta"]);
  });

  it("cleans two actors independently", () => {
    const { registry, book } = setup();
    registry.cleanup("C003", carried, at(400_000, 400_000), book, T(50));
    const other = registry.cleanup("C009", { "item.rope": 1 }, at(410_000, 400_000), book, T(50));
    expect(other.performed).toBe(true);
    expect(other.releasedKeys).toEqual(["station.fire"]);
    expect(registry.cleanedCount).toBe(2);
  });
});
