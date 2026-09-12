/**
 * Failure bundles (W0-06).
 *
 * When a run fails, the bundle is what someone else opens tomorrow. It carries
 * copies of everything the verdict depended on — the fixture, the event tape,
 * the log, the summary — plus the identity of the code that produced it and the
 * exact command that reproduces it.
 *
 * The `verdictDigest` covers only the inputs and the verdict, never the
 * timestamp or the absolute paths, so two runs of the same failure produce the
 * same digest. That is what makes "reproducible" a checkable claim rather than
 * an adjective: `clanlab inspect` recomputes it and says whether the bundle is
 * internally consistent.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

export const BUNDLE_VERSION = 1;
export const BUNDLE_FILES = {
  manifest: "bundle.json",
  fixture: "fixture.json",
  events: "events.json",
  log: "run.log",
  summary: "run-summary.json",
} as const;

export interface BundleFailure {
  readonly index: number;
  readonly kind: string;
  readonly expected?: string;
  readonly observed?: number;
  readonly detail: string;
  /** The tick the run had reached when the assertion was judged. */
  readonly evaluatedAtTick: number;
  readonly matchWindow?: { readonly fromTick: number; readonly throughTick: number | null };
  readonly nearMiss?: readonly { readonly type: string; readonly tick: number; readonly actorId?: string; readonly targetId?: string }[];
}

export interface BundleManifest {
  readonly bundleVersion: number;
  readonly createdAtIso: string;
  readonly verdictDigest: string;
  readonly status: "Failed" | "Invalid";
  readonly fixture: {
    readonly path: string;
    readonly sha256: string;
    readonly id: string | null;
    readonly gate: string | null;
    readonly profile: string | null;
    readonly seed: number | null;
    readonly maxTicks: number | null;
  };
  readonly identity: unknown;
  readonly host: unknown;
  readonly counts: Readonly<Record<string, number>>;
  readonly failures: readonly BundleFailure[];
  readonly validationErrors: readonly { readonly code: string; readonly path: string; readonly message: string }[];
  readonly artifacts: Readonly<Record<string, string | null>>;
  readonly reproduce: { readonly command: string; readonly note: string };
}

export interface WriteBundleInput {
  readonly directory: string;
  readonly createdAtIso: string;
  readonly status: "Failed" | "Invalid";
  readonly fixture: BundleManifest["fixture"];
  readonly fixtureText: string;
  readonly eventsText?: string;
  readonly eventsSha256?: string;
  readonly logText: string;
  readonly runSummary: unknown;
  readonly identity: unknown;
  readonly host: unknown;
  readonly counts: Readonly<Record<string, number>>;
  readonly failures: readonly BundleFailure[];
  readonly validationErrors: BundleManifest["validationErrors"];
  readonly reproduceCommand: string;
}

