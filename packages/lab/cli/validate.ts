/**
 * `clanlab validate --fixture <path> [--summary <json>]` (W0-05).
 *
 * Validates fixtures without constructing a world or running anything. The
 * summary is machine-readable and distinguishes four counts that must never be
 * conflated: valid, invalid, skipped checks (could not be run here) and blocked
 * assertions (known and well formed, but needing a simulation that does not
 * exist yet). Exit 0 means every requested **supported** check passed.
 */
import { readFileSync, statSync } from "node:fs";
import { evaluateAll, parseFixtureText } from "../fixture/index.js";
import type { FixtureError, FixtureSkippedCheck } from "../fixture/index.js";

export interface FixtureValidationReport {
  readonly file: string;
  readonly status: "Valid" | "Invalid" | "Unreadable";
  readonly id?: string;
  readonly gate?: string;
  readonly profile?: string;
  readonly evidenceStatus?: string;
  readonly errors: readonly FixtureError[];
  readonly skippedChecks: readonly FixtureSkippedCheck[];
  readonly assertions?: { readonly requested: number; readonly blocked: number; readonly blockedDetail: readonly string[] };
}

export interface ValidateSummary {
  readonly tool: "clanlab";
  readonly command: "validate";
  readonly fixtureDslVersion: number;
  readonly contractVersion: number;
  readonly requested: number;
  readonly valid: number;
  readonly invalid: number;
  readonly unreadable: number;
  readonly skippedChecks: number;
  readonly blockedAssertions: number;
  readonly note: string;
  readonly reports: readonly FixtureValidationReport[];
}

export function validateFixtureFile(file: string): FixtureValidationReport {
  let text: string;
  let bytes: number;
  try {
    bytes = statSync(file).size;
    text = readFileSync(file, "utf8");
  } catch (e) {
    return { file, status: "Unreadable", errors: [{ code: "MalformedJson", path: "/", message: (e as Error).message }], skippedChecks: [] };
  }

  const result = parseFixtureText(text, { inputBytes: bytes });
  if (!result.ok) {
    return { file, status: "Invalid", errors: result.errors, skippedChecks: result.skipped };
  }
  // Validation does not run the fixture, so every assertion is reported as
  // blocked with the packet that will make it evaluable — never as passed.
  const summary = evaluateAll(result.fixture.assertions, undefined);
  return {
    file,
    status: "Valid",
    id: result.fixture.id,
    gate: result.fixture.gate,
    profile: result.fixture.profile.kind,
    evidenceStatus: result.fixture.evidenceStatus,
    errors: [],
    skippedChecks: result.skipped,
    assertions: {
      requested: summary.requested,
      blocked: summary.blocked,
      blockedDetail: summary.outcomes.filter((o) => o.status === "Blocked").map((o) => `${o.kind}: ${o.detail ?? ""} (${o.availableFrom ?? "unknown packet"})`),
    },
  };
}

export function buildSummary(reports: readonly FixtureValidationReport[]): ValidateSummary {
  return {
    tool: "clanlab",
    command: "validate",
    fixtureDslVersion: 1,
    contractVersion: 0,
    requested: reports.length,
    valid: reports.filter((r) => r.status === "Valid").length,
    invalid: reports.filter((r) => r.status === "Invalid").length,
    unreadable: reports.filter((r) => r.status === "Unreadable").length,
    skippedChecks: reports.reduce((n, r) => n + r.skippedChecks.length, 0),
    blockedAssertions: reports.reduce((n, r) => n + (r.assertions?.blocked ?? 0), 0),
    note: "validate parses and checks fixtures; it does not construct a world or run anything. Blocked assertions are not passes (clanlab run arrives in W0-06).",
    reports,
  };
}
