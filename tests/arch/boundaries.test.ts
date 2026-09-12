/**
 * Architecture boundaries (W0-01; extended by W0-04).
 *
 * Lints synthetic source text *as if* it lived at a given repository path,
 * using the real eslint.config.js, and asserts which boundary rules fire.
 * This is the executable form of AGENTS.md "Non-negotiable engineering
 * boundaries" and TP v2.0 §21: nothing in packages/sim may import three,
 * react, DOM types, timers, the wall clock, Node built-ins or apps/web.
 */
import { ESLint, type Linter } from "eslint";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

let eslint: ESLint;

beforeAll(() => {
  // cwd = repository root so the real eslint.config.js is discovered.
  eslint = new ESLint({ cwd: repoRoot });
});

/** Lint `code` as if it were the file at `relPath`; return messages. */
async function lintAt(relPath: string, code: string): Promise<Linter.LintMessage[]> {
  const results = await eslint.lintText(code, { filePath: path.join(repoRoot, relPath) });
  const first = results[0];
  if (first === undefined) throw new Error("ESLint returned no result");
  return first.messages;
}

function ruleIds(messages: readonly Linter.LintMessage[]): string[] {
  return messages.map((m) => m.ruleId ?? "(parse)");
}

const SIM_FILE = "packages/sim/core/__boundary_probe__.ts";
const SIM_TEST_FILE = "packages/sim/core/__boundary_probe__.test.ts";
const LAB_FILE = "packages/lab/render/__boundary_probe__.ts";
const CONTENT_FILE = "packages/content/compiler/__boundary_probe__.ts";
const WEB_FILE = "apps/web/src/__boundary_probe__.ts";
const AI_FILE = "packages/sim/ai/__boundary_probe__.ts";
const AI_TEST_FILE = "packages/sim/ai/__boundary_probe__.test.ts";
const CONTRACTS_FILE = "packages/sim/contracts/__boundary_probe__.ts";
const CORE_FILE = "packages/sim/core/__boundary_probe__.ts";
const HOST_FILE = "packages/sim/host/__boundary_probe__.ts";
const OBSERVER_FILE = "packages/sim/observer/__boundary_probe__.ts";
const PERSISTENCE_FILE = "packages/sim/persistence/__boundary_probe__.ts";
const SPATIAL_FILE = "packages/sim/spatial/__boundary_probe__.ts";

describe("eslint.config.js is the configuration under test", () => {
  it("resolves a config for a packages/sim file that carries the boundary rules", async () => {
    const cfg = (await eslint.calculateConfigForFile(path.join(repoRoot, SIM_FILE))) as Linter.Config;
    const rules = cfg.rules ?? {};
    expect(rules["no-restricted-imports"]).toBeDefined();
    expect(rules["no-restricted-globals"]).toBeDefined();
    expect(rules["@typescript-eslint/no-restricted-types"]).toBeDefined();
    expect(rules["no-restricted-properties"]).toBeDefined();
  });

  it("does not ignore the paths the probes use", async () => {
    for (const f of [SIM_FILE, SIM_TEST_FILE, LAB_FILE, CONTENT_FILE, WEB_FILE]) {
      expect(await eslint.isPathIgnored(path.join(repoRoot, f)), f).toBe(false);
    }
  });
});

describe("packages/sim may not import rendering or UI libraries", () => {
  it.each([
    ["three", 'import * as THREE from "three";\nexport const v = THREE;'],
    ["three subpath", 'import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";\nexport const c = OrbitControls;'],
    ["react", 'import { useState } from "react";\nexport const s = useState;'],
    ["react-dom", 'import { createRoot } from "react-dom/client";\nexport const r = createRoot;'],
    ["@react-three/fiber", 'import { Canvas } from "@react-three/fiber";\nexport const c = Canvas;'],
    ["apps/web by relative path", 'import { APP_NAME } from "../../../apps/web/src/index.js";\nexport const n = APP_NAME;'],
    ["@lastclan/web", 'import { APP_NAME } from "@lastclan/web";\nexport const n = APP_NAME;'],
    ["@lastclan/lab (layer inversion)", 'import { PACKAGE_NAME } from "@lastclan/lab";\nexport const n = PACKAGE_NAME;'],
    ["vitest outside a test file", 'import { expect } from "vitest";\nexport const e = expect;'],
  ])("%s → no-restricted-imports", async (_label, code) => {
    const messages = await lintAt(SIM_FILE, code);
    expect(ruleIds(messages)).toContain("no-restricted-imports");
    expect(messages.every((m) => m.severity === 2)).toBe(true);
  });
});

