import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import type { contracts } from "../index.js";
import { composeProviders, DECISION_CONTEXT_MEMBERS, ProviderError } from "./providers.js";

/**
 * P1-01 criterion 2: the host composes providers **without giving decision code
 * a world-state handle**. The test below does not take that on trust — it walks
 * the object graph reachable from a DecisionContext and fails if the sentinel
 * world object is reachable from it at all.
 */
const WORLD_SENTINEL = { iAmTheWorld: true, actors: [{ id: "C001", secret: "hidden state" }] };

function stubPerception(): contracts.IPerceptionQuery {
  return {
    query: (request) => [{ schemaVersion: 0, observerActorId: request.observerActorId, tick: request.tick, kind: request.kind } as unknown as contracts.EvidenceRecord],
    knowledgeView: (actorId, tick) => ({ schemaVersion: 0, actorId, tick, self: {}, publicNotices: [], facts: [] }) as unknown as contracts.ActorKnowledgeView,
  };
}

function stubRoutes(): contracts.IRouteQuery {
  return { route: () => ({ schemaVersion: 0, status: "Complete" }) as unknown as contracts.RouteResult };
}

function stubSection(sectionId: string): contracts.IStateSectionCodec {
  return {
    sectionId,
    sectionVersion: 1 as Int,
    required: true,
    hashDomain: "Authoritative",
    capture: () => new Uint8Array([1, 2, 3]),
    restore: () => undefined,
    hashContribution: () => 7 as Int,
    validate: () => ({ ok: true }),
    describe: (bytes) => ({ schemaVersion: 0, sectionId, sectionVersion: 1, required: true, hashDomain: "Authoritative", byteLength: bytes.byteLength, contributionHash: 7 }) as unknown as contracts.StateSectionDescriptor,
  };
}

function reachable(root: unknown, limit = 5000): Set<unknown> {
  const seen = new Set<unknown>();
  const queue: unknown[] = [root];
  while (queue.length > 0 && seen.size < limit) {
    const value = queue.pop();
    if (value === null || (typeof value !== "object" && typeof value !== "function") || seen.has(value)) continue;
    seen.add(value);
    if (typeof value === "object") for (const v of Object.values(value as Record<string, unknown>)) queue.push(v);
  }
  return seen;
}

describe("the host composes providers", () => {
  const composed = (): ReturnType<typeof composeProviders> =>
    composeProviders({ perception: stubPerception(), routes: stubRoutes(), sections: [stubSection("world"), stubSection("random")] });

  it("hands decision code only record-returning members", () => {
    const context = composed().decisionContext("C001", 42 as Int);
    expect(Object.keys(context).sort()).toEqual([...DECISION_CONTEXT_MEMBERS].sort());
    expect(context.actorId).toBe("C001");
    expect(context.tick).toBe(42);
    expect(context.knowledge().actorId).toBe("C001");
    expect(context.perceive("Sight", 10_000 as Int)).toHaveLength(1);
  });

  it("makes world state unreachable from the decision context, checked by walking the graph", () => {
    // A perception provider that closes over the world — as a real one will —
    // must still not expose it through anything Core hands to decision code.
    const perception: contracts.IPerceptionQuery = {
      query: (request) => {
        void WORLD_SENTINEL.actors.length;
        return [{ schemaVersion: 0, observerActorId: request.observerActorId } as unknown as contracts.EvidenceRecord];
      },
      knowledgeView: (actorId, tick) => {
        void WORLD_SENTINEL.actors.length;
        return { schemaVersion: 0, actorId, tick, self: {}, publicNotices: [], facts: [] } as unknown as contracts.ActorKnowledgeView;
      },
    };
    const context = composeProviders({ perception, routes: stubRoutes(), sections: [] }).decisionContext("C001", 1 as Int);

    const graph = reachable(context);
    expect(graph.has(WORLD_SENTINEL)).toBe(false);
    expect(graph.has(WORLD_SENTINEL.actors)).toBe(false);
    // ...and the values it returns are records, not live structures from the world.
    expect(reachable(context.knowledge()).has(WORLD_SENTINEL)).toBe(false);
  });

  it("is frozen, so a caller cannot graft a world handle onto it afterwards", () => {
    const context = composed().decisionContext("C001", 1 as Int);
    expect(Object.isFrozen(context)).toBe(true);
    expect(() => {
      (context as unknown as Record<string, unknown>)["world"] = WORLD_SENTINEL;
    }).toThrow();
  });

  it("keeps section codecs off the decision surface entirely", () => {
    const composition = composed();
    const context = composition.decisionContext("C001", 1 as Int);
    expect(Object.keys(context)).not.toContain("section");
    expect(composition.sectionIds()).toEqual(["random", "world"]);
    expect(composition.section("world").sectionId).toBe("world");
  });

  it("fails at composition time on a duplicate section, not mid-match", () => {
    expect(() => composeProviders({ perception: stubPerception(), routes: stubRoutes(), sections: [stubSection("world"), stubSection("world")] })).toThrow(ProviderError);
    try {
      composeProviders({ perception: stubPerception(), routes: stubRoutes(), sections: [stubSection("world"), stubSection("world")] });
    } catch (e) {
      expect((e as ProviderError).code).toBe("DuplicateSection");
    }
  });

  it("names what is registered when an unknown section is asked for", () => {
    expect(() => composed().section("nope")).toThrow(/UnknownSection: nope; registered: random, world/u);
  });

  it("describes every registered section for the persistence layer", () => {
    const described = composed().describeSections();
    expect(described.map((d) => d.sectionId)).toEqual(["random", "world"]);
    expect(described[0]?.byteLength).toBe(3);
  });
});
