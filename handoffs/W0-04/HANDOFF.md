# Handoff — W0-04 / attempt 1

Status: **READY_FOR_REVIEW**.
Base ID / Git commit / contract / content: base `dedfa6a` (W0-03 ACCEPTED). **Contract version 0 is frozen by this packet** (`contracts/registry.json`); no content.
Goal and implemented behavior: the shared interface contract of INTERFACES.md as 16 immutable, closed record types with JSON Schemas, canonical codecs, 25 golden samples and the v0 reason registry; plus the compile-time dependency direction inside `packages/sim` as enforced lint.

Design centre: a record is **declared once** in a small typed DSL (`packages/sim/contracts/schema.ts`). From that one declaration come the TypeScript type (`Infer<typeof Shape>`), the runtime validator, the JSON Schema (draft 2020-12) and the canonical JSON codec. Hand-writing a type *and* a schema would have let them drift; here there is nothing to keep in sync.

Changed files and purpose:
- `packages/sim/contracts/{schema,ids,reasons,commands,simulation,views,ports,index}.ts` + `README.md` — the contract.
- `packages/sim/contracts/schemas/*.schema.json` (16) — emitted schemas.
- `contracts/registry.json` — reason registry, contract version, change procedure, per-record schema hashes.
- `contracts/samples/` — 12 canonical valid samples (generated), 13 hand-written rejection/unknown-version samples, and `index.json` naming what each must do and **which layer** enforces it.
- `tools/gen_contract_artifacts.mjs` — regenerates schemas, registry and valid samples.
- `packages/sim/contracts/{schema,contracts}.test.ts` (44), `tests/contracts/samples.test.ts` (29), `tests/arch/boundaries.test.ts` extended (44 → 80).
- `eslint.config.js` — intra-sim dependency direction; `packages/sim/index.ts` namespaces the contracts export; `tests/tsconfig.json` references the sim project; dev dependency `ajv` 8.20.0.

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. Golden samples validate against the schemas and round-trip through the codecs; rejection and unknown-version samples are rejected | `tests/contracts/samples.test.ts`: each of the 12 accepted samples is validated by **ajv against the emitted JSON Schema** (an independent validator, not our own opinion of our schema), then by the contract validator, then decoded and re-encoded — the bytes on disk must equal the canonical form exactly. All 13 rejection samples are refused by the contract validator and by `decodeJson`; the two unknown-version samples (schemaVersion 1 and 2) are refused by the schema itself. The manifest records `enforcedBy: schema` vs `refinement` and the test asserts *both directions*, so a refinement rule cannot quietly claim schema-level coverage | PASS |
| 2. The architecture test proves ai/ cannot import core/ implementation and nothing in packages/sim imports rendering or DOM | `tests/arch/boundaries.test.ts` (80 cases): 8 ways for `ai` to reach core/spatial/observer/persistence/host/story all rejected (including the `@lastclan/sim/core` package subpath and a deep path), 3 allowed imports accepted, the same direction enforced inside `ai` **tests**; 10 more pairs cover the rest of the INTERFACES table; and every sim module still rejects `three`, `node:fs`, DOM types, `window`, `Date.now`, `Math.random` and float literals | PASS |
| 3. The reason registry contains at least the mandatory v0 IDs, each with player text and required debug fields; contract version and change procedure are recorded in `contracts/registry.json` | `packages/sim/contracts/contracts.test.ts` asserts all 13 IDs from INTERFACES.md verbatim, unique stable codes, a `reason.*` text key, English text and ≥1 required debug field each, and that the checked-in `registry.json` matches the implemented definitions field by field. `registry.json` carries `contractVersion: 0`, `frozenAt: "W0-04"` and a five-step change procedure | PASS |

Commands actually executed: `npm run verify` → 0 (`evidence/verify.txt`: build 0, lint 0, **233/233** vitest across 10 files, 6/6 python, workboard PASS). `node tools/gen_contract_artifacts.mjs` → 16 schemas, 13 reasons, 12 samples. Mutation checks (`evidence/mutation-checks.txt`): allowing `ai → core` in the direction table → 4 arch failures; removing the accepted-ack refinement → 2 failures; making records open → 5 failures; all restored green.

Two things the boundary caught during the work, both worth recording:
1. The DSL's union type was originally named `Node`, which is on the banned DOM-type list. Lint refused it. The type was renamed `SchemaNode` — the rule was not touched.
2. Adding the direction rules as a *second* ESLint block for `no-restricted-imports` silently replaced the purity rules for the same files (verified with a probe: `node:fs` in `packages/sim/primitives` stopped erroring). The blocks are now composed into one rule per module, and the test asserts both sets fire together. That failure mode is exactly what an unrun assumption looks like.

Pre-existing baseline failures: none (124/124 at base).

Design decisions within scope:
- **Payload fields stay open at v0.** `PlayerCommand.payload` and `CommittedEvent.payload` carry `kind` + `version` + a fields object frozen later per operation/event. Inventing law or event fields now would be design work this packet does not own; INTERFACES.md explicitly freezes provider contracts incrementally.
- **Records are closed.** An unknown field is a validation error, so a client cannot smuggle `assignedTick` into a command (a rejection sample covers exactly that).
- **Refinements are annotations in JSON Schema, not silent extras.** `x-refinements` lists the rule text; the sample manifest says which rejections ajv alone catches and which need the contract validator. The test asserts refinement-marked samples *are* accepted by ajv, so the split stays honest.
- **Contracts are namespaced in the package entry** (`export * as contracts`), because several schema builders share names with primitive unit constructors (`int`, `milli`, `mm`).
- `tests/contracts/samples.test.ts` lives in the repo-level tests project rather than under `packages/sim`, because it needs the filesystem and ajv, and `packages/sim` deliberately compiles with no Node types. That keeps sim pure while still checking the artifacts on disk. The card's listed test paths are additive, not exclusive.

Contract proposals / deferred: the typed lint rule against bare arithmetic on branded `Int` (CONVENTIONS.md) is **still deferred** — it needs type-aware linting and a custom rule, and doing it inside this already-M packet would have been scope creep. It belongs with **W0-07**, where consequential arithmetic first appears; recorded in STATUS so it does not get lost. `IStateSectionCodec` is a TypeScript interface only: its first real implementation and round-trip tests are W0-08.

Remaining risks: the canonical encoder relies on JavaScript object key iteration order only through the *declaration* list, not the input object, so it is stable; but any future record with numeric-like keys should be checked. Payload `fields` being an empty closed object at v0 means samples cannot carry realistic payload content yet — intentional, and the first operation packet will extend both schema and samples.

Next action: review, then W0-05 (fixture DSL and `clanlab validate`).