describe("packages/sim may not touch the DOM, timers, the wall clock or Node", () => {
  it.each([
    ["window", "export const w = window.innerWidth;", "no-restricted-globals"],
    ["document", 'export const d = document.createElement("canvas");', "no-restricted-globals"],
    ["navigator", "export const n = navigator.userAgent;", "no-restricted-globals"],
    ["setTimeout", "export const t = setTimeout(() => undefined, 1);", "no-restricted-globals"],
    ["requestAnimationFrame", "export const r = requestAnimationFrame(() => undefined);", "no-restricted-globals"],
    ["Date.now (wall clock)", "export const now = Date.now();", "no-restricted-globals"],
    ["performance.now (wall clock)", "export const now = performance.now();", "no-restricted-globals"],
    ["process (Node global)", "export const p = process.env;", "no-restricted-globals"],
    ["indexedDB", 'export const db = indexedDB.open("x");', "no-restricted-globals"],
    ["node:fs import", 'import { readFileSync } from "node:fs";\nexport const r = readFileSync;', "no-restricted-imports"],
    ["bare fs import", 'import { readFileSync } from "fs";\nexport const r = readFileSync;', "no-restricted-imports"],
    ["worker_threads import", 'import { Worker } from "node:worker_threads";\nexport const w = Worker;', "no-restricted-imports"],
  ])("%s → %s", async (_label, code, rule) => {
    const messages = await lintAt(SIM_FILE, code);
    expect(ruleIds(messages)).toContain(rule);
  });

  it.each([
    ["HTMLElement parameter", "export function attach(el: HTMLElement): void { el.focus(); }"],
    ["Document return type", "export function doc(): Document { throw new Error(); }"],
    ["WebGL2RenderingContext field", "export interface R { gl: WebGL2RenderingContext }"],
    ["Worker type", "export type W = Worker;"],
    ["IDBDatabase type", "export type D = IDBDatabase;"],
    ["Date type", "export interface S { at: Date }"],
  ])("%s → @typescript-eslint/no-restricted-types", async (_label, code) => {
    const messages = await lintAt(SIM_FILE, code);
    expect(ruleIds(messages)).toContain("@typescript-eslint/no-restricted-types");
  });
});

describe("packages/sim may not use entropy or floats", () => {
  it.each([
    ["Math.random", "export const r = Math.random();", "no-restricted-properties"],
    ["Math.sqrt", "export const s = Math.sqrt(2);", "no-restricted-properties"],
    ["Math.sin", "export const s = Math.sin(1);", "no-restricted-properties"],
    ["Math.PI", "export const p = Math.PI;", "no-restricted-properties"],
    ["float literal", "export const half = 0.5;", "no-restricted-syntax"],
    ["float literal without leading zero", "export const q = .25;", "no-restricted-syntax"],
    ["parseFloat", 'export const f = parseFloat("1.5");', "no-restricted-syntax"],
  ])("%s → %s", async (_label, code, rule) => {
    const messages = await lintAt(SIM_FILE, code);
    expect(ruleIds(messages)).toContain(rule);
  });

  it("allows integer literals and integer-safe Math members", async () => {
    const messages = await lintAt(
      SIM_FILE,
      [
        "export const TICK_HZ = 10;",
        "export const million = 1_000_000;",
        "export const big = 1e6;",
        "export function clamp(a: number): number { return Math.max(0, Math.min(1000, Math.trunc(a))); }",
        "export function magnitude(a: number): number { return Math.abs(a); }",
      ].join("\n"),
    );
    expect(messages).toEqual([]);
  });
});

describe("packages/sim tests keep the render/DOM boundary but may use Node and vitest", () => {
  it("allows node:fs and vitest in a *.test.ts under packages/sim", async () => {
    const messages = await lintAt(
      SIM_TEST_FILE,
      ['import { readFileSync } from "node:fs";', 'import { expect, it } from "vitest";', 'it("reads", () => { expect(readFileSync).toBeDefined(); });'].join("\n"),
    );
    expect(messages).toEqual([]);
  });

  it("still rejects three and DOM types in a *.test.ts under packages/sim", async () => {
    const messages = await lintAt(
      SIM_TEST_FILE,
      ['import * as THREE from "three";', "export function f(el: HTMLElement): unknown { return [THREE, el]; }"].join("\n"),
    );
    expect(ruleIds(messages)).toContain("no-restricted-imports");
    expect(ruleIds(messages)).toContain("@typescript-eslint/no-restricted-types");
  });
});

describe("packages/lab and packages/content share the render/DOM ban and ban Math.random", () => {
  it.each([LAB_FILE, CONTENT_FILE])("%s: three, HTMLElement and Math.random are rejected", async (file) => {
    const messages = await lintAt(
      file,
      ['import * as THREE from "three";', "export function f(el: HTMLElement): number { return Math.random() + Number(THREE) + Number(el); }"].join("\n"),
    );
    const ids = ruleIds(messages);
    expect(ids).toContain("no-restricted-imports");
    expect(ids).toContain("@typescript-eslint/no-restricted-types");
    expect(ids).toContain("no-restricted-properties");
  });

  it.each([LAB_FILE, CONTENT_FILE])("%s: Node built-ins and the wall clock are allowed", async (file) => {
    const messages = await lintAt(
      file,
      ['import { readFileSync } from "node:fs";', "export const startedAt = Date.now();", "export const read = readFileSync;"].join("\n"),
    );
    expect(messages).toEqual([]);
  });
});

