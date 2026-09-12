/**
 * checkedMath — the only arithmetic allowed on consequential values (TP v2.0 §4, CONVENTIONS.md).
 *
 * Every function validates its operands, computes an exact integer result and
 * asserts `Number.isSafeInteger` on it (always, not only in test builds: the
 * check is one comparison and a wrong number is worse than a thrown error).
 * Division follows floor semantics (toward −∞) unless the name says otherwise;
 * `mulDiv` computes floor(a·b/d) exactly even when a·b exceeds 2^53.
 *
 * This file is the one place in packages/sim where bare `+ - * / %` on
 * integers is legitimate; everything else goes through these functions.
 */
import { asInt, IntegerError, type Int, MAX_SAFE } from "./int.js";

const TWO_POW_32 = 4294967296; // 2^32
const TWO_POW_51 = 2251799813685248; // 2^51
const TWO_POW_52 = 4503599627370496; // 2^52

function check(n: number, operation: string, operands: readonly number[]): Int {
  if (!Number.isSafeInteger(n)) {
    throw new IntegerError("NOT_SAFE_INTEGER", operation, operands, "result left the safe-integer range");
  }
  return n as Int;
}

function requireInts(operation: string, operands: readonly number[]): void {
  for (const n of operands) {
    if (!Number.isSafeInteger(n)) {
      throw new IntegerError("NOT_SAFE_INTEGER", operation, operands, "operand is not a safe integer");
    }
  }
}

/** a + b, asserted safe. */
export function add(a: Int, b: Int): Int {
  requireInts("add", [a, b]);
  return check(a + b, "add", [a, b]);
}

/** a − b, asserted safe. */
export function sub(a: Int, b: Int): Int {
  requireInts("sub", [a, b]);
  return check(a - b, "sub", [a, b]);
}

/**
 * a · b, asserted safe. If the true product exceeds 2^53 the IEEE product is
 * also outside the safe range (rounding is monotonic and 2^53 is representable),
 * so the assertion is sound.
 */
export function mul(a: Int, b: Int): Int {
  requireInts("mul", [a, b]);
  return check(a * b, "mul", [a, b]);
}

/** −a. */
export function neg(a: Int): Int {
  requireInts("neg", [a]);
  return check(-a, "neg", [a]);
}

/** |a|. */
export function abs(a: Int): Int {
  requireInts("abs", [a]);
  return check(a < 0 ? -a : a, "abs", [a]);
}

/**
 * Exact truncating division of safe integers: returns [quotient, remainder]
 * with the remainder carrying the dividend's sign (like `%`). `%` on integer
 * doubles is exact, `p − r` is exact and an exact multiple divided by `d` is
 * exact, so no floating rounding can reach the result.
 */
function divTrunc(p: number, d: number): [number, number] {
  const r = p % d;
  const q = (p - r) / d;
  return [q, r];
}

/** floor(a / d). d ≠ 0. */
export function divFloor(a: Int, d: Int): Int {
  requireInts("divFloor", [a, d]);
  if (d === 0) throw new IntegerError("DIVISION_BY_ZERO", "divFloor", [a, d]);
  const [q, r] = divTrunc(a, d);
  const adjust = r !== 0 && r < 0 !== d < 0 ? 1 : 0;
  return check(q - adjust, "divFloor", [a, d]);
}

/** ceil(a / d). d ≠ 0. Used for positive action durations (Addendum D02). */
export function divCeil(a: Int, d: Int): Int {
  requireInts("divCeil", [a, d]);
  if (d === 0) throw new IntegerError("DIVISION_BY_ZERO", "divCeil", [a, d]);
  const [q, r] = divTrunc(a, d);
  const adjust = r !== 0 && r < 0 === d < 0 ? 1 : 0;
  return check(q + adjust, "divCeil", [a, d]);
}

/** a − d·floor(a / d): the remainder that pairs with `divFloor` (sign of the divisor, or zero). */
export function modFloor(a: Int, d: Int): Int {
  requireInts("modFloor", [a, d]);
  if (d === 0) throw new IntegerError("DIVISION_BY_ZERO", "modFloor", [a, d]);
  const [, r] = divTrunc(a, d);
  const adjusted = r !== 0 && r < 0 !== d < 0 ? r + d : r;
  return check(adjusted, "modFloor", [a, d]);
}

/**
 * floor((|a| mod D) · B / D) for 0 ≤ a' < D, B ≤ 2^53, D < 2^51, without
 * forming the product: binary long multiplication with the running remainder
 * reduced modulo D at every step. rem < D and a' < D keep rem·2 + a' < 3·D < 2^53.
 */
function mulDivSlowNonNegative(aReduced: number, B: number, D: number): number {
  const hi = Math.floor(B / TWO_POW_32); // < 2^21
  const lo = B - hi * TWO_POW_32; // < 2^32
  let rem = 0;
  let quo = 0;
  const step = (bit: number): void => {
    rem = rem * 2 + (bit === 1 ? aReduced : 0);
    quo = quo * 2;
    while (rem >= D) {
      rem -= D;
      quo += 1;
    }
  };
  for (let i = 20; i >= 0; i -= 1) step((hi >>> i) & 1);
  for (let i = 31; i >= 0; i -= 1) step((lo >>> i) & 1);
  return quo;
}

