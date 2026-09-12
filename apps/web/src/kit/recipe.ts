/**
 * The procedural identity kit (W0-10; GDD 14.1, Addendum D06, TP v2.0 §13).
 *
 * Three builds, four heads, ten headwear variants, six accessories, a clan
 * colour and a personal accent — assembled from primitives so identity is data,
 * not art assets, and a rigged kit can replace the primitives later without
 * changing a recipe.
 *
 * **Contract status:** `AppearanceRecipe` is now a frozen contract record
 * (P1-01), closing the gap W0-10 found — TP v2.0 referred to it as existing when
 * it was not. The kit below is the app-side assembly of that record: the slot
 * families here are checked against the contract's enums by a test, so the two
 * cannot drift, and the colours stay app-side because the contract carries
 * palette **indices** rather than hex strings.
 */
export const APPEARANCE_RECIPE_VERSION = 1;

export const BUILDS = ["slight", "average", "heavy"] as const;
export const HEADS = ["round", "long", "square", "narrow"] as const;
export const HEADWEAR = ["none", "band", "hood", "cap", "horns", "feather", "crown", "wrap", "helm", "braid"] as const;
export const ACCESSORIES = ["none", "satchel", "cloak", "beads", "belt", "quiver"] as const;

export type Build = (typeof BUILDS)[number];
export type Head = (typeof HEADS)[number];
export type Headwear = (typeof HEADWEAR)[number];
export type Accessory = (typeof ACCESSORIES)[number];

export interface AppearanceRecipe {
  readonly recipeVersion: number;
  readonly id: string;
  readonly build: Build;
  readonly head: Head;
  readonly headwear: Headwear;
  readonly accessory: Accessory;
  /** Clan colour: shared, and replaceable when an actor changes clan. */
  readonly clanColor: string;
  /** Personal accent: survives a clan change (GDD 14.1). */
  readonly accentColor: string;
}

/** Millimetres, like everything consequential. The kit is drawn in metres by dividing at the scene edge. */
const BUILD_DIMENSIONS: Record<Build, { heightMm: number; shoulderMm: number; depthMm: number }> = {
  slight: { heightMm: 1_680, shoulderMm: 420, depthMm: 240 },
  average: { heightMm: 1_760, shoulderMm: 480, depthMm: 270 },
  heavy: { heightMm: 1_820, shoulderMm: 560, depthMm: 320 },
};

const HEAD_DIMENSIONS: Record<Head, { widthMm: number; heightMm: number }> = {
  round: { widthMm: 200, heightMm: 200 },
  long: { widthMm: 180, heightMm: 240 },
  square: { widthMm: 210, heightMm: 210 },
  narrow: { widthMm: 165, heightMm: 225 },
};

export interface PartPlacement {
  readonly part: string;
  readonly shape: "box" | "sphere" | "cylinder" | "cone";
  readonly sizeMm: readonly [number, number, number];
  readonly offsetMm: readonly [number, number, number];
  readonly color: string;
}

export interface AttachmentPoints {
  readonly hand: readonly [number, number, number];
  readonly back: readonly [number, number, number];
  readonly waist: readonly [number, number, number];
}

export interface AssembledRecipe {
  readonly id: string;
  readonly parts: readonly PartPlacement[];
  /** Axis-aligned bounds in millimetres, recorded so a camera or a layout test never guesses at actor size. */
  readonly boundsMm: { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] };
  readonly attachments: AttachmentPoints;
}

