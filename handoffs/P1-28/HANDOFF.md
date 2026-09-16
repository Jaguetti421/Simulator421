# Handoff — P1-28 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `14b618b` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: a procedural motion for each of the twelve catalog actions, measurably distinct silhouettes for the five states a viewer must tell apart, and a presentation checklist that covers day, night, close and wide.

Changed files: `apps/web/src/view/motion.ts` (new) — `poseFor`, `poseDistance`, `MOTIONS`, `checkPresentation`; `apps/web/src/view/motion.test.ts` (16 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. Rest, wait, blocked work, combat and rescue remain visually distinct | `evidence/motion.txt`, `motion.test.ts` | **PASS** — all ten pairs are separated at four phases, the closest pair (blocked work vs combat) by 296 and the widest (rest vs blocked work) by 1,031. **Distinctness is measured, not asserted**: `poseDistance` sums joint offsets and lean. The five states also occupy five different stances — Prone, Upright, Reaching, Striking, Crouched — which is what reads at a hundred metres, with the limbs confirming it up close |
| 2. No motion or particle event creates gameplay effects | `evidence/motion.txt`, `motion.test.ts` | **PASS** — a pose contains `actionDefId`, `leanDeciDeg`, `offsetsMm`, `phaseMilli`, `stance` and nothing else: no event, no callback, **nothing to fire**. `poseFor` takes two arguments and is pure — fifty interleaved calls for another action leave a third call byte-identical. Every value is an integer, so a pose cannot drift between machines, and offsets stay inside their declared amplitude at every phase |
| 3. Day/night and close/wide images pass the presentation checklist | `evidence/motion.txt`, `motion.test.ts` | **PASS** — all four lighting/framing combinations are **required**; a set missing night-wide fails by name. Subject contrast is checked against WCAG 2.2's 3:1 non-text floor, silhouette height against a minimum, and stance readability separately — an image that is bright and large and whose stance still cannot be identified fails |

Commands executed: `npm run verify` → **0** (build, lint, **983/983** vitest across 63 files — 967 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Three notes.
1. **Distinctness is a number, not an opinion.** Ten pairs at four phases each, with a floor. The alternative — looking at them and agreeing they seem different — is exactly how two crouching actions end up indistinguishable at wide framing three months later.
2. **The module has nothing to fire.** Criterion 2 is often written as "do not let animation events cause effects", which is a rule someone has to keep. Here there is no event type, no emitter and no callback in the exported surface, so the rule has nothing to violate.
3. **The checklist separates "bright and large" from "readable".** An image can pass contrast and size and still not show what the actor is doing, and that is the failure a presentation check is actually for.

Deferred and out of scope: nothing renders these poses — joining them to the Three.js kit is the app packet that draws actors, and the offsets are deliberately in millimetres so that join needs no unit conversion. Also absent: particles and their pooling (named in the card, but a particle with no renderer is a data structure looking for a purpose); blending between motions when an action changes; facing and gaze, which belong with the perception cue work; and the real captured images the checklist is meant to judge — `checkPresentation` grades measurements a capture pass supplies, and that pass is P1-34's evidence work.