describe("apps/web is the only place rendering, DOM and floats are allowed", () => {
  it("accepts three, react, DOM types, timers and float literals under apps/web", async () => {
    const messages = await lintAt(
      WEB_FILE,
      [
        'import * as THREE from "three";',
        'import { useState } from "react";',
        "export const CAMERA_TILT_RADIANS = 0.785;",
        "export function mount(el: HTMLElement): void {",
        "  const w = window.innerWidth;",
        "  setTimeout(() => el.focus(), 1);",
        "  void [THREE, useState, w, Math.random(), performance.now()];",
        "}",
      ].join("\n"),
    );
    expect(messages).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// W0-04 acceptance 2: the compile-time dependency direction of INTERFACES.md
// ---------------------------------------------------------------------------

/** `import X from "<specifier>"` as a one-line probe module. */
const importing = (specifier: string): string => `import { X } from "${specifier}";\nexport const y = X;`;

describe("packages/sim/ai cannot reach core, spatial or any implementation", () => {
  it.each([
    ["core by relative path", "../core/tick.js"],
    ["core deep path", "../core/actions/gather.js"],
    ["spatial", "../spatial/index.js"],
    ["observer", "../observer/feed.js"],
    ["persistence", "../persistence/sections.js"],
    ["host", "../host/index.js"],
    ["story", "../story/guest.js"],
    ["core via the package subpath", "@lastclan/sim/core"],
  ])("%s → no-restricted-imports", async (_label, specifier) => {
    const messages = await lintAt(AI_FILE, importing(specifier));
    expect(ruleIds(messages)).toContain("no-restricted-imports");
    expect(messages.some((m) => (m.message ?? "").includes("dependency direction"))).toBe(true);
  });

  it.each([
    ["primitives", "../primitives/index.js"],
    ["contracts", "../contracts/index.js"],
    ["a sibling file inside ai", "./beliefs.js"],
  ])("may import %s", async (_label, specifier) => {
    expect(await lintAt(AI_FILE, importing(specifier))).toEqual([]);
  });

  it("the same direction applies inside ai tests — a test cannot invert the layering either", async () => {
    const messages = await lintAt(AI_TEST_FILE, importing("../core/tick.js"));
    expect(ruleIds(messages)).toContain("no-restricted-imports");
  });
});

describe("the rest of the dependency-direction table (contracts/INTERFACES.md)", () => {
  it.each([
    ["primitives may not import contracts", "packages/sim/primitives/__boundary_probe__.ts", "../contracts/index.js"],
    ["primitives may not import core", "packages/sim/primitives/__boundary_probe__.ts", "../core/tick.js"],
    ["contracts may not import core", CONTRACTS_FILE, "../core/tick.js"],
    ["contracts may not import ai", CONTRACTS_FILE, "../ai/decide.js"],
    ["core may not import ai", CORE_FILE, "../ai/decide.js"],
    ["core may not import spatial implementation", CORE_FILE, "../spatial/grid.js"],
    ["core may not import persistence", CORE_FILE, "../persistence/sections.js"],
    ["spatial may not import core", SPATIAL_FILE, "../core/tick.js"],
    ["observer may not import core", OBSERVER_FILE, "../core/tick.js"],
    ["persistence may not import core", PERSISTENCE_FILE, "../core/tick.js"],
  ])("%s", async (_label, file, specifier) => {
    const messages = await lintAt(file, importing(specifier));
    expect(ruleIds(messages)).toContain("no-restricted-imports");
  });

  it.each([
    ["core may import contracts", CORE_FILE, "../contracts/index.js"],
    ["spatial may import primitives", SPATIAL_FILE, "../primitives/index.js"],
    ["observer may import contracts", OBSERVER_FILE, "../contracts/index.js"],
    ["persistence may import primitives", PERSISTENCE_FILE, "../primitives/index.js"],
    ["host may import core", HOST_FILE, "../core/tick.js"],
    ["host may import ai", HOST_FILE, "../ai/decide.js"],
    ["host may import persistence", HOST_FILE, "../persistence/sections.js"],
  ])("%s", async (_label, file, specifier) => {
    expect(await lintAt(file, importing(specifier))).toEqual([]);
  });
});

describe("the render/DOM and purity bans survive the per-module rules", () => {
  it.each([CONTRACTS_FILE, CORE_FILE, AI_FILE, SPATIAL_FILE, OBSERVER_FILE, PERSISTENCE_FILE, HOST_FILE])(
    "%s still rejects three, node:fs, Math.random, float literals and DOM types",
    async (file) => {
      const ids = ruleIds(
        await lintAt(
          file,
          [
            'import * as THREE from "three";',
            'import { readFileSync } from "node:fs";',
            "export function f(el: HTMLElement): number {",
            "  void [THREE, readFileSync, el, window.innerWidth, Date.now()];",
            "  return Math.random() + 0.5;",
            "}",
          ].join("\n"),
        ),
      );
      for (const rule of ["no-restricted-imports", "@typescript-eslint/no-restricted-types", "no-restricted-globals", "no-restricted-properties", "no-restricted-syntax"]) {
        expect(ids, `${file} / ${rule}`).toContain(rule);
      }
    },
  );
});