function sha256Hex(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

/**
 * The part of a bundle that must not vary between two runs of the same failure:
 * the inputs by hash, the verdict, and the failures with their evidence. Paths
 * and clock time are excluded on purpose.
 */
export function verdictDigest(input: {
  readonly status: string;
  readonly fixtureSha256: string;
  readonly eventsSha256: string | null;
  readonly hostKind: string;
  readonly failures: readonly BundleFailure[];
  readonly validationErrors: BundleManifest["validationErrors"];
}): string {
  const canonical = JSON.stringify({
    status: input.status,
    fixtureSha256: input.fixtureSha256,
    eventsSha256: input.eventsSha256,
    hostKind: input.hostKind,
    failures: input.failures.map((f) => ({
      index: f.index,
      kind: f.kind,
      expected: f.expected ?? null,
      observed: f.observed ?? null,
      detail: f.detail,
      evaluatedAtTick: f.evaluatedAtTick,
      matchWindow: f.matchWindow ?? null,
      nearMiss: (f.nearMiss ?? []).map((e) => [e.type, e.tick, e.actorId ?? null, e.targetId ?? null]),
    })),
    validationErrors: input.validationErrors.map((e) => [e.code, e.path, e.message]),
  });
  return sha256Hex(canonical);
}

export function writeFailureBundle(input: WriteBundleInput): { readonly directory: string; readonly manifest: BundleManifest } {
  mkdirSync(input.directory, { recursive: true });
  writeFileSync(join(input.directory, BUNDLE_FILES.fixture), input.fixtureText);
  writeFileSync(join(input.directory, BUNDLE_FILES.log), input.logText);
  writeFileSync(join(input.directory, BUNDLE_FILES.summary), `${JSON.stringify(input.runSummary, null, 1)}\n`);
  if (input.eventsText !== undefined) writeFileSync(join(input.directory, BUNDLE_FILES.events), input.eventsText);

  const manifest: BundleManifest = {
    bundleVersion: BUNDLE_VERSION,
    createdAtIso: input.createdAtIso,
    verdictDigest: verdictDigest({
      status: input.status,
      fixtureSha256: input.fixture.sha256,
      eventsSha256: input.eventsSha256 ?? null,
      hostKind: (input.host as { kind?: string }).kind ?? "unknown",
      failures: input.failures,
      validationErrors: input.validationErrors,
    }),
    status: input.status,
    fixture: input.fixture,
    identity: input.identity,
    host: input.host,
    counts: input.counts,
    failures: input.failures,
    validationErrors: input.validationErrors,
    artifacts: {
      fixture: BUNDLE_FILES.fixture,
      events: input.eventsText === undefined ? null : BUNDLE_FILES.events,
      log: BUNDLE_FILES.log,
      summary: BUNDLE_FILES.summary,
    },
    reproduce: {
      command: input.reproduceCommand,
      note: "Run it from the repository root. The copies in this bundle are the exact inputs the verdict used; their hashes are recorded above and checked by `clanlab inspect`.",
    },
  };
  writeFileSync(join(input.directory, BUNDLE_FILES.manifest), `${JSON.stringify(manifest, null, 1)}\n`);
  return { directory: input.directory, manifest };
}

export interface BundleIntegrity {
  readonly fixtureCopyMatches: boolean;
  readonly eventsCopyMatches: boolean | null;
  readonly verdictDigestMatches: boolean;
  readonly missingArtifacts: readonly string[];
}

export type ReadBundleResult =
  | { readonly ok: true; readonly manifest: BundleManifest; readonly integrity: BundleIntegrity; readonly directory: string }
  | { readonly ok: false; readonly errors: readonly { readonly code: string; readonly message: string }[] };

/** Reopen a bundle and check it against itself: copies, hashes and the recomputed verdict digest. */
export function readFailureBundle(directory: string): ReadBundleResult {
  const manifestPath = join(directory, BUNDLE_FILES.manifest);
  let manifest: BundleManifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as BundleManifest;
  } catch (e) {
    return { ok: false, errors: [{ code: "BundleUnreadable", message: `${manifestPath}: ${(e as Error).message}` }] };
  }
  if (manifest.bundleVersion !== BUNDLE_VERSION) {
    return { ok: false, errors: [{ code: "BundleUnknownVersion", message: `this build reads bundle v${BUNDLE_VERSION}; got ${String(manifest.bundleVersion)}` }] };
  }

  const missing: string[] = [];
  for (const [name, file] of Object.entries(manifest.artifacts)) {
    if (file === null) continue;
    if (!existsSync(join(directory, basename(file)))) missing.push(`${name} (${file})`);
  }

  const fixtureMatches = ((): boolean => {
    try {
      return sha256Hex(readFileSync(join(directory, BUNDLE_FILES.fixture), "utf8")) === manifest.fixture.sha256;
    } catch {
      return false;
    }
  })();

  let eventsMatches: boolean | null = null;
  const eventsArtifact = manifest.artifacts["events"];
  if (typeof eventsArtifact === "string") {
    const recorded = (manifest.host as { tape?: { sha256?: string } }).tape?.sha256;
    try {
      const actual = sha256Hex(readFileSync(join(directory, BUNDLE_FILES.events), "utf8"));
      eventsMatches = recorded === undefined ? null : actual === recorded;
    } catch {
      eventsMatches = false;
    }
  }

  const recomputed = verdictDigest({
    status: manifest.status,
    fixtureSha256: manifest.fixture.sha256,
    eventsSha256: (manifest.host as { tape?: { sha256?: string } }).tape?.sha256 ?? null,
    hostKind: (manifest.host as { kind?: string }).kind ?? "unknown",
    failures: manifest.failures,
    validationErrors: manifest.validationErrors,
  });

  return {
    ok: true,
    manifest,
    directory,
    integrity: {
      fixtureCopyMatches: fixtureMatches,
      eventsCopyMatches: eventsMatches,
      verdictDigestMatches: recomputed === manifest.verdictDigest,
      missingArtifacts: missing,
    },
  };
}

/** Copy a file into a bundle directory (used when the caller already has a path rather than text). */
export function copyInto(directory: string, source: string, name: string): void {
  mkdirSync(directory, { recursive: true });
  copyFileSync(source, join(directory, name));
}
