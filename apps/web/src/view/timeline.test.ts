import { describe, expect, it } from "vitest";
import type { Int } from "@lastclan/sim";
import { buildCommandList, buildLawTimeline, isDisplayedAsInForce, pausedSpeedReading, pendingCommands, readSpeed } from "./timeline.js";

/** P1-30. */
const T = (n: number): Int => n as Int;

const accepted = [{ lawId: "law.truce", version: 1, label: "Truce", activationTick: T(100), endTick: T(400) }];
const refused = [{ lawId: "law.curfew", version: 1, label: "Curfew", activationTick: T(50), endTick: T(900), reasonId: "NoticeTooShort" }];

describe("a rejected law never displays as active (criterion 1)", () => {
  it("shows a refused law as Rejected even while its interval covers now", () => {
    const rows = buildLawTimeline(accepted, refused, T(200));
    const curfew = rows.find((row) => row.lawId === "law.curfew");
    expect(curfew?.state).toBe("Rejected");
    expect(isDisplayedAsInForce(curfew as never)).toBe(false);
    expect(curfew?.reasonId).toBe("NoticeTooShort");
  });

  it("shows only acknowledged laws as active", () => {
    const rows = buildLawTimeline(accepted, refused, T(200));
    expect(rows.filter(isDisplayedAsInForce).map((row) => row.lawId)).toEqual(["law.truce"]);
  });

  it("moves an acknowledged law through Scheduled, Active and Ended with the tick", () => {
    expect(buildLawTimeline(accepted, [], T(50)).find((r) => r.lawId === "law.truce")?.state).toBe("Scheduled");
    expect(buildLawTimeline(accepted, [], T(100)).find((r) => r.lawId === "law.truce")?.state).toBe("Active");
    expect(buildLawTimeline(accepted, [], T(399)).find((r) => r.lawId === "law.truce")?.state).toBe("Active");
    expect(buildLawTimeline(accepted, [], T(400)).find((r) => r.lawId === "law.truce")?.state).toBe("Ended");
  });

  it("does not show a submitted-but-unanswered law in the timeline at all", () => {
    // It is a pending command until the core answers; the timeline is for
    // acknowledged truth only.
    const rows = buildLawTimeline([], [], T(200));
    expect(rows).toEqual([]);
    const commands = buildCommandList([{ sequence: 1, label: "Install Truce", submittedAtTick: T(150) }], [], false);
    expect(commands[0]?.status).toBe("Pending");
  });

  it("orders the timeline by activation tick, then by law id", () => {
    const rows = buildLawTimeline(
      [
        { lawId: "law.zeta", version: 1, label: "Z", activationTick: T(100), endTick: T(200) },
        { lawId: "law.alpha", version: 1, label: "A", activationTick: T(100), endTick: T(200) },
        { lawId: "law.early", version: 1, label: "E", activationTick: T(10), endTick: T(20) },
      ],
      [],
      T(0),
    );
    expect(rows.map((r) => r.lawId)).toEqual(["law.early", "law.alpha", "law.zeta"]);
  });
});

describe("pending paused commands stay visibly pending (criterion 2)", () => {
  const submitted = [
    { sequence: 1, label: "Install Truce", submittedAtTick: T(100) },
    { sequence: 2, label: "Cancel Curfew", submittedAtTick: T(101) },
  ];

  it("marks an unanswered command PendingPaused while the world is paused", () => {
    const rows = buildCommandList(submitted, [], true);
    expect(rows.map((r) => r.status)).toEqual(["PendingPaused", "PendingPaused"]);
    expect(pendingCommands(rows)).toHaveLength(2);
  });

  it("never drops a pending command from the list", () => {
    const rows = buildCommandList(submitted, [{ sequence: 1, accepted: true, tick: T(105) }], true);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.status).toBe("Accepted");
    expect(rows[1]?.status).toBe("PendingPaused");
  });

  it("never shows an unanswered command as accepted", () => {
    for (const paused of [true, false]) {
      const rows = buildCommandList(submitted, [], paused);
      expect(rows.every((row) => row.status !== "Accepted")).toBe(true);
    }
  });

  it("carries the rejection reason through to the row", () => {
    const rows = buildCommandList(submitted, [{ sequence: 2, accepted: false, tick: T(106), reasonId: "NoticeTooShort" }], false);
    expect(rows[1]?.status).toBe("Rejected");
    expect(rows[1]?.reasonId).toBe("NoticeTooShort");
    expect(rows[1]?.acknowledgedAtTick).toBeUndefined();
  });

  it("records the acknowledging tick for an accepted command", () => {
    const rows = buildCommandList(submitted, [{ sequence: 1, accepted: true, tick: T(105) }], false);
    expect(rows[0]?.acknowledgedAtTick).toBe(105);
  });
});

describe("the delivered speed is shown when the request is unsustainable (criterion 3)", () => {
  it("shows the request when it is being met", () => {
    // 4x for one second at 10 Hz is 40 ticks.
    const reading = readSpeed(4_000, 40, 1_000);
    expect(reading.throttled).toBe(false);
    expect(reading.label).toBe("4x");
  });

  it("shows both numbers when delivery falls short", () => {
    const reading = readSpeed(4_000, 17, 1_000);
    expect(reading.throttled).toBe(true);
    expect(reading.deliveredMilli).toBe(1_700);
    expect(reading.label).toBe("1.7x (requested 4x)");
  });

  it("does not cry throttled over a rounding wobble", () => {
    const reading = readSpeed(1_000, 10, 1_000);
    expect(reading.throttled).toBe(false);
    expect(reading.label).toBe("1x");
  });

  it("measures delivery rather than echoing the setting", () => {
    const slow = readSpeed(2_000, 5, 1_000);
    expect(slow.deliveredMilli).toBe(500);
    expect(slow.deliveredMilli).not.toBe(slow.requestedMilli);
  });

  it("says paused rather than reporting zero times a request", () => {
    const reading = pausedSpeedReading(4_000);
    expect(reading.label).toBe("paused");
    expect(reading.throttled).toBe(false);
    expect(reading.deliveredMilli).toBe(0);
  });

  it("survives a zero elapsed time without dividing by it", () => {
    expect(() => readSpeed(1_000, 0, 0)).not.toThrow();
    expect(readSpeed(1_000, 0, 0).deliveredMilli).toBe(0);
  });
});
