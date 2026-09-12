# Handoff — W0-09 / attempt 1

Status: **READY_FOR_REVIEW**.
Base ID / Git commit / contract / content: base `04dc723` (W0-08 ACCEPTED) → this commit. Contract v0 unchanged; scene version 1; renderer `clanlab-readability-2d-v1`.
Goal and implemented behavior: the deterministic 2D top-down readability render of a snapshot (law boundaries, actors as discs with a ring, headwear glyph, action icon, nameplate), `clanlab render`, and the first readability assertions with TUNE thresholds.

Changed files and purpose:
- `packages/lab/render/scene.ts` — palette, WCAG contrast maths, the pure scene model (mm → px with a fixed margin, no auto-fit), nameplate layout, the readability metrics and their TUNE thresholds.
- `packages/lab/render/draw.ts` — node-canvas rasterizing, the twelve action icons and ten headwear glyphs, `tEXt` metadata embedding with CRC, `readPngText`, `toLatin1`, and `iconDistinctness` (each icon rendered alone and hashed).
- `packages/lab/render/command.ts` — `renderFixture`: builds the world from the fixture's map seed, advances the real kernel to `--tick`, takes the W0-08 snapshot, renders, and returns the readability verdict as the exit code.
- `packages/lab/render/index.ts`, `packages/lab/cli/run.ts` (dispatch, help, version `0.1.0-w0-09`).
- `packages/lab/render/render.test.ts` (15 tests); `tests/fixtures/PRESENT-READ-01.json` + `tools/gen_present_read_01.mjs`; `canvas@3.2.0` pinned exactly.

| Acceptance criterion | Evidence path | Executed result |
| --- | --- | --- |
| 1. `clanlab render --fixture <f> --tick <t> --out <png>` produces a PNG with metadata (fixture, tick, build hash) for the synthetic workload | `evidence/cli-transcript.txt`, `evidence/present-read-01-t300.png`, `evidence/render-summary.json` | **PASS** — exit 0, 200,918 bytes, 137 actors and 1 law boundary at tick 300. The PNG's own `tEXt` chunks read back as `Fixture=PRESENT-READ-01`, `Tick=300`, `BuildHash=sha256:572f9f6e…`, `Software=clanlab-readability-2d-v1`, plus the terrain status |
| 2. Readability assertions exist and run: nameplate overlap below a threshold, ring contrast above a threshold, every action-state icon distinct; thresholds recorded as TUNE | `evidence/render-summary.json`, `render.test.ts` | **PASS** — overlap 17/137 = 0.124 against a 0.35 threshold; ring contrast minimum 6.24 against a floor of 3 (Contestant 7.22/6.24, Wildlife 9.80/8.47, Guest 8.75/7.56 versus disc/ground); 12 of 12 icons rasterize to distinct pixel hashes. Every threshold carries `thresholdStatus: "TUNE"` and a note saying what it was set from. Both negative cases are tested: stacking all 137 actors on one point fails the overlap check, and a reported duplicate icon fails the icon check |
| 3. The renderer is pure over the snapshot: same snapshot, same bytes | `evidence/cli-transcript.txt`, `render.test.ts` | **PASS** — two independent CLI renders of tick 300 produce byte-identical files (`sha256 6229a6b8…` twice); a test renders the same snapshot twice in-process and compares buffers, and a second test requires tick 100 and tick 200 to differ so a stale image cannot pass as fresh |

Commands actually executed: `npm run verify` → **0** (build, lint, **442/442** vitest across 25 files — 426 at baseline, **+16**; 6/6 python; workboard PASS; `evidence/verify.txt`). `node tools/gen_present_read_01.mjs`; `clanlab render … --tick 300` → 0, twice.

Pre-existing baseline failures: none.

Design decisions within scope:
1. **Nothing is drawn that does not exist.** There is no map compiler, so terrain is one declared `unavailable` class rather than invented biomes; clans do not exist, so the ring encodes actor kind; no actor has an action state, so icons are assigned deterministically from the actor's id purely to exercise the icon set. All three are listed as skipped checks in every render summary with the packet that will supply the real thing.
2. **The twelve icon names are provisional and say so.** TP v1.1 §2 requires twelve action states at G1 but does not enumerate them where I could find them, so I did not invent a canonical list and present it as one. What is verified is what can be: the twelve rasterize differently, proved by hashing each icon rendered alone.
3. **The scene is pure data and the raster is separate.** Layout and readability are asserted without rendering anything, which is why the overlap metric could be tested against a deliberately crowded scene.
4. **The DOM-type ban was respected, not weakened.** node-canvas names its context `CanvasRenderingContext2D`, which the lab's lint rule bans by name. Rather than add an exception, `DrawingContext` declares exactly the surface the renderer uses — the same approach W0-08 took for IndexedDB.
5. **`tEXt` is Latin-1**, so metadata is transliterated deliberately (`toLatin1`) instead of being written and silently corrupted. The first evidence run caught this: an em dash had become `\u0014` in the image.

Contract proposals or deferred work outside scope:
- **Fixture DSL v1 cannot express a readability assertion.** Its kinds are `EventCount*`, `Invariant` (four registered names, none about presentation) and `HashEqualVariant`. PRESENT-READ-01 therefore carries only what the DSL can honestly express, and the readability verdict lives in the render summary and the exit code. Adding a readability assertion kind is a named gap for a later lab packet — the fixture's own notes say so rather than implying the checks ran through `clanlab run`.
- `clanlab render` builds the world from the fixture's **map seed**, not from its declared `setup.actors`; when the two rosters differ the summary records `FixtureSetupNotApplied` naming the P1 packet that will seed a world from fixture setup.
- The card's in-scope path is `packages/lab/render/**`; the CLI dispatch in `packages/lab/cli/run.ts`, the fixture and its generator are the minimum outside it needed to expose and exercise the command.

Remaining risks, reproduction and exact next action:
- The thresholds are TUNE and came from this synthetic scene plus WCAG's non-text floor. They are not a human readability review — PRESENT 01's other half is, and these numbers do not stand in for it.
- Nameplates are laid out at a fixed offset with no de-collision; 12% overlap at 137 actors is tolerable now and will not be at higher densities. Leader-line or priority-based hiding belongs with the in-game overview (P1-29).
- Reproduce: `npm run verify`, then `node packages/lab/dist/cli/index.js render --fixture tests/fixtures/PRESENT-READ-01.json --tick 300 --out <png>`.
- Next action: review, then W0-10 (web app shell, Worker bootstrap and the `/capture` route) — which also resolves the browser half of W0-07's criterion 1.

Source archive/patch and RETURN_MANIFEST.json: not applicable — GitHub is canonical; the work is pushed to `main`.

Reviewer request: reproduce the acceptance evidence against the returned files and record findings in REVIEW.md.
