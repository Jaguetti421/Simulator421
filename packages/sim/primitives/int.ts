/**
 * Branded integer type and explicit failure reasons (TP v2.0 §4).
 *
 * Every consequential value in packages/sim is an `Int`: an integer-valued
 * `number` within ±2^53 - 1 (`Number.isSafeInteger`). The brand is compile-time
 * only; `asInt` is the single runtime gate and throws `IntegerError` with a
 * stable reason code instead of producing a wrong number.
 */

declare const INT_BRAND: unique symbol;

/** An integer-valued number inside the safe range, produced only by `asInt` or `checkedMath`. */
export type Int = number & { readonly [INT_BRAND]: true };

export type IntegerErrorCode =
  | "NOT_SAFE_INTEGER" // input or result is not an integer within ±2^53 - 1
  | "DIVISION_BY_ZERO"
  | "MULDIV_RANGE" // mulDiv slow path preconditions violated (see checkedMath.mulDiv)
  | "NEGATIVE_SQRT"
  | "INVALID_UNIT"; // a unit constructor received a value outside its domain

/** Thrown by every primitive on invalid input or an unsafe result. Never swallowed. */
export class IntegerError extends Error {
  readonly code: IntegerErrorCode;
  readonly operation: string;
  readonly operands: readonly number[];

  constructor(code: IntegerErrorCode, operation: string, operands: readonly number[], detail?: string) {
    super(`${code} in ${operation}(${operands.join(", ")})${detail === undefined ? "" : `: ${detail}`}`);
    this.name = "IntegerError";
    this.code = code;
    this.operation = operation;
    this.operands = operands;
  }
}

export const MAX_SAFE = Number.MAX_SAFE_INTEGER; // 2^53 - 1
export const MIN_SAFE = Number.MIN_SAFE_INTEGER; // -(2^53 - 1)

/** True when `n` is an integer within the safe range. Does not throw. */
export function isInt(n: unknown): n is Int {
  return typeof n === "number" && Number.isSafeInteger(n);
}

/** Runtime gate: returns `n` as `Int` or throws `IntegerError("NOT_SAFE_INTEGER")`. */
export function asInt(n: number, operation = "asInt"): Int {
  if (!Number.isSafeInteger(n)) {
    throw new IntegerError("NOT_SAFE_INTEGER", operation, [n]);
  }
  return n as Int;
}

/** Literal helper for constants: `int(10)`. Validated once at module load. */
export function int(n: number): Int {
  return asInt(n, "int");
}

export const ZERO: Int = int(0);
export const ONE: Int = int(1);
