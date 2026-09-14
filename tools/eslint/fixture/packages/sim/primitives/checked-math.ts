import type { Int } from './int';
export const add = (a: Int, b: Int): Int => (a + b) as Int;   // allowed: allow-listed file
export const mul = (a: Int, b: Int): Int => (a * b) as Int;
