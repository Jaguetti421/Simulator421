/**
 * The readability scene (W0-09; TP v2.0 §13 "Readability renderer").
 *
 * A deterministic 2D top-down view of a snapshot: terrain classes, law
 * boundaries, actors as discs with a ring, a headwear glyph, an action icon and
 * a nameplate. This module is **pure data** — it computes the scene and its
 * readability metrics without touching a canvas, so both can be asserted in a
 * test without rendering anything, and so the drawing layer has nothing to
 * decide.
 *
 * What is real here and what is standing in:
 *   - actor positions, kinds, ids and the law circles are real snapshot state;
 *   - terrain classes are **not** — no map compiler exists (W0-07 records map
 *     geometry as Unavailable), so the ground is drawn as one declared
 *     `unavailable` class rather than invented biomes;
 *   - the ring encodes actor **kind**, because clans do not exist until P2. The
 *     contrast assertion is on the ring colours either way, so the check
 *     survives the swap;
 *   - the twelve action-state icons exist as a distinguishable set, but their
 *     canonical names are frozen by the packet that implements actions. They are
 *     marked provisional and no snapshot assigns them yet.
 */
import type { persistence } from "@lastclan/sim";

/** The plain-data snapshot the persistence codec produces (W0-08). */
export type WorldSnapshot = ReturnType<typeof persistence.decodeWorldSnapshot>;

export const SCENE_VERSION = 1;
export const ENVELOPE_MM = 800_000;

