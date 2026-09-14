import type { Int, Milli } from '../primitives/int';
import { add } from '../primitives/checked-math';
export function f(a: Int, b: Int, m: Milli, arr: number[], n: number, maybe: Int | undefined): number {
  const ok1 = add(a, b);              // fine
  const ok2 = a < b;                  // fine: comparison, not arithmetic (flagComparison=false)
  const ok3 = arr[a];                 // fine: index, no arithmetic
  const bad1 = a + b;                 // flagged
  const bad2 = arr[a + 1];            // flagged: arithmetic consumed as index
  const bad3 = n * m;                 // flagged: right operand branded
  const bad4 = -a;                    // flagged
  let c = a; c += 1;                  // flagged compound
  let d = a; d++;                     // flagged update
  const bad5 = (a * 2) > n;           // flagged: arithmetic consumed as comparison
  const bad6 = maybe ? maybe + 1 : 0; // flagged: union with Int
  const bad7 = a >>> 0;               // flagged bitwise
  return [ok1, ok2, ok3, bad1, bad2, bad3, bad4, c, d, bad5, bad6, bad7].length; // no arithmetic on Int here
}
