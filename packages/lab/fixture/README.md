# packages/lab/fixture — fixture DSL v1

Parses and validates fixtures. **It never constructs a world**: running them is `clanlab run` (W0-06).

| File | Holds |
| --- | --- |
| `envelope.ts` | the fixture envelope declared with the W0-04 contract DSL — mirrors `contracts/fixture.schema.json` |
| `semantics.ts` | the rules JSON Schema cannot express: profile rosters (Addendum D07), the 600-tick notice, duplicates, law intervals, region geometry, fact provenance, hash-variant range |
| `assertions.ts` | the registry: `EventCountGte`, `EventCountEq`, `Invariant`, `HashEqualVariant`; registration, evaluation and statuses |
| `parse.ts` | the ordered pipeline: size → JSON → schema version → assertion registration → envelope → semantics |
| `errors.ts` | typed error codes, tool limits, the notice constant |

## Why the envelope is re-declared

`contracts/fixture.schema.json` is the supplied authority, but running JSON Schema inside the tool would mean a runtime dependency and untyped errors. The envelope is re-declared with the contract DSL, and `tests/fixtures/conformance.test.ts` keeps the two honest: every case is run through **both** ajv (the supplied schema) and this parser, and they must agree on the structural verdict. Cases the parser refuses semantically must be *accepted* by ajv, so a semantic rule can never quietly claim schema-level backing.

## Statuses that cannot be mistaken for a pass

- **skipped check** — could not be run here. Item, goal and profile-override IDs need a compiled catalog; each skip names the packet that will make it runnable.
- **Blocked assertion** — known and well formed, but needs a running simulation (`Invariant` → W0-07, `HashEqualVariant` → W0-08). `clanlab validate` reports every assertion as Blocked, because validation does not run anything.
- **UnsupportedAssertion** — an unknown kind, invariant name or hash variant. Never a silent skip.
- An `EventCountGte` with no matching events **fails**. The minimum of 1 exists so a vacuous match cannot prove a behaviour.

## CLI

```
clanlab validate --fixture <path|directory>... [--summary <path>]
```
Exit 0 when every fixture is valid, 1 when any is invalid or unreadable, 2 on a usage error. Blocked assertions never affect the exit code, because validate does not claim to have run them.
