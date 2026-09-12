# Session resume — P1-01, after slice 1

Written 12 September 2026. **P1-01 is IN_PROGRESS, not complete.** W0 is closed: G0 was approved by Jani on tag `w0-baseline`, with two human checks (visual judgement of the eight identities, GPU frame timing) **deferred to G1, not satisfied** — they are in `state/gates.json` under `deferredHumanChecks` and must be re-raised there.

## Baseline
`npm run verify` → 0: 475/475 vitest across 30 files, 6 python, workboard PASS. Pushed.

## What slice 1 delivered (criteria 2 and 3)
- **`packages/sim/host/providers.ts` + 7 tests — criterion 2.** `composeProviders()` is the only place providers are wired. `decisionContext(actorId, tick)` returns a frozen object whose five members all return contract records: `knowledge()`, `perceive()`, `route()`, plus `actorId` and `tick`. A test walks the reachable object graph from a DecisionContext and asserts a sentinel world object is unreachable even when the perception provider closes over it; another asserts the context is frozen so a handle cannot be grafted on later; section codecs are deliberately off that surface.
- **`tests/contracts/consumers.test.ts` — criterion 3.** Scans every `*.test.ts` / `*.spec.ts` for each of the 16 record names and fails on any record with no named consumer. **It immediately found three: `EventRange`, `JournaledCommand`, `RouteRequest`** — covered only by a generic sample loop, so a contract change searching by name would have missed them. Named assertions added for all three against their real fields. Reason IDs are covered the same way.

## Remaining (criterion 1, and the extension the card asks for)
1. **Extend the action lifecycle contracts to TP v1.1 §8's table.** Present records cover identity, preconditions (partly), revalidation dependencies and typed failure. **Missing:** resources (inputs, output capacity, ownership policy, reservation keys), execution detail (work position, progress milestones, animation and sound cues), interruption (consumed vs unconsumed inputs, retained progress, lease release, cooldown) and completion (atomic effects, output location, knowledge effects, committed event types). Decide whether these extend `ActionRequest`/`ActionResult` or arrive as new records — new records keep the existing 16 stable and the contract digest change explicit.
2. **World queries and complete state sections** — `IPerceptionQuery`/`IRouteQuery`/`IStateSectionCodec` exist as types from W0-04 and are now composed; check TP §12 for what a *complete* section set must declare and whether a `StateSectionSet` record is needed.
3. **Golden samples and codec versions for everything added**, in `contracts/samples/`, following the W0-04 pattern (valid plus at least one reject case per rule). The consumer-map test will fail until each new record has a named consumer.
4. Then handoff, review, STATUS, workboard.

## Carried notes
- Any new record changes `identity.contract.recordsDigest`, which appears in every run summary and bundle. Say so in the handoff; it is not a silent change.
- **`AppearanceRecipe` is still not a contract record** (W0-10 finding). It is presentation, not action lifecycle, so it does not belong in this packet's scope — but P1-01 is the first contracts packet, so decide explicitly and record the decision rather than letting it drift again.
- Every scripted edit asserts its match before writing (the gates.json edit that silently did nothing in W0-11).
