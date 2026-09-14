export type Int = number & { readonly __brand: 'Int' };
export type Milli = number & { readonly __brand: 'Milli' };
export const int = (n: number): Int => n as Int;
