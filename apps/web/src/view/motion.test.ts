import { describe, expect, it } from "vitest";
import { PROTOTYPE_ACTIONS } from "@lastclan/content";
import { CHECKLIST, checkPresentation, DISTINCT_STATES, JOINTS, MOTIONS, poseDistance, poseFor } from "./motion.js";
import type { PresentationImage } from "./motion.js";

/** P1-28. */

describe("the five states stay visually distinct (criterion 1)", () => {
  it("gives every catalog action a motion", () => {
    for (const action of PROTOTYPE_ACTIONS) {
      expect(Object.keys(MOTIONS), `${action.actionDefId} has no motion`).toContain(action.actionDefId);
    }
    expect(Object.keys(MOTIONS)).toHaveLength(PROTOTYPE_ACTIONS.length);
  });

  it("separates every pair of the five states at the same phase", () => {
    const states = Object.entries(DISTINCT_STATES);
    for (let i = 0; i < states.length; i += 1) {
      for (let j = i + 1; j < states.length; j += 1) {
        const [nameA, actionA] = states[i] as [string, string];
        const [nameB, actionB] = states[j] as [string, string];
        for (const phase of [0, 250, 500, 750]) {
          const distance = poseDistance(poseFor(actionA, phase), poseFor(actionB, phase));
          expect(distance, `${nameA} and ${nameB} look alike at phase ${phase}`).toBeGreaterThan(100);
        }
      }
    }
  });

  it("separates them by stance first, which is what reads at a distance", () => {
    const stances = Object.values(DISTINCT_STATES).map((action) => poseFor(action, 0).stance);
    // Rest is prone, combat strikes, work reaches, forage-style rescue crouches,
    // waiting stands: at least four different silhouettes among five states.
    expect(new Set(stances).size).toBeGreaterThanOrEqual(4);
  });

  it("keeps a blocked worker distinguishable from someone waiting", () => {
    const working = poseFor(DISTINCT_STATES["blockedWork"] as string, 300);
    const waiting = poseFor(DISTINCT_STATES["wait"] as string, 300);
    expect(working.stance).not.toBe(waiting.stance);
    expect(poseDistance(working, waiting)).toBeGreaterThan(200);
  });

  it("poses deterministically — the same action and phase twice", () => {
    for (const actionDefId of Object.keys(MOTIONS)) {
      expect(poseFor(actionDefId, 375)).toEqual(poseFor(actionDefId, 375));
    }
  });

  it("wraps a phase outside 0-1000 instead of producing a broken pose", () => {
    expect(poseFor("action.walk", 1_250)).toEqual(poseFor("action.walk", 250));
    expect(poseFor("action.walk", -750)).toEqual(poseFor("action.walk", 250));
  });

  it("poses an unknown action as idle rather than failing", () => {
    const pose = poseFor("action.does.not.exist", 400);
    expect(pose.stance).toBe("Upright");
    expect(JOINTS.every((joint) => Number.isInteger(pose.offsetsMm[joint]))).toBe(true);
  });
});

describe("no motion creates a gameplay effect (criterion 2)", () => {
  it("returns poses and nothing a simulation could consume", () => {
    const pose = poseFor("action.strike", 500);
    expect(Object.keys(pose).sort()).toEqual(["actionDefId", "leanDeciDeg", "offsetsMm", "phaseMilli", "stance"]);
    // No damage, no event, no callback: there is nothing here to fire.
    for (const forbidden of ["damage", "event", "emit", "onHit", "apply"]) {
      expect(Object.keys(pose)).not.toContain(forbidden);
    }
  });

  it("is a pure function of action and phase", () => {
    expect(poseFor.length).toBe(2);
    const before = poseFor("action.craft", 250);
    for (let i = 0; i < 50; i += 1) poseFor("action.strike", i * 17);
    expect(poseFor("action.craft", 250)).toEqual(before);
  });

  it("produces only integers, so a pose cannot drift between machines", () => {
    for (const actionDefId of Object.keys(MOTIONS)) {
      for (const phase of [0, 125, 500, 999]) {
        const pose = poseFor(actionDefId, phase);
        expect(Number.isInteger(pose.leanDeciDeg)).toBe(true);
        for (const joint of JOINTS) expect(Number.isInteger(pose.offsetsMm[joint]), `${actionDefId}.${joint}`).toBe(true);
      }
    }
  });

  it("keeps offsets inside their declared amplitude", () => {
    for (const [actionDefId, spec] of Object.entries(MOTIONS)) {
      for (let phase = 0; phase < 1_000; phase += 37) {
        const pose = poseFor(actionDefId, phase);
        for (const joint of JOINTS) {
          const amplitude = spec.amplitude[joint] ?? 0;
          expect(Math.abs(pose.offsetsMm[joint]), `${actionDefId}.${joint} at ${phase}`).toBeLessThanOrEqual(amplitude);
        }
      }
    }
  });
});

describe("the presentation checklist covers day/night and close/wide (criterion 3)", () => {
  function image(lighting: "Day" | "Night", framing: "Close" | "Wide", overrides: Partial<PresentationImage> = {}): PresentationImage {
    return {
      label: `${lighting}-${framing}`,
      lighting,
      framing,
      subjectContrastX100: 420,
      silhouetteHeightPx: framing === "Close" ? 220 : 30,
      stanceReadable: true,
      ...overrides,
    };
  }

  const fourImages = [image("Day", "Close"), image("Day", "Wide"), image("Night", "Close"), image("Night", "Wide")];

  it("passes a complete, legible set", () => {
    const result = checkPresentation(fourImages);
    for (const finding of result.findings) expect(finding.ok, `${finding.rule} -> ${finding.detail}`).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("fails when a lighting or framing combination is missing", () => {
    const result = checkPresentation(fourImages.slice(0, 3));
    expect(result.ok).toBe(false);
    expect(result.findings.find((f) => f.rule === "Night Wide image present")?.ok).toBe(false);
  });

  it("fails a night image whose subject contrast is below the WCAG floor", () => {
    const dim = [...fourImages.slice(0, 3), image("Night", "Wide", { subjectContrastX100: 180 })];
    const result = checkPresentation(dim);
    expect(result.ok).toBe(false);
    expect(result.findings.find((f) => f.rule.includes("Night-Wide: subject contrast"))?.detail).toBe("1.80:1");
    expect(CHECKLIST.minContrastX100).toBe(300);
  });

  it("fails a wide image whose silhouette is too small to read", () => {
    const tiny = [...fourImages.slice(0, 3), image("Night", "Wide", { silhouetteHeightPx: 6 })];
    expect(checkPresentation(tiny).ok).toBe(false);
  });

  it("fails an image whose stance cannot be identified, even if it is bright and large", () => {
    const unreadable = [...fourImages.slice(0, 3), image("Night", "Wide", { stanceReadable: false, subjectContrastX100: 900, silhouetteHeightPx: 400 })];
    const result = checkPresentation(unreadable);
    expect(result.ok).toBe(false);
    expect(result.findings.find((f) => f.rule.includes("stance readable") && f.rule.includes("Night-Wide"))?.ok).toBe(false);
  });
});
