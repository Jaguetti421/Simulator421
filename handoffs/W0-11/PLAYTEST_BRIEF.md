# Playtest brief — W0 / G0 / build `3796038` (tag `w0-baseline`)

**What you are looking at.** The web foundation, not the game. A synthetic workload of 137 actors (100 contestants, 36 wildlife, one guest) moves around an 800 m island under a fixed 10 Hz tick, and two law regions install on schedule. There are **no goals, no decisions, no combat, no crafting, no economy, no clans and no terrain** — stage 4 of the tick loop runs and decides nothing, on purpose. What is real: the tick transaction, determinism across Node and the browser, pause and speed, saves that restore and continue identically, and two renderers (a 2D readability view and a 3D tabletop scene). A look takes ten minutes; there is nothing to win.

**How to run it.** In the repository root at tag `w0-baseline`:

```
npm ci
npm run build
npx serve apps/web/dist-site      # any static server; the site needs no network after loading
```

Open the printed URL in a Chromium-based browser. Seed **4107** is baked in. If something looks wrong, the seed and the build hash above make it reproducible exactly.

**Ten-minute viewing script.**
1. **Minute 0–2 — the shell.** The big number is the tick the Worker has *confirmed*, not an animation. Watch it climb at 1×, then press 2× and 4×: the tick rate changes, the tick length never does. Press Pause: it settles on the last completed tick and nothing moves past it. Press "Authoritative digest" while paused — that eight-character value is the hash of the whole world state.
2. **Minute 2–5 — determinism you can check yourself.** Reload the page and pause at the same tick, then take the digest again. Same tick, same digest. At tick 600 with the guest present it should read `4d0bd28a` — the same value Node produces headless.
3. **Minute 5–8 — a capture.** Open `capture.html?fixture=PRESENT-READ-01&tick=300&camera=45,30,220`. That is the 3D tabletop scene at the GDD's default 45° pitch. Try `camera=65,180,90` for a steeper, closer, reversed view, and `recipes=1&camera=45,0,60` to see the eight procedural identities side by side. **This is the thing I most need your eyes on** — see question 1.
4. **Minute 8–10 — the 2D readability view.** `handoffs/W0-09/evidence/present-read-01-t300.png` is the top-down overview at the same tick: 137 actors, one law boundary, nameplates. It is what the in-game overview will be built from.

**Known limitations** (you do not need to report these):
- *Synthetic:* no gameplay of any kind; actors drift and query, they do not decide.
- *Placeholder:* terrain is one flat "unavailable" colour; the actor ring shows species, not clan; action icons are assigned from actor id because no actor has an action yet.
- *Software rendering:* every image here was made without a GPU. Nothing in this build says anything about frame rate.
- *Provisional:* the twelve action-icon names, and the readability thresholds.

**Feedback form** — answer briefly, in any language:
1. **The eight identities.** Look at the `recipes=1` view or `identity-kit-prototype8.png`. Can you tell them apart at that distance? Do they read as people-shaped, or as markers? This is the one question where my judgement is worth nothing and yours decides whether the procedural kit is a viable path (Addendum D06: "debug capsules alone do not meet the first-playable presentation promise").
2. **The tabletop framing.** Is 45° at 220 m the right default for watching an island, or does it want to be closer, flatter, steeper?
3. **The 2D overview.** At 137 actors, are the nameplates readable enough to be useful, or already too crowded?
4. **Bugs.** What, at which tick, and what you expected instead.
5. **Anything you wanted to do and couldn't** — including things that are obviously P1 work; it tells me what to sequence first.

**Return to the developer:** this file with answers, plus any screenshots. Seed 4107 and build `3796038` stay attached.
