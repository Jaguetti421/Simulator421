# Jani's PC checklist — W0 / build `3796038` (tag `w0-baseline`)

Checks this sandbox cannot run. **Two of the five are genuinely blocked here; the rest ran and are listed so you can confirm them on real hardware rather than take my word.** Results go in `handoffs/W0-11/evidence/jani/`; I attach them to GATE_EVIDENCE.md next session.

**Prerequisites (once):** Node 22+, git, a Chromium-based browser. In the repository root: `npm ci` and `npx playwright install chromium`.

## 1. Build and serve offline — *confirmation, not blocked*
```
npm run build
npx serve apps/web/dist-site
```
Open the URL. Then disconnect the network and reload. Expected: the page still boots and the tick still advances. (Automated equivalent passes here with every external origin blocked.)

## 2. Visual judgement of the eight identities — **HUMAN_REQUIRED, the real one**
```
npm run screens        # writes handoffs/W0-10/evidence/*.png
```
Open `identity-kit-prototype8.png`, and `capture.html?recipes=1&camera=45,0,60` live in your browser. Question: at default tabletop distance, are the eight distinguishable, and do they read as characters rather than markers? Write one or two sentences. **This is the check that decides whether the procedural kit is a viable path to G1**, and nothing automated can answer it.

## 3. Frame budget and GPU timing — **HUMAN_REQUIRED, blocked here**
```
npm run build
npx serve apps/web/dist-site
# open capture.html?fixture=PRESENT-READ-01&tick=300&width=1920&height=1080
# then in DevTools > Performance, record 5 seconds and note the frame time
```
Record: GPU model, browser version, and the median and worst frame time at 1920×1080 with 137 actors. Everything in this build was rendered by SwiftShader on one CPU, so **no performance claim in the repository has ever been tested on hardware**. A 1280×720 capture exceeded a 30-second timeout here and takes under a second at 960×540 — that gap is the software renderer, and your numbers replace it.

## 4. The shell on your machine — *confirmation*
Open the site, run to tick 600 at 4×, pause, click "Authoritative digest". Expected: `4d0bd28a`. If it differs on your machine, that is a determinism failure and the most important bug this project could have — send the value, your browser version and OS.

## 5. Browser storage limits — *untested anywhere*
With the site open, save a checkpoint (not yet exposed in the UI — skip unless you want to open DevTools). Otherwise just note your browser's storage quota from DevTools > Application > Storage. Quota and eviction behaviour is the one persistence risk nothing in this gate touches.

---
**What I am not asking you to check:** correctness of the tick loop, hash equality across Node and browser, save/restore continuation, the fixture harness, or IndexedDB semantics. All of those ran automatically here and in CI, and are cited with artifacts in GATE_EVIDENCE.md.
