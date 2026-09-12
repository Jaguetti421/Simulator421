/**
 * Identity for a run summary (W0-06).
 *
 * Every summary says which code produced it, which contract version it read and
 * which content and map geometry it used. Where a thing does not exist yet
 * (there is no compiled content catalog and no map compiler), the identity says
 * so explicitly with the packet that will supply it — it never reports an empty
 * string or a zero that could be mistaken for a real identity.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { contracts } from "@lastclan/sim";

export const CLANLAB_SUMMARY_SCHEMA_VERSION = 1;

export interface BuildIdentity {
  readonly tool: "clanlab";
  readonly version: string;
  /** sha256 over the executing code (sorted path + content), so two summaries from different builds cannot look identical. */
  readonly sourceDigest: string;
  /** Which form of the code ran: the compiled package or the TypeScript sources under vitest. */
  readonly sourceKind: "dist" | "source";
  readonly files: number;
}

export interface ContractIdentity {
  readonly version: number;
  /** sha256 over every emitted record schema, in name order: a changed contract changes this. */
  readonly recordsDigest: string;
  readonly records: number;
  readonly reasonIds: number;
}

export interface UnavailableIdentity {
  readonly status: "Unavailable";
  readonly reason: string;
  readonly availableFrom: string;
}

export interface GeometryIdentity {
  readonly recipeId: string;
  readonly seed: number;
  readonly compiled: UnavailableIdentity;
}

export interface RunIdentity {
  readonly build: BuildIdentity;
  readonly contract: ContractIdentity;
  readonly content: UnavailableIdentity;
  readonly fixtureDslVersion: number;
}

export function sha256(text: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function listCodeFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir).sort()) {
      if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if ((entry.endsWith(".js") || entry.endsWith(".ts")) && !entry.includes(".test.") && !entry.endsWith(".d.ts")) {
        out.push(full);
      }
    }
  };
  walk(root);
  return out;
}

/**
 * Identity of the code that is executing. The digest covers the lab package's
 * own modules — the runner, the fixture DSL and the bundle writer — because
 * those decide what a summary says.
 */
export function buildIdentity(version: string): BuildIdentity {
  const here = dirname(fileURLToPath(import.meta.url)); // .../packages/lab/cli or .../packages/lab/dist/cli
  const packageRoot = dirname(here);
  const sourceKind = packageRoot.split(sep).at(-1) === "dist" ? "dist" : "source";
  const files = listCodeFiles(packageRoot);
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(relative(packageRoot, file).split(sep).join("/"));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return { tool: "clanlab", version, sourceDigest: `sha256:${hash.digest("hex")}`, sourceKind, files: files.length };
}

/** Identity of the frozen contract surface this build reads (W0-04, design version 0). */
export function contractIdentity(): ContractIdentity {
  const names = Object.keys(contracts.CONTRACT_RECORDS).sort();
  const hash = createHash("sha256");
  for (const name of names) {
    const shape = contracts.CONTRACT_RECORDS[name];
    if (shape === undefined) continue;
    hash.update(name);
    hash.update("\0");
    hash.update(JSON.stringify(contracts.toJsonSchema(shape, name)));
    hash.update("\0");
  }
  return {
    version: contracts.CONTRACT_SCHEMA_VERSION,
    recordsDigest: `sha256:${hash.digest("hex")}`,
    records: names.length,
    reasonIds: contracts.MANDATORY_V0_REASON_IDS.length,
  };
}

export const CONTENT_UNAVAILABLE: UnavailableIdentity = {
  status: "Unavailable",
  reason: "no compiled content catalog exists yet, so item, goal and profile-override IDs were not checked",
  availableFrom: "content packets (P1+)",
};

export const GEOMETRY_UNAVAILABLE: UnavailableIdentity = {
  status: "Unavailable",
  reason: "no map compiler exists yet, so the map recipe was not compiled and its geometry has no digest",
  availableFrom: "map compiler (P1)",
};

export function runIdentity(version: string): RunIdentity {
  return { build: buildIdentity(version), contract: contractIdentity(), content: CONTENT_UNAVAILABLE, fixtureDslVersion: 1 };
}

export function geometryIdentity(recipeId: string, seed: number): GeometryIdentity {
  return { recipeId, seed, compiled: GEOMETRY_UNAVAILABLE };
}
