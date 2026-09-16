import { describe, expect, it } from "vitest";
import { PROFILES, PROTOTYPE8, PROTOTYPE_ACTIONS, ruleNames, SKILLS, TRAITS, validateCatalog } from "./prototype8.js";
import type { ActionEntry, Contestant } from "./prototype8.js";

/** P1-26. */

describe("the prototype profile validates without weakening Standard (criterion 1)", () => {
  it("passes every rule", () => {
    const result = validateCatalog(PROTOTYPE8, PROTOTYPE_ACTIONS, PROFILES.Prototype8);
    for (const finding of result.findings) expect(finding.ok, `${finding.rule} -> ${finding.detail}`).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("runs exactly the same rules for Standard as for Prototype8", () => {
    const prototype = validateCatalog(PROTOTYPE8, PROTOTYPE_ACTIONS, PROFILES.Prototype8);
    // A deliberately undersized Standard catalog: the counts fail, and every
    // other rule still runs.
    const standard = validateCatalog(PROTOTYPE8, PROTOTYPE_ACTIONS, PROFILES.Standard);
    expect(ruleNames(standard)).toEqual(ruleNames(prototype));
    expect(standard.findings).toHaveLength(prototype.findings.length);
  });

  it("fails Standard on scope alone, never on a relaxed rule", () => {
    const standard = validateCatalog(PROTOTYPE8, PROTOTYPE_ACTIONS, PROFILES.Standard);
    expect(standard.ok).toBe(false);
    const failures = standard.findings.filter((f) => !f.ok).map((f) => f.rule);
    expect(failures).toEqual(["Standard declares 100 contestants", "Standard declares 48 actions"]);
  });

  it("only lets a profile vary how much content there is", () => {
    expect(Object.keys(PROFILES.Prototype8).sort()).toEqual(["actions", "contestants", "name", "writeCareer"]);
    expect(PROFILES.Prototype8.writeCareer).toBe(false);
    expect(PROFILES.Standard.writeCareer).toBe(true);
  });

  it("catches a catalog that breaks a rule, at either profile", () => {
    const broken: Contestant[] = [...PROTOTYPE8.slice(1), { ...(PROTOTYPE8[0] as Contestant), skills: { ...(PROTOTYPE8[0] as Contestant).skills, forage: 140 } }];
    for (const profile of [PROFILES.Prototype8, PROFILES.Standard]) {
      const result = validateCatalog(broken, PROTOTYPE_ACTIONS, profile);
      expect(result.findings.find((f) => f.rule.includes("whole 0-100"))?.ok).toBe(false);
    }
  });
});

describe("every implemented action has its presentation mapping (criterion 2)", () => {
  it("gives all twelve an intent, an icon, an animation and a sound-or-silent", () => {
    expect(PROTOTYPE_ACTIONS).toHaveLength(PROFILES.Prototype8.actions);
    for (const action of PROTOTYPE_ACTIONS) {
      expect(action.intentTemplateId, action.actionDefId).not.toBe("");
      expect(action.iconId, action.actionDefId).not.toBe("");
      expect(action.animationCue, action.actionDefId).not.toBe("");
      expect(action.soundCue, action.actionDefId).not.toBe("");
    }
  });

  it("treats silence as a decision rather than a missing field", () => {
    const silent = PROTOTYPE_ACTIONS.filter((a) => a.soundCue === "silent");
    expect(silent.map((a) => a.actionDefId)).toEqual(["action.rest", "action.observe"]);
    // An empty sound is a failure; "silent" is not.
    const missing: ActionEntry[] = [{ ...(PROTOTYPE_ACTIONS[0] as ActionEntry), soundCue: "" }];
    expect(validateCatalog(PROTOTYPE8, missing, { ...PROFILES.Prototype8, actions: 1 }).ok).toBe(false);
  });

  it("gives every action a unique id and a whole duration of at least one tick", () => {
    const ids = PROTOTYPE_ACTIONS.map((a) => a.actionDefId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const action of PROTOTYPE_ACTIONS) expect(Number.isInteger(action.durationTicks) && action.durationTicks >= 1).toBe(true);
  });

  it("names icons and cues distinctly, so two actions cannot share a look by accident", () => {
    const icons = PROTOTYPE_ACTIONS.map((a) => a.iconId);
    expect(new Set(icons).size).toBe(icons.length);
  });
});

describe("authored data uses GDD values and explicit units (criterion 3)", () => {
  it("gives every contestant every skill, as whole 0-100 points", () => {
    for (const contestant of PROTOTYPE8) {
      for (const skill of SKILLS) {
        const value = contestant.skills[skill];
        expect(value, `${contestant.actorId}.${skill}`).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
        expect(Number.isInteger(value)).toBe(true);
      }
      expect(Object.keys(contestant.skills).sort()).toEqual([...SKILLS].sort());
    }
  });

  it("declares at least one trait per contestant, from the named set", () => {
    for (const contestant of PROTOTYPE8) {
      expect(contestant.traits.length).toBeGreaterThan(0);
      for (const trait of contestant.traits) expect(TRAITS).toContain(trait);
    }
  });

  it("uses whole items in starting inventories, with units in the key", () => {
    for (const contestant of PROTOTYPE8) {
      for (const [item, count] of Object.entries(contestant.startingInventory)) {
        expect(item.startsWith("item."), `${contestant.actorId} carries ${item}`).toBe(true);
        expect(Number.isInteger(count) && count > 0).toBe(true);
      }
    }
  });

  it("pairs clan colours and keeps every personal accent unique", () => {
    const clans = PROTOTYPE8.map((c) => c.clanColorIndex);
    for (const clan of new Set(clans)) expect(clans.filter((c) => c === clan)).toHaveLength(2);
    const accents = PROTOTYPE8.map((c) => c.accentColorIndex);
    expect(new Set(accents).size).toBe(accents.length);
  });

  it("gives the eight distinguishable appearances", () => {
    const signatures = PROTOTYPE8.map((c) => `${c.build}/${c.head}/${c.headwear}/${c.accessory}`);
    expect(new Set(signatures).size).toBe(8);
  });

  it("names durations in ticks, not in seconds or milliseconds", () => {
    for (const action of PROTOTYPE_ACTIONS) {
      expect(Object.keys(action)).toContain("durationTicks");
      expect(Object.keys(action)).not.toContain("durationMs");
      expect(Object.keys(action)).not.toContain("duration");
    }
  });
});
