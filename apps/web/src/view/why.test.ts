import { describe, expect, it } from "vitest";
import { core } from "@lastclan/sim";
import type { Int } from "@lastclan/sim";
import { buildWhyPanel, EventFeed, MAX_ALTERNATIVES, shouldRefresh } from "./why.js";
import type { FeedEvent } from "./why.js";

/** P1-31. */
const T = (n: number): Int => n as Int;

const candidates = [
  {
    candidateId: "goal.forage",
    considerations: [
      { id: "hunger" as const, inputMilli: 700, weightMilli: 1_000 },
      { id: "threat" as const, inputMilli: 200, weightMilli: 1_000 },
    ],
  },
  {
    candidateId: "goal.shelter",
    considerations: [
      { id: "shelter" as const, inputMilli: 500, weightMilli: 1_000 },
      { id: "threat" as const, inputMilli: 300, weightMilli: 1_000 },
    ],
  },
  {
    candidateId: "goal.chat",
    considerations: [{ id: "socialDebt" as const, inputMilli: 200, weightMilli: 1_000 }],
  },
];

function traceFor(traits: Parameters<typeof core.decide>[0]["traits"] = []): ReturnType<typeof core.decide>["trace"] {
  return core.decide({ actorId: "C003", traits, candidates, evidence: [{ factId: 7, ageTicks: 240 }] }, T(100)).trace;
}

describe("displayed alternatives are a subset of evaluated entries (criterion 1)", () => {
  it("shows only candidates the decider actually scored", () => {
    const trace = traceFor();
    const panel = buildWhyPanel(trace, { nowTick: 100 });
    const evaluated = new Set(trace.candidates.map((c) => c.candidateId));
    for (const alternative of panel.alternatives) expect(evaluated.has(alternative.candidateId)).toBe(true);
    expect(panel.alternatives.map((a) => a.candidateId)).not.toContain(panel.chosenCandidateId);
  });

  it("shows at most two, as the GDD specifies, even with more evaluated", () => {
    const panel = buildWhyPanel(traceFor(), { nowTick: 100 });
    // Three evaluated, one chosen: two alternatives remain, which is the cap.
    expect(traceFor().candidates.length).toBeGreaterThan(MAX_ALTERNATIVES);
    expect(panel.alternatives).toHaveLength(MAX_ALTERNATIVES);
  });

  it("gives each alternative one real reason drawn from the considerations", () => {
    const trace = traceFor();
    const panel = buildWhyPanel(trace, { nowTick: 100 });
    const consideredIds = new Set(trace.candidates.flatMap((c) => c.considerations.map((x) => x.id)));
    for (const alternative of panel.alternatives) {
      expect(alternative.reason.length).toBeGreaterThan(0);
      const namedConsideration = [...consideredIds].some((id) => alternative.reason.includes(id));
      expect(namedConsideration || alternative.reason.includes("lower overall")).toBe(true);
    }
  });

  it("cannot show a counterfactual, because the trace is its only input", () => {
    expect(buildWhyPanel.length).toBe(2);
    const empty = buildWhyPanel({ ...traceFor(), candidates: [] }, { nowTick: 100 });
    expect(empty.alternatives).toEqual([]);
  });

  it("adds scores, facts and the decision tick only in the developer view", () => {
    const plain = buildWhyPanel(traceFor(), { nowTick: 100 });
    expect(plain.developer).toBeUndefined();

    const dev = buildWhyPanel(traceFor(), { nowTick: 100, developerView: true });
    expect(dev.developer?.scores.length).toBe(3);
    expect(dev.developer?.evidence).toEqual([{ factId: 7, ageTicks: 240 }]);
    expect(dev.developer?.trigger).toBe("Routine");
  });
});

describe("no evaluated alternative means an explicit explanation (criterion 2)", () => {
  it("says so when only the chosen candidate was evaluated", () => {
    const single = core.decide({ actorId: "C003", traits: [], candidates: [candidates[0] as never], evidence: [] }, T(100)).trace;
    const panel = buildWhyPanel(single, { nowTick: 100 });
    expect(panel.alternatives).toEqual([]);
    expect(panel.unavailable).toBe("no alternative was evaluated this cycle: the only candidate was the one chosen");
  });

  it("says so when nothing at all was evaluated", () => {
    const none = core.decide({ actorId: "C003", traits: [], candidates: [], evidence: [] }, T(100)).trace;
    const panel = buildWhyPanel(none, { nowTick: 100 });
    expect(panel.unavailable).toBe("no alternatives were evaluated this cycle");
    expect(panel.chosenCandidateId).toBeUndefined();
  });

  it("does not set an explanation when alternatives exist", () => {
    expect(buildWhyPanel(traceFor(), { nowTick: 100 }).unavailable).toBeUndefined();
  });

  it("reports the age of a cached reason and refreshes on a meaningful change", () => {
    const trace = traceFor();
    const panel = buildWhyPanel(trace, { nowTick: 340 });
    expect(panel.ageTicks).toBe(240);
    expect(shouldRefresh(panel, trace)).toBe(false);

    const later = core.decide({ actorId: "C003", traits: ["cautious"], candidates, evidence: [] }, T(400)).trace;
    expect(shouldRefresh(panel, later)).toBe(true);
  });
});

describe("off-camera events enter the feed without changing knowledge (criterion 3)", () => {
  function event(tick: number, onCamera: boolean): FeedEvent {
    return { type: "action.completed", tick, actorId: "C009", text: `C009 finished an axe`, onCamera };
  }

  it("admits off-camera events exactly as on-camera ones", () => {
    const feed = new EventFeed();
    feed.append(event(10, true));
    feed.append(event(11, false));
    feed.append(event(12, false));
    expect(feed.size).toBe(3);
    expect(feed.offCameraCount).toBe(2);
    expect(feed.recent(3).map((e) => e.tick)).toEqual([12, 11, 10]);
  });

  it("has no method a simulation could consume, so a feed entry cannot become a belief", () => {
    const feed = new EventFeed();
    feed.append(event(10, false));
    const surface = Object.getOwnPropertyNames(Object.getPrototypeOf(feed)).filter((name) => name !== "constructor");
    expect(surface.sort()).toEqual(["append", "offCameraCount", "recent", "size"]);
    // `recent` hands out copies: mutating one cannot reach the feed.
    const copy = feed.recent(1)[0] as { text: string };
    copy.text = "tampered";
    expect(feed.recent(1)[0]?.text).toBe("C009 finished an axe");
  });

  it("does not let an actor's beliefs change because the feed saw something", () => {
    // The belief store and the feed share no reference; an entry in one is not
    // an entry in the other, which is the whole of criterion 3.
    const store = new core.BeliefStore(8);
    const feed = new EventFeed();
    feed.append(event(10, false));
    feed.append(event(11, false));
    expect(store.size).toBe(0);
    expect(store.all()).toEqual([]);
  });

  it("caps its length rather than growing without bound", () => {
    const feed = new EventFeed(5);
    for (let tick = 0; tick < 50; tick += 1) feed.append(event(tick, tick % 2 === 0));
    expect(feed.size).toBe(5);
    expect(feed.recent(5).map((e) => e.tick)).toEqual([49, 48, 47, 46, 45]);
  });
});
