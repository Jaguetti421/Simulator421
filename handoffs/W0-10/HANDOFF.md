# Handoff — W0-10 / attempt 1

Status: **READY_FOR_REVIEW**.
Base ID / Git commit / contract / content: base `827fd2a` (W0-09 ACCEPTED) → `0393f22` (runtime half) → `122ff28`. Contract v0 unchanged; scene renderer `lastclan-tabletop-3d-v1`; AppearanceRecipe v1 (app-level — see below).
Goal and implemented behavior: `apps/web` with the Worker bootstrap running the W0-07 kernel, a Three.js tabletop scene with the GDD 14.2 camera, the procedural identity kit for the eight Prototype8 recipes, a watermarked FakeSim mode, the `/capture` route, and the Playwright screenshot job in CI.

Changed files and purpose:
- `apps/web/vite.config.ts`, `index.html`, `capture.html` — two entries: the shell and `/capture`. `npm run build` now builds the site as well as the packages.
- `apps/web/src/view/pacing.ts` — 10 Hz timestep, 36,000-tick Standard ceiling, speed as ticks-per-batch (TP v1.1 §1, GDD).
- `apps/web/src/worker/{protocol,sim.worker}.ts` — one simulation writer in a Worker; the wall clock lives outside `packages/sim`; pause settles on the last completed tick.
- `apps/web/src/App.tsx`, `main.tsx` — the shell: confirmed tick, 1×/2×/4×, pause, digest readout, synthetic watermark and the workload's omissions on the page.
- `apps/web/src/kit/recipe.ts` — AppearanceRecipe, the slot tables, deterministic assembly with mesh bounds and hand/back/waist attachment points, and the eight Prototype8 identities.
- `apps/web/src/scene/{camera,scene}.ts` — the tabletop camera maths (clamped band, full yaw orbit) and the Three.js scene, one `InstancedMesh` per primitive shape with per-instance colour and transform.
- `apps/web/src/capture.ts` — the `/capture` route: query parameters, warm-up frames, in-image FakeSim watermark, capture metadata on the element and on `window`.
- Tests: `apps/web/src/**/*.test.ts` (19), `tests/playwright/{shell,worker-hash,capture}.spec.ts` (13 of the 16 browser tests).
- `.github/workflows/ci.yml` — the `screens` job is enabled: installs Chromium, runs the Playwright suite, uploads captures and a report on failure.
- `package.json` — `screens` now runs the capture spec instead of printing BLOCKED_RENDER; `three`, `vite`, `react` and `@playwright/test` pinned exactly.

| Acceptance criterion | Evidence path | Executed result |
| --- | --- | --- |
| 1. `npm run build` produces a static site; opening it runs the synthetic workload in a Worker at 1×/2×/4× with pause; the page shows the confirmed tick | `evidence/verify.txt`, `evidence/playwright.txt`, `tests/playwright/shell.spec.ts` | **PASS** — the build emits `dist-site` (index + capture, 232 KB). Driven against the built output: the Worker boots with 137 actors, the confirmed tick advances, pause settles and nothing moves past it, resume continues, and 4× advances more ticks per second than 1× |
| 2. Eight supplied recipes render as distinguishable procedural characters; mesh bounds and attachment points are recorded | `evidence/identity-kit-prototype8.png`, `apps/web/src/kit/recipe.test.ts`, capture spec "eight supplied recipes" | **PASS (structural) / HUMAN_REQUIRED (visual)** — all eight render side by side at default tabletop distance, and the scene reports 39 instances: 24 body parts, 8 headwear, 7 accessories (P8-06 declares none). Every pair differs in at least two of the four kit slots; bounds are recorded per identity (1.68–1.82 m, feet at 0) and hand/back/waist points are asserted to sit inside those bounds. **Whether they look distinguishable to a person is not something I can certify** — the image is the artefact for that review |
| 3. `/capture?fixture=&tick=&camera=&textScale=` renders after warm-up frames and writes a PNG with metadata under Playwright; FakeSim frames carry a visible watermark | `evidence/capture-t300.png`, `evidence/capture-metadata.txt`, `tests/playwright/capture.spec.ts` | **PASS — executed here, not BLOCKED_RENDER.** The card expected a block; Chromium with software WebGL runs it. The PNG carries `Fixture`, `Tick=300`, `Camera=45,30,220`, `Actors=137`, `Kernel`, `AuthoritativeDigest=e82bda09`, `Watermark=FakeSim` and an explicit note that software rendering proves layout only. The watermark is inside the captured region, and a different tick produces a different picture |
| 4. Browser Worker hashes equal Node hashes for the workload (closes the W0-07 blocked half) | `evidence/node-digests.txt`, `tests/playwright/worker-hash.spec.ts` | **PASS** — a browser Worker importing the same `packages/sim/dist` bytes reports `4d0bd28a` for 137 actors at 600 ticks and `bc38b04a` for 136 at 250, matching Node exactly; a third test shows the two workloads differ from each other, so the equality is not trivial |

