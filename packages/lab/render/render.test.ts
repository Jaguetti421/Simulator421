import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { host as simHost, persistence } from "@lastclan/sim";
import {
  ACTION_ICONS,
  assessReadability,
  buildScene,
  contrastRatio,
  drawScene,
  iconDistinctness,
  nameplateOverlaps,
  PALETTE,
  READABILITY_THRESHOLDS,
  RENDERER_ID,
  RING_CLASSES,
  readPngText,
  renderFixture,
  renderSnapshot,
  toLatin1,
} from "./index.js";
import type { WorldSnapshot } from "./scene.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const FIXTURE = join(repoRoot, "tests/fixtures/PRESENT-READ-01.json");

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "clanlab-render-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function snapshotAt(tick: number): WorldSnapshot {
  const host = simHost.SimHost.create({ matchSeed: 4107 as never, withGuest: true });
  host.runTicks(tick);
  return persistence.decodeWorldSnapshot(host.save());
}

describe("the renderer is pure over the snapshot", () => {
  it("produces identical bytes for the same snapshot, twice", () => {
    const snapshot = snapshotAt(200);
    const meta = { fixture: "PRESENT-READ-01", tick: 200, buildHash: "sha256:test" };
    const first = renderSnapshot(snapshot, meta);
    const second = renderSnapshot(snapshot, meta);
    expect(second.png.equals(first.png)).toBe(true);
    expect(second.scene).toEqual(first.scene);
  });

  it("produces different bytes for a different tick, so a stale image cannot pass as fresh", () => {
    const meta = { fixture: "PRESENT-READ-01", tick: 0, buildHash: "sha256:test" };
    const a = renderSnapshot(snapshotAt(100), { ...meta, tick: 100 });
    const b = renderSnapshot(snapshotAt(200), { ...meta, tick: 200 });
    expect(b.png.equals(a.png)).toBe(false);
  });

  it("builds the scene without drawing, so layout can be asserted without a raster", () => {
    const scene = buildScene(snapshotAt(50));
    expect(scene.actors).toHaveLength(137);
    expect(scene.actors.every((a) => a.x >= 0 && a.x <= scene.width && a.y >= 0 && a.y <= scene.height)).toBe(true);
    expect(scene.terrain.status).toBe("Unavailable");
    expect(scene.terrain.availableFrom).toContain("map compiler");
  });
});

describe("PNG metadata", () => {
  it("carries the fixture, tick and build hash inside the image", () => {
    const { png } = renderSnapshot(snapshotAt(10), { fixture: "PRESENT-READ-01", tick: 10, buildHash: "sha256:abc123" });
    const text = readPngText(png);
    expect(text["Fixture"]).toBe("PRESENT-READ-01");
    expect(text["Tick"]).toBe("10");
    expect(text["BuildHash"]).toBe("sha256:abc123");
    expect(text["Software"]).toBe(RENDERER_ID);
    expect(text["Terrain"]).toContain("Unavailable");
  });

  it("transliterates text PNG cannot carry, rather than writing bytes that decode as something else", () => {
    const { png } = renderSnapshot(snapshotAt(1), { fixture: "f", tick: 1, buildHash: "h" });
    const text = readPngText(png);
    expect(text["Terrain"]).toContain("map compiler (P1) - no terrain classes");
    expect(text["Terrain"]).not.toContain("\u0014");
    expect(toLatin1("a \u2014 b \u4e2d")).toBe("a - b ?");
  });

  it("still decodes as a PNG after the metadata is inserted", () => {
    const { png } = renderSnapshot(snapshotAt(1), { fixture: "f", tick: 1, buildHash: "h" });
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.subarray(png.byteLength - 8).toString("latin1")).toContain("IEND");
  });
});

describe("readability assertions (thresholds are TUNE)", () => {
  it("counts overlapping nameplates and stays under the threshold on the synthetic scene", () => {
    const scene = buildScene(snapshotAt(300));
    const report = assessReadability(scene, iconDistinctness());
    expect(report.nameplates.total).toBe(137);
    expect(report.nameplates.ratio).toBeLessThanOrEqual(READABILITY_THRESHOLDS.maxNameplateOverlapRatio);
    expect(report.nameplates.pass).toBe(true);
    expect(report.thresholdStatus).toBe("TUNE");
  });

  it("actually detects crowding: a scene with every actor stacked fails the overlap check", () => {
    const snapshot = snapshotAt(10);
    const stacked = { ...snapshot, actors: snapshot.actors.map((a) => ({ ...a, xMm: 400_000, yMm: 400_000 })) };
    const report = assessReadability(buildScene(stacked), iconDistinctness());
    expect(nameplateOverlaps(buildScene(stacked))).toBe(137);
    expect(report.nameplates.pass).toBe(false);
    expect(report.pass).toBe(false);
  });

  it("keeps every ring above the contrast floor, against both the disc and the ground", () => {
    const report = assessReadability(buildScene(snapshotAt(10)), iconDistinctness());
    expect(report.ringContrast.minimum).toBeGreaterThanOrEqual(READABILITY_THRESHOLDS.minRingContrast);
    for (const color of Object.values(RING_CLASSES)) {
      expect(contrastRatio(color, PALETTE.discFill)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(color, PALETTE.terrainUnavailable)).toBeGreaterThanOrEqual(3);
    }
    expect(report.ringContrast.pass).toBe(true);
  });

  it("proves the twelve action icons rasterize differently, rather than trusting their names", () => {
    const distinctness = iconDistinctness();
    expect(ACTION_ICONS).toHaveLength(12);
    expect(distinctness.distinct).toBe(12);
    expect(distinctness.duplicates).toEqual([]);
    expect(new Set(Object.values(distinctness.digests)).size).toBe(12);
  });

  it("fails the icon check when two icons are indistinguishable", () => {
    const report = assessReadability(buildScene(snapshotAt(10)), { distinct: 11, duplicates: ["walk == flee"] });
    expect(report.actionIcons.pass).toBe(false);
    expect(report.pass).toBe(false);
  });

  it("says in the report that the icon names are provisional", () => {
    const report = assessReadability(buildScene(snapshotAt(10)), iconDistinctness());
    expect(report.actionIcons.note).toContain("provisional");
    expect(READABILITY_THRESHOLDS.tuneNote).toContain("TUNE");
  });
});

