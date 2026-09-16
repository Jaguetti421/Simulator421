/**
 * @lastclan/content — package entry point.
 *
 * W0-01 shipped the skeleton; P1-26 adds the first catalog — the eight-person
 * prototype roster, its action table, and the validator both profiles share.
 */
export const PACKAGE_NAME = "@lastclan/content" as const;

export { ACCESSORIES, BUILDS, HEADS, HEADWEAR, PROFILES, PROTOTYPE8, PROTOTYPE_ACTIONS, ruleNames, SKILLS, TRAITS, validateCatalog } from "./catalog/prototype8.js";
export type { ActionEntry, CatalogFinding, CatalogValidation, Contestant, ProfileName, ProfileScope, SkillName, TraitName } from "./catalog/prototype8.js";
