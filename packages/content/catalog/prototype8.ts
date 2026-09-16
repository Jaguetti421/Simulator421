/**
 * Eight-person prototype catalog (P1-26; GDD §14, §26, §30–31).
 *
 * The content the first playable runs on: eight contestants, the actions they
 * can take, and the presentation mapping every action must carry.
 *
 * The rule that shapes the whole packet is criterion 1 — **the prototype profile
 * must validate without weakening the Standard requirements**. The tempting way
 * to ship a prototype is to relax the validator: fewer required fields, softer
 * ranges, "we'll tighten it for Standard". Then Standard arrives and half the
 * catalog fails rules it was never checked against. So there is **one**
 * validator with one set of rules; a profile may declare a smaller *scope* (8
 * contestants instead of 100, 12 actions instead of the full catalog) but never
 * a looser *standard*.
 */

export type ProfileName = "Prototype8" | "Standard";

/** What a profile may vary: how much content, never how good it has to be. */
export interface ProfileScope {
  readonly name: ProfileName;
  readonly contestants: number;
  readonly actions: number;
  /** Whether career records are written; a prototype does not write them. */
  readonly writeCareer: boolean;
}

export const PROFILES: Readonly<Record<ProfileName, ProfileScope>> = {
  Prototype8: { name: "Prototype8", contestants: 8, actions: 12, writeCareer: false },
  Standard: { name: "Standard", contestants: 100, actions: 48, writeCareer: true },
};

// ---------------------------------------------------------------------------
// Contestants
// ---------------------------------------------------------------------------

/** GDD §14.1 families. The appearance recipe is the frozen contract's shape. */
export const BUILDS = ["slight", "average", "heavy"] as const;
export const HEADS = ["round", "long", "square", "narrow"] as const;
export const HEADWEAR = ["none", "band", "hood", "cap", "horns", "feather", "crown", "wrap", "helm", "braid"] as const;
export const ACCESSORIES = ["none", "satchel", "cloak", "beads", "belt", "quiver"] as const;

/** GDD §26 traits, as P1-16 weights them. */
export const TRAITS = ["cautious", "greedy", "sociable", "industrious"] as const;
export type TraitName = (typeof TRAITS)[number];

/** GDD §30 skills. Values are 0–100 whole points. */
export const SKILLS = ["forage", "craft", "build", "fight", "heal"] as const;
export type SkillName = (typeof SKILLS)[number];

export interface Contestant {
  readonly actorId: string;
  readonly name: string;
  readonly recipeId: string;
  readonly build: (typeof BUILDS)[number];
  readonly head: (typeof HEADS)[number];
  readonly headwear: (typeof HEADWEAR)[number];
  readonly accessory: (typeof ACCESSORIES)[number];
  readonly clanColorIndex: number;
  readonly accentColorIndex: number;
  readonly traits: readonly TraitName[];
  /** Skill → whole points, 0–100. Every skill is present; there are no defaults. */
  readonly skills: Readonly<Record<SkillName, number>>;
  /** Item definition ID → whole items. */
  readonly startingInventory: Readonly<Record<string, number>>;
}

/**
 * The eight. Paired clan colours (two per clan) with distinct personal accents,
 * so a clan change is visible and the individual is still recognisable — the
 * property P1-29 tests.
 */
