# REVIEW-EXTERNAL-01 — preliminary response from the reviewing agent

**To:** the web-track developer, via Jani · **From:** the reviewing agent (Claude Fable 5.1, fresh context — I authored the plans, I have not seen a line of this code) · **Date:** 13 September 2026 · **Re:** REVIEW-REQUEST-01, build `test-build-01` = `f42e343`

## 1. Status: the packet reviews are BLOCKED

`git clone https://github.com/Jaguetti421/Simulator421.git` from this sandbox fails with "could not read Username" — the repository is private (or requires authentication) and no credential was supplied. Under the rules you set and I hold: **no repository, no review.** I will not write fourteen REVIEW-EXTERNAL-01.md files from a handoff description; that would be exactly the same-session-review problem wearing a different hat.

**What unblocks it** (any one):

1. Jani pastes a fine-grained GitHub token with **Contents: read** on `Simulator421` into the message that dispatches me, together with the tag. I use it in memory only.
2. Jani uploads a zip of the repository at `test-build-01` (with `.git`, so I can read per-packet diffs; without `node_modules`).
3. The repository is made public for the duration of the review.

Then I deliver the per-packet files in the order you set (P1-01…04, W0-06…08, DEBT-01/02, then W0-09…11) plus the summary, each declared as fresh-context, each verdict tied to an artifact I ran or read. I can run `npm run verify` and the Playwright suite here (Node 22, npm registry reachable; browsers must be installable via Playwright — I will record BLOCKED if they are not).

## 2. What I can deliver now without the code

Three of your §5 items and most of your §3 suspicions are answerable from the design, the plans and the algorithms. That is what follows. None of it is a verdict on a packet.

- **§5.1 — the ESLint rule.** Delivered and tested: `tools/eslint/no-bare-int-arithmetic.ts`, with a fixture project and a runner that passes on typescript-eslint 8.70 / ESLint 10 / TypeScript 6.0 (the versions that installed here). See `tools/eslint/README.md` for wiring, options and what it does *not* catch.
- **§5.2 — action contracts vs TP v1.1 §8.** Section 4 below: what an action implementation will need from the contracts, and which of your seven unexecuted records are most likely to break first.
- **§5.3 — what the plans got wrong.** Section 5 below: your three, confirmed and corrected, plus four more I can see from here.
- **§3 — your suspicions.** Section 3 below, item by item. Item 9 (A* admissibility) has a concrete answer that does not need the code to be *stated*, but needs the code to be *confirmed*: it depends on two facts about your grid that you did not give.

## 3. Your ten suspicions

**3.1 Escarpment authored into the valley.** Both readings are true, and the fix separates them. Class coverage is a *test* concern: a template used by the suites must instance every traversal class, and that template can be `ridge` or a purpose-built `classes-all`. The shipping valley's terrain is a *design* concern: GDD §22's first-playable valley is Jani's to shape. If the escarpment stays, record it in the addendum as a design choice with a design reason (a readable landmark for the eight-person scene is a legitimate one), not as a test need. If it was only there for coverage, remove it from `valley` and keep it in the test template. Either way the finding for the suites is 3.2.

**3.2 Suites run on `ridge`, never on `valley`.** This is the one I would fix before G1, and I would call it Medium now and High at G1. The shipping map must be under test even when its cases are dull: LOS across open ground at the sight limit, shallow-water crossings with the speed multiplier, coast edges, the eight-actor start positions, and the D05 anchor-set route times. Add `tests/fixtures/valley-*.json` that exercise exactly those. A suite that never touched the shipping template proves the algorithm, not the game.

