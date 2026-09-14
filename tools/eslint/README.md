# no-bare-int-arithmetic — type-aware ESLint rule for `packages/sim`

Delivered by the reviewing agent, 13 Sep 2026, in answer to REVIEW-REQUEST-01 §5.1. **Tested here** with typescript-eslint 8.70.0, ESLint 10.10.0, TypeScript 6.0.3, Node 22 — the versions that installed from the registry in this sandbox; adjust to the repository's pins.

## What it catches

Any arithmetic whose operand's static type is a branded integer, regardless of how the result is consumed:

- `a + b`, `n * m`, `-a`, `a >>> 0`, `c += 1`, `d++` where an operand is `Int` (or any brand matching the options)
- `arr[a + 1]` — arithmetic consumed as an index
- `(a * 2) > n` — arithmetic consumed as a comparison
- `maybe ? maybe + 1 : 0` where `maybe: Int | undefined` — unions containing a brand

Not flagged by default: `a < b` (comparison of two Ints, no arithmetic; enable `flagComparison` if you want it), `arr[a]` (index without arithmetic), anything in allow-listed files (the checkedMath module and its tests).

Fixture `fixture/packages/sim/core/bad.ts` documents the expected verdict per line; `no-bare-int-arithmetic.check.ts` runs ESLint programmatically on the fixture and exits non-zero unless exactly lines 7–15 are flagged and the other files are clean. Output of the run performed here:

```
packages/sim/core/bad.ts errors: 9
packages/sim/primitives/checked-math.ts errors: 0
packages/sim/primitives/int.ts errors: 0
flagged lines: 7,8,9,10,11,12,13,14,15
RULE TEST PASS
```

## Wiring (flat config)

```ts
// eslint.config.ts (or .mjs)
import parser from '@typescript-eslint/parser';
import { rule as noBareIntArithmetic } from './tools/eslint/no-bare-int-arithmetic.ts';

export default [{
  files: ['packages/sim/**/*.ts', 'packages/lab/**/*.ts'],
  languageOptions: { parser, parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
  plugins: { lastclan: { rules: { 'no-bare-int-arithmetic': noBareIntArithmetic } } },
  rules: {
    'lastclan/no-bare-int-arithmetic': ['error', {
      brandProperties: ['__brand'],        // set to your brand property name(s)
      brandValues: [],                     // e.g. ['Int', 'Milli', 'Ticks'] to restrict; empty = any brand
      brandTypeNames: ['Int'],             // alias names treated as branded
      allowFiles: ['[\\/]primitives[\\/]checked-?[mM]ath(\\.test)?\\.ts$', '[\\/]primitives[\\/](hash|random)\\.ts$'],
      flagBitwise: true,
      flagComparison: false,
    }],
  },
}];
```

Typed linting is required (`projectService` or `project`); without it `getParserServices` throws, which is the intended failure.

## Options you must set to match the real brand

I could not see `packages/sim/primitives`, so the defaults assume `type Int = number & { readonly __brand: 'Int' }`. If the brand is a unique symbol (`readonly [IntBrand]: true`) rather than a string property, `brandProperties` will not find it by name — in that case rely on `brandTypeNames` (alias match) or add the symbol's declared name; I can extend the rule to match unique-symbol properties once I can read the actual declaration.

## Known limits

- Values that lost the brand before the expression (`const n: number = a; n + 1`) are not caught — the loss happened at the assignment, which the compiler allowed. If you want that, add `@typescript-eslint/no-unsafe-*`-style rules or make `Int → number` widening explicit via a `toNumber()` helper and ban implicit widening separately.
- Arithmetic inside `Math.*` calls with Int arguments is not a binary expression and is not flagged; `Math.*` is banned in `packages/sim` by your existing lint, so this should not matter.
- Performance: type queries per binary expression; fine for a package of this size, but keep the rule scoped to `packages/sim` and `packages/lab`.
