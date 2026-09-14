// ESLint 10 flat config for The Last Clan (web build).
// Locked at W0-01 (CONVENTIONS.md): rule changes need a note in state/STATUS.md.
//
// The boundaries below implement AGENTS.md "Non-negotiable engineering boundaries"
// and TP v2.0 §21: nothing in packages/sim may import three, react, DOM types or
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

/**
 * The typed rule banning bare arithmetic on branded `Int` (REVIEW-REQUEST-01
 * §5.1, delivered by the reviewing agent, wired here after four deferrals).
 *
 * It is TypeScript, so it is compiled by `npm run build` like everything else.
 * If it is missing we fail loudly rather than lint without it: a silently
 * skipped rule is how a guard stops guarding without anyone noticing.
 */
const ruleRequire = createRequire(import.meta.url);
const compiledRulePath = "./tools/eslint/dist/no-bare-int-arithmetic.js";
if (!existsSync(new URL("tools/eslint/dist/no-bare-int-arithmetic.js", import.meta.url))) {
  throw new Error("eslint.config.js: tools/eslint/dist is missing — run `npm run build` before linting (the no-bare-int-arithmetic rule is compiled from TypeScript).");
}
const noBareIntArithmetic = ruleRequire(compiledRulePath).default ?? ruleRequire(compiledRulePath);
// apps/web; no wall clock, Math.random, floats or timers may determine outcomes.
// tests/arch/boundaries.test.ts proves each rule fires. W0-04 extends this file
// with the intra-sim direction (ai may not import core implementation, ...).
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

// ---------------------------------------------------------------------------
// Ban lists
// ---------------------------------------------------------------------------

/** Rendering / UI / app imports that no simulation-side package may take. */
const RENDER_AND_APP_IMPORT_GROUPS = [
  "three",
  "three/*",
  "@react-three/*",
  "react",
  "react/*",
  "react-dom",
  "react-dom/*",
  "vite",
  "vite/*",
  "@lastclan/web",
  "**/apps/web/**",
];

/** Node built-ins: packages/sim runs unchanged in a Web Worker and in Node. */
const NODE_BUILTIN_MODULES = [
  "assert", "async_hooks", "buffer", "child_process", "cluster", "console", "constants", "crypto",
  "dgram", "diagnostics_channel", "dns", "domain", "events", "fs", "http", "http2", "https",
  "inspector", "module", "net", "os", "path", "perf_hooks", "process", "punycode", "querystring",
  "readline", "repl", "stream", "string_decoder", "sys", "timers", "tls", "trace_events", "tty",
  "url", "util", "v8", "vm", "wasi", "worker_threads", "zlib",
];

/** DOM, Worker, storage, timer and clock globals that must not appear in packages/sim. */
const SIM_BANNED_GLOBALS = [
  // DOM and browser
  "window", "document", "navigator", "self", "globalThis", "location", "history", "screen",
  "alert", "confirm", "prompt", "addEventListener", "removeEventListener", "dispatchEvent",
  "postMessage", "Worker", "SharedWorker", "MessageChannel", "BroadcastChannel", "XMLHttpRequest",
  "fetch", "WebSocket", "localStorage", "sessionStorage", "indexedDB", "caches",
  "requestAnimationFrame", "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback",
  "OffscreenCanvas", "ImageData", "Blob", "File", "URL", "Image", "Audio",
  // timers and microtask scheduling
  "setTimeout", "setInterval", "clearTimeout", "clearInterval", "setImmediate", "clearImmediate",
  "queueMicrotask",
  // wall clock and entropy
  "Date", "performance", "crypto",
  // Node
  "process", "Buffer", "require", "module", "exports", "__dirname", "__filename",
];

