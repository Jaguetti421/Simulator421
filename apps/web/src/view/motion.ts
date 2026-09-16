/**
 * Twelve procedural action motions (P1-28; GDD §14.3, PRESENT 01 foundation).
 *
 * Every action in the P1-26 catalog gets a motion: a small set of joint offsets
 * over the action's duration, generated rather than authored, so twelve actions
 * do not need twelve animation files before anyone can tell them apart.
 *
 * Two rules decide whether this is safe to build now:
 *
 *   - **Motions are pure functions of (action, phase).** No randomness, no
 *     clock, no world. The same action at the same phase always poses the same
 *     way, so two machines drawing the same tick draw the same thing.
 *   - **A motion cannot cause anything.** The module exports poses and nothing
 *     else: there is no event, no callback and no return value a simulation
 *     could consume. Addendum D06 says presentation is never the only evidence
 *     of a legal action; the inverse — that presentation is never the *cause* of
 *     one — is enforced here by having nothing to fire.
 *
 * Distinctness is measured, not asserted: `poseDistance` compares two poses and
 * the tests require every pair of the five states a viewer must tell apart to
 * differ by a real margin at the same phase.
 */

/** Joints a pose can move. Deliberately few: this is silhouette, not animation. */
export const JOINTS = ["head", "torso", "armL", "armR", "legL", "legR"] as const;
export type Joint = (typeof JOINTS)[number];

/** A pose: offsets in millimetres and a lean in tenths of a degree. */
export interface Pose {
  readonly actionDefId: string;
  /** Phase through the action, in thousandths. */
  readonly phaseMilli: number;
  readonly offsetsMm: Readonly<Record<Joint, number>>;
  readonly leanDeciDeg: number;
  /** Silhouette bucket a viewer reads at a glance. */
  readonly stance: "Upright" | "Crouched" | "Prone" | "Reaching" | "Striking";
}

/** Integer triangle wave in [-amplitude, amplitude] with the given period, in thousandths. */
function wave(phaseMilli: number, periodMilli: number, amplitude: number): number {
  const p = ((phaseMilli % periodMilli) + periodMilli) % periodMilli;
  const half = Math.trunc(periodMilli / 2);
  const rising = p < half ? p : periodMilli - p;
  return Math.trunc((rising * 2 * amplitude) / half) - amplitude;
}

interface MotionSpec {
  readonly stance: Pose["stance"];
  readonly leanDeciDeg: number;
  readonly periodMilli: number;
  readonly amplitude: Readonly<Partial<Record<Joint, number>>>;
}

/**
 * The twelve motions, one per catalog action.
 *
 * The amplitudes are chosen so the five states a viewer must distinguish —
 * rest, wait, blocked work, combat, rescue — differ in **stance first** and in
 * limb movement second. Stance is what reads at a hundred metres; the limbs are
 * what confirm it up close.
 */
export const MOTIONS: Readonly<Record<string, MotionSpec>> = {
  "action.walk": { stance: "Upright", leanDeciDeg: 30, periodMilli: 500, amplitude: { legL: 120, legR: 120, armL: 70, armR: 70 } },
  "action.forage": { stance: "Crouched", leanDeciDeg: 250, periodMilli: 700, amplitude: { armR: 140, torso: 40, head: 30 } },
  "action.eat": { stance: "Upright", leanDeciDeg: 60, periodMilli: 400, amplitude: { armR: 90, head: 40 } },
  "action.drink": { stance: "Crouched", leanDeciDeg: 200, periodMilli: 600, amplitude: { armR: 80, head: 50 } },
  "action.rest": { stance: "Prone", leanDeciDeg: 850, periodMilli: 2_000, amplitude: { torso: 15 } },
  "action.craft": { stance: "Crouched", leanDeciDeg: 180, periodMilli: 350, amplitude: { armL: 110, armR: 130, head: 20 } },
  "action.build": { stance: "Reaching", leanDeciDeg: 120, periodMilli: 450, amplitude: { armL: 160, armR: 160, torso: 50 } },
  "action.strike": { stance: "Striking", leanDeciDeg: 220, periodMilli: 300, amplitude: { armR: 260, torso: 90, legR: 80 } },
  "action.shoot": { stance: "Striking", leanDeciDeg: 80, periodMilli: 900, amplitude: { armL: 180, armR: 60 } },
  "action.revive": { stance: "Crouched", leanDeciDeg: 400, periodMilli: 800, amplitude: { armL: 120, armR: 120, head: 60 } },
  "action.observe": { stance: "Upright", leanDeciDeg: 0, periodMilli: 1_500, amplitude: { head: 90 } },
  "action.speak": { stance: "Upright", leanDeciDeg: 20, periodMilli: 600, amplitude: { armR: 100, head: 45 } },
};

