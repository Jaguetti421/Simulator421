# Handoff — W0-05 / attempt 1

Status: **READY_FOR_REVIEW**.
Base ID / Git commit / contract / content: base `1a3d478` (W0-04 ACCEPTED). Contract version 0; fixture DSL version 1; no content catalog yet.
Goal and implemented behavior: the fixture envelope, semantic validation, catalog profiles and the assertion registry — plus `clanlab validate`, which is now a real command. Parsing is strictly ordered (size → JSON → schema version → assertion registration → envelope → semantics) and **constructs no world**.

Changed files and purpose:
- `packages/lab/fixture/{envelope,semantics,assertions,parse,errors,index}.ts` + `README.md` — the fixture DSL.
- `packages/lab/fixture/{parse,assertions,semantics}.test.ts` (53 tests) and `tests/fixtures/conformance.test.ts` (22) — verification.
- `tests/fixtures/examples/*.json` — the three supplied examples, byte-identical copies (a test asserts that).
- `packages/lab/cli/{validate.ts,run.ts}` — `clanlab validate --fixture <path|dir> [--summary <path>]`; `packages/lab/cli/run.test.ts` updated because `validate` no longer reports NOT_IMPLEMENTED.
- `packages/sim/contracts/schema.ts` — DSL gained an open **map** node (`mapOf`) for the inventory, a `const` option for booleans, and unknown-field errors now point at the field rather than its parent object. Regenerating the contract artifacts produced **no diff**, so contract v0 is unchanged.
- `.github/workflows/ci.yml` — the fixture step lost its `continue-on-error`; `npm run fixtures` now really validates the three examples. `packages/lab/package.json` declares its `@lastclan/sim` dependency.

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. Unknown versions, fields, units, IDs and assertion kinds are rejected with typed errors before any world is constructed | `parse.test.ts`: unknown schemaVersion (5 forms) → `UnknownSchemaVersion` alone, never a cascade of field errors; unknown top-level and nested fields → `StructureInvalid` with the field's own path; vitals outside 0–100000 and non-integers; malformed actor IDs, fixture IDs, seeds, maxTicks; five unknown-assertion forms → `UnsupportedAssertion` with the exact path; malformed JSON and oversized input as typed errors. `parse.ts` has no world construction of any kind — assertion registration runs *before* the envelope, so an unknown kind never degrades into a union mismatch | PASS |
| 2. Setup-only state is separated from validated player commands; a runtime law without 600 ticks of notice is rejected by the real validator path | `parse.test.ts`: a precommitted law may start at tick 0, a scheduled command may not (the envelope pins `atTick >= 1`, and `validateSemantics` carries the same rule as `SetupOnlyInSchedule` for callers that bypass it); notice of 599 with `expectAck: Accepted` → `NoticeTooShort`, exactly 600 accepted; the same short notice **is** allowed when the fixture expects a rejection and names a registered reason — which is how a rejection test submits through the real validator; missing, unknown or pointless `expectedReasonId` all refused | PASS |
| 3. The three example fixtures parse; an EventCountGte with no matching events fails rather than passing empty | `parse.test.ts` parses all three supplied examples (and `conformance.test.ts` confirms the checked-in copies are byte-identical to `contracts/examples`); `assertions.test.ts`: zero matches → **Failed** with the observed count and "no assertion passes on an empty match"; near-miss matches (wrong actor, wrong reason, out-of-range tick) also fail; `EventCountEq` can assert an explicit absence and fails when the thing happened | PASS |

Commands actually executed: `npm run verify` → 0 (`evidence/verify.txt`: build 0, lint 0, **303/303** vitest across 14 files, 6/6 python, workboard PASS). `clanlab validate --fixture contracts/examples` → exit 0, 3 valid, 0 invalid, 4 skipped checks, 6 blocked assertions (`evidence/validate-summary.json`). Mutation checks (`evidence/mutation-checks.txt`): making `EventCountGte` pass on an empty match → 4 failures; silently skipping unknown assertion kinds → 2; dropping the 600-tick notice rule → 1; accepting unknown schema versions → 1; all restored green.

**Two corrections the work forced, both worth recording:**
1. I had written a semantic rule that a law starting at or after `maxTicks` "could never take effect". It rejected the kit's own `LAW-NOTICE-REJECTION` example, whose whole point is a law that never takes effect. FIXTURE_DSL.md enumerates the semantic law checks and that is not among them — I had invented it. The rule was deleted (a test now asserts its absence), not worked around.
2. The conformance test caught me claiming that "a scheduled command at tick 0" was a semantic-only rule. The supplied schema pins `atTick >= 1`, so it is structural. The envelope now mirrors the supplied minimums for `atTick` and `sequence`, and the claim moved to the structural list.

Pre-existing baseline failures: none (233/233 at base).

Design decisions within scope:
- **Re-declared envelope + conformance cross-check** rather than running JSON Schema inside the tool: typed errors with paths, no runtime dependency, and ajv-against-the-supplied-schema keeps the declaration honest in both directions.
- **Skipped ≠ passed.** Content-catalog checks (item, goal, profile-override IDs) cannot run before a catalog exists, so they are reported as `ContentCatalogUnavailable` skips naming the packet that will make them runnable; supply a catalog and the same checks run for real (tested).
- **Blocked ≠ passed.** `Invariant` and `HashEqualVariant` evaluate to Blocked with the packet that will make them evaluable; `evaluateAssertion` with no event list returns Blocked rather than trivially satisfied, so validation can never look like a run.
- Wildlife (`Wxxx`) and the guest (`G001`) are excluded from the contestant count, per Addendum D07; the count must also match what the setup actually declares.

Contract proposals / deferred: `clanlab run`, failure bundles and summaries → W0-06 (the CLI's `run` still reports NOT_IMPLEMENTED with exit 3). Real content validation of item/goal/override IDs → the content packets; the plumbing (`catalog` option) is in place and tested. The typed lint rule against bare arithmetic on branded `Int` remains queued for W0-07.

Remaining risks: the fixture envelope duplicates the supplied schema, so drift is possible in principle — the conformance test is the guard, and it has already caught one real divergence. `parseFixtureText` counts input bytes as `text.length` when the caller gives no byte count, which is a character count rather than a UTF-8 byte count; fixtures are ASCII in practice and the CLI passes the real size from `statSync`.

Next action: review, then W0-06 (fixture runner, summaries and failure bundles).
