import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { isIntentionalWait, PASSAGE_GRANT_TICKS, PassageQueue, ProgressMonitor, STALL_TICKS } from "./avoidance.js";

/** P1-06. Each test constructs the failure the rule exists to prevent. */
const T = (n: number): Int => n as Int;

describe("a narrow passage clears without overlap or starvation (criterion 1)", () => {
  it("grants the passage to one actor and gives the other an intentional wait", () => {
    const queue = new PassageQueue();
    const first = queue.claim("gap.01", "C003", "north", T(0));
    const second = queue.claim("gap.01", "C009", "south", T(0));

    expect(first.kind).toBe("Granted");
    expect(second.kind).toBe("Waiting");
    if (second.kind !== "Waiting") return;
    expect(second.wait.trigger).toContain("released by C003");
    expect(queue.holder("gap.01")).toBe("C003");
  });

  it("never lets two actors hold the same passage at once", () => {
    const queue = new PassageQueue();
    queue.claim("gap.01", "C003", "north", T(0));
    for (let tick = 0; tick < PASSAGE_GRANT_TICKS; tick += 1) {
      queue.claim("gap.01", "C009", "south", T(tick));
      queue.advance(T(tick));
      expect(queue.holder("gap.01")).toBe("C003");
    }
  });

  it("hands the passage over when the holder releases it", () => {
    const queue = new PassageQueue();
    queue.claim("gap.01", "C003", "north", T(0));
    queue.claim("gap.01", "C009", "south", T(1));
    queue.release("gap.01", "C003", T(5));
    expect(queue.holder("gap.01")).toBe("C009");
  });

  it("does not let a low actor ID starve a high one: both directions get turns", () => {
    const queue = new PassageQueue();
    // C003 always asks first — the shape that produces permanent priority when
    // ties break on ID alone and nothing ages.
    for (let round = 0; round < 12; round += 1) {
      const tick = T(round * PASSAGE_GRANT_TICKS);
      queue.claim("gap.01", "C003", "north", tick);
      queue.claim("gap.01", "C009", "south", tick);
      queue.advance(T((round + 1) * PASSAGE_GRANT_TICKS));
    }
    const north = queue.grantsByDirection.get("north") ?? 0;
    const south = queue.grantsByDirection.get("south") ?? 0;
    expect(south, "the south side never got the passage").toBeGreaterThan(0);
    expect(north).toBeGreaterThan(0);
    // Neither side may hold it forever.
    expect(queue.maxStreak("gap.01")).toBeLessThan(12);
  });

  it("resolves ties by actor ID, so two runs agree", () => {
    const run = (): string | undefined => {
      const queue = new PassageQueue();
      queue.claim("gap.01", "C009", "south", T(4));
      queue.claim("gap.01", "C003", "north", T(4));
      queue.advance(T(PASSAGE_GRANT_TICKS + 1));
      return queue.holder("gap.01");
    };
    expect(run()).toBe(run());
  });
});

describe("waits carry triggers and deadlines (criterion 2)", () => {
  it("every wait the queue issues has both", () => {
    const queue = new PassageQueue();
    queue.claim("gap.01", "C003", "north", T(0));
    const waiting = queue.claim("gap.01", "C009", "south", T(2));
    expect(waiting.kind).toBe("Waiting");
    if (waiting.kind !== "Waiting") return;
    expect(isIntentionalWait(waiting.wait)).toBe(true);
    expect(waiting.wait.trigger.length).toBeGreaterThan(0);
    expect(waiting.wait.deadlineTick).toBeGreaterThan(waiting.wait.sinceTick);
  });

  it("rejects a wait that names no trigger or never expires", () => {
    expect(isIntentionalWait({ reason: "ResourceReserved", trigger: "", deadlineTick: T(50), sinceTick: T(0) })).toBe(false);
    expect(isIntentionalWait({ reason: "ResourceReserved", trigger: "stack released", deadlineTick: T(0), sinceTick: T(0) })).toBe(false);
    expect(isIntentionalWait(undefined)).toBe(false);
  });
});

describe("the ten-second diagnostic (criterion 3)", () => {
  const position = { xMm: T(400_000), yMm: T(400_000) };

  it("reports an actor that has made no progress for ten seconds with no wait on file", () => {
    const monitor = new ProgressMonitor();
    let diagnostic;
    for (let tick = 0; tick <= STALL_TICKS + 1 && diagnostic === undefined; tick += 1) {
      diagnostic = monitor.observe("C003", T(tick), position, "walking to camp.01");
    }
    expect(diagnostic).toBeDefined();
    expect(diagnostic?.ticks).toBe(STALL_TICKS);
    expect(diagnostic?.seconds).toBe(10);
    expect(diagnostic?.lastIntent).toBe("walking to camp.01");
    expect(diagnostic?.lastPositionMm).toEqual(position);
  });

  it("stays silent while the actor is intentionally waiting — that lack of progress is explained", () => {
    const monitor = new ProgressMonitor();
    const wait = { reason: "PassageOwnedByOthers" as const, trigger: "passage gap.01 released by C009", deadlineTick: T(500), sinceTick: T(0) };
    for (let tick = 0; tick <= STALL_TICKS * 2; tick += 1) {
      expect(monitor.observe("C003", T(tick), position, "queued at gap.01", wait)).toBeUndefined();
    }
    expect(monitor.isReported("C003")).toBe(false);
  });

  it("reports once, not every tick, and re-arms after the actor moves", () => {
    const monitor = new ProgressMonitor();
    for (let tick = 0; tick <= STALL_TICKS; tick += 1) monitor.observe("C003", T(tick), position, "walking");
    expect(monitor.observe("C003", T(STALL_TICKS + 1), position, "walking")).toBeUndefined();
    expect(monitor.isReported("C003")).toBe(true);

    monitor.observe("C003", T(STALL_TICKS + 2), { xMm: T(401_000), yMm: T(400_000) }, "walking");
    expect(monitor.isReported("C003")).toBe(false);
  });

  it("does not report an actor that is moving slowly but really moving", () => {
    const monitor = new ProgressMonitor();
    let diagnostic;
    for (let tick = 0; tick <= STALL_TICKS * 2; tick += 1) {
      diagnostic = monitor.observe("C003", T(tick), { xMm: T(400_000 + tick * 200), yMm: T(400_000) }, "walking") ?? diagnostic;
    }
    expect(diagnostic).toBeUndefined();
  });
});