/** Types that are DOM/Node/clock surfaces. Reported by @typescript-eslint/no-restricted-types. */
const SIM_BANNED_TYPES = [
  "Document", "Window", "Element", "HTMLElement", "HTMLCanvasElement", "HTMLDivElement",
  "Node", "Event", "EventTarget", "MessageEvent", "Worker", "SharedWorker", "MessagePort",
  "CanvasRenderingContext2D", "OffscreenCanvas", "OffscreenCanvasRenderingContext2D", "ImageData",
  "WebGLRenderingContext", "WebGL2RenderingContext", "GPUDevice",
  "Blob", "File", "URL", "Request", "Response", "Headers", "AbortController", "AbortSignal",
  "IDBDatabase", "IDBFactory", "IDBTransaction", "IDBObjectStore", "Storage", "Navigator",
  "Location", "XMLHttpRequest", "WebSocket", "Performance", "Date", "DOMRect",
];

/**
 * Compile-time dependency direction inside packages/sim (contracts/INTERFACES.md).
 * Each key may import only what its row allows; every other sim module is banned.
 * `host` is the composition root and may import everything.
 */
const SIM_MODULE_MAY_IMPORT = {
  primitives: [],
  contracts: ["primitives"],
  core: ["primitives", "contracts"],
  spatial: ["primitives", "contracts"],
  ai: ["primitives", "contracts"],
  story: ["primitives", "contracts"],
  observer: ["primitives", "contracts"],
  persistence: ["primitives", "contracts"],
  host: ["primitives", "contracts", "core", "spatial", "ai", "story", "observer", "persistence"],
};
const SIM_MODULES = Object.keys(SIM_MODULE_MAY_IMPORT);

/** Import patterns that reach sim module `m` from anywhere (relative or package path). */
function simModulePatterns(m) {
  return [`**/${m}`, `**/${m}/**`, `@lastclan/sim/${m}`, `@lastclan/sim/${m}/*`];
}

/** The no-restricted-imports patterns that enforce one module's row of the table. */
function simDirectionPatterns(self) {
  const allowed = new Set([self, ...SIM_MODULE_MAY_IMPORT[self]]);
  return SIM_MODULES.filter((m) => !allowed.has(m)).map((m) => ({
    group: simModulePatterns(m),
    message: `packages/sim/${self} may not import packages/sim/${m} (dependency direction, contracts/INTERFACES.md). Allowed: ${SIM_MODULE_MAY_IMPORT[self].join(", ") || "nothing but the platform base library"}.`,
  }));
}

/** Math members that produce floats or entropy. Integer-safe members (abs, max, min, floor, trunc, sign, imul, clz32) stay allowed. */
const FLOAT_OR_ENTROPY_MATH = [
  "random", "sin", "cos", "tan", "asin", "acos", "atan", "atan2", "sinh", "cosh", "tanh",
  "asinh", "acosh", "atanh", "sqrt", "cbrt", "pow", "exp", "expm1", "log", "log2", "log10", "log1p",
  "hypot", "fround", "PI", "E", "LN2", "LN10", "LOG2E", "LOG10E", "SQRT2", "SQRT1_2",
];

// ---------------------------------------------------------------------------
// Rule blocks
// ---------------------------------------------------------------------------

const BOUNDARY_MSG = "packages/sim, packages/content and packages/lab import nothing from three, react, the DOM or apps/web (AGENTS.md; TP v2.0 §21).";

/** Applied to every simulation-side package, tests included. */
const noRenderOrAppImports = {
  "no-restricted-imports": [
    "error",
    { patterns: [{ group: RENDER_AND_APP_IMPORT_GROUPS, message: BOUNDARY_MSG }] },
  ],
  "@typescript-eslint/no-restricted-types": [
    "error",
    {
      types: Object.fromEntries(
        SIM_BANNED_TYPES.map((t) => [t, { message: `${t} is a DOM/Node/clock type; ${BOUNDARY_MSG}` }]),
      ),
    },
  ],
};

/**
 * The composed import rule for one module inside packages/sim. Production files
 * get the full set (no render/app, no Node built-ins, no lab/content, no vitest)
 * plus the dependency direction; test files keep the render/app ban and the
 * direction but may use Node and vitest. Composing them into ONE rule matters:
 * ESLint merges by later-wins per rule key, so a second block for the same key
 * would silently replace the first instead of adding to it.
 */
