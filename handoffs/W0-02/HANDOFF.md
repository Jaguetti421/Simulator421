# Handoff — W0-02 / attempt 1

Status: **READY_FOR_REVIEW**. Never self-mark ACCEPTED (Jani accepted W0-01 in chat; W0-02 waits for the same or a fresh-context review).
Base ID / Git commit / contract / content: base `7c354db` (W0-01 ACCEPTED). Contract version DESIGN_V0_UNIMPLEMENTED (primitives only, no contracts yet); no content.
Goal and implemented behavior: `packages/sim/primitives` — branded `Int` with an explicit `IntegerError` reason code; `checkedMath` (`add sub mul neg abs divFloor divCeil modFloor mulDiv isqrt min max clamp`) asserting `Number.isSafeInteger` on every result, `mulDiv` exact past 2^53 by binary long multiplication (no BigInt, stated preconditions, `MULDIV_RANGE` otherwise); units `Ticks`/`Mm`/`Milli` with validating constructors, conversions, D02 `actionDurationTicks` (ceil after the single skill modifier); `Rate` with saved integer remainders (`advance`, partition-invariant); little-endian `ByteWriter`/`ByteReader` with `int53`, versioned sections, `RateState` codec format v1.

Changed files and purpose:
- `packages/sim/primitives/int.ts` — brand, `asInt`/`int`/`isInt`, `IntegerError` (`NOT_SAFE_INTEGER | DIVISION_BY_ZERO | MULDIV_RANGE | NEGATIVE_SQRT | INVALID_UNIT`).
- `packages/sim/primitives/checkedMath.ts` — the arithmetic (the one file where bare operators are legitimate).
- `packages/sim/primitives/units.ts`, `rate.ts`, `serialize.ts`, `index.ts`, `README.md`; `packages/sim/index.ts` re-exports primitives.
- Tests: `checkedMath.test.ts` (16), `units.test.ts` (17), `serialize.test.ts` (11) — 44 tests, 13 of them fast-check properties against BigInt references (safe range, mm² and thousandths domains, forced slow path, isqrt, remainders, int53 round trip).
- `package.json`/lockfile — `fast-check` 4.10.0 (dev, exact; the version on the registry today).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. Known movement and need-rate vectors round as GDD 30.1–30.2 and D02 specify (ceil after single skill modifier; remainders carried) | `units.test.ts`: walk 3500 mm/s → 350 mm/tick, sprint → 500; 1.2 s × 0.9 → **11 ticks**, 30 × 1.15 → 35, positive durations never 0; food −6/min, recovery +3, fatigue +8 (13,13,14,13,13,14 per tick, 800 over 60 ticks, 8000 over 600), rest −45, exposure +12 (48 over 4 min, 72 with Cold Front); 0.1 HP/tick → exactly 1 HP per 10 ticks; partition-invariance property | PASS |
| 2. Overflow past 2^53 and invalid units fail explicitly; `mulDiv` handles mm² and thousandths products without overflow | `checkedMath.test.ts`: add/sub/mul vs BigInt with throw on unsafe; `mul(94906267, 94906267)` throws `NOT_SAFE_INTEGER`; mm²×milli÷milli property (2000 runs) and forced-slow-path property (2000 runs) vs BigInt; hand vectors with products ≈4·10^23; `MULDIV_RANGE` on out-of-precondition input; `units.test.ts`: `ticks(1.5)`, `ticks(-1)`, `mm(0.5)`, `milli(2^53)` → `INVALID_UNIT`. Mutation check: a +1 in the slow path made 4 tests fail | PASS |
| 3. Serialization round-trips values and remainders byte-exactly; format version recorded | `serialize.test.ts`: fixed byte layouts (LE), int53 round-trip property over the full safe range, canonical bytes, section header `LCS\0 | u16 version | u32 length`, `RateState` codec v1 round trip property, unknown version / truncation / trailing bytes / bad magic are distinct errors | PASS |

Commands actually executed: `npm run verify` → 0 (`handoffs/W0-02/evidence/verify.txt`: build 0, lint 0, vitest 5 files / 94 tests, python 6 OK, workboard PASS). Two property-test runs initially failed because the *test* asserted a result that does not fit 2^53 (`mulDiv(-18151551634, -496222, 1)`); the function had correctly thrown `NOT_SAFE_INTEGER` — the tests were corrected to expect the throw, the implementation was not weakened. One TypeScript error (`let t = n` typed as `Int` in `isqrt`) fixed.

Pre-existing baseline failures: none (49/49 at base).

Design decisions within scope:
- Safety assertions run always, not only in test builds — one comparison per operation; a wrong number is worse than a thrown error. Revisit only with a measured budget problem.
- `mulDiv` slow path uses binary long multiplication with a running remainder (≤ 53 steps), preconditions |a| < 2^52, |d| < 2^51 — orders of magnitude beyond any game domain — and throws rather than approximates outside them. No BigInt anywhere in `packages/sim`.
- Durations: bases are quantized to ticks first (GDD seconds have tenth precision → deciseconds = ticks), then `ceil(base × modifier / 1000)` per D02. Non-duration scaling floors. Speeds that do not divide by 10 must be `Rate`s; `mmPerTickFromMmPerSecond` refuses inexact input.
- `int53` = u32 low word + i32 high word (floor division by 2^32); no BigInt in the codec.

Contract proposals / deferred: typed lint rule "bare arithmetic on `Int` is an error in packages/sim" → W0-04 (needs type-aware ESLint; noted in STATUS). Angle tables, vector normalization → spatial packets. PRNG/hash → W0-03.

Remaining risks: `advance` with large tick counts multiplies numerator × ticks before dividing (safe for any plausible rate × 36,000 ticks; asserted). Next action: review, then W0-03.
