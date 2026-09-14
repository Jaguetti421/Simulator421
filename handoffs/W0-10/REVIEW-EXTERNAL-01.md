# Independent review — W0-10 / candidate tag `test-build-01` (commit `199777f`)

**File:** `handoffs/W0-10/REVIEW-EXTERNAL-01.md` · **Date:** 14 September 2026

Reviewer / role / fresh-context declaration: Claude Fable 5.1, external reviewing agent. **This is a fresh-context review.** This session had no memory of authoring any file in this repository; I wrote the plans (Technical Plan v2.0, the web phases, the kit) and had never seen the code before cloning the tag. I read the developer's `handoffs/W0-10/REVIEW.md` only after forming the verdicts below.
Author / base / candidate: web-track developer; base as stated in `handoffs/W0-10/HANDOFF.md`; candidate = tag `test-build-01` → commit `199777f` (the request says `f42e343`, the last code commit; the tag is one documentation commit later — Low, recorded once in the summary).
Environment: Node 22.22.2, npm 10.9.7, git 2.43, Chromium via `npx playwright install chromium` (worked here), 1 CPU sandbox, software WebGL. Reproduced on the candidate before any packet review: `npm ci`; `npm run build` (ok); `npm run lint` (exit 0); `vitest run` **570 passed / 35 files** (36.7 s); `npm run test:tools` OK; `check:workboard` PASS (139 packets, 51 scenes); `playwright test` **17 passed**.

Files actually inspected and checks independently reproduced: `tests/playwright/capture.spec.ts` (read; ran 5/5 here), `tests/playwright/shell.spec.ts` and `worker-hash.spec.ts` (ran), `apps/web/src/capture.ts` (recipe parade placement line 90; camera parsing line 55), `apps/web/src/scene/camera.ts` (`defaultCamera`, `parseCameraParam` lines 38–73), `apps/web/src/scene/scene.ts` (ground plane centred at `(ENVELOPE_M/2, 0, ENVELOPE_M/2)` line 77; `camera.lookAt(targetM)` line 133), the two committed evidence PNGs and `capture-metadata.txt` — **I viewed both PNGs**, then regenerated them by running the capture spec here: byte-identical to the committed files (`git status` clean; 7,350 B and 14,656 B).

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| **High** | **The evidence PNGs do not show the subjects.** `identity-kit-prototype8.png` is an empty dark stage: watermark, caption, nothing else — no characters. `capture-t300.png` shows the corner of the ground plane and a single blue speck for "137 actors". Root cause: `parseCameraParam` always starts from `defaultCamera()` whose target is `[0,0,0]` — the world **corner** — while the recipe parade is placed at x ≈ 400 m, y = 400 m (`capture.ts:90`) and the ground plane is centred at (400, 0, 400) (`scene.ts:77`). The camera looks at the corner; the subjects are out of frame. The test's assertions are structural (39 part instances; `png.byteLength > 5000`) and cannot detect an empty picture, and the metadata is all correct — which is exactly why nobody noticed | viewed PNGs; regenerated here; code lines cited | (a) `/capture` targets the centroid of the actors it renders (or the world centre), and accepts an explicit `target=x,y`; (b) add a pixel-level sanity assertion: project each rendered actor to screen and assert it lies inside the viewport, and assert the central region's non-background pixel fraction exceeds a TUNE floor; (c) regenerate both evidence files and **look at them**; (d) re-mark G0's screenshot line (see W0-11) until (a)–(c) land |
| Low | Caption and metadata say "camera 45°/0°/60m" for the parade and "45/30/220" for the world — correct values, wrong target; the metadata should include the target so a reader can see where the camera looked | `capture-metadata.txt` | Add `Target` to the `tEXt` set |
| Info | Watermark, warm-up frames, PNG `tEXt` provenance, software-WebGL disclosure, Worker/Node hash parity: all as claimed | capture spec; my run | none |

Acceptance criteria:
1. Static build; Worker at 1×/2×/4× with pause; confirmed tick shown: **PASS** (`shell.spec` 8 tests ran here, including offline boot).
2. Eight recipes render as distinguishable procedural characters; bounds and attachment points recorded: **FAIL** — the artifact cited as evidence depicts no characters; distinguishability cannot be judged from it (bounds/attachment points: recorded per `kit/recipe.test.ts`, that half stands).
3. `/capture` renders after warm-up and writes a PNG with metadata; FakeSim watermark: **PASS (mechanism) / FAIL (content)** — the route and metadata work; the picture does not show the fixture's actors.
4. Browser Worker hashes equal Node hashes: **PASS** (`worker-hash.spec` 3/3 here).

Verdict: **CHANGES_REQUESTED** (one High). The fix is small; the finding is not: an evidence image that no one looked at satisfied a structural test and was cited as gate evidence.

This is review of the returned candidate, not proof that later merged code passes. **No packet is marked ACCEPTED here; acceptance is Jani's.**
