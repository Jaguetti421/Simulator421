# Message from Jani to the web-track developer (copy-paste)

The external fresh-context review of test-build-01 is done. Attached: `REVIEW-EXTERNAL-01-package.zip` — unzip it into the repository root. It contains:

- `handoffs/<ID>/REVIEW-EXTERNAL-01.md` for W0-06, W0-07, W0-08, W0-09, W0-10, W0-11, P1-01, P1-02, P1-03, P1-04, DEBT-01, DEBT-02 — twelve fresh-context reviews, each with reproduced checks, a findings table, per-criterion verdicts and an overall verdict. None marks anything ACCEPTED; that stays with me.
- `handoffs/REVIEW-EXTERNAL-01-SUMMARY.md` — the ranked list of fixes before G1, process findings, and what the plans got wrong.
- `DESIGN-RULINGS-01.md` — my delegated design decisions (island templates, the valley, the G1 scene, testing the shipping map, DSL v2, AppearanceRecipe, TUNE constants, readability scale, regions). These are binding unless I override them.
- `REVIEW-EXTERNAL-01-PRELIMINARY.md` — the reviewer's answers to your §3 suspicions and §5 items (A* admissibility, action contracts vs TP §8, plan errata).
- `tools/eslint/no-bare-int-arithmetic.ts` + README + fixture — the type-aware lint rule you asked for, tested on typescript-eslint 8.70 / ESLint 10 / TS 6.0. Wire it and set the brand options to match `packages/sim/primitives`.

What to do next, in order:
1. Read the SUMMARY, then the W0-10 review first: the two evidence PNGs cited for G0 show no characters — the capture camera targets the world corner. Fix it (target the actor centroid, add the pixel-level sanity assertion, regenerate, and look at the images), then re-mark the G0 screenshot line in GATE_EVIDENCE.md. I am keeping G0 approved; the record must be truthful.
2. Open a short contracts patch packet before the first action packet: fix the two refinements that can never fail, add the refinement-liveness test, add `ActionInstance` as a state section, and reword "completing §8".
3. Make the geometry hash canonical (P1-02 Medium) before any geometry hash is stored as a golden.
4. Apply DESIGN-RULINGS-01: rename the current valley to `trough` (test template), author the shipping `valley` and the 180×180 G1 scene per R2/R3, and put the shipping map under the sight/route suites (R4).
5. Work through the remaining Medium items in the summary's ranked list, then continue P1 in the phases order. Record every accepted correction in STATUS with the review ID.

Reply through me with anything you disagree with; disagreement with a finding is in scope, silently ignoring one is not.
