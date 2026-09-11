# Evidence: acceptance criterion 2 — a three/react/DOM import inside packages/sim fails lint

Recorded: 2026-09-11T10:50:28Z in the Anthropic sandbox (Node v22.22.2, eslint v10.10.0).
Probe file (temporary, deleted afterwards): packages/sim/core/__boundary_probe__.ts

```ts
// TEMPORARY PROBE for W0-01 acceptance criterion 2. Deleted after the lint run is recorded.
import * as THREE from "three";
import { useState } from "react";

export function attach(el: HTMLElement): void {
  el.focus();
  void [THREE, useState, window.innerWidth, Date.now(), Math.random(), 0.5];
}
```

## 1. `npm run lint` with the probe present
```

> lastclan@0.0.0 lint
> eslint .


/home/claude/lastclan/packages/sim/core/__boundary_probe__.ts
  2:1   error  'three' import is restricted from being used by a pattern. packages/sim, packages/content and packages/lab import nothing from three, react, the DOM or apps/web (AGENTS.md; TP v2.0 §21)                no-restricted-imports
  3:1   error  'react' import is restricted from being used by a pattern. packages/sim, packages/content and packages/lab import nothing from three, react, the DOM or apps/web (AGENTS.md; TP v2.0 §21)                no-restricted-imports
  5:28  error  Don't use `HTMLElement` as a type. HTMLElement is a DOM/Node/clock type; packages/sim, packages/content and packages/lab import nothing from three, react, the DOM or apps/web (AGENTS.md; TP v2.0 §21)  @typescript-eslint/no-restricted-types
  7:26  error  Unexpected use of 'window'. window is a DOM/timer/clock/Node global; packages/sim owns consequential state with no wall clock, timers or DOM (AGENTS.md)                                                 no-restricted-globals
  7:45  error  Unexpected use of 'Date'. Date is a DOM/timer/clock/Node global; packages/sim owns consequential state with no wall clock, timers or DOM (AGENTS.md)                                                     no-restricted-globals
  7:57  error  'Math.random' is restricted from being used. Math.random is float or entropy; consequential arithmetic is integer and goes through checkedMath (AGENTS.md, CONVENTIONS.md)                               no-restricted-properties
  7:72  error  Float literal in packages/sim: consequential arithmetic is integer-only (CONVENTIONS.md). Use integer units (mm, milli, ticks)                                                                           no-restricted-syntax

✖ 7 problems (7 errors, 0 warnings)

exit code: 1
```

## 2. `npm run lint` after deleting the probe
```

> lastclan@0.0.0 lint
> eslint .

exit code: 0
```

The same seven rule firings are asserted automatically in tests/arch/boundaries.test.ts (44 cases).