describe("clanlab render", () => {
  it("renders PRESENT-READ-01 to a PNG with metadata and exits 0", () => {
    const out = join(dir, "present-read-01.png");
    const result = renderFixture({ fixturePath: FIXTURE, tick: 300, outPath: out, version: "test" });
    expect("summary" in result).toBe(true);
    if (!("summary" in result)) return;
    expect(result.exitCode).toBe(0);
    expect(result.summary.scene.actors).toBe(137);
    expect(result.summary.readability.pass).toBe(true);
    expect(result.summary.pngSha256).toMatch(/^sha256:[0-9a-f]{64}$/u);

    const text = readPngText(readFileSync(out));
    expect(text["Fixture"]).toBe("PRESENT-READ-01");
    expect(text["Tick"]).toBe("300");
    expect(text["BuildHash"]).toMatch(/^sha256:/u);
  });

  it("lists what it could not draw instead of drawing something it made up", () => {
    const result = renderFixture({ fixturePath: FIXTURE, tick: 10, outPath: join(dir, "a.png"), version: "test" });
    if (!("summary" in result)) throw new Error("expected a summary");
    expect(result.summary.skippedChecks.map((s) => s.code)).toEqual(["TerrainUnavailable", "RingEncodesKindNotClan", "ActionStatesNotAssigned"]);
    expect(result.summary.note).toContain("not for 3D quality");
  });

  it("refuses a tick outside the fixture's range and an unreadable fixture", () => {
    const bad = renderFixture({ fixturePath: FIXTURE, tick: 10_000, outPath: join(dir, "b.png"), version: "test" });
    expect(bad.exitCode).toBe(2);
    const missing = renderFixture({ fixturePath: join(dir, "nope.json"), tick: 0, outPath: join(dir, "c.png"), version: "test" });
    expect(missing.exitCode).toBe(1);
  });

  it("writes a PNG whose bytes match the summary hash, so the record and the image cannot drift", () => {
    const out = join(dir, "hashed.png");
    const result = renderFixture({ fixturePath: FIXTURE, tick: 120, outPath: out, version: "test" });
    if (!("summary" in result)) throw new Error("expected a summary");
    const rendered = drawScene(buildScene(snapshotAt(120)));
    expect(rendered.byteLength).toBeGreaterThan(0);
    expect(readFileSync(out).byteLength).toBe(result.summary.bytes);
  });
});

describe("fixture DSL v2 tool checks (12 Sep debt pass)", () => {
  it("performs the readability checks the fixture states, instead of leaving them in a test", () => {
    const result = renderFixture({ fixturePath: FIXTURE, tick: 300, outPath: join(dir, "tc.png"), version: "test" });
    if (!("summary" in result)) throw new Error("expected a summary");
    expect(result.summary.toolChecks.map((c) => c.check)).toEqual([
      "NameplateOverlapWithinThreshold",
      "RingContrastAboveThreshold",
      "ActionIconsDistinct",
    ]);
    expect(result.summary.toolChecks.every((c) => c.status === "Passed")).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it("fails the run when a stated check does not hold", () => {
    const raw = JSON.parse(readFileSync(FIXTURE, "utf8")) as { assertions: unknown[] };
    const path = join(dir, "expect-fail.json");
    writeFileSync(
      path,
      `${JSON.stringify({ ...raw, id: "PRESENT-READ-02", assertions: [{ kind: "ToolCheck", check: "ActionIconsDistinct", expect: "Fail" }] }, null, 1)}\n`,
    );
    const result = renderFixture({ fixturePath: path, tick: 10, outPath: join(dir, "tc2.png"), version: "test" });
    if (!("summary" in result)) throw new Error("expected a summary");
    // The icons ARE distinct, so a fixture claiming they are not must fail.
    expect(result.summary.toolChecks[0]?.status).toBe("Failed");
    expect(result.exitCode).toBe(1);
  });
});
