# packages/sim/primitives

Kit module **Sim.Primitives** (CONVENTIONS.md path map). Platform base library only; imports nothing from any other project module.

| File | Provides | Spec |
| --- | --- | --- |
| `int.ts` | branded `Int`, `asInt`/`int`/`isInt`, `IntegerError` with stable reason codes | TP v2.0 §4 |
| `checkedMath.ts` | `add sub mul neg abs divFloor divCeil modFloor mulDiv isqrt min max clamp`; every result asserted safe; `mulDiv` exact without intermediate overflow (no BigInt) | TP v2.0 §4; TP v1.1 §4 |
| `units.ts` | `Ticks` (10 Hz), `Mm`, `Milli` constructors that reject non-integers/negative ticks; conversions; `actionDurationTicks` = ceil after the single skill modifier | GDD 30.1–30.2; Addendum D02 |
| `rate.ts` | `Rate` = numerator / denominator ticks; `advance` releases floor amounts and keeps the remainder in saved state | TP v1.1 §4 ("0.1 HP per tick must accumulate"); D02 |
| `serialize.ts` | `ByteWriter`/`ByteReader` (little-endian, `int53` without BigInt), versioned `writeSection`/`readSection`, `encodeRateState`/`decodeRateState` (format v1) | CONVENTIONS.md |

Rules: no floats, no `Math.random/sin/cos/sqrt`, no `Date` (lint-enforced). Bare arithmetic is legitimate only inside `checkedMath.ts`; the typed lint rule that bans it elsewhere on `Int` values is scheduled for W0-04.

Deferred: PRNG (sfc32), stream derivation and canonical hashing — W0-03. Vectors and angle tables — the spatial packets.
