import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { abs, add, clamp, divCeil, divFloor, isqrt, max, min, modFloor, mul, mulDiv, neg, sub } from "./checkedMath.js";
import { asInt, IntegerError, type Int, MAX_SAFE, MIN_SAFE } from "./int.js";

const I = (n: number): Int => asInt(n);
const safeInt = fc.integer({ min: MIN_SAFE, max: MAX_SAFE }).map(I);
const nonZeroSafe = safeInt.filter((n) => n !== 0);
/** Game domains: mm² over the 800 m envelope (≈2^40), thousandths (≤2^20), ticks (≤2^16). */
const mmSquared = fc.integer({ min: -700_000_000_000, max: 700_000_000_000 }).map(I);
const thousandths = fc.integer({ min: -1_000_000, max: 1_000_000 }).map(I);
const nonZeroThousandths = thousandths.filter((n) => n !== 0);

function bigFloorDiv(a: bigint, d: bigint): bigint {
  const q = a / d;
  const r = a % d;
  return r !== 0n && r < 0n !== d < 0n ? q - 1n : q;
}
function bigCeilDiv(a: bigint, d: bigint): bigint {
  const q = a / d;
  const r = a % d;
  return r !== 0n && r < 0n === d < 0n ? q + 1n : q;
}
function bigSqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}
const inSafe = (b: bigint): boolean => b >= BigInt(MIN_SAFE) && b <= BigInt(MAX_SAFE);

