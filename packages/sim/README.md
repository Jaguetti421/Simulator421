# @lastclan/sim

The authoritative simulation of The Last Clan. Owns consequential state at 10 Hz with integer units, explicit remainders, stable order and versioned random streams (AGENTS.md, CONVENTIONS.md, TP v2.0 §2–§4; TP v1.1 for every section v2.0 does not override).

**Boundary (enforced by `eslint.config.js` and `tests/arch/boundaries.test.ts`):** this package imports nothing from `three`, `react`, the DOM, timers, the wall clock, Node built-ins or `apps/web`. Its `tsconfig.json` has no DOM lib and no ambient Node types, so DOM and Node usage is also a type error. Render-only floats live in `apps/web`, never here.

Planned sub-modules (each arrives with its own packet; none exists yet):

| Directory | Kit module | Packet |
| --- | --- | --- |
| `primitives/` | Sim.Primitives — checked integer math, units, rounding, serialization, PRNG, hashing | W0-02, W0-03 |
| `contracts/` | Sim.Contracts — command/ack/event/snapshot records, codecs, reason registry | W0-04 |
| `core/` | Sim.Core — tick transaction, actions, laws, combat | W0-07 onward |
| `spatial/` | Sim.Spatial | P1 |
| `ai/` | Sim.AI — evidence-limited decisions | P1 |
| `story/` | Sim.Story — guest framework | P5 |
| `observer/` | Observer read models | P1/P2 |
| `persistence/` | Persistence core — section container, codecs | W0-08 |
| `host/` | Sim.Host — composition root for Worker and Node | W0-07 |

Status: **skeleton only (W0-01)**. `index.ts` exports a package name constant so the project compiles.
