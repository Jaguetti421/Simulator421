/**
 * `clanlab inspect --failure <directory>` (W0-06).
 *
 * Reopens a failure bundle and prints what someone needs to act on it: the
 * failing assertions with the tick they were judged at, the evidence paths, and
 * the command that reproduces the run. It also checks the bundle against itself
 * — the copied fixture and tape must hash to what the manifest recorded, and the
 * verdict digest must recompute — because a bundle that quietly disagrees with
 * its own inputs is worse than a missing one.
 *
 * The status says plainly that a failed run is being reopened, so a zero exit
 * (the bundle is intact) can never be read as "the fixture passed".
 */
import { join, resolve } from "node:path";
import { readFailureBundle } from "../bundle/index.js";
import type { BundleFailure, BundleIntegrity, BundleManifest } from "../bundle/index.js";

export interface InspectOutput {
  readonly tool: "clanlab";
  readonly command: "inspect";
  readonly status: "FAILED_RUN_REOPENED" | "BUNDLE_UNUSABLE";
  readonly bundle: {
    readonly directory: string;
    readonly bundleVersion?: number;
    readonly createdAtIso?: string;
    readonly verdictDigest?: string;
    readonly runStatus?: BundleManifest["status"];
  };
  readonly integrity?: BundleIntegrity & { readonly intact: boolean };
  readonly fixture?: BundleManifest["fixture"];
  readonly host?: unknown;
  readonly counts?: Readonly<Record<string, number>>;
  readonly failures?: readonly BundleFailure[];
  readonly validationErrors?: BundleManifest["validationErrors"];
  readonly evidence?: Readonly<Record<string, string | null>>;
  readonly reproduce?: BundleManifest["reproduce"];
  readonly errors?: readonly { readonly code: string; readonly message: string }[];
  readonly note: string;
}

export function inspectBundle(directory: string): { readonly output: InspectOutput; readonly exitCode: number } {
  const result = readFailureBundle(directory);
  if (!result.ok) {
    return {
      exitCode: 1,
      output: {
        tool: "clanlab",
        command: "inspect",
        status: "BUNDLE_UNUSABLE",
        bundle: { directory },
        errors: result.errors,
        note: "The bundle could not be reopened. Nothing about the original run can be concluded from this directory.",
      },
    };
  }

  const { manifest, integrity } = result;
  const intact =
    integrity.fixtureCopyMatches && integrity.verdictDigestMatches && integrity.missingArtifacts.length === 0 && integrity.eventsCopyMatches !== false;

  const evidence: Record<string, string | null> = {};
  for (const [name, file] of Object.entries(manifest.artifacts)) {
    evidence[name] = file === null ? null : resolve(join(directory, file));
  }

  return {
    exitCode: intact ? 0 : 1,
    output: {
      tool: "clanlab",
      command: "inspect",
      status: "FAILED_RUN_REOPENED",
      bundle: {
        directory: resolve(directory),
        bundleVersion: manifest.bundleVersion,
        createdAtIso: manifest.createdAtIso,
        verdictDigest: manifest.verdictDigest,
        runStatus: manifest.status,
      },
      integrity: { ...integrity, intact },
      fixture: manifest.fixture,
      host: manifest.host,
      counts: manifest.counts,
      failures: manifest.failures,
      validationErrors: manifest.validationErrors,
      evidence,
      reproduce: manifest.reproduce,
      note: intact
        ? "This is a reopened failing run, not a pass. Exit 0 means the bundle is internally consistent: the copied inputs hash to what the manifest recorded and the verdict digest recomputes."
        : "The bundle is inconsistent with its own recorded hashes — treat its verdict as unproven and re-run from the original inputs.",
    },
  };
}
