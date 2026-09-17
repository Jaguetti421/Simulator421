# Playtest brief — G1 first playable

Twenty minutes. Nothing here can break anything.

```bash
git clone https://github.com/Jaguetti421/Simulator421.git
cd Simulator421 && git checkout g1-candidate
npm ci && npm run build
npx serve apps/web/dist-site
```

**Before you start:** the shell takes a few seconds to boot. It is compiling a 640,000-cell island before the first tick — that pause is real work, not a hang, and it is the single thing I would most like a reaction to.

## 1. Watch eight people survive (ten minutes)

Open the printed URL. The banner says what this build is and what it is not; the list below the controls says it again in detail. Believe that list — it is generated from the same source as the gate evidence.

Watch the tick climb. Press 2× and 4×. Pause and read the authoritative digest; reload, pause at the same tick, and it must read the same. **If it ever differs, stop and tell me both values** — that is a determinism failure and the most serious bug this project could have.

**Question 1, the one that decides something:** do these read as *people surviving*, or as *markers moving*? Eight actors start hungry, work out that they are hungry, pick the nearest unreserved food, walk to it and eat. If that does not read as a story, the fix belongs now.

## 2. Look at the eight (three minutes)

```
http://localhost:3000/capture.html?recipes=1&camera=30,0,22
```

**Question 2:** can you tell them apart, and do they read as characters? This is the G0 judgement I still owe you. My own read: blocky figures, distinguishable by colour pair and build, headwear too small to matter at distance.

## 3. The island (three minutes)

```
http://localhost:3000/capture.html?fixture=PRESENT-READ-01&tick=300&camera=40,30,30
```

**Question 3:** at the tabletop camera a 1.8 m actor is about four pixels tall at 220 m. I capture evidence at 30 m instead. Is the default camera distance right for watching an island, or does the whole framing need rethinking?

## 4. The one measurement only you can give (four minutes)

```
http://localhost:3000/capture.html?fixture=PRESENT-READ-01&tick=300&width=1920&height=1080
```

DevTools → Performance, record five seconds. **Question 4:** median and worst frame time, plus your GPU and browser. Every performance number in this repo came from a single CPU with software rendering.

## 5. Anything you wanted to do and could not

**Question 5.** That answer tells me what to sequence first in P2 better than any plan I can write.

## What not to report

Known and deliberate: no building or fighting; actors know where food is without looking; no clans, trading or careers; the ground is flat grey with no trees or water in the 3D view (terrain is compiled and validated but not yet drawn).
