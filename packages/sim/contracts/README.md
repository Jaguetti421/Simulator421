# packages/sim/contracts — design version 0

Kit module **Sim.Contracts** (CONVENTIONS.md path map). Frozen at W0-04. May import `packages/sim/primitives` and nothing else in the simulation; lint and `tests/arch/boundaries.test.ts` enforce that.

## One declaration, four artifacts

A record is declared once with the DSL in `schema.ts`. From that one declaration come the TypeScript type (`Infer<typeof Shape>`), the runtime validator (`validate`), the JSON Schema (`toJsonSchema`, draft 2020-12) and the canonical JSON codec (`encodeJson`/`decodeJson`). They cannot drift apart, because there is nothing to keep in sync.

| File | Holds |
| --- | --- |
| `schema.ts` | the DSL, validation with JSON-pointer paths, refinements, canonical codec, JSON Schema emitter |
| `ids.ts` | actor/durable/hash ID patterns, tick, sequence, version, milli, mm |
| `reasons.ts` | the reason registry: 13 mandatory v0 IDs, each with a stable code, player text and required debug fields |
| `commands.ts` | `PlayerCommand`, `CommandAck`, `JournaledCommand` |
| `simulation.ts` | `ActionRequest/Result`, `ActorKnowledgeView`, `EvidenceRecord`, `RouteRequest/Result`, `DamageProposal`, `DecisionTrace`, `CommittedEvent`, `EventRange` |
| `views.ts` | `RenderSnapshot` (+ transform layout and small views), `StateSectionDescriptor`, `ContentProfile`, `FinalResult` |
| `ports.ts` | `IPerceptionQuery`, `IRouteQuery`, `IStateSectionCodec` — query surfaces, never mutable world access |
| `schemas/*.schema.json` | emitted JSON Schemas (generated; do not hand-edit) |

Generated artifacts: `node tools/gen_contract_artifacts.mjs` rewrites `schemas/`, `contracts/registry.json` and the `*.valid.json` samples. `contracts/samples/index.json` lists every sample with what it must do and which layer enforces it.

## Refinements

Cross-field invariants that JSON Schema cannot express live in `refine(...)` and appear in the emitted schema as `x-refinements` annotations. They carry the rules that matter most: an accepted ack has a tick and no reason; a rejected one has a reason and no tick; `BudgetExhausted` cannot return a path; `Partial` must certify a nearer portal and a progress measure; a decision chooses a candidate it actually evaluated; damage has exactly one source; a match has at most one winner.

## Extension points left open on purpose

Operation and event payload *fields* are frozen per operation/event by the packet that implements it (`payload.kind` + `payload.version`). v0 freezes the envelope, not invented game fields.