Commands actually executed: `npm run verify` → **0** (build including the site, lint, **461/461** vitest across 28 files — 447 after the runtime half, 426 at the packet's baseline; 6/6 python; workboard PASS). `npm run test:e2e` → **0**, 16 Playwright tests, run repeatedly.

Pre-existing baseline failures: none.

Design decisions within scope:
1. **`AppearanceRecipe` does not exist in contract v0.** TP v2.0 says the contract "from v1.1 is unchanged", but the sixteen frozen records contain no such thing. Rather than add a seventeenth record from an app packet — which would change `identity.contract.recordsDigest` in every summary this build produces — the shape lives in `apps/web/src/kit/recipe.ts`, versioned, with the gap stated in the file. **Freezing it as a real contract record is proposed work for a contracts packet.**
2. **One `InstancedMesh` per primitive shape**, not per kit part. TP v2.0 says per part; grouping by shape is the same idea one level coarser and is what lets a torso, a head and a helm share a draw call. Noted here because it is a deviation, small as it is.
3. **The split, and why it was not the card's.** The card suggests a/b = shell+camera+kit / capture+Playwright+parity. I shipped the runtime proof first (shell, Worker, hash parity) and the visual half second, because parity closed a standing BLOCKED_RENDER from W0-07 and needed no rendering at all. Aggregate acceptance is unchanged.
4. **A capture is slow under software WebGL** — 1280×720 exceeded a 30 s Playwright timeout; at 960×540 the same test takes under a second. The spec says so in a comment rather than hiding the timeout, because it is a fact about SwiftShader and precisely why frame budgets stay HUMAN_REQUIRED.
5. **The capture route reads the kernel's own snapshot** (the W0-08 plain-data format) rather than a parallel view, so the picture cannot drift from simulated state.

Contract proposals or deferred work outside scope:
- `AppearanceRecipe` as a frozen contract record (above).
- The tabletop camera exists as maths and is used for captures; interactive orbit/zoom controls, the panel layout from GDD 14.2 and the twelve action-state motions belong with P1 UI packets.
- The scene draws actors and ground only: no terrain height field, foliage, fog ring or night lighting — none of that data exists yet.

Remaining risks, reproduction and exact next action:
- Software WebGL proves layout and correctness, never frame budget or GPU quality. **The two PNGs in `evidence/` are the artefacts for your visual review**; nothing automated in this packet certifies that eight identities are recognisable to a person.
- CI's `screens` job is enabled but has never run on the GitHub runner — it installs Chromium itself, which the sandbox did not have to do. The first push after this one is its first real execution.
- Reproduce: `npm run verify`, then `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npm run test:e2e`.
- Next action: review, then **W0-11** (integration, gate evidence and the G0 stop for your playtest).

Source archive/patch and RETURN_MANIFEST.json: not applicable — GitHub is canonical; the work is pushed to `main`.

Reviewer request: reproduce the acceptance evidence against the returned files and record findings in REVIEW.md.
