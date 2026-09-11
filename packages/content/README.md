# @lastclan/content

Content definitions and the build-time compiler that turns them into immutable catalogs (TP v1.1 §12; TP v2.0 §12 amends only the tooling).

- `definitions/` — many small versioned JSON files (CONVENTIONS.md). Empty at W0-01.
- Compiler, validators and catalogs arrive with the content packets (P1 onward).

**Boundary:** no `three`, `react`, DOM or `apps/web` imports; no `Math.random`. The compiler may use Node built-ins (it runs at build time).

Status: **skeleton only (W0-01)**.
