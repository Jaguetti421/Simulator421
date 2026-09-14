# Independent review — P1-01 / candidate tag `test-build-01` (commit `199777f`)

**File:** `handoffs/P1-01/REVIEW-EXTERNAL-01.md` · **Date:** 14 September 2026

Reviewer / role / fresh-context declaration: Claude Fable 5.1, external reviewing agent. **This is a fresh-context review.** This session had no memory of authoring any file in this repository; I wrote the plans (Technical Plan v2.0, the web phases, the kit) and had never seen the code before cloning the tag. I read the developer's `handoffs/P1-01/REVIEW.md` only after forming the verdicts below.
Author / base / candidate: web-track developer; base as stated in `handoffs/P1-01/HANDOFF.md`; candidate = tag `test-build-01` → commit `199777f` (the request says `f42e343`, the last code commit; the tag is one documentation commit later — Low, recorded once in the summary).
Environment: Node 22.22.2, npm 10.9.7, git 2.43, Chromium via `npx playwright install chromium` (worked here), 1 CPU sandbox, software WebGL. Reproduced on the candidate before any packet review: `npm ci`; `npm run build` (ok); `npm run lint` (exit 0); `vitest run` **570 passed / 35 files** (36.7 s); `npm run test:tools` OK; `check:workboard` PASS (139 packets, 51 scenes); `playwright test` **17 passed**.

Files actually inspected and checks independently reproduced: `packages/sim/contracts/lifecycle.ts` (all seven new records and their refinements), `simulation.ts` (`ActionRequest`, `ActionResult` fields), `contracts/samples/` listing (14 new samples incl. reject cases), contract tests within the 570; the contract digest `sha256:3fe2ced1…` reproduced in every `clanlab run` summary; `reference/Technical_Plan_v1_1.md` §8 table (eight rows) compared against the records.

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| Medium | **Tautological refinement.** `ActionResources`: "An action that produces nothing does not reserve output capacity" is `outputCapacity === 0 || Object.keys(inputs).length >= 0` — the right-hand side is always true, so the refinement can never fail. No reject sample exists for it (the sample set has `reject-duplicate-reservation` only), which is how a dead refinement stays invisible when "refinements are proven by samples" | `lifecycle.ts:55`; `contracts/samples/` | Encode the intended rule with fields that can express it (an `outputs` count, or "outputCapacity > 0 ⇒ the definition declares outputs"), add a reject sample, and add a **refinement-liveness test**: every refinement must fail on at least one crafted sample |
| Medium | **Second tautology.** `AppearanceRecipe`: refinement `() => true` ("never carries stats") | `lifecycle.ts:247` | Remove it (put the intent in `description`) or make it checkable (e.g. reject any non-declared field — the closed-record rule already does that); the liveness test above catches both |
| Medium | **No in-flight action state.** TP v1.1 §8 has eight rows; five have records here. "Identity" (stable action ID + causal parent) and "Revalidation" (state of per-tick dependency checks) are partly folded into `ActionRequest` (`planId`, `dependencies`, `expectedLawVersion`) and the executor's Pending…Failed state — progress ticks, milestones applied, leases with renewal ticks, consumed-input ledger, last-revalidation tick, cooldown — has **no record and no state section**. `ActionResult.outcome` (`Started/Progressed/…` with `remainingTicks`) is an event stream, not persistable state. The first action packet will find that a half-finished action cannot be saved, replayed or restored; the handoff's "completing TP v1.1 §8" is therefore overstated | records read; TP §8 rows | Add an `ActionInstance` record registered as a state section (with codec) before P1's first action packet; reword the P1-01 handoff to "five of eight rows have records; instance state deferred to P1-xx" |
| Low | `ReservationKey.kind` = `Station, Slot, ItemStack, WorkPosition, Route`; TP §8 lists **passage** and **interaction partner** (trade, teach, rescue in P2) | `lifecycle.ts:34` | Add `Passage` and `Partner` when the first consumer arrives; note the gap now |
| Low | Two identities for one lease: `ActionRequest.leaseHandles` are `sequence`s; `ActionResources.reservations[].key` and `ActionInterruption.releasedReservations` are durable string keys | `simulation.ts:49`, `lifecycle.ts:33,119` | Pick one (durable key) and reference it from the request |
| Low | `AppearanceRecipe` is new here; TP v1.1 §13 named the concept, no contract existed. Plan erratum (mine), not a packet defect. Palette-index design is right | — | TP v2.0 §13 wording fixed in the summary |

Acceptance criteria:
1. Golden samples for shared requests, events, reasons and codec versions: **PASS** (every record has a valid sample; reject samples exist for all but the dead refinement).
2. Host composes providers with no world handle for decision code: **PASS** (`providers.test.ts` in the suite; not re-derived by me beyond running it).
3. Contract changes identify all consumer tests: **PASS** (`consumers.test.ts` runs).

Verdict: **CHANGES_REQUESTED** (three Medium). The shapes that exist are sound; the packet's claim of completeness is not, and one refinement is a false guarantee.

This is review of the returned candidate, not proof that later merged code passes. **No packet is marked ACCEPTED here; acceptance is Jani's.**
