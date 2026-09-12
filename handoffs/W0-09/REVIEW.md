# Independent review — W0-09 / attempt 1

Reviewer / role / fresh-context declaration: same developer, **same session as the author** — not a fresh-context review; the relaxed one-window rule applies and Jani accepts in chat.
Author / base / commit: same developer; base `04dc723` (W0-08 ACCEPTED) → `65644ec`.
Checks independently reproduced: `npm run verify` → 0 (**442/442** across 25 files); `clanlab render` run twice and the two PNGs compared by sha256; the embedded `tEXt` metadata read back out of the committed image; `node tools/gen_present_read_01.mjs` re-run → no diff.

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| Medium (found and fixed inside the packet) | PNG `tEXt` is Latin-1; the terrain string contained an em dash and was written as `\u0014` — metadata that decodes as something other than what was meant | first evidence run showed the mangled value; `toLatin1` and its test now transliterate deliberately | Fixed. Worth noting the first evidence generation is what caught it, not the tests — a reason to read evidence rather than only diff it. |
| Medium (scope, named not hidden) | Fixture DSL v1 cannot express any readability assertion, so `clanlab run` on PRESENT-READ-01 proves nothing about readability | the fixture's own notes; the verdict lives in the render summary and the exit code | No silent workaround: I did not register invented invariant names to make the fixture look richer (the DSL correctly rejected that attempt). A readability assertion kind is a named gap for a later lab packet. |
| Medium (design, deliberate) | Three visible elements stand in for things that do not exist: terrain class, clan ring, action state | every render summary lists `TerrainUnavailable`, `RingEncodesKindNotClan`, `ActionStatesNotAssigned` with the packet that supplies the real thing | Correct for W0-09. The alternative — inventing biomes and clan colours — would make the picture look further along than the build is. |
| Low | The twelve icon names are provisional; TP v1.1 §2 requires twelve action states but I could not find them enumerated | `ACTION_ICONS_ARE_PROVISIONAL`, surfaced in the report | Do not treat this list as canonical. The packet that implements actions freezes the names; the distinctness check survives a rename. |
| Low | Thresholds are TUNE from one synthetic scene plus WCAG 1.4.11 | `READABILITY_THRESHOLDS.tuneNote` | They are not a human readability review. PRESENT 01's human half still owes that. |
| Low | Nameplates have no de-collision: 12% overlap at 137 actors, and it will be worse at higher density | overlap metric in the summary | Belongs with the in-game overview (P1-29), where hiding and leader lines are a design decision rather than a renderer detail. |
| Info | node-canvas's context type is named like the DOM one | `DrawingContext` declares the surface structurally | The lint ban was respected rather than given an exception — same approach as the IndexedDB types in W0-08. |

Contract, ownership, hidden-state and serialization findings: contract v0 untouched. `packages/lab` keeps its boundary — no `three`, `react`, DOM or `apps/web` imports; node-canvas is explicitly permitted there. Purity is a real property and not a claim: the scene is computed without a canvas, and two CLI renders produce byte-identical files.

Acceptance criteria: 1 **PASS**, 2 **PASS**, 3 **PASS**.

Verdict: **ACCEPTABLE_FOR_INTEGRATION** — one Medium found and fixed in-packet, two Medium recorded as named limits, three Low, one Info.

This is review of the returned candidate, not proof that later merged code passes. The packet stays READY_FOR_REVIEW until Jani accepts it in chat.
