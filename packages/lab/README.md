# @lastclan/lab — `clanlab`

The simulation laboratory CLI (TP v2.0 §2, §19; TP v1.1 §19). Runs in Node, uses the same `@lastclan/sim` bytes as the browser Worker.

Commands (all **stubs** at W0-01 — each reports `NOT_IMPLEMENTED` and the packet that implements it, and never claims a PASS):

| Command | Implemented by |
| --- | --- |
| `clanlab validate <fixture...>` | W0-05 (fixture DSL parser and semantic validation) |
| `clanlab run <fixture...>` | W0-06 (run, summaries, failure bundles) |
| `clanlab render <snapshot>` | W0-09 (readability renderer) |

`clanlab --help` / `clanlab --version` work. Unknown commands exit 2; stubbed commands exit 3 (`NOT_IMPLEMENTED`), so no CI step can mistake a stub for a passing fixture run.

**Boundary:** no `three`, `react`, DOM or `apps/web` imports; `Math.random` is banned (CONVENTIONS.md). Node built-ins and node-canvas are allowed.

Status: **skeleton only (W0-01)**.