/** Assemble a recipe into placed primitives. Pure: the same recipe always assembles identically. */
export function assembleRecipe(recipe: AppearanceRecipe): AssembledRecipe {
  const body = BUILD_DIMENSIONS[recipe.build];
  const head = HEAD_DIMENSIONS[recipe.head];
  const torsoHeight = Math.round(body.heightMm * 0.45);
  const legHeight = body.heightMm - torsoHeight - head.heightMm;

  const parts: PartPlacement[] = [
    { part: "legs", shape: "cylinder", sizeMm: [body.shoulderMm * 0.6, legHeight, body.depthMm * 0.8], offsetMm: [0, legHeight / 2, 0], color: recipe.clanColor },
    { part: "torso", shape: "box", sizeMm: [body.shoulderMm, torsoHeight, body.depthMm], offsetMm: [0, legHeight + torsoHeight / 2, 0], color: recipe.clanColor },
    { part: "head", shape: "sphere", sizeMm: [head.widthMm, head.heightMm, head.widthMm], offsetMm: [0, legHeight + torsoHeight + head.heightMm / 2, 0], color: recipe.accentColor },
  ];

  const crown = legHeight + torsoHeight + head.heightMm;
  if (recipe.headwear !== "none") {
    const headwearShape: PartPlacement["shape"] = recipe.headwear === "horns" || recipe.headwear === "feather" ? "cone" : recipe.headwear === "helm" || recipe.headwear === "hood" ? "sphere" : "cylinder";
    const rise = recipe.headwear === "crown" || recipe.headwear === "horns" || recipe.headwear === "feather" ? 90 : 40;
    parts.push({
      part: `headwear:${recipe.headwear}`,
      shape: headwearShape,
      sizeMm: [head.widthMm * 1.1, rise, head.widthMm * 1.1],
      offsetMm: [0, crown - head.heightMm * 0.15 + rise / 2, 0],
      color: recipe.accentColor,
    });
  }
  if (recipe.accessory !== "none") {
    parts.push({
      part: `accessory:${recipe.accessory}`,
      shape: recipe.accessory === "beads" ? "sphere" : "box",
      sizeMm: [body.shoulderMm * 0.5, 160, body.depthMm * 0.5],
      offsetMm: [body.shoulderMm * 0.45, legHeight + torsoHeight * 0.6, -body.depthMm * 0.4],
      color: recipe.accentColor,
    });
  }

  const max: [number, number, number] = [0, 0, 0];
  const min: [number, number, number] = [0, 0, 0];
  for (const p of parts) {
    for (let axis = 0; axis < 3; axis += 1) {
      const half = (p.sizeMm[axis] as number) / 2;
      max[axis] = Math.max(max[axis] as number, (p.offsetMm[axis] as number) + half);
      min[axis] = Math.min(min[axis] as number, (p.offsetMm[axis] as number) - half);
    }
  }

  return {
    id: recipe.id,
    parts,
    boundsMm: { min, max },
    attachments: {
      hand: [body.shoulderMm * 0.6, legHeight + torsoHeight * 0.5, body.depthMm * 0.3],
      back: [0, legHeight + torsoHeight * 0.7, -body.depthMm * 0.6],
      waist: [0, legHeight + torsoHeight * 0.05, body.depthMm * 0.5],
    },
  };
}

/**
 * The eight Prototype8 identities (Addendum D07: "Prototype8 uses eight declared
 * roster identities and a recipe subset with closed dependencies"). Every recipe
 * differs from every other in at least two of the four kit slots, so they stay
 * distinguishable without relying on colour alone.
 */
export const PROTOTYPE8_RECIPES: readonly AppearanceRecipe[] = [
  { recipeVersion: 1, id: "P8-01", build: "slight", head: "round", headwear: "band", accessory: "satchel", clanColor: "#4ea3ff", accentColor: "#ffd166" },
  { recipeVersion: 1, id: "P8-02", build: "average", head: "long", headwear: "hood", accessory: "cloak", clanColor: "#4ea3ff", accentColor: "#ef476f" },
  { recipeVersion: 1, id: "P8-03", build: "heavy", head: "square", headwear: "helm", accessory: "belt", clanColor: "#5fd08a", accentColor: "#118ab2" },
  { recipeVersion: 1, id: "P8-04", build: "slight", head: "narrow", headwear: "feather", accessory: "quiver", clanColor: "#5fd08a", accentColor: "#ffd166" },
  { recipeVersion: 1, id: "P8-05", build: "average", head: "square", headwear: "crown", accessory: "beads", clanColor: "#ff8fa3", accentColor: "#06d6a0" },
  { recipeVersion: 1, id: "P8-06", build: "heavy", head: "round", headwear: "horns", accessory: "none", clanColor: "#ff8fa3", accentColor: "#f4a261" },
  { recipeVersion: 1, id: "P8-07", build: "average", head: "narrow", headwear: "wrap", accessory: "cloak", clanColor: "#c792ea", accentColor: "#80ffdb" },
  { recipeVersion: 1, id: "P8-08", build: "heavy", head: "long", headwear: "braid", accessory: "satchel", clanColor: "#c792ea", accentColor: "#ffd166" },
];

/** How many kit slots two recipes differ in — the distinguishability measure the tests assert on. */
export function slotDifferences(a: AppearanceRecipe, b: AppearanceRecipe): number {
  return [a.build !== b.build, a.head !== b.head, a.headwear !== b.headwear, a.accessory !== b.accessory].filter(Boolean).length;
}
