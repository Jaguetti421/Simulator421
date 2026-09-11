# Jani's PC checklist — {phase} / build {hash}

Checks the developer's sandbox cannot run: 3D rendering, GPU timing, real browsers. Each block is copy-paste-runnable. Results go into the folder named in each step; the developer attaches them to GATE_EVIDENCE.md next session.

**Prerequisites (once):** Node 22+, git, a Chromium-based browser. Then, in the repository root: `npm ci` and `npx playwright install chromium`.

**1. Build and serve**
```
npm run build
npx serve apps/web/dist    # or: npm run preview
```
Open the URL it prints. Confirm the page loads offline after the first load (disconnect network, reload).

**2. 3D screenshots (PRESENT-style fixtures)**
```
npm run screens            # runs tests/playwright/capture.spec.ts; PNGs under evidence/screens/
```
Look at each PNG for one second: is anything unreadable, clipped or obviously wrong? Note the file name.

**3. Timing captures**
```
npm run perf:browser       # Worker tick timing at 1x/2x/4x; JSON under evidence/perf/
```
Also note: GPU model, browser and version, screen resolution, and the frame rate shown in the top bar at default zoom and at the dense camp preset.

**4. Browser persistence**
```
npm run test:browser       # tests/playwright/persistence.spec.ts against real IndexedDB
```

**5. Return**
Zip `evidence/` (or push it if the repository is shared) and send it back with the playtest brief. Anything that failed to run: paste the exact error; the developer marks that check BLOCKED, never PASS.