describe("add / sub / mul agree with BigInt and refuse unsafe results", () => {
  it("add", () => {
    fc.assert(
      fc.property(safeInt, safeInt, (a, b) => {
        const expected = BigInt(a) + BigInt(b);
        if (inSafe(expected)) expect(BigInt(add(a, b))).toBe(expected);
        else expect(() => add(a, b)).toThrow(IntegerError);
      }),
    );
  });
  it("sub", () => {
    fc.assert(
      fc.property(safeInt, safeInt, (a, b) => {
        const expected = BigInt(a) - BigInt(b);
        if (inSafe(expected)) expect(BigInt(sub(a, b))).toBe(expected);
        else expect(() => sub(a, b)).toThrow(IntegerError);
      }),
    );
  });
  it("mul", () => {
    fc.assert(
      fc.property(safeInt, safeInt, (a, b) => {
        const expected = BigInt(a) * BigInt(b);
        if (inSafe(expected)) expect(BigInt(mul(a, b))).toBe(expected);
        else expect(() => mul(a, b)).toThrow(IntegerError);
      }),
    );
  });
  it("overflow past 2^53 fails explicitly with the reason code", () => {
    expect(() => add(I(MAX_SAFE), I(1))).toThrow(/NOT_SAFE_INTEGER/);
    expect(() => mul(I(94906267), I(94906267))).toThrow(/NOT_SAFE_INTEGER/); // 94906267² > 2^53
    expect(() => sub(I(MIN_SAFE), I(1))).toThrow(/NOT_SAFE_INTEGER/);
    const err = (() => {
      try {
        mul(I(MAX_SAFE), I(2));
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(IntegerError);
    expect((err as IntegerError).code).toBe("NOT_SAFE_INTEGER");
    expect((err as IntegerError).operation).toBe("mul");
  });
  it("non-integer or unsafe operands are refused even when branded by a cast", () => {
    expect(() => add(1.5 as Int, I(1))).toThrow(/NOT_SAFE_INTEGER/);
    expect(() => mul(Number.NaN as Int, I(1))).toThrow(/NOT_SAFE_INTEGER/);
    expect(() => divFloor(9007199254740992 as Int, I(1))).toThrow(/NOT_SAFE_INTEGER/);
  });
});

describe("divFloor / divCeil / modFloor", () => {
  it("match BigInt floor and ceil semantics for all sign combinations", () => {
    fc.assert(
      fc.property(safeInt, nonZeroSafe, (a, d) => {
        expect(BigInt(divFloor(a, d))).toBe(bigFloorDiv(BigInt(a), BigInt(d)));
        expect(BigInt(divCeil(a, d))).toBe(bigCeilDiv(BigInt(a), BigInt(d)));
        const m = modFloor(a, d);
        expect(BigInt(m)).toBe(BigInt(a) - BigInt(d) * bigFloorDiv(BigInt(a), BigInt(d)));
        expect(m === 0 || m < 0 === d < 0).toBe(true);
      }),
    );
  });
  it("known vectors", () => {
    expect(divFloor(I(7), I(2))).toBe(3);
    expect(divFloor(I(-7), I(2))).toBe(-4);
    expect(divFloor(I(7), I(-2))).toBe(-4);
    expect(divCeil(I(7), I(2))).toBe(4);
    expect(divCeil(I(-7), I(2))).toBe(-3);
    expect(divCeil(I(108), I(10))).toBe(11); // D02 example in tenths: 10.8 → 11
    expect(modFloor(I(-7), I(2))).toBe(1);
  });
  it("division by zero is explicit", () => {
    for (const f of [divFloor, divCeil, modFloor]) expect(() => f(I(1), I(0))).toThrow(/DIVISION_BY_ZERO/);
    expect(() => mulDiv(I(1), I(1), I(0))).toThrow(/DIVISION_BY_ZERO/);
  });
  it("large dividends near 2^53 with small divisors stay exact (no float quotient rounding)", () => {
    fc.assert(
      fc.property(safeInt, fc.integer({ min: 1, max: 1000 }).map(I), (a, d) => {
        expect(BigInt(divFloor(a, d))).toBe(bigFloorDiv(BigInt(a), BigInt(d)));
      }),
    );
    expect(divFloor(I(MAX_SAFE), I(3))).toBe(3002399751580330); // floor((2^53-1)/3)
    expect(divFloor(I(MAX_SAFE - 1), I(MAX_SAFE))).toBe(0);
    expect(divCeil(I(MAX_SAFE - 1), I(MAX_SAFE))).toBe(1);
  });
});

describe("mulDiv computes floor(a·b/d) exactly beyond 2^53", () => {
  it("millimetre-squared × thousandths ÷ thousandths (the spatial domain) agrees with BigInt", () => {
    fc.assert(
      fc.property(mmSquared, thousandths, nonZeroThousandths, (a, b, d) => {
        const expected = bigFloorDiv(BigInt(a) * BigInt(b), BigInt(d));
        if (inSafe(expected)) expect(BigInt(mulDiv(a, b, d))).toBe(expected);
        else expect(() => mulDiv(a, b, d)).toThrow(/NOT_SAFE_INTEGER/); // result itself does not fit: explicit, never approximate
      }),
      { numRuns: 2000 },
    );
  });
  it("forces the slow path: products far beyond 2^53 with results that fit", () => {
    const bigA = fc.integer({ min: -2_000_000_000_000, max: 2_000_000_000_000 }).map(I); // ~2^41
    const bigB = fc.integer({ min: -2_000_000_000_000, max: 2_000_000_000_000 }).map(I);
    const bigD = fc.integer({ min: 1_000_000, max: 1_000_000_000_000 }).map(I);
    fc.assert(
      fc.property(bigA, bigB, bigD, fc.boolean(), (a, b, d0, negD) => {
        const d = (negD ? -d0 : d0) as Int;
        const product = BigInt(a) * BigInt(b);
        const expected = bigFloorDiv(product, BigInt(d));
        if (inSafe(expected)) expect(BigInt(mulDiv(a, b, d))).toBe(expected);
        else expect(() => mulDiv(a, b, d)).toThrow(IntegerError);
      }),
      { numRuns: 2000 },
    );
  });
  it("hand vectors", () => {
    expect(mulDiv(I(350), I(850), I(1000))).toBe(297); // walk speed × carry factor 0.850 → floor
    expect(mulDiv(I(12), I(900), I(1000))).toBe(10); // floor; durations use divCeil (11)
    expect(mulDiv(I(640_000_000_000), I(640_000_000_000), I(640_000_000_000))).toBe(640_000_000_000); // product 4.1e23
    expect(mulDiv(I(-640_000_000_000), I(640_000_000_000), I(640_000_000_000))).toBe(-640_000_000_000);
    expect(mulDiv(I(-640_000_000_001), I(640_000_000_000), I(640_000_000_000))).toBe(-640_000_000_001);
    expect(mulDiv(I(640_000_000_001), I(640_000_000_000), I(-640_000_000_000))).toBe(-640_000_000_001);
    expect(mulDiv(I(1_000_000_000_001), I(1_000_000_000_001), I(1_000_000_000_000))).toBe(1_000_000_000_002); // 1e24+2e12+1 / 1e12 → floor = 1e12+2
    expect(mulDiv(I(-1_000_000_000_001), I(1_000_000_000_001), I(1_000_000_000_000))).toBe(-1_000_000_000_003);
  });
  it("refuses the slow path outside its stated preconditions instead of approximating", () => {
    expect(() => mulDiv(I(4503599627370496), I(4503599627370496), I(3))).toThrow(/MULDIV_RANGE|NOT_SAFE_INTEGER/);
    expect(() => mulDiv(I(2 ** 40), I(2 ** 40), I(2 ** 51))).toThrow(/MULDIV_RANGE/);
  });
  it("any partition of a product-then-divide chain is order-independent (exactness witness)", () => {
    fc.assert(
      fc.property(mmSquared, thousandths, nonZeroThousandths, (a, b, d) => {
        fc.pre(inSafe(bigFloorDiv(BigInt(a) * BigInt(b), BigInt(d))));
        expect(mulDiv(a, b, d)).toBe(mulDiv(b, a, d));
      }),
    );
  });
});

describe("isqrt", () => {
  it("equals floor(√n) for random safe n", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX_SAFE }).map(I), (n) => {
        const r = isqrt(n);
        expect(BigInt(r)).toBe(bigSqrt(BigInt(n)));
        expect(BigInt(r) * BigInt(r) <= BigInt(n)).toBe(true);
        expect((BigInt(r) + 1n) * (BigInt(r) + 1n) > BigInt(n)).toBe(true);
      }),
      { numRuns: 2000 },
    );
  });
  it("edges and perfect squares", () => {
    expect(isqrt(I(0))).toBe(0);
    expect(isqrt(I(1))).toBe(1);
    expect(isqrt(I(2))).toBe(1);
    expect(isqrt(I(3))).toBe(1);
    expect(isqrt(I(4))).toBe(2);
    expect(isqrt(I(640_000_000_000))).toBe(800_000); // 800 m in mm, squared
    expect(isqrt(I(640_000_000_000 - 1))).toBe(799_999);
    expect(isqrt(I(MAX_SAFE))).toBe(94906265);
    expect(() => isqrt(I(-1))).toThrow(/NEGATIVE_SQRT/);
  });
});

describe("neg / abs / min / max / clamp", () => {
  it("agree with plain integer semantics", () => {
    fc.assert(
      fc.property(safeInt, safeInt, safeInt, (a, b, c) => {
        expect(neg(a)).toBe(-a);
        expect(abs(a)).toBe(a < 0 ? -a : a);
        expect(min(a, b)).toBe(a < b ? a : b);
        expect(max(a, b)).toBe(a > b ? a : b);
        const lo = min(b, c);
        const hi = max(b, c);
        const v = clamp(a, lo, hi);
        expect(v >= lo && v <= hi).toBe(true);
      }),
    );
    expect(() => clamp(I(1), I(5), I(2))).toThrow(/INVALID_UNIT/);
  });
});