// ---------------------------------------------------------------------------
// Palette and contrast
// ---------------------------------------------------------------------------

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export function rgb(hex: string): Rgb {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

export function hex(color: Rgb): string {
  const part = (n: number): string => n.toString(16).padStart(2, "0");
  return `#${part(color.r)}${part(color.g)}${part(color.b)}`;
}

/** WCAG relative luminance. */
export function relativeLuminance(color: Rgb): number {
  const channel = (raw: number): number => {
    const c = raw / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

/** WCAG contrast ratio, 1:1 (identical) to 21:1 (black on white). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

export const PALETTE = {
  background: rgb("#12161c"),
  /** The one terrain class this build can honestly draw: "not compiled yet". */
  terrainUnavailable: rgb("#1b2028"),
  grid: rgb("#242b35"),
  lawBoundary: rgb("#e8b33a"),
  lawFill: rgb("#3a3320"),
  discFill: rgb("#0d1117"),
  nameplate: rgb("#e6edf3"),
  nameplateShadow: rgb("#05070a"),
  glyph: rgb("#e6edf3"),
} as const;

/**
 * Ring classes. At W0-09 a ring encodes the actor's kind; when clans land (P2)
 * the same slot carries clan colour. Colours are chosen for contrast against
 * `discFill`, which the readability check measures rather than assumes.
 */
export const RING_CLASSES = {
  Contestant: rgb("#4ea3ff"),
  Wildlife: rgb("#5fd08a"),
  Guest: rgb("#ff8fa3"),
} as const;
export type RingClass = keyof typeof RING_CLASSES;

/**
 * Twelve action-state icon slots (TP v1.1 §2 requires twelve action states at
 * G1). **The names below are provisional**: the canonical list is frozen by the
 * packet that implements actions, and nothing in this build assigns them. What
 * is verified here is the only thing that can be verified now — that the twelve
 * are pairwise distinguishable when drawn.
 */
export const ACTION_ICONS = [
  "idle",
  "walk",
  "carry",
  "gather",
  "craft",
  "build",
  "eat",
  "drink",
  "rest",
  "attack",
  "flee",
  "talk",
] as const;
export type ActionIcon = (typeof ACTION_ICONS)[number];
export const ACTION_ICONS_ARE_PROVISIONAL =
  "icon slot names are provisional; the canonical twelve action states are frozen by the packet that implements actions (P1)";

/** Ten headwear glyph slots (GDD 14.1: ten hair/headwear variants). */
export const HEADWEAR_GLYPHS = ["none", "band", "hood", "cap", "horns", "feather", "crown", "wrap", "helm", "braid"] as const;
export type HeadwearGlyph = (typeof HEADWEAR_GLYPHS)[number];

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SceneActor {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly ringClass: RingClass;
  readonly ringColor: string;
  readonly headwear: HeadwearGlyph;
  readonly action: ActionIcon;
  readonly nameplate: Rect;
  readonly label: string;
}

export interface SceneLaw {
  readonly lawId: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly installed: boolean;
}

export interface Scene {
  readonly sceneVersion: number;
  readonly width: number;
  readonly height: number;
  readonly tick: number;
  readonly terrain: { readonly classes: readonly string[]; readonly status: "Unavailable"; readonly availableFrom: string };
  readonly actors: readonly SceneActor[];
  readonly laws: readonly SceneLaw[];
}

export interface SceneOptions {
  readonly width?: number;
  readonly height?: number;
  readonly discRadius?: number;
  /** Nameplates are the densest thing on screen; a caller may turn them off to compare. */
  readonly nameplates?: boolean;
}

const NAMEPLATE_CHAR_WIDTH = 6;
const NAMEPLATE_HEIGHT = 11;

/**
 * Project a snapshot into scene space. The mapping is integer millimetres to
 * pixels with a fixed margin, so the same snapshot always lands on the same
 * pixels — no fitting to content, no auto-zoom, nothing that would make two
 * renders of the same state differ.
 */
export function buildScene(snapshot: WorldSnapshot, options: SceneOptions = {}): Scene {
  const width = options.width ?? 900;
  const height = options.height ?? 900;
  const discRadius = options.discRadius ?? 5;
  const margin = 24;
  const span = width - margin * 2;

  const toX = (mm: number): number => margin + (mm / ENVELOPE_MM) * span;
  const toY = (mm: number): number => margin + (mm / ENVELOPE_MM) * (height - margin * 2);
  const scale = (mm: number): number => (mm / ENVELOPE_MM) * span;

  const actors: SceneActor[] = snapshot.actors.map((actor, index) => {
    const x = toX(actor.xMm);
    const y = toY(actor.yMm);
    const ringClass = actor.kind as RingClass;
    const label = actor.id;
    return {
      id: actor.id,
      x,
      y,
      radius: discRadius,
      ringClass,
      ringColor: hex(RING_CLASSES[ringClass]),
      // Deterministic placeholder assignments: derived from the actor's own
      // stable id number, never random, and never claimed to be game state.
      headwear: HEADWEAR_GLYPHS[actor.idNumber % HEADWEAR_GLYPHS.length] as HeadwearGlyph,
      action: ACTION_ICONS[(actor.idNumber + index) % ACTION_ICONS.length] as ActionIcon,
      label,
      nameplate: {
        x: x - (label.length * NAMEPLATE_CHAR_WIDTH) / 2,
        y: y + discRadius + 2,
        width: label.length * NAMEPLATE_CHAR_WIDTH,
        height: NAMEPLATE_HEIGHT,
      },
    };
  });

  const laws: SceneLaw[] = snapshot.laws
    .filter((law) => law.centerXMm !== null && law.centerYMm !== null && law.radiusMm !== null)
    .map((law) => ({
      lawId: law.lawId,
      x: toX(law.centerXMm as number),
      y: toY(law.centerYMm as number),
      radius: scale(law.radiusMm as number),
      installed: law.installed,
    }));

  return {
    sceneVersion: SCENE_VERSION,
    width,
    height,
    tick: snapshot.tick,
    terrain: {
      classes: ["unavailable"],
      status: "Unavailable",
      availableFrom: "map compiler (P1) — no terrain classes exist to draw yet, so the ground is one declared class",
    },
    actors: options.nameplates === false ? actors.map((a) => ({ ...a, label: "", nameplate: { ...a.nameplate, width: 0 } })) : actors,
    laws,
  };
}

// ---------------------------------------------------------------------------
// Readability
// ---------------------------------------------------------------------------

/**
 * Thresholds. **TUNE** — chosen from what this synthetic scene produces plus
 * WCAG's 3:1 floor for non-text contrast, not from a human readability review.
 * PRESENT 01's other half is a human check, and these numbers do not stand in
 * for it.
 */
export const READABILITY_THRESHOLDS = {
  /** Share of nameplates allowed to overlap another nameplate. TUNE. */
  maxNameplateOverlapRatio: 0.35,
  /** WCAG non-text contrast minimum, applied to ring against disc and background. TUNE. */
  minRingContrast: 3,
  tuneNote: "TUNE — thresholds are provisional: the overlap ratio is set from the 137-actor synthetic scene, the contrast floor from WCAG 2.2 non-text guidance (1.4.11). Neither has been through a human readability review (PRESENT 01, human half).",
} as const;

export interface ReadabilityReport {
  readonly nameplates: { readonly total: number; readonly overlapping: number; readonly ratio: number; readonly threshold: number; readonly pass: boolean };
  readonly ringContrast: {
    readonly byClass: Readonly<Record<string, { readonly againstDisc: number; readonly againstBackground: number }>>;
    readonly minimum: number;
    readonly threshold: number;
    readonly pass: boolean;
  };
  readonly actionIcons: { readonly total: number; readonly distinct: number; readonly duplicates: readonly string[]; readonly pass: boolean; readonly note: string };
  readonly pass: boolean;
  readonly thresholdStatus: "TUNE";
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Count nameplates that overlap at least one other nameplate. */
export function nameplateOverlaps(scene: Scene): number {
  const plates = scene.actors.filter((a) => a.nameplate.width > 0).map((a) => a.nameplate);
  const hit = new Set<number>();
  for (let i = 0; i < plates.length; i += 1) {
    for (let j = i + 1; j < plates.length; j += 1) {
      if (overlaps(plates[i] as Rect, plates[j] as Rect)) {
        hit.add(i);
        hit.add(j);
      }
    }
  }
  return hit.size;
}

/**
 * Readability of a scene, plus the icon-distinctness result the caller measured
 * by rendering (the renderer supplies it; this module cannot rasterize).
 */
export function assessReadability(scene: Scene, iconDistinctness: { distinct: number; duplicates: readonly string[] }): ReadabilityReport {
  const total = scene.actors.filter((a) => a.nameplate.width > 0).length;
  const overlapping = nameplateOverlaps(scene);
  const ratio = total === 0 ? 0 : overlapping / total;

  const byClass: Record<string, { againstDisc: number; againstBackground: number }> = {};
  for (const [name, color] of Object.entries(RING_CLASSES)) {
    byClass[name] = {
      againstDisc: Number(contrastRatio(color, PALETTE.discFill).toFixed(2)),
      againstBackground: Number(contrastRatio(color, PALETTE.terrainUnavailable).toFixed(2)),
    };
  }
  const minimum = Math.min(...Object.values(byClass).flatMap((c) => [c.againstDisc, c.againstBackground]));

  const nameplates = {
    total,
    overlapping,
    ratio: Number(ratio.toFixed(4)),
    threshold: READABILITY_THRESHOLDS.maxNameplateOverlapRatio,
    pass: ratio <= READABILITY_THRESHOLDS.maxNameplateOverlapRatio,
  };
  const ringContrast = { byClass, minimum, threshold: READABILITY_THRESHOLDS.minRingContrast, pass: minimum >= READABILITY_THRESHOLDS.minRingContrast };
  const actionIcons = {
    total: ACTION_ICONS.length,
    distinct: iconDistinctness.distinct,
    duplicates: iconDistinctness.duplicates,
    pass: iconDistinctness.distinct === ACTION_ICONS.length && iconDistinctness.duplicates.length === 0,
    note: ACTION_ICONS_ARE_PROVISIONAL,
  };

  return {
    nameplates,
    ringContrast,
    actionIcons,
    pass: nameplates.pass && ringContrast.pass && actionIcons.pass,
    thresholdStatus: "TUNE",
  };
}
