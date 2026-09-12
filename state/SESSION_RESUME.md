# Session resume — W0-10, after the first half

Written 12 September 2026. **W0-10 is IN_PROGRESS, not complete.** The card explicitly allows a split; I took one, but not the one the card suggested — read the next paragraph before assuming otherwise.

## Baseline
`2223a8b`. `npm run verify` → 0: 447/447 vitest across 26 files, 6/6 python, workboard PASS. `npm run test:e2e` → 0: 11 Playwright tests, run twice for stability.

## The split I actually took
The card suggests W0-10a = shell, camera, kit and W0-10b = /capture, Playwright, hash parity. I split differently, by what could be **proved** rather than by what is visual:

- **Shipped (this half): the runtime proof in the browser.** Vite build producing a static site; the W0-07 kernel running in a Worker at 1x/2x/4x with pause; the page showing the confirmed tick; the synthetic watermark; browser Worker digests equal to Node digests. That last one closes the half of W0-07's criterion 1 that was recorded BLOCKED_RENDER — the highest-value item in the packet, and it needed no Three.js at all.
- **Remaining: the visual shell.** Three.js scene with the perspective tabletop camera (GDD 14.2: 45° default, 35–65° band, yaw orbit, clamped zoom); the procedural identity kit for eight AppearanceRecipe recipes (three builds, four heads, ten headwear, six accessories — GDD 14.1, Addendum D06) with mesh bounds and attachment points recorded; the `/capture?fixture=&tick=&camera=&textScale=` route with warm-up frames and PNG metadata; the FakeSim frame watermark; the CI screens job.

Acceptance criteria 1 and 4 are met; 2 and 3 are not started.

## Next session, in this order
1. **Three.js scene and tabletop camera** — install `three` (pin it), add `apps/web/src/scene/**`. Camera parameters are in GDD 14.2; do not invent the band.
2. **Procedural identity kit** — eight recipes behind the existing `AppearanceRecipe` contract (it is already frozen in contract v0, W0-04: read it before designing anything). Record mesh bounds and attachment points as data a test can assert, not as a screenshot claim.
3. **`/capture` route** — warm-up frames before the shot, PNG metadata via the same `embedPngText` the readability renderer uses (`packages/lab/render/draw.ts`) rather than a second implementation. FakeSim frames need a visible watermark in the image itself, not only in the DOM.
4. **`tests/playwright/capture.spec.ts`** and the CI screens job. Note: the sandbox has browsers, so try the capture spec here before recording BLOCKED_RENDER — the same assumption in the W0-08 card turned out to be wrong. GPU quality and frame budgets stay HUMAN_REQUIRED on Jani's PC regardless; software WebGL proves layout and correctness only.
5. Then handoff, review, STATUS, workboard, acceptance request.

## Carried notes
- Push is gated on the verify exit code (W0-07 lesson).
- `npm run build` now also builds the site, so a broken app breaks verify — intended.
- The readability renderer (W0-09) is the 2D overview; the 3D scene is separate work and must not silently reuse its thresholds.
