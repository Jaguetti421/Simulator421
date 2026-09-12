import { describe, expect, it } from "vitest";
import { ACCESSORIES, assembleRecipe, BUILDS, HEADS, HEADWEAR, PROTOTYPE8_RECIPES, slotDifferences } from "./recipe.js";
import type { AppearanceRecipe } from "./recipe.js";

const base = (): AppearanceRecipe => {
  const first = PROTOTYPE8_RECIPES[0];
  if (first === undefined) throw new Error("no recipes");
  return first;
};

describe("the procedural identity kit", () => {
  it("offers the GDD 14.1 slot counts: three builds, four heads, ten headwear, six accessories", () => {
    expect(BUILDS).toHaveLength(3);
    expect(HEADS).toHaveLength(4);
    expect(HEADWEAR).toHaveLength(10);
    expect(ACCESSORIES).toHaveLength(6);
  });

  it("supplies exactly eight Prototype8 identities", () => {
    expect(PROTOTYPE8_RECIPES).toHaveLength(8);
    expect(new Set(PROTOTYPE8_RECIPES.map((r) => r.id)).size).toBe(8);
  });

  it("keeps every pair distinguishable by shape, not only by colour", () => {
    for (let i = 0; i < PROTOTYPE8_RECIPES.length; i += 1) {
      for (let j = i + 1; j < PROTOTYPE8_RECIPES.length; j += 1) {
        const a = PROTOTYPE8_RECIPES[i];
        const b = PROTOTYPE8_RECIPES[j];
        if (a === undefined || b === undefined) continue;
        expect(slotDifferences(a, b)).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("assembles deterministically: the same recipe always produces the same parts", () => {
    const recipe = PROTOTYPE8_RECIPES[0];
    if (recipe === undefined) throw new Error("missing recipe");
    expect(assembleRecipe(recipe)).toEqual(assembleRecipe(recipe));
  });

  it("records mesh bounds for every identity, sized like a person", () => {
    for (const recipe of PROTOTYPE8_RECIPES) {
      const { boundsMm } = assembleRecipe(recipe);
      const height = (boundsMm.max[1] as number) - (boundsMm.min[1] as number);
      expect(height).toBeGreaterThan(1_600);
      expect(height).toBeLessThan(2_100);
      expect(boundsMm.min[1]).toBe(0);
    }
  });

  it("records hand, back and waist attachment points inside the actor's own bounds", () => {
    for (const recipe of PROTOTYPE8_RECIPES) {
      const assembled = assembleRecipe(recipe);
      for (const point of Object.values(assembled.attachments)) {
        expect(point[1]).toBeGreaterThan(0);
        expect(point[1]).toBeLessThan(assembled.boundsMm.max[1] as number);
      }
      expect(assembled.attachments.back[2]).toBeLessThan(0);
      expect(assembled.attachments.waist[2]).toBeGreaterThan(0);
    }
  });

  it("gives a heavier build a wider silhouette than a slight one", () => {
    const slight = assembleRecipe({ ...base(), build: "slight" });
    const heavy = assembleRecipe({ ...base(), build: "heavy" });
    expect((heavy.boundsMm.max[0] as number) - (heavy.boundsMm.min[0] as number)).toBeGreaterThan((slight.boundsMm.max[0] as number) - (slight.boundsMm.min[0] as number));
  });

  it("drops the part entirely when a slot is 'none', rather than drawing an invisible one", () => {
    const bare = assembleRecipe({ ...base(), headwear: "none", accessory: "none" });
    expect(bare.parts.map((p) => p.part)).toEqual(["legs", "torso", "head"]);
  });
});
