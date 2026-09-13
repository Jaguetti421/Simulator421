# Handoff — DEBT-02 (producer-directed) / attempt 1

Status: **READY_FOR_REVIEW**. Producer instruction, 12 September 2026: "Fix debt that you can and report if you need another agent's help."
Base: `cb8dedf` (P1-04 READY_FOR_REVIEW) → `416cc06`. Contract v0 unchanged; **fixture DSL v1 → v2**.

## What was closed

**Five registry fixtures could not state their own claims.** PRESENT-READ-01, INFO-ISOLATION, ROUTE-PROGRESS and the sight and boundary claims behind them assert things no `EventCount*`, `Invariant` or `HashEqualVariant` can express, so each one either carried assertions about something else or carried none — and the real claim lived in a unit test, invisible to the harness that is supposed to run the registry. Four packets reported this and deferred it; I called it a scheduled packet last turn. It is done.

**Fixture DSL v2** adds one assertion kind:

```json
{ "kind": "ToolCheck", "check": "<registered check>", "expect": "Pass" }
```

- `check` comes from a closed registry, exactly as invariant names do — an unregistered check fails registration.
- `expect` is `Pass` or `Fail`, so a fixture can pin a known defect rather than only assert health.
- A **provider** performs the check. `clanlab render` performs the three readability checks today; `clanlab run` reports every ToolCheck as **Blocked** and names the provider that would run it. A check with no provider is Blocked, never Passed.
- **v1 fixtures are untouched and still parse.** `schemaVersion` is now 1 or 2; 3 and anything else is refused exactly as before.

| Evidence | Result |
| --- | --- |
| `evidence/dsl-v2.txt` — `clanlab render` on PRESENT-READ-01 (now v2) | exit 0; the three stated checks report `Passed` with `expect=Pass observed=Pass` |
| `evidence/dsl-v2.txt` — `clanlab run --host kernel` on the same fixture | exit 4; each ToolCheck **Blocked**, naming `clanlab render` as its provider |
| `evidence/dsl-v2.txt` — the three supplied v1 examples and SAVE-ROUNDTRIP | exit 0 — v1 unchanged |
| `evidence/verify.txt` | `npm run verify` → **0**: build, lint, **570/570** vitest across 35 files, 6 python, workboard PASS |

Changed: `packages/lab/fixture/envelope.ts` (kind, `TOOL_CHECKS` registry, version range), `parse.ts` (supported versions), `assertions.ts` (union narrowing), `packages/lab/cli/runner.ts` (Blocked + `TOOL_CHECK_PROVIDERS`), `packages/lab/render/command.ts` (performs the readability checks, exit code reflects them), `contracts/fixture.schema.json` and `contracts/FIXTURE_DSL.md` (the same addendum, so the conformance check still compares the parser against a schema rather than against itself), `tools/gen_present_read_01.mjs` + the regenerated fixture, and five tests updated where they used v2 as their "unknown version" case.

## What I could not fix, and what needs someone else

1. **Fresh-context reviews — needs another session or another agent.** Ten of eleven W0 reviews, and every P1 review, were written in the same session as the code. A fresh-context review cannot be produced from inside this session by definition. **This is the one place where another agent would genuinely help**: hand a new session (or a second model) the diff and the handoff for W0-06 … P1-04 with no other context, and have it write REVIEW.md files independently. I would rather that happen before G1 than after.
2. **The two G0 human checks** — visual judgement of the eight identities, and GPU frame timing on real hardware. Only Jani can supply them.
3. **The typed lint rule for bare `Int` arithmetic.** Still undelivered after three deferrals. It needs a type-aware custom ESLint rule; I have measured the remaining gap precisely (only expressions consumed as a plain `number`) but writing the rule well is a packet, not a patch, and I would rather say so than half-build it again.
4. **Providers for the other three registered checks** — `DecisionContextHasNoWorldHandle`, `RouteProgressAdvancesOrRecovers`, `SightIgnoresUnobservedTerrain` — are named but not wired to a CLI tool; their claims still live in unit tests. The DSL can now *state* them, which is the part that was blocking; wiring a provider is ordinary work for the packet that owns each area.

Reviewer request: reproduce the evidence and record findings in REVIEW.md.
