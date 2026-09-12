# packages/sim/primitives

Kit module **Sim.Primitives** (CONVENTIONS.md path map). Platform base library only; imports nothing from any other project module.

| File | Provides | Spec |
| --- | --- | --- |
| `int.ts` | branded `Int`, `asInt`/`int`/`isInt`, `IntegerError` with stable reason codes | TP v2.0 §4 |
| `checkedMath.ts` | `add sub mul neg abs divFloor divCeil modFloor mulDiv isqrt min max clamp`; every result asserted safe; `mulDiv` exact without intermediate overflow (no BigInt) | TP v2.0 §4; TP v1.1 §4 |
| `units.ts` | `Ticks` (10 Hz), `Mm`, `Milli` constructors that reject non-integers/negative ticks; conversions; `actionDurationTicks` = ceil after the single skill modifier | GDD 30.1–30.2; Addendum D02 |
| `rate.ts` | `Rate` = numerator / denominator ticks; `advance` releases floor amounts and keeps the remainder in saved state | TP v1.1 §4 ("0.1 HP per tick must accumulate"); D02 |
| `serialize.ts` | `ByteWriter`/`ByteReader` (little-endian, `int53` without BigInt), versioned `writeSection`/`readSection`, `encodeRateState`/`decodeRateState` (format v1) | CONVENTIONS.md |
| `random.ts` | sfc32 `RandomStream` (uint32 output, no floats), splitmix32 labeled stream derivation from (matchSeed, ASCII label), unbiased `nextBelow`/`nextRange`/`nextChanceMilli`, snapshot + versioned byte state | TP v2.0 §4; TP v1.1 §4 |
| `hash.ts` | FNV-1a/32 with two separated domains (authoritative, observer), `HashAccumulator` folding keyed digests in canonical key order | TP v2.0 §4; TP v1.1 §15 |
| `vectors/random-v1.json` | pinned vectors: algorithm, output rule, seeding rule, warm-up count, byte order, splitmix32, sfc32 steps (cross-checked against `@thi.ng/random` SFC32), 28 derived streams, hash cases. Regenerate with `node tools/gen_random_vectors.mjs` — a changed rule needs a new rule string and regenerated vectors | W0-03 |

Rules: no floats, no `Math.random/sin/cos/sqrt`, no `Date` (lint-enforced). Bare arithmetic is legitimate only inside `checkedMath.ts`; the typed lint rule that bans it elsewhere on `Int` values is scheduled for W0-04.

Deferred: typed lint rule against bare arithmetic on `Int` — W0-04. Shuffle / weighted choice helpers — the packet that first needs them. Vectors and angle tables — the spatial packets. Cross-runtime (browser Worker vs Node) equality of derived streams — W0-07/W0-10.
