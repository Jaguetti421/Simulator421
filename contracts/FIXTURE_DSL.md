> **Web build note (v2.0):** paths and stack terms map per CONVENTIONS.md (C# assemblies → TypeScript packages; SQLite → IndexedDB; Godot capture → `/capture` under Playwright; `clanlab` is a Node CLI). Semantics are unchanged.

# Fixture DSL v1 — executable contract to implement

The supplied JSON schema and three examples are structurally validated planning assets. ClanLab does not exist yet. SCHEMA_EXAMPLE_UNEXECUTED is mandatory until real implementation runs. No golden state hash or passing result is invented here. P0-05 implements parsing; later packets add real action/assertion adapters. Unsupported assertions fail as UnsupportedAssertion, never silently skip.

## Envelope and semantic validation

schemaVersion is pinned. Reject unknown fields, versions, IDs, units, duplicate actors/sequences and unreasonable allocation sizes. Use a bounded 2 MiB fixture input, 200 setup actors including wildlife/guest, 10,000 scheduled commands and 1,000 assertions as initial tool limits; profile limits remain stricter. Report typed errors before constructing a partial world. The schema describes the first ScheduleLaw command only; extend via versioned oneOf payload definitions for other commands before implementing their fixtures.

Tick zero is setup state. setup.precommittedLaws models already announced scenario rules and may begin at zero; it is not a player command bypass. schedule entries enter the ordinary validator at atTick >= 1. A runtime Standard/Trial paid law needs >=600 ticks of notice, valid duration/Influence/overlap and the proper latest-start boundary. An expected rejection still submits through the real validator. Every scheduled command must emit the expected acknowledgement; explicit expectedReasonId is required when a rejection is intended.

All vitalsMilli use thousandths of displayed values: fullness 85000 means 85/100, not 85000 HP or a hunger penalty. positionMm is [x,y,z] in millimeters. Inventory values are nonnegative counts. Unknown item/goal/profile override IDs fail content validation. Actor count must match declared contestantCount after excluding Wxxx and G001. Prototype8/Trial24/Standard100 enforce 8/24/100 contestants; arbitrary smaller rosters use Fixture. Fixtures never write production careers; result-store tests use an isolated disposable profile.

Profile overrides and initial goals exist only in declared test content. The compiler resolves actual map resources, targets and preconditions. Initial known facts must refer to valid authored setup evidence; they cannot become a backdoor for production AI omniscience. Law end must exceed start, region powers require legal region geometry, and event match intervals must be ordered. Hash variant start plus advance must be <= maxTicks. These are semantic checks in addition to JSON schema.

## Assertion semantics

| Kind | Evaluation |
| --- | --- |
| EventCountGte | Match actual committed events by typed fields and tick range; minimum >=1 prevents vacuous proof of a behavior. |
| EventCountEq | Assert an exact count, including zero for an explicit absence condition. Pair a positive observation where needed to prove the fixture actually exercised its setup. |
| Invariant | Evaluate registered production-state/effect invariants over every completed tick, with failure evidence. NoIllegalEffects allows legal preflight rejection but prohibits unauthorized committed effects. |
| HashEqualVariant | Run baseline and the named perturbed continuation from identical setup; compare canonical subsystem and aggregate hashes over the specified interval, not only final survivor count. |

No generic “all matching events are valid” assertion may claim a behavior happened when there were no events. Unknown event types and reasons fail registration. Stage order and action permissions come from the production host, not fixture-specific gameplay. Bootstrap synthetic hosts declare unsupported systems explicitly.

## CLI contract

P0 creates scripts or documented dotnet entry points implementing these conceptual commands:

```text
clanlab validate --fixture <path> --summary <json>
clanlab run --fixture <path> --summary <json> --evidence <directory>
clanlab batch --profile Standard100 --seeds <file> --summary <json>
clanlab replay --bundle <path> --compare-hashes --summary <json>
clanlab inspect --failure <directory>
```

Exit 0 means every requested supported check passed; nonzero means failed, blocked or invalid. Summary includes build/contract/content/geometry identity, actual profile, seed, requested/executed/failed/skipped/blocked counts, final tick, outcome, checksum paths, counters and evidence paths. Logs stay in bounded files. Unsupported hardware tests report BLOCKED_RENDER/HUMAN_REQUIRED, never exit 0 as if passed.

The Godot client uses a real rendered capture entry point, for example `--capture-fixture <path> --tick 1200 --camera camp-wide --text-scale 1.5 --output <png>`. Exact executable flags are frozen in P0-09 and recorded by build scripts. Import, confirmed snapshot, warm-up frames and write completion are required. Godot headless simulation alone does not prove a PNG was rendered.

## Regression registry beyond the 51 GDD scenes

P0/P1 define SAVE-ROUNDTRIP, SAVE-FREQUENCY, WHY-TRACE, BRIDGE-OWNERSHIP, INFO-ISOLATION, ROUTE-PROGRESS and PERF-OPS-BASE. P2/P3 add membership/schedule boundary matrices, Custom command refusal, scenario provenance and full-population traffic. P4 adds THREAD-FACTS, SAGA-ESCAPE and IDENTITY-100. P6 adds DSL-FUZZ, ARCH-BOUNDARIES, CRASH-RECOVERY and CLEAN-PC-OFFLINE. A7 owns adapters and evidence; game owners implement necessary behavior. Refer to GDD_TRACEABILITY.md for exact gate homes.


## Addendum — fixture DSL v2 (12 September 2026)

Five registry fixtures state claims that v1's assertion kinds cannot express:
PRESENT-READ-01 (nameplate overlap, ring contrast, icon distinctness),
INFO-ISOLATION (decision code cannot reach world state), ROUTE-PROGRESS
(a repeated partial route advances or recovers), and the sight and boundary
claims behind them. Before this addendum those fixtures either carried
assertions about something else or carried none, and the claim lived only in a
unit test — invisible to the harness that is supposed to run the registry.

v2 adds one assertion kind:

```json
{ "kind": "ToolCheck", "check": "<registered check>", "expect": "Pass" }
```

- `check` comes from a closed registry (`TOOL_CHECKS` in the envelope), exactly
  as invariant names do. An unregistered check fails registration.
- `expect` is `Pass` or `Fail`. `Fail` lets a fixture pin a known defect.
- A **provider** performs the check. `clanlab render` performs the three
  readability checks today; `clanlab run` reports every ToolCheck as **Blocked**
  and names the provider that would run it. A check with no provider is Blocked,
  never Passed — the rule the rest of this document already applies.

v1 fixtures are unchanged and still parse. `schemaVersion` is now `1` or `2`;
anything else is refused as before. The supplied `contracts/fixture.schema.json`
carries the same addendum so the conformance check still compares the parser
against a schema, not against itself.
