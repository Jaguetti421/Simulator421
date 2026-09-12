# @lastclan/lab — `clanlab`

The simulation laboratory CLI (TP v2.0 §2, §19; TP v1.1 §19). Runs in Node, uses the same `@lastclan/sim` bytes as the browser Worker.

| Command | State |
| --- | --- |
| `clanlab validate --fixture <path\|dir> [--summary <path>]` | **implemented** (W0-05) — parses and semantically validates fixtures; constructs no world |
| `clanlab run --fixture <path\|dir> [--events <tape>] [--summary <path>] [--evidence <dir>]` | **implemented** (W0-06) — judges assertions against a declared host, writes summaries, bounded logs and failure bundles |
| `clanlab inspect --failure <dir>` | **implemented** (W0-06) — reopens a failure bundle and checks it against its own recorded hashes |
| `clanlab batch` / `clanlab replay` / `clanlab render` | stubs; each exits 3 (`NOT_IMPLEMENTED`) naming its packet |

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | every requested supported check passed, and nothing was blocked |
| 1 | failed: an assertion failed, a fixture was invalid or unreadable, a tape was unusable, or a bundle is inconsistent with itself |
| 2 | usage error |
| 3 | the command is planned but its packet has not shipped |
| 4 | blocked: nothing failed, and at least one requested check could not be evaluated by this build |

Blocked is nonzero on purpose (`contracts/FIXTURE_DSL.md`: nonzero means failed, blocked or invalid). A build that cannot evaluate a check may not exit 0 as though it had.

## Hosts

`run` is the harness; the events it judges come from a host, and at W0-06 there is still no simulation.

- **none** (default) — simulates nothing, produces no event stream, so every assertion is Blocked and the run exits 4.
- **tape** (`--events <file>`) — committed events read from a declared file. Every event is validated against the frozen `CommittedEvent` contract (W0-04); the tape must declare `source` and `producedBy`, may declare `fixtureId`, and its ticks and sequences must be monotonic and inside the fixture's `maxTicks`.

Both hosts are watermarked `FakeSim` with `gateEligible: false`: a tape run proves the harness and the assertions, never the game. A fixture's own `expectAck` is never turned into an event — deriving the outcome from the expectation would confirm it with itself.

**Known contract gap:** `CommittedEvent` at contract v0 carries no `reasonId` and its payload fields are closed, so an assertion matching on `reasonId` is reported **Blocked** (naming P1-12), never Failed. Reporting it as a failure would blame the game for a gap in the contract.

## Event tape format

```json
{
  "tapeVersion": 1,
  "source": "where these events came from",
  "producedBy": "the build, kernel version or person that produced them",
  "fixtureId": "OPTIONAL-FIXTURE-ID",
  "events": [ /* CommittedEvent records, contract v0 */ ]
}
```

## Failure bundles

A failing or invalid run writes `<evidence>/<fixture>/bundle/` containing `bundle.json`, plus copies of the fixture, the tape, the run log and the run summary. `bundle.json` records the identity of the code that produced it, the counts, the failing assertions with the tick they were judged at and the events that nearly matched, and the command that reproduces the run. Its `verdictDigest` covers the inputs and the verdict but not the timestamp or the paths, so the same failure produces the same digest twice — `clanlab inspect` recomputes it and reports whether the bundle is internally consistent.

**Boundary:** no `three`, `react`, DOM or `apps/web` imports; `Math.random` is banned (CONVENTIONS.md). Node built-ins and node-canvas are allowed.

Status: fixture DSL, runner, hosts, bundles and inspect shipped (W0-05, W0-06). No simulation yet — the tick kernel is W0-07.
