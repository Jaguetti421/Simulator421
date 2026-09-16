import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import {
  AWARENESS_RADIUS_MM,
  beliefFrom,
  BASE_SIGHT_RANGE_MM,
  perceive,
  sightRangeMm,
  SLEEP_RANGE_MILLI,
  THREAT_INTERRUPT_TICKS,
  ThreatQueue,
} from "./sensory.js";
import type { Evidence, Observer, SensedActor } from "./sensory.js";

/** P1-15. */
const T = (n: number): Int => n as Int;
const at = (x: number, y: number): readonly [Int, Int] => [T(x), T(y)];
const clearSight = { hasLineOfSight: (): boolean => true };
const blockedSight = { hasLineOfSight: (): boolean => false };

const observer: Observer = { actorId: "C003", positionMm: at(400_000, 400_000), facingMm: at(1_000, 0) };

function hostileAt(actorId: string, x: number, y: number): SensedActor {
  return { actorId, positionMm: at(x, y), hostile: true };
}

describe("what is not perceived cannot change a decision (criterion 1)", () => {
  /** A stand-in decision layer: it sees evidence and nothing else. */
  const decide = (evidence: readonly Evidence[]): string =>
    evidence
      .map((e) => `${e.channel}:${e.subjectId ?? "?"}@${e.positionMm[0]},${e.positionMm[1]}`)
      .sort()
      .join("|");

  it("produces identical decisions whether or not hidden enemies exist", () => {
    const visible = [hostileAt("C009", 430_000, 400_000)];
    const hidden = [
      hostileAt("C011", 300_000, 300_000), // far away
      hostileAt("C012", 370_000, 400_000), // behind the observer
      { ...hostileAt("C013", 410_000, 400_000), concealmentMilli: 1_000 }, // fully concealed
    ];
    const withoutHidden = decide(perceive(observer, visible, [], clearSight, T(100)));
    const withHidden = decide(perceive(observer, [...visible, ...hidden], [], clearSight, T(100)));
    expect(withHidden).toBe(withoutHidden);
    expect(withHidden).toContain("C009");
    for (const ghost of ["C011", "C012", "C013"]) expect(withHidden).not.toContain(ghost);
  });

  it("produces no evidence at all when the line of sight is blocked", () => {
    const evidence = perceive(observer, [hostileAt("C009", 430_000, 400_000)], [], blockedSight, T(100));
    expect(evidence).toEqual([]);
  });

  it("gives a decision layer no handle to anything but evidence", () => {
    const evidence = perceive(observer, [hostileAt("C009", 430_000, 400_000)], [], clearSight, T(100));
    // Every field is a value: no arrays of the world, no actor objects, no terrain.
    for (const item of evidence) {
      expect(Object.keys(item).sort()).toEqual(["atTick", "channel", "kind", "positionMm", "provenance", "subjectId", "uncertaintyMm", "urgent"]);
      expect(typeof item.subjectId).toBe("string");
    }
  });

  it("turns evidence into a belief that keeps the channel's uncertainty and provenance", () => {
    const evidence = perceive(observer, [hostileAt("C009", 430_000, 400_000)], [], clearSight, T(100));
    const belief = beliefFrom(evidence[0] as Evidence, T(105));
    expect(belief.observedAtTick).toBe(100);
    expect(belief.learnedAtTick).toBe(105);
    expect(belief.provenance).toBe("Observed");
    expect(belief.uncertaintyMm).toBe((evidence[0] as Evidence).uncertaintyMm);
  });
});