/**
 * floor(a · b / d) computed exactly, d ≠ 0. This is how millimetre-squared
 * (≈6.4·10^11 over the 800 m envelope) and thousandths products are scaled
 * without intermediate overflow.
 *
 * Fast path: when |a·b| fits in the safe range the product is exact and a
 * plain floor division follows. Slow path: binary long multiplication; it
 * requires |a| < 2^52 and |d| < 2^51 (both far beyond any game domain) and
 * throws `MULDIV_RANGE` otherwise rather than returning an approximation.
 * The result itself is asserted safe. No BigInt.
 */
export function mulDiv(a: Int, b: Int, d: Int): Int {
  requireInts("mulDiv", [a, b, d]);
  if (d === 0) throw new IntegerError("DIVISION_BY_ZERO", "mulDiv", [a, b, d]);

  const product = a * b;
  if (Math.abs(product) <= MAX_SAFE) {
    return divFloor(product as Int, d);
  }

  const A = Math.abs(a);
  const B = Math.abs(b);
  const D = Math.abs(d);
  if (A >= TWO_POW_52 || D >= TWO_POW_51) {
    throw new IntegerError("MULDIV_RANGE", "mulDiv", [a, b, d], "slow path needs |a| < 2^52 and |d| < 2^51");
  }
  const negative = a < 0 !== b < 0 !== d < 0;

  // |a|·|b| / D = qa·B + (ra·B)/D with |a| = qa·D + ra, 0 ≤ ra < D.
  const [qa, ra] = divTrunc(A, D);
  const partial = mulDivSlowNonNegative(ra, B, D); // floor(ra·B/D)
  const magnitude = qa * B + partial; // floor(|a·b| / D); every term ≤ the final magnitude
  check(magnitude, "mulDiv", [a, b, d]);

  if (!negative) return magnitude as Int;
  // Negative exact result: floor(−x) = −ceil(x); ceil = floor + 1 unless the division was exact.
  // Exactness of |a·b| / D ⇔ (ra·B) mod D = 0; recompute that remainder the same way.
  const remainder = mulDivRemainderNonNegative(ra, B, D);
  return check(remainder === 0 ? -magnitude : -magnitude - 1, "mulDiv", [a, b, d]);
}

/** (a' · B) mod D for 0 ≤ a' < D, same loop as the quotient. */
function mulDivRemainderNonNegative(aReduced: number, B: number, D: number): number {
  const hi = Math.floor(B / TWO_POW_32);
  const lo = B - hi * TWO_POW_32;
  let rem = 0;
  const step = (bit: number): void => {
    rem = rem * 2 + (bit === 1 ? aReduced : 0);
    while (rem >= D) rem -= D;
  };
  for (let i = 20; i >= 0; i -= 1) step((hi >>> i) & 1);
  for (let i = 31; i >= 0; i -= 1) step((lo >>> i) & 1);
  return rem;
}

/** floor(√n) for n ≥ 0 by integer Newton iteration. No Math.sqrt (TP v2.0 §4). */
export function isqrt(n: Int): Int {
  requireInts("isqrt", [n]);
  if (n < 0) throw new IntegerError("NEGATIVE_SQRT", "isqrt", [n]);
  if (n < 2) return n;
  // Start above the root: 2^ceil(bits/2) ≥ √n.
  let bits = 0;
  for (let t: number = n; t >= 1; t = Math.floor(t / 2)) bits += 1;
  let x = 1;
  for (let i = 0; i < Math.ceil(bits / 2); i += 1) x *= 2;
  // Newton: x_{k+1} = floor((x_k + floor(n / x_k)) / 2), decreasing while above the root.
  for (;;) {
    const [q] = divTrunc(n, x); // exact floor(n / x), both non-negative
    const y = Math.floor((x + q) / 2); // exact: the sum is a safe integer and halving is exact
    if (y >= x) break;
    x = y;
  }
  return asInt(x, "isqrt");
}

/** Smaller of two Ints. */
export function min(a: Int, b: Int): Int {
  requireInts("min", [a, b]);
  return (a < b ? a : b) as Int;
}

/** Larger of two Ints. */
export function max(a: Int, b: Int): Int {
  requireInts("max", [a, b]);
  return (a > b ? a : b) as Int;
}

/** Clamp `a` into [lo, hi]; lo ≤ hi required. */
export function clamp(a: Int, lo: Int, hi: Int): Int {
  requireInts("clamp", [a, lo, hi]);
  if (lo > hi) throw new IntegerError("INVALID_UNIT", "clamp", [a, lo, hi], "lo > hi");
  return (a < lo ? lo : a > hi ? hi : a) as Int;
}
