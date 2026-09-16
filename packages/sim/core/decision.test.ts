import { describe, expect, it } from "vitest";
import { contracts } from "../index.js";
import type { Int } from "../primitives/index.js";
import { considerationsThatDiffer, decide, SWITCH_DELAY_TICKS } from "./decision.js";
import type { Candidate, DecisionInput, TraitId } from "./decision.js";

/** P1-16. */
const T = (n: number): Int => n as Int;

const candidates: readonly Candidate[] = [
  {
    candidateId: "goal.forage",
    considerations: [
      { id: "hunger", inputMilli: 700, weightMilli: 1_000 },
      { id: "opportunity", inputMilli: 400, weightMilli: 1_000 },
      { id: "threat", inputMilli: 200, weightMilli: 1_000 },
    ],
  },
  {
    candidateId: "goal.shelter",
    considerations: [
      { id: "shelter", inputMilli: 500, weightMilli: 1_000 },
      { id: "threat", inputMilli: 300, weightMilli: 1_000 },
      { id: "fatigue", inputMilli: 400, weightMilli: 1_000 },
    ],
  },
];

const flee: Candidate = {
  candidateId: "goal.flee",
  emergency: true,
  considerations: [{ id: "threat", inputMilli: 950, weightMilli: 2_000 }],
};

function input(traits: readonly TraitId[], extra: Partial<DecisionInput> = {}): DecisionInput {
  return { actorId: "C003", traits, candidates, evidence: [{ factId: 1, ageTicks: 12 }], ...extra };
}

describe("a trait moves only what it touches (criterion 1)", () => {
  it("changes only the considerations the trait weights", () => {
    const plain = decide(input([]), T(100)).trace;
    const cautious = decide(input(["cautious"]), T(100)).trace;
    // `cautious` weights threat and shelter, and nothing else.
    expect(considerationsThatDiffer(plain, cautious)).toEqual(["shelter", "threat"]);
  });

  it("leaves untouched considerations numerically identical, not merely close", () => {
    const plain = decide(input([]), T(100)).trace;
    const greedy = decide(input(["greedy"]), T(100)).trace;
    for (const candidate of plain.candidates) {
      const other = greedy.candidates.find((c) => c.candidateId === candidate.candidateId);
      for (const consideration of candidate.considerations) {
        if (consideration.id === "opportunity" || consideration.id === "socialDebt") continue;
        const match = other?.considerations.find((c) => c.id === consideration.id);
        expect(match?.effectiveWeightMilli).toBe(consideration.effectiveWeightMilli);
        expect(match?.contributionMilli).toBe(consideration.contributionMilli);
      }
    }
  });

  it("can change which candidate wins, which is what a trait is for", () => {
    const plain = decide(input([]), T(100));
    const cautious = decide(input(["cautious"]), T(100));
    expect(plain.chosenCandidateId).toBe("goal.forage");
    expect(cautious.chosenCandidateId).toBe("goal.shelter");
  });

  it("stacks two traits without either touching the other's considerations", () => {
    const both = decide(input(["cautious", "greedy"]), T(100)).trace;
    const plain = decide(input([]), T(100)).trace;
    expect(considerationsThatDiffer(plain, both)).toEqual(["opportunity", "shelter", "threat"]);
  });

  it("is deterministic and orders ties by candidate ID", () => {
    const run = (): string => JSON.stringify(decide(input(["cautious"]), T(100)).trace);
    expect(run()).toBe(run());
    const tied = decide({ ...input([]), candidates: [
      { candidateId: "goal.zeta", considerations: [{ id: "hunger", inputMilli: 500, weightMilli: 1_000 }] },
      { candidateId: "goal.alpha", considerations: [{ id: "hunger", inputMilli: 500, weightMilli: 1_000 }] },
    ] }, T(100));
    expect(tied.chosenCandidateId).toBe("goal.alpha");
  });
});