function simImportPatterns(self, { isTest }) {
  const patterns = [{ group: RENDER_AND_APP_IMPORT_GROUPS, message: BOUNDARY_MSG }, ...simDirectionPatterns(self)];
  if (!isTest) {
    patterns.push(
      {
        group: ["node:*", ...NODE_BUILTIN_MODULES, ...NODE_BUILTIN_MODULES.map((m) => `${m}/*`)],
        message: "packages/sim runs unchanged in a Web Worker and in Node: no Node built-ins (AGENTS.md).",
      },
      {
        group: ["@lastclan/lab", "@lastclan/content", "**/packages/lab/**", "**/packages/content/**"],
        message: "packages/sim is the lowest layer: it never imports lab, content tooling or apps (INTERFACES.md).",
      },
      { group: ["vitest", "vitest/*"], message: "vitest is a test-only import." },
    );
  }
  return ["error", { patterns }];
}

/** Determinism rules for every packages/sim production file (imports are composed above). */
const simPurity = {
  "no-restricted-globals": [
    "error",
    ...SIM_BANNED_GLOBALS.map((name) => ({
      name,
      message: `${name} is a DOM/timer/clock/Node global; packages/sim owns consequential state with no wall clock, timers or DOM (AGENTS.md).`,
    })),
  ],
  "no-restricted-properties": [
    "error",
    ...FLOAT_OR_ENTROPY_MATH.map((property) => ({
      object: "Math",
      property,
      message: `Math.${property} is float or entropy; consequential arithmetic is integer and goes through checkedMath (AGENTS.md, CONVENTIONS.md).`,
    })),
    { object: "Number", property: "parseFloat", message: "No floats in packages/sim." },
  ],
  "no-restricted-syntax": [
    "error",
    {
      selector: "Literal[raw=/^[0-9]*\\.[0-9]+/]",
      message: "Float literal in packages/sim: consequential arithmetic is integer-only (CONVENTIONS.md). Use integer units (mm, milli, ticks).",
    },
    {
      selector: "CallExpression[callee.name='parseFloat']",
      message: "No floats in packages/sim.",
    },
  ],
};

