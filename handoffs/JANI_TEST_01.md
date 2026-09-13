# Jani's first hands-on test — build `test-build-01` (`f42e343`)

Twenty to thirty minutes. Nothing here can break anything: it is a static site and a command-line tool, both reading from a repository you can delete afterwards.

**Say this before you start:** there is **no gameplay**. 137 actors drift around an island under a fixed 10 Hz tick and two law regions install on schedule. Nobody decides anything, nobody eats, nobody fights. What you are testing is whether the foundation *behaves* — and, in two places, whether it *looks* like it could become the game.

---

## Setup (once, about three minutes)

```bash
git clone https://github.com/Jaguetti421/Simulator421.git
cd Simulator421
git checkout test-build-01
npm ci
npm run build
```

If `npm run build` fails, stop and send me the output — that alone is a finding.

---

## Part 1 — The shell (five minutes)

```bash
npx serve apps/web/dist-site
```

Open the printed URL in Chrome or Edge.

1. The big number is the tick the Worker has **confirmed**, not an animation. Watch it climb.
2. Press **2×** and **4×**. The tick rate changes; the tick length never does.
3. Press **Pause**. It should settle and stop dead — not drift, not stutter on.
4. While paused, press **Authoritative digest**. Note the eight characters.
5. Reload the page, pause at the **same tick**, press it again. **Same tick must give the same digest.**

> **If step 5 ever disagrees, stop and tell me immediately with both values, your browser and your OS.** That is a determinism failure and the most serious bug this project could have.

Optional: run to tick 600 at 4×, pause, take the digest. On my machine it is `4d0bd28a`. A different value on yours is the same alarm as step 5.

---

## Part 2 — The two images I actually need judged (ten minutes)

This is the part where my opinion is worth nothing and yours decides something.

```
http://localhost:3000/capture.html?recipes=1&camera=45,0,60
```

(Adjust the port to whatever `serve` printed.) Eight procedural characters, side by side, at the default tabletop distance.

**Question 1 — the one that matters.** Can you tell them apart? Do they read as *people*, or as markers? Addendum D06 says debug capsules do not meet the first-playable presentation promise, and I cannot judge whether primitives clear that line. If they do not, the fix belongs now, not at P4. My own read: they are readable markers, not characters.

Then:

```
http://localhost:3000/capture.html?fixture=PRESENT-READ-01&tick=300&camera=45,30,220
```

137 actors on the island from the tabletop camera. Try `camera=65,180,90` for steeper, closer and reversed, and `tick=600`.

**Question 2.** Is 45° at 220 m the right default for watching an island? Closer, flatter, steeper?

**Question 3.** Open `handoffs/W0-09/evidence/present-read-01-t300.png` — the 2D top-down overview at the same tick, which is what the in-game overview will be built from. At 137 actors, are the nameplates readable or already too crowded?

---

## Part 3 — The tools, if you are curious (five minutes, optional)

```bash
# Run a fixture against the real kernel
node packages/lab/dist/cli/index.js run --fixture tests/fixtures/PERF-OPS-BASE.json --host kernel --evidence /tmp/out

# Render the 2D readability view yourself
node packages/lab/dist/cli/index.js render --fixture tests/fixtures/PRESENT-READ-01.json --tick 300 --out /tmp/overview.png

# The whole suite, including the browser tests
npm run verify
npx playwright install chromium && npm run test:e2e
```

Exit code 4 is not a failure — it means *nothing failed and something could not be checked yet*, which is deliberate.

---

## Part 4 — The one measurement only your PC can give (five minutes)

Every performance number in this repository came from a single-CPU sandbox with **software** rendering. None of it has touched a GPU.

```
http://localhost:3000/capture.html?fixture=PRESENT-READ-01&tick=300&width=1920&height=1080
```

Open DevTools → Performance, record about five seconds, and note the **median and worst frame time**, plus your GPU model and browser version. A 1280×720 capture blew a 30-second timeout in my sandbox and takes under a second at 960×540 — that gap is the software renderer, and your numbers replace my guesses.

---

## What I need back

Short answers are fine, in any language:

1. **The eight identities** — distinguishable? characters or markers? (the decision question)
2. **Camera default** — right, or what instead?
3. **2D overview readability** at 137 actors.
4. **Frame time** at 1920×1080, with GPU and browser.
5. **Digest check** — did step 5 hold?
6. Anything that felt broken, slow or confusing, and **anything you wanted to do and could not** — that last one tells me what to sequence first.

---

## What not to report

These are known and deliberate; you are not missing anything:

- Flat grey ground with no terrain, trees or water in the 3D view — the terrain compiler exists but is **not wired into the app** yet.
- Actors drifting without purpose, walking through each other, never eating or fighting.
- The ring colour showing species rather than clan; action icons that mean nothing.
- The "SYNTHETIC WORKLOAD" and "FakeSim" watermarks — those are on purpose and stay until there is a real game behind them.