describe("the trace records what was evaluated, with evidence age (criterion 2)", () => {
  it("lists every scored candidate and no others", () => {
    const trace = decide(input([]), T(100)).trace;
    expect(trace.candidates.map((c) => c.candidateId).sort()).toEqual(["goal.forage", "goal.shelter"]);
    expect(trace.candidates.every((c) => typeof c.scoreMilli === "number")).toBe(true);
  });

  it("keeps the reason each candidate scored as it did", () => {
    const trace = decide(input(["cautious"]), T(100)).trace;
    const shelter = trace.candidates.find((c) => c.candidateId === "goal.shelter");
    const threat = shelter?.considerations.find((c) => c.id === "threat");
    expect(threat?.weightMilli).toBe(1_000);
    expect(threat?.effectiveWeightMilli).toBe(1_600);
    expect(threat?.contributionMilli).toBe(480);
    expect(shelter?.scoreMilli).toBe(shelter?.considerations.reduce((sum, c) => sum + c.contributionMilli, 0));
  });

  it("carries evidence with the age it had when it was used", () => {
    const trace = decide(input([], { evidence: [{ factId: 7, ageTicks: 240 }] }), T(100)).trace;
    expect(trace.evidenceRefs).toEqual([{ factId: 7, ageTicks: 240 }]);
  });

  it("matches the frozen DecisionTrace contract's field names", () => {
    const schema = contracts.toJsonSchema(contracts.CONTRACT_RECORDS["DecisionTrace"] as never, "DecisionTrace") as { properties: Record<string, unknown> };
    const trace = decide(input([]), T(100)).trace;
    for (const field of ["schemaVersion", "actorId", "tick", "candidates", "chosenCandidateId", "evidenceRefs"]) {
      expect(Object.keys(schema.properties)).toContain(field);
      expect(Object.keys(trace)).toContain(field);
    }
  });

  it("says why it chose nothing rather than leaving the field blank", () => {
    const none = decide({ ...input([]), candidates: [] }, T(100));
    expect(none.trace.noChoiceReasonId).toBe("NoCandidates");
    expect(none.chosenCandidateId).toBeUndefined();

    const zero = decide({ ...input([]), candidates: [{ candidateId: "goal.idle", considerations: [{ id: "hunger", inputMilli: 0, weightMilli: 1_000 }] }] }, T(100));
    expect(zero.trace.noChoiceReasonId).toBe("AllScoredZero");
  });
});

describe("emergencies bypass the switching delay (criterion 3)", () => {
  it("holds an ordinary better option until the delay elapses", () => {
    const held = decide(input(["cautious"], { current: { candidateId: "goal.forage", chosenAtTick: T(90) } }), T(100));
    expect(held.heldByDelay).toBe(true);
    expect(held.chosenCandidateId).toBe("goal.forage");
    expect(held.trace.trigger).toBe("Routine");

    const after = decide(input(["cautious"], { current: { candidateId: "goal.forage", chosenAtTick: T(90) } }), T(90 + SWITCH_DELAY_TICKS));
    expect(after.heldByDelay).toBe(false);
    expect(after.chosenCandidateId).toBe("goal.shelter");
  });

  it("switches immediately for an emergency candidate, mid-delay", () => {
    const urgent = decide(
      { ...input([], { current: { candidateId: "goal.forage", chosenAtTick: T(99) } }), candidates: [...candidates, flee] },
      T(100),
    );
    expect(urgent.heldByDelay).toBe(false);
    expect(urgent.chosenCandidateId).toBe("goal.flee");
    expect(urgent.trace.trigger).toBe("Emergency");
  });

  it("switches immediately when the current action has become illegal", () => {
    const forced = decide(
      input(["cautious"], { current: { candidateId: "goal.forage", chosenAtTick: T(99) }, currentInvalidated: true }),
      T(100),
    );
    expect(forced.heldByDelay).toBe(false);
    expect(forced.chosenCandidateId).toBe("goal.shelter");
    expect(forced.trace.trigger).toBe("LegalInvalidation");
  });

  it("does not bypass the delay for a candidate that merely scores well", () => {
    const tempting: Candidate = { candidateId: "goal.feast", considerations: [{ id: "hunger", inputMilli: 999, weightMilli: 3_000 }] };
    const held = decide(
      { ...input([], { current: { candidateId: "goal.forage", chosenAtTick: T(99) } }), candidates: [...candidates, tempting] },
      T(100),
    );
    expect(held.heldByDelay).toBe(true);
    expect(held.chosenCandidateId).toBe("goal.forage");
    // The trace still shows what it would have preferred — the delay is a
    // commitment, not a blindfold.
    expect(held.trace.candidates[0]?.candidateId).toBe("goal.feast");
  });
});
