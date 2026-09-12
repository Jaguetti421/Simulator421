# Independent review — P1-01 / attempt 1

Reviewer / role / fresh-context declaration: same developer, **same session as the author** — not fresh-context, under the producer-approved relaxation. Worth repeating here because this packet changes the contract surface the rest of P1 builds on.
Author / base / commit: same developer; base `cf8641c` → `41edb31` (slice 1) → `fbc34f0`.
Checks independently reproduced: `npm run verify` → 0 (**509/509** across 31 files); `npm run test:e2e` → 0 (17 tests); `node tools/gen_contract_artifacts.mjs` re-run → no diff; the contract digest recomputed from the live declarations rather than read from a summary.

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| **Medium (disclosed, unavoidable now)** | Seven records are declared and nothing executes them | no action system exists until the P1 action packets | Their refinements are proven by samples, not by a simulation. The first packet that implements an action will find shapes that cannot express a real one — that is expected, and cheaper than guessing further. Do not read "contract frozen" as "contract validated by use". |
| Medium (loud by design) | The contract digest changed: `291f9b94…` → `3fe2ced1…`, and it appears in every run summary, failure bundle and render summary | `evidence/contract-digest.txt` | Correct handling: records were added, none edited, so the sixteen existing shapes are byte-identical and old artifacts remain truthful records of the surface they were made against. |
| Medium (process, mine) | Two scripted edits in this packet silently did nothing before I noticed — the `CONTRACT_RECORDS` spread was lost when a later assertion in the same script threw, and the sample manifest needed three passes to match the existing format | the record count read 16 after "registered" printed | Same class as the W0-11 `gates.json` miss. The fix is ordering, not care: **write the edit, then assert, and never batch an unrelated assertion after a completed write.** Third occurrence; recorded in STATUS rather than treated as a one-off. |
| Low | `appearance-recipe.reject-unknown-headwear.json` was first labelled `enforcedBy: refinement` when the schema enum catches it | manifest corrected | Caught by the samples test, which distinguishes the two layers on purpose. |
| Low | My first samples wrapped the value in `{record, value}`; existing samples are bare values with the record named in the manifest | corrected, and the files are now written through `encodeJsonPretty` | The canonical-form check caught it byte-exactly, which is what it is for. |
| Info | `composeProviders` refuses duplicate and unknown sections at construction | tests | A startup failure instead of a mid-match mystery. |
| Info | The consumer map found three real gaps on its first run | `EventRange`, `JournaledCommand`, `RouteRequest` | The criterion earned its place immediately rather than ratifying what was already true. |

Contract, ownership, hidden-state and serialization findings: the existing sixteen shapes are unchanged — verified by the emitted-schema comparison, which fails on any hand-edit. No record exposes mutable state: `ActionResources` names reservation **keys**, `ActionCompletion` names an output **entity ID**, and neither hands over a container. `AppearanceRecipe` carries palette indices rather than colours, keeping presentation choices app-side. `packages/sim` purity holds.

Acceptance criteria: 1 **PASS**, 2 **PASS**, 3 **PASS**.

Verdict: **ACCEPTABLE_FOR_INTEGRATION** — three Medium (one an honest limit of any contract written before its implementation, one a deliberate and loud digest change, one a repeat process failure of mine), two Low, two Info.

This is review of the returned candidate, not proof that later merged code passes. The packet stays READY_FOR_REVIEW until Jani accepts it in chat.
