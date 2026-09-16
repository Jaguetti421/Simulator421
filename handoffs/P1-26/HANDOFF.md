# Handoff — P1-26 / attempt 1

Status: **ACCEPTED** (standing producer authorization; self-review below found no material issues).
Base: `96025e6` → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: the eight-person roster, the twelve prototype actions with their presentation mapping, and one validator both profiles share.

Changed files: `packages/content/catalog/prototype8.ts` (new) — `PROTOTYPE8`, `PROTOTYPE_ACTIONS`, `PROFILES`, `validateCatalog`; `packages/content/index.ts`; `packages/content/catalog/prototype8.test.ts` (15 tests).

| Acceptance criterion | Evidence | Executed result |
| --- | --- | --- |
| 1. Prototype profile validates without weakening Standard requirements | `evidence/catalog.txt`, `prototype8.test.ts` | **PASS** — all twelve rules pass for Prototype8. Run against **Standard**, the same catalog fails on exactly two findings, both scope: "declares 100 contestants" and "declares 48 actions". Every other rule still runs and still passes. A test masks the scope numbers and requires the two rule lists to be **identical**, so a rule cannot be skipped for a profile. A profile may vary only counts and `writeCareer` — its four fields are asserted |
| 2. Every implemented action has intent, icon, animation and sound-or-silent mapping | `evidence/catalog.txt`, `prototype8.test.ts` | **PASS** — twelve actions, each with all four. `"silent"` is a **decision**: `action.rest` and `action.observe` are silent by design, and an *empty* sound fails validation while `"silent"` does not. Icons and action IDs are unique, so two actions cannot share a look by accident |
| 3. Authored data uses GDD identity/skill/trait values and explicit units | `evidence/catalog.txt`, `prototype8.test.ts` | **PASS** — every contestant carries all five skills as whole 0–100 points with no defaults, at least one trait from the named set, and starting inventory in whole items with `item.` keys. Appearance uses only the GDD §14.1 families and all eight signatures differ. Clan colours are paired two-by-two while every personal accent is unique. Durations are named `durationTicks`; a test requires the absence of `duration` and `durationMs` |

Commands executed: `npm run verify` → **0** (build, lint, **967/967** vitest across 62 files — 952 at the packet baseline; 6 python; workboard PASS).

Self-review (same session; standing authorization): no material findings. Three notes.
1. **One validator, and a profile supplies counts rather than leniency.** The tempting shape here is a prototype validator with fewer rules; then Standard arrives and half the catalog fails checks it was never run against. The masked rule-list comparison is what keeps that honest — if a rule is ever skipped for a profile, the lists differ and the test fails.
2. **The validator found a real defect in my own data on its first run.** C004 shared C001's personal accent index, which would have made two contestants indistinguishable after a clan change — exactly the property P1-29 tests. Fixed in the data, and worth recording: the rule earned its place immediately rather than ratifying what was already true.
3. **`"silent"` is distinguished from empty.** Some actions have no sound on purpose, and a catalog that cannot tell that from an oversight will eventually ship both.

Deferred and out of scope: this is the roster and the action table. **Not here:** the text behind `intentTemplateId` and the art behind `iconId` — the catalog names them and nothing renders them yet; the twelve procedural motions those cues will drive, which is P1-28 by name; skill effects (nothing yet reads a skill value); relationships, clans and start positions, which belong with world generation; and any binding to the frozen `AppearanceRecipe` record — this catalog carries palette indices in the same shape, and joining them belongs where content is compiled.
