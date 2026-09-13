/**
 * `clanlab render --fixture <f> --tick <t> --out <png>` (W0-09).
 *
 * The snapshot comes from the real kernel: the fixture's map seed builds the
 * world, the host advances it to the requested tick, and the snapshot codec
 * (W0-08) produces the plain-data state the scene is built from. Nothing is
 * mocked, and the PNG carries the fixture, tick and build hash so a picture can
 * never be separated from what produced it.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { core, host as simHost, persistence } from "@lastclan/sim";
import { parseFixtureText } from "../fixture/index.js";
import { buildIdentity } from "../cli/identity.js";
import { assessReadability } from "./scene.js";
import { iconDistinctness, renderSnapshot, RENDERER_ID } from "./draw.js";

export interface RenderOptions {
  readonly fixturePath: string;
  readonly tick: number;
  readonly outPath: string;
  readonly version: string;
  readonly width?: number;
  readonly height?: number;
}

export interface RenderSummary {
  readonly tool: "clanlab";
  readonly command: "render";
  readonly renderer: string;
  readonly fixture: { readonly path: string; readonly id: string; readonly seed: number; readonly declaredActors: number };
  readonly tick: number;
  readonly out: string;
  readonly bytes: number;
  readonly pngSha256: string;
  readonly scene: { readonly width: number; readonly height: number; readonly actors: number; readonly laws: number; readonly terrain: unknown };
  readonly readability: ReturnType<typeof assessReadability>;
  /** Verdicts for the fixture's own `ToolCheck` assertions (fixture DSL v2). */
  readonly toolChecks: readonly { readonly check: string; readonly expect: string; readonly observed?: string; readonly status: "Passed" | "Failed" | "Blocked"; readonly detail?: string }[];
  readonly skippedChecks: readonly { readonly code: string; readonly message: string; readonly availableFrom: string }[];
  readonly buildHash: string;
  readonly note: string;
}

export function renderFixture(options: RenderOptions): { summary: RenderSummary; exitCode: number } | { error: string; exitCode: number } {
  let text: string;
  try {
    text = readFileSync(options.fixturePath, "utf8");
  } catch (e) {
    return { error: `${options.fixturePath}: ${(e as Error).message}`, exitCode: 1 };
  }
  const parsed = parseFixtureText(text, { inputBytes: Buffer.byteLength(text, "utf8") });
  if (!parsed.ok) {
    return { error: `${options.fixturePath}: ${parsed.errors.map((e) => `${e.code} at ${e.path}`).join(", ")}`, exitCode: 1 };
  }
  const fixture = parsed.fixture;
  if (options.tick < 0 || options.tick > fixture.maxTicks) {
    return { error: `--tick ${options.tick} is outside the fixture's range 0..${fixture.maxTicks}`, exitCode: 2 };
  }

  const withGuest = fixture.setup.actors.some((a) => a.id.startsWith("G"));
  const host = simHost.SimHost.create({ matchSeed: fixture.map.seed as never, withGuest });
  host.runTicks(options.tick);
  const snapshot = persistence.decodeWorldSnapshot(host.save());

  const skippedChecks = [
    {
      code: "TerrainUnavailable",
      message: "no map compiler exists, so terrain classes were not drawn; the ground is one declared 'unavailable' class",
      availableFrom: "map compiler (P1)",
    },
    {
      code: "RingEncodesKindNotClan",
      message: "clans do not exist yet, so the actor ring encodes actor kind; the contrast check measures the ring either way",
      availableFrom: "clan packets (P2)",
    },
    {
      code: "ActionStatesNotAssigned",
      message: "no actor has an action state yet, so icons are assigned deterministically from actor id purely to exercise the icon set",
      availableFrom: "the packet that implements actions (P1)",
    },
  ];
  const declaredIds = fixture.setup.actors.map((a) => a.id).join(",");
  const worldIds = snapshot.actors.map((a) => a.id).join(",");
  if (declaredIds !== worldIds) {
    skippedChecks.push({
      code: "FixtureSetupNotApplied",
      message: "the world is built from the fixture's map seed, not from its declared setup actors, so this render does not show the declared roster",
      availableFrom: "the packet that seeds a world from fixture setup (P1)",
    });
  }

  const build = buildIdentity(options.version);
  const { png, scene } = renderSnapshot(
    snapshot,
    { fixture: fixture.id, tick: options.tick, buildHash: build.sourceDigest },
    { ...(options.width === undefined ? {} : { width: options.width }), ...(options.height === undefined ? {} : { height: options.height }) },
  );

  mkdirSync(dirname(options.outPath), { recursive: true });
  writeFileSync(options.outPath, png);

  const readability = assessReadability(scene, iconDistinctness());

  // Fixture DSL v2: the fixture can now *state* its readability claims, and this
  // is the tool that performs them. A check the renderer does not provide stays
  // Blocked rather than being counted either way.
  const checkResults: Record<string, boolean> = {
    NameplateOverlapWithinThreshold: readability.nameplates.pass,
    RingContrastAboveThreshold: readability.ringContrast.pass,
    ActionIconsDistinct: readability.actionIcons.pass,
  };
  const toolChecks = fixture.assertions
    .filter((a): a is Extract<typeof a, { kind: "ToolCheck" }> => a.kind === "ToolCheck")
    .map((a) => {
      const actual = checkResults[a.check];
      if (actual === undefined) {
        return { check: a.check, expect: a.expect, status: "Blocked" as const, detail: "the readability renderer does not perform this check" };
      }
      const verdict = actual ? "Pass" : "Fail";
      return { check: a.check, expect: a.expect, observed: verdict, status: verdict === a.expect ? ("Passed" as const) : ("Failed" as const) };
    });
  return {
    exitCode: readability.pass && toolChecks.every((c) => c.status !== "Failed") ? (toolChecks.some((c) => c.status === "Blocked") ? 4 : 0) : 1,
    summary: {
      tool: "clanlab",
      command: "render",
      renderer: RENDERER_ID,
      fixture: { path: options.fixturePath, id: fixture.id, seed: fixture.map.seed, declaredActors: fixture.setup.actors.length },
      tick: options.tick,
      out: options.outPath,
      bytes: png.byteLength,
      pngSha256: `sha256:${createHash("sha256").update(png).digest("hex")}`,
      scene: { width: scene.width, height: scene.height, actors: scene.actors.length, laws: scene.laws.length, terrain: scene.terrain },
      readability,
      toolChecks,
      skippedChecks,
      buildHash: build.sourceDigest,
      note: `${core.WORKLOAD_OMISSIONS.length} workload omissions apply (the world is the W0-07 synthetic kernel). This is evidence for layout and readability, not for 3D quality.`,
    },
  };
}