**3.3 149k shallow + 71k deep of 640k.** Two questions before anyone calls it wrong. (a) Is "valley" the 800×800 m full-island envelope or TP §22's 180×180 m first-playable scene? If it compiles to 640k cells it is the former, and deep water at the perimeter is the *sea* — expected. (b) What is the walkable land fraction inside the coast, and does it satisfy the GDD's density rules (food within 45 s, a camp site within 90 s, D05's anchor times at 3.5 m/s)? Those rules, not the raw cell counts, are the acceptance test. Ask Jani for a design ruling on target land fraction; until then record the constants as developer-set. Hypothesis, not guidance: an island with 55–70 percent land inside the coast is what the GDD's pacing seems to assume.

**3.4 Every TUNE constant.** Correct approach, correctly declared. One structural request: collect them in a single `tune.ts` per package with a citation column — GDD/addendum section, or `DEV` if you set it — so the design review at G1 is a one-file read. Eye height 1.6 m and obstacle height 2.2 m are conventional; route budget 4,000 expansions per job is consistent with TP v1.1 §5's 20,000 per tick if at most five route jobs run per tick — write that relation down where the budget is defined.

**3.5 Seven unexecuted contract records.** See section 4. Short version: the records that break first are the ones describing *in-flight* state, not requests and results. If none of your seven is an executor-instance record with a state-section codec, the first action packet will discover that a half-finished action cannot be saved.

**3.6 `AppearanceRecipe` carries palette indices.** Good call; I would keep it. Palette resolution is presentation, indices are deterministic and theme-swappable, and the readability renderer can use the same palette table so the 2D and 3D views agree by construction. The TP error is mine — see 5.1.

**3.7 Fixture DSL v2 with `ToolCheck`.** Not a High finding. The kit is versioned, not immutable: INTERFACES.md's change procedure (proposal, review, version bump) is exactly what a dated addendum in both the schema and FIXTURE_DSL.md is. One consequence to log rather than fix: the schema is shared with the Godot track, and the two tracks now differ. Record `ToolCheck` (and the `AckCountGte` kind I propose in 5.2) as a design clarification candidate for both tracks in the research log.

**3.8 Kernel host submits only `ScheduleLaw`.** Acceptable at this stage, on one condition: a fixture that schedules an unsupported operation must terminate with a typed `UnsupportedOperation` → BLOCKED_TOOL count, never hang, never pass, and the runner's summary must show that count. If it does, the "Blocked indefinitely" is honest and visible; if fixtures can sit in a pending state, that is a Medium finding.

**3.9 A\* admissibility.** Your heuristic `h = isqrt(d) × 1000` with step cost `1,000,000 / speedMultiplier` is admissible and consistent **only if both of the following hold**, and you did not state either:

- **Diagonal steps.** If the grid is 8-connected and a diagonal step costs 1,000 (same as an axial step), the Euclidean heuristic over-estimates: a diagonal cell is 1.414 units of `h` but 1.000 of `g`. That is inadmissible, and it produces exactly the plausible-but-suboptimal routes you fear. Fix: diagonal cost = `ceil(1000 × √2) = 1415` (1414 is 0.02 percent inadmissible; take 1415), or use an octile heuristic. If the grid is 4-connected, Euclidean `h` is admissible against Manhattan movement and this point is moot.
- **Minimum step cost.** `h` assumes no cell costs less than 1,000 per unit of distance. Any traversal class with `speedMultiplier > 1000` (a road, a downhill bonus) breaks admissibility. Assert `min(stepCost) ≥ 1000` at content-compile time.

Given those two, consistency holds: for any edge `|h(n) − h(n′)| ≤ 1000 × ‖n − n′‖ ≤ c(n, n′)`, and `isqrt` flooring only lowers `h`, which is safe. Also confirm: `d` is in *cell* units squared, not millimeters squared (otherwise `h` is off by 10⁶ and the search degenerates to Dijkstra or worse); the open set orders by `(f, g, cellIndex)` for determinism; and for **certified partial routes** under the 4,000-expansion budget, the certified endpoint is the closed node with minimum `h` (not the last expanded node), and its `g` is optimal only because the heuristic is consistent — which is why the two conditions above matter for partial routes as much as full ones.

**3.10 Your process failures.** I cannot look for a fifth without the repository. Two mechanical guards worth adding regardless: every scripted edit ends with a non-empty `git diff --stat` assertion (a script that changed nothing fails loudly), and a pre-push hook that runs lint so a red-lint push is impossible rather than merely noticed.

## 4. Action contracts — what the first action implementation will need (§5.2)

TP v1.1 §8 defines an action as a transaction with a visible execution state through Pending, Travelling, Ready, Working, Interrupted, Completed, Failed. Reading that table as a contract checklist, an action implementation needs *five shapes*, not two:

| Shape | Contents TP §8 requires | Most likely gap in "request/result only" records |
| --- | --- | --- |
| **ActionDefinition** (content) | Kind, parameters, duration ticks, work-position rule, progress milestones (e.g. construction's 50 percent consumption), precondition spec (state, knowledge, distance, procedure, tools, permissions, timing), resource spec (inputs, output capacity, ownership policy, reservation keys), animation and sound cues, recovery methods per failure reason | Milestones and recovery methods are usually forgotten |
| **ActionRequest** | Stable action ID, definition ID + version, actor, **typed** target (entity / cell / socket / partner), plan ID, causal parent event, knowledge version and rules version the preconditions were evaluated against, requested tick | Untyped target; missing knowledge/rules version — revalidation on interrupt then has nothing to compare |
| **ActionInstance** (executor state — **must be a state section with a codec**) | Current state, progress ticks, milestones applied, lease handles with expiry and renewal ticks, consumed-input ledger, route handle, last revalidation tick, cooldown-until tick, retained-progress rule | This is the one that breaks first: a half-finished action must survive save/load (DATA fixtures) and replay, so it needs `IStateSectionCodec` |
| **ReservationSet / ReservationHandle** | Key kind (stack, quantity, slot, passage, partner), canonical ordering for multi-key atomic acquire, owner actor, lease expiry, denial reason visible to the requester | Atomic multi-key acquire needs a set record, not N handles |
| **ActionResult** | Outcome (Completed / Failed / Interrupted), typed reason ID, consumed inputs as before/after per stack, produced outputs with location, knowledge effects, emitted event types, retained progress | Before/after quantities (audit builds) and retained progress are the usual omissions |

Plus event payloads for ActionStarted / Milestone / Completed / Failed / Interrupted with causal parents, and InventoryTransfer with before/after quantities; `DamageProposal` you already have.

Which of your seven will break first: whichever ones assume an action is a request that returns a result in one tick. Actions here span ticks, hold leases, and get interrupted; the *instance* is the contract, and it must serialize. If P1-01's five records include an instance record with a section codec, you are fine; if not, that is the record to add before P1 touches actions.

## 5. What the plans got wrong (§5.3)

1. **`AppearanceRecipe` "existing contract".** Confirmed, my error. TP v1.1 §13 describes it as a *concept* ("behind AppearanceRecipe"); INTERFACES.md never lists it as a frozen record. TP v2.0 §13 wrongly says "the AppearanceRecipe contract from v1.1 is unchanged." Correction: "AppearanceRecipe is a new contract record introduced in P1-01; v1.1 described the concept only." Your palette-index shape is the definition.
2. **`CommittedEvent` cannot carry a rejection, but `LAW-NOTICE-REJECTION.json` asserts `EventCountGte CommandRejected`.** Confirmed: INTERFACES.md puts rejection on `CommandAck` (reason ID, no false UI state) and defines `CommittedEvent` as factual/reported world events. The example fixture is wrong, not the contract: a rejected command never happened in the world and must not enter the authoritative event log or its hash domain. Fix: add an assertion kind `AckCountGte { status: "Rejected", reasonId?, min }` to DSL v2 and rewrite the example to use it; keep `NoIllegalEffects` as the invariant. If you want rejections visible in the lab, emit them into the *diagnostic* stream (observer hash domain), never the authoritative one.
3. **BLOCKED_RENDER in the sandbox was stale.** Confirmed as my observation error: I measured one sandbox once (headless-gl returned null; no Playwright browsers) and wrote it into two cards as if it were the environment. The cards should have said "record what the environment provides." Good news that it renders.
4. **TP v2.0 §18 targets are pre-measurement.** Declared as such, but a 20 ms Node tick P95 at 137 actors was a guess; your G0 numbers replace it. Please cite the measured figure in STATUS and mark the plan's row superseded.
5. **W0-07's card says the browser half "is verified in W0-10"**, which sequenced Worker hash parity after the kernel. If Playwright was available earlier, parity belongs in W0-07's own acceptance. Card ordering was conservative, not wrong; note it.
6. **Fixture DSL version references.** The kit's docs say "v1" throughout; you are on v2 with a dated addendum. When the reviews land, every fixture I read will be checked against v2, so please make sure FIXTURE_DSL.md's header states the current version and the delta list.
7. **`RouteResult` "certified portal for Partial"** (INTERFACES.md row) assumes the hierarchical portal graph of TP v1.1 §5. If P1-04 certifies partial progress by minimum-`h` closed node rather than by portal (your wording "certified partial progress" suggests so), the contract's field name is misleading and should be renamed to what it certifies. This is a question, not a finding, until I read it.

## 6. What I am not doing

No gameplay design feedback, no scope suggestions, no P2+ planning — you asked, and Jani owns them. Once the repository is reachable, the packet reviews arrive in your priority order with the summary file, and nothing in them will say ACCEPTED.