/** A pose for an action that has no motion — still a pose, never a crash. */
const IDLE: MotionSpec = { stance: "Upright", leanDeciDeg: 0, periodMilli: 2_000, amplitude: { torso: 10 } };

/**
 * Pose an actor.
 *
 * Pure: the same action and phase always produce the same pose, on any machine.
 * There is no `Math.random`, no clock and no world state in this call.
 */
export function poseFor(actionDefId: string, phaseMilli: number): Pose {
  const spec = MOTIONS[actionDefId] ?? IDLE;
  const phase = ((phaseMilli % 1_000) + 1_000) % 1_000;
  const offsets = Object.fromEntries(
    JOINTS.map((joint) => [joint, spec.amplitude[joint] === undefined ? 0 : wave(phase * 4, spec.periodMilli, spec.amplitude[joint] as number)]),
  ) as Record<Joint, number>;
  return { actionDefId, phaseMilli: phase, offsetsMm: offsets, leanDeciDeg: spec.leanDeciDeg, stance: spec.stance };
}

/** How far apart two poses look: summed joint offsets plus the lean difference. */
export function poseDistance(a: Pose, b: Pose): number {
  const joints = JOINTS.reduce((sum, joint) => sum + Math.abs(a.offsetsMm[joint] - b.offsetsMm[joint]), 0);
  return joints + Math.abs(a.leanDeciDeg - b.leanDeciDeg);
}

/** The five states a viewer must be able to tell apart (criterion 1). */
export const DISTINCT_STATES: Readonly<Record<string, string>> = {
  rest: "action.rest",
  wait: "action.observe",
  blockedWork: "action.build",
  combat: "action.strike",
  rescue: "action.revive",
};

// ---------------------------------------------------------------------------
// Presentation checklist
// ---------------------------------------------------------------------------

export interface PresentationImage {
  readonly label: string;
  readonly lighting: "Day" | "Night";
  readonly framing: "Close" | "Wide";
  /** Contrast of the subject against its background, as a WCAG-style ratio ×100. */
  readonly subjectContrastX100: number;
  /** Pixels of the actor's silhouette height in the image. */
  readonly silhouetteHeightPx: number;
  /** Whether the actor's current stance is identifiable in the image. */
  readonly stanceReadable: boolean;
}

export const CHECKLIST = {
  /** WCAG 2.2 non-text minimum, ×100 (1.4.11). */
  minContrastX100: 300,
  /** Below this the silhouette is a dot, whatever its shape. TUNE. */
  minSilhouettePx: 12,
  /** The four images a presentation check must include. */
  required: [
    { lighting: "Day", framing: "Close" },
    { lighting: "Day", framing: "Wide" },
    { lighting: "Night", framing: "Close" },
    { lighting: "Night", framing: "Wide" },
  ] as const,
} as const;

export interface ChecklistFinding {
  readonly rule: string;
  readonly ok: boolean;
  readonly detail: string;
}

/**
 * Check a set of presentation images.
 *
 * Reports which image failed which rule. The four lighting/framing combinations
 * are **required**: a checklist run only in daylight close-up says nothing about
 * the view a player actually spends the match in.
 */
export function checkPresentation(images: readonly PresentationImage[]): { readonly findings: readonly ChecklistFinding[]; readonly ok: boolean } {
  const findings: ChecklistFinding[] = [];
  for (const required of CHECKLIST.required) {
    const image = images.find((i) => i.lighting === required.lighting && i.framing === required.framing);
    findings.push({
      rule: `${required.lighting} ${required.framing} image present`,
      ok: image !== undefined,
      detail: image === undefined ? "missing" : image.label,
    });
  }

  for (const image of images) {
    findings.push({
      rule: `${image.label}: subject contrast at least ${CHECKLIST.minContrastX100 / 100}:1`,
      ok: image.subjectContrastX100 >= CHECKLIST.minContrastX100,
      detail: `${(image.subjectContrastX100 / 100).toFixed(2)}:1`,
    });
    findings.push({
      rule: `${image.label}: silhouette at least ${CHECKLIST.minSilhouettePx} px`,
      ok: image.silhouetteHeightPx >= CHECKLIST.minSilhouettePx,
      detail: `${image.silhouetteHeightPx} px`,
    });
    findings.push({ rule: `${image.label}: stance readable`, ok: image.stanceReadable, detail: image.stanceReadable ? "readable" : "not identifiable" });
  }

  return { findings, ok: findings.every((f) => f.ok) };
}