/** packages/lab and packages/content: no entropy from Math.random (CONVENTIONS.md). */
const noMathRandom = {
  "no-restricted-properties": [
    "error",
    { object: "Math", property: "random", message: "Math.random is banned in packages/lab and packages/content (CONVENTIONS.md); use derived streams from @lastclan/sim." },
  ],
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export default defineConfig([
  globalIgnores([
    "**/node_modules/",
    "**/dist/",
    "**/*.tsbuildinfo",
    "docs/",
    "reference/",
    "handoffs/",
    "coverage/",
  ]),

  // Baseline for all TypeScript sources.
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports", fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
    },
  },

  // Root config/scripts run in Node.
  {
    files: ["*.js", "*.ts", "scripts/**/*.js", "scripts/**/*.ts"],
    languageOptions: { globals: { ...globals.node } },
  },

  // Simulation-side packages: no rendering, no DOM, no app imports (tests included).
  {
    files: ["packages/sim/**/*.ts", "packages/content/**/*.ts", "packages/lab/**/*.ts"],
    rules: noRenderOrAppImports,
  },

  /**
   * Typed rule: no bare arithmetic on branded `Int` inside `packages/sim`.
   *
   * The compiler already rejects `const x: Int = a + b` because the brand is lost
   * by arithmetic. This closes the gap the type system leaves: arithmetic on
   * `Int` consumed as a plain `number` — a comparison of sums, an array index, a
   * `number` parameter. Typed linting is enabled only for this block, because it
   * costs real time and nothing else needs it.
   */
  {
    files: ["packages/sim/**/*.ts"],
    // The architecture probes lint synthetic files that exist only in memory
    // (`__boundary_probe__.ts`). Type-aware parsing needs a real file in a real
    // project, so those paths are excluded here rather than the probes being
    // rewritten — they are testing the untyped boundary rules, not this one.
    ignores: ["**/__boundary_probe__*.ts"],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    plugins: { lastclan: { rules: { "no-bare-int-arithmetic": noBareIntArithmetic } } },
    rules: {
      "lastclan/no-bare-int-arithmetic": [
        "error",
        {
          brandTypeNames: ["Int"],
          // The modules whose whole job is the arithmetic everything else must
          // route through, plus the PRNG and hashing, which are bitwise by
          // definition.
          allowFiles: [
            // The modules whose whole job is the arithmetic everything else
            // routes through, plus the PRNG and hashing, which are bitwise by
            // definition.
            "packages/sim/primitives/checkedMath\\.ts$",
            "packages/sim/primitives/int\\.ts$",
            "packages/sim/primitives/random\\.ts$",
            "packages/sim/primitives/hash\\.ts$",
            "packages/sim/primitives/serialize\\.ts$",
            "\\.test\\.ts$",
            // ---------------------------------------------------------------
            // Debt, 14 Sep 2026: these five files still hold bare `Int`
            // arithmetic the rule catches — 29 sites in total, counted below.
            // They are listed individually, with counts, so the debt shrinks
            // visibly and cannot be forgotten the way the rule itself was for
            // four packets. `visibility.ts` was cleaned first and is NOT here.
            //
            //   spatial/terrain.ts  19    spatial/route.ts   4
            //   core/tick.ts         3    spatial/island.ts  2
            //   host/index.ts        1
            //
            // Removing an entry is the acceptance test for fixing that file.
            "packages/sim/spatial/terrain\\.ts$",
            "packages/sim/spatial/route\\.ts$",
            "packages/sim/spatial/island\\.ts$",
            "packages/sim/core/tick\\.ts$",
            "packages/sim/host/index\\.ts$",
          ],
        },
      ],
    },
  },

  // packages/lab and packages/content are Node programs (compiler, CLI, renderer).
  {
    files: ["packages/lab/**/*.ts", "packages/content/**/*.ts"],
    languageOptions: { globals: { ...globals.node } },
    rules: noMathRandom,
  },

  // packages/sim production code: pure, deterministic, integer-only, and inside
  // the dependency direction of contracts/INTERFACES.md. One block per module so
  // each file gets a single composed no-restricted-imports rule.
  ...SIM_MODULES.map((m) => ({
    files: [`packages/sim/${m}/**/*.ts`],
    ignores: [`packages/sim/${m}/**/*.test.ts`],
    languageOptions: { globals: {} },
    rules: { ...simPurity, "no-restricted-imports": simImportPatterns(m, { isTest: false }) },
  })),

  // The package entry (packages/sim/*.ts) composes the modules, like host.
  {
    files: ["packages/sim/*.ts"],
    ignores: ["packages/sim/*.test.ts"],
    languageOptions: { globals: {} },
    rules: { ...simPurity, "no-restricted-imports": simImportPatterns("host", { isTest: false }) },
  },

  // packages/sim tests run in Node under vitest: Node and vitest allowed; the
  // render/app ban and the dependency direction still apply, so a test cannot
  // smuggle in a layer inversion either.
  ...SIM_MODULES.map((m) => ({
    files: [`packages/sim/${m}/**/*.test.ts`],
    languageOptions: { globals: { ...globals.node } },
    rules: { "no-restricted-imports": simImportPatterns(m, { isTest: true }) },
  })),

  // Browser app: DOM allowed; render-only floats allowed (AGENTS.md).
  {
    files: ["apps/web/**/*.ts", "apps/web/**/*.tsx"],
    languageOptions: { globals: { ...globals.browser } },
  },

  // Repository-level tests (architecture, integration) run in Node.
  {
    files: ["tests/**/*.ts"],
    languageOptions: { globals: { ...globals.node } },
  },
]);