export const PROTOTYPE8: readonly Contestant[] = [
  { actorId: "C001", name: "Aro", recipeId: "P8-01", build: "slight", head: "round", headwear: "band", accessory: "satchel", clanColorIndex: 0, accentColorIndex: 3, traits: ["industrious"], skills: { forage: 62, craft: 40, build: 35, fight: 20, heal: 25 }, startingInventory: { "item.berry": 2 } },
  { actorId: "C002", name: "Bekka", recipeId: "P8-02", build: "average", head: "long", headwear: "hood", accessory: "cloak", clanColorIndex: 0, accentColorIndex: 7, traits: ["cautious"], skills: { forage: 45, craft: 30, build: 28, fight: 30, heal: 55 }, startingInventory: { "item.bandage": 1 } },
  { actorId: "C003", name: "Cael", recipeId: "P8-03", build: "heavy", head: "square", headwear: "helm", accessory: "belt", clanColorIndex: 1, accentColorIndex: 11, traits: ["greedy", "industrious"], skills: { forage: 30, craft: 58, build: 60, fight: 45, heal: 15 }, startingInventory: { "item.flint": 1 } },
  { actorId: "C004", name: "Doro", recipeId: "P8-04", build: "slight", head: "narrow", headwear: "feather", accessory: "quiver", clanColorIndex: 1, accentColorIndex: 5, traits: ["cautious", "sociable"], skills: { forage: 55, craft: 35, build: 25, fight: 52, heal: 20 }, startingInventory: { "item.arrow": 5 } },
  { actorId: "C005", name: "Eike", recipeId: "P8-05", build: "average", head: "square", headwear: "crown", accessory: "beads", clanColorIndex: 2, accentColorIndex: 15, traits: ["sociable"], skills: { forage: 40, craft: 42, build: 38, fight: 25, heal: 48 }, startingInventory: { "item.berry": 1, "item.bandage": 1 } },
  { actorId: "C006", name: "Falk", recipeId: "P8-06", build: "heavy", head: "round", headwear: "horns", accessory: "none", clanColorIndex: 2, accentColorIndex: 19, traits: ["greedy"], skills: { forage: 28, craft: 33, build: 52, fight: 64, heal: 10 }, startingInventory: {} },
  { actorId: "C007", name: "Gyda", recipeId: "P8-07", build: "average", head: "narrow", headwear: "wrap", accessory: "cloak", clanColorIndex: 3, accentColorIndex: 23, traits: ["cautious", "industrious"], skills: { forage: 58, craft: 50, build: 30, fight: 22, heal: 38 }, startingInventory: { "item.rope": 1 } },
  { actorId: "C008", name: "Hild", recipeId: "P8-08", build: "heavy", head: "long", headwear: "braid", accessory: "satchel", clanColorIndex: 3, accentColorIndex: 27, traits: ["sociable", "greedy"], skills: { forage: 35, craft: 46, build: 44, fight: 40, heal: 30 }, startingInventory: { "item.flint": 1, "item.berry": 1 } },
];

// ---------------------------------------------------------------------------
// Actions and their presentation mapping
// ---------------------------------------------------------------------------

/**
 * Every action carries an intent template, an icon, an animation cue and a sound
 * mapping. `"silent"` is a **decision**, not a missing field: some actions have
 * no sound on purpose, and the catalog has to distinguish that from an oversight.
 */
export interface ActionEntry {
  readonly actionDefId: string;
  readonly intentTemplateId: string;
  readonly iconId: string;
  readonly animationCue: string;
  readonly soundCue: string | "silent";
  readonly durationTicks: number;
}