describe("channels match the GDD (criterion 2)", () => {
  it("sees inside the 160-degree forward field and not outside it", () => {
    const front = perceive(observer, [hostileAt("C009", 430_000, 400_000)], [], clearSight, T(100));
    expect(front[0]?.channel).toBe("Sight");

    // 90 degrees off the facing axis is outside an 80-degree half-angle.
    const side = perceive(observer, [hostileAt("C009", 400_000, 430_000)], [], clearSight, T(100));
    expect(side).toEqual([]);

    // Directly behind.
    const behind = perceive(observer, [hostileAt("C009", 370_000, 400_000)], [], clearSight, T(100));
    expect(behind).toEqual([]);
  });

  it("keeps the 8-metre awareness radius regardless of facing", () => {
    const behindButClose = perceive(observer, [hostileAt("C009", 393_000, 400_000)], [], clearSight, T(100));
    expect(behindButClose[0]?.channel).toBe("Awareness");
    expect(AWARENESS_RADIUS_MM).toBe(8_000);

    const behindAndFar = perceive(observer, [hostileAt("C009", 391_000, 400_000)], [], clearSight, T(100));
    expect(behindAndFar).toEqual([]);
  });

  it("reduces sensory range during sleep rather than switching it off", () => {
    const asleep: Observer = { ...observer, asleep: true };
    expect(sightRangeMm(asleep)).toBe((BASE_SIGHT_RANGE_MM * SLEEP_RANGE_MILLI) / 1_000);
    expect(sightRangeMm(asleep)).toBeGreaterThan(0);
    // An alarm close enough is still heard while asleep (GDD §7.1).
    const heard = perceive(asleep, [], [{ positionMm: at(405_000, 400_000), loudnessMilli: 1_000 }], clearSight, T(100));
    expect(heard.map((e) => e.channel)).toEqual(["Hearing"]);
  });

  it("scales sight with light and with the target's concealment", () => {
    expect(sightRangeMm({ ...observer, lightMilli: 500 })).toBe(BASE_SIGHT_RANGE_MM / 2);
    expect(sightRangeMm(observer, 500)).toBe(BASE_SIGHT_RANGE_MM / 2);
    // Concealment scales rather than cutting off: it is still non-zero at 90 %.
    expect(sightRangeMm(observer, 900)).toBeGreaterThan(0);
  });

  it("gives hearing an approximate location and never an identity", () => {
    const heard = perceive(observer, [], [{ positionMm: at(420_000, 430_000), loudnessMilli: 1_000 }], clearSight, T(100));
    expect(heard).toHaveLength(1);
    expect(heard[0]?.subjectId).toBeUndefined();
    expect(heard[0]?.uncertaintyMm).toBeGreaterThan(10_000);
  });

  it("does not hear a sound beyond its loudness-scaled radius", () => {
    const quiet = perceive(observer, [], [{ positionMm: at(430_000, 400_000), loudnessMilli: 100 }], clearSight, T(100));
    expect(quiet).toEqual([]);
  });

  it("is deterministic: the same inputs give the same evidence in the same order", () => {
    const run = (): string => JSON.stringify(perceive(observer, [hostileAt("C022", 420_000, 400_000), hostileAt("C009", 415_000, 400_000)], [], clearSight, T(100)));
    expect(run()).toBe(run());
    expect(JSON.parse(run())[0].subjectId).toBe("C009");
  });
});

describe("urgent threats arrive within five ticks (criterion 3)", () => {
  it("delivers a newly sensed hostile inside the bound", () => {
    const queue = new ThreatQueue();
    const evidence = perceive(observer, [hostileAt("C009", 430_000, 400_000)], [], clearSight, T(100));
    queue.offer(evidence, T(100));
    const delivered = queue.drain(evidence, T(103));
    expect(delivered).toHaveLength(1);
    expect(delivered[0]?.latencyTicks).toBe(3);
    expect(delivered[0]?.latencyTicks).toBeLessThanOrEqual(THREAT_INTERRUPT_TICKS);
    expect(queue.overdue(T(103))).toEqual([]);
  });

  it("reports a threat held past the bound instead of hiding it", () => {
    const queue = new ThreatQueue();
    queue.offer(perceive(observer, [hostileAt("C009", 430_000, 400_000)], [], clearSight, T(100)), T(100));
    expect(queue.overdue(T(105))).toEqual([]);
    const late = queue.overdue(T(106));
    expect(late).toHaveLength(1);
    expect(late[0]?.latencyTicks).toBe(6);
  });

  it("keeps every latency inside the bound across a staggered run", () => {
    const queue = new ThreatQueue();
    for (let tick = 100; tick < 200; tick += 1) {
      const evidence = perceive(observer, [hostileAt("C009", (410_000 + tick * 10) as unknown as number, 400_000)], [], clearSight, T(tick));
      queue.offer(evidence, T(tick));
      // Ordinary inspection is staggered: drain every fourth tick, inside the bound.
      if (tick % 4 === 0) queue.drain(evidence, T(tick));
      expect(queue.overdue(T(tick))).toEqual([]);
    }
    expect(queue.worstLatency).toBeLessThanOrEqual(THREAT_INTERRUPT_TICKS);
  });

  it("does not queue evidence that is not a threat", () => {
    const queue = new ThreatQueue();
    const friendly = perceive(observer, [{ ...hostileAt("C009", 430_000, 400_000), hostile: false }], [], clearSight, T(100));
    queue.offer(friendly, T(100));
    expect(queue.drain(friendly, T(101))).toEqual([]);
    expect(queue.overdue(T(200))).toEqual([]);
  });
});