export const PROTOTYPE_ACTIONS: readonly ActionEntry[] = [
  { actionDefId: "action.walk", intentTemplateId: "text.intent.walk", iconId: "icon.walk", animationCue: "cue.walk.loop", soundCue: "cue.footstep", durationTicks: 1 },
  { actionDefId: "action.forage", intentTemplateId: "text.intent.forage", iconId: "icon.forage", animationCue: "cue.forage.loop", soundCue: "cue.rustle", durationTicks: 30 },
  { actionDefId: "action.eat", intentTemplateId: "text.intent.eat", iconId: "icon.eat", animationCue: "cue.eat.loop", soundCue: "cue.eat", durationTicks: 10 },
  { actionDefId: "action.drink", intentTemplateId: "text.intent.drink", iconId: "icon.drink", animationCue: "cue.drink.loop", soundCue: "cue.water", durationTicks: 10 },
  { actionDefId: "action.rest", intentTemplateId: "text.intent.rest", iconId: "icon.rest", animationCue: "cue.rest.loop", soundCue: "silent", durationTicks: 60 },
  { actionDefId: "action.craft", intentTemplateId: "text.intent.craft", iconId: "icon.craft", animationCue: "cue.craft.loop", soundCue: "cue.craft.tap", durationTicks: 40 },
  { actionDefId: "action.build", intentTemplateId: "text.intent.build", iconId: "icon.build", animationCue: "cue.build.loop", soundCue: "cue.hammer", durationTicks: 80 },
  { actionDefId: "action.strike", intentTemplateId: "text.intent.strike", iconId: "icon.strike", animationCue: "cue.strike", soundCue: "cue.impact", durationTicks: 11 },
  { actionDefId: "action.shoot", intentTemplateId: "text.intent.shoot", iconId: "icon.shoot", animationCue: "cue.draw", soundCue: "cue.bowstring", durationTicks: 20 },
  { actionDefId: "action.revive", intentTemplateId: "text.intent.revive", iconId: "icon.revive", animationCue: "cue.kneel", soundCue: "cue.cloth", durationTicks: 60 },
  { actionDefId: "action.observe", intentTemplateId: "text.intent.observe", iconId: "icon.observe", animationCue: "cue.look", soundCue: "silent", durationTicks: 5 },
  { actionDefId: "action.speak", intentTemplateId: "text.intent.speak", iconId: "icon.speak", animationCue: "cue.gesture", soundCue: "cue.voice", durationTicks: 15 },
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface CatalogFinding {
  readonly rule: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface CatalogValidation {
  readonly profile: ProfileName;
  readonly findings: readonly CatalogFinding[];
  readonly ok: boolean;
}

/**
 * Validate a catalog against a profile.
 *
 * **The rules do not vary by profile — only the counts do.** Every check below
 * runs for `Prototype8` exactly as it runs for `Standard`; the profile supplies
 * how many contestants and actions to expect and nothing else. A prototype that
 * passes here passes the same rules the full catalog will.
 */
export function validateCatalog(contestants: readonly Contestant[], actions: readonly ActionEntry[], profile: ProfileScope): CatalogValidation {
  const findings: CatalogFinding[] = [];
  const add = (rule: string, ok: boolean, detail: string): void => void findings.push({ rule, ok, detail });

  add(`${profile.name} declares ${profile.contestants} contestants`, contestants.length === profile.contestants, `${contestants.length} present`);
  add(`${profile.name} declares ${profile.actions} actions`, actions.length === profile.actions, `${actions.length} present`);

  const ids = contestants.map((c) => c.actorId);
  add("actor ids are unique", new Set(ids).size === ids.length, `${new Set(ids).size} of ${ids.length} unique`);
  const recipes = contestants.map((c) => c.recipeId);
  add("appearance recipes are unique", new Set(recipes).size === recipes.length, `${new Set(recipes).size} of ${recipes.length} unique`);

  const badFamily = contestants.filter(
    (c) => !BUILDS.includes(c.build) || !HEADS.includes(c.head) || !HEADWEAR.includes(c.headwear) || !ACCESSORIES.includes(c.accessory),
  );
  add("appearance uses only the GDD 14.1 families", badFamily.length === 0, badFamily.length === 0 ? "all within families" : badFamily.map((c) => c.actorId).join(", "));

  const badSkills = contestants.filter((c) => SKILLS.some((skill) => !Number.isInteger(c.skills[skill]) || c.skills[skill] < 0 || c.skills[skill] > 100));
  add("every skill is a whole 0-100 value and none is missing", badSkills.length === 0, badSkills.length === 0 ? "all present and in range" : badSkills.map((c) => c.actorId).join(", "));

  const badTraits = contestants.filter((c) => c.traits.length === 0 || c.traits.some((trait) => !TRAITS.includes(trait)));
  add("every contestant has at least one declared trait", badTraits.length === 0, badTraits.length === 0 ? "all declared" : badTraits.map((c) => c.actorId).join(", "));

  const badInventory = contestants.filter((c) => Object.values(c.startingInventory).some((count) => !Number.isInteger(count) || count <= 0));
  add("starting inventory counts are whole items", badInventory.length === 0, badInventory.length === 0 ? "all whole" : badInventory.map((c) => c.actorId).join(", "));

  const accents = contestants.map((c) => c.accentColorIndex);
  add("personal accents are unique, so a clan change leaves an individual recognisable", new Set(accents).size === accents.length, `${new Set(accents).size} of ${accents.length} unique`);

  const incomplete = actions.filter((a) => a.intentTemplateId === "" || a.iconId === "" || a.animationCue === "" || a.soundCue === "");
  add("every action has an intent, an icon, an animation and a sound-or-silent mapping", incomplete.length === 0, incomplete.length === 0 ? "all four present on all actions" : incomplete.map((a) => a.actionDefId).join(", "));

  const actionIds = actions.map((a) => a.actionDefId);
  add("action ids are unique", new Set(actionIds).size === actionIds.length, `${new Set(actionIds).size} of ${actionIds.length} unique`);

  const badDuration = actions.filter((a) => !Number.isInteger(a.durationTicks) || a.durationTicks < 1);
  add("durations are whole ticks, at least one", badDuration.length === 0, badDuration.length === 0 ? "all whole" : badDuration.map((a) => a.actionDefId).join(", "));

  return { profile: profile.name, findings, ok: findings.every((f) => f.ok) };
}

/**
 * The rules a validation ran, with the profile's own name and counts masked.
 *
 * Used to prove that two profiles ran the **same rules** — only the scope
 * numbers differ, and those are what a profile is allowed to vary. Masking them
 * is the point: if the lists still differ after masking, a rule was skipped.
 */
export function ruleNames(validation: CatalogValidation): readonly string[] {
  return validation.findings.map((f) =>
    f.rule.replace(/^(Prototype8|Standard) declares \d+ /u, "<profile> declares <n> ").replace(/^(Prototype8|Standard) /u, "<profile> "),
  );
}
