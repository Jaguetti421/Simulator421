# Handoff — P1-12 / attempt 1

Status: **READY_FOR_REVIEW**.
Base: `3050d38` (P1-07 in review; P1-12 depends only on P1-01) → this commit. Contract v0, 24 records, digest unchanged.
Goal and implemented behavior: one permission service interpreting typed law intervals, with start-inclusive/end-exclusive boundaries, same-tick law precedence, and denials that carry a truthful reason.

Changed files: `packages/sim/core/permission.ts` (new) — `PermissionService`, `isActiveAt`, `resolveEffect`, the `Law` and `PermissionResult` types; `packages/sim/core/index.ts`; `packages/sim/core/permission.test.ts` (11 tests).

| Acceptance criterion | Evidence path | Executed result |
| --- | --- | --- |
| 1. Start-inclusive and end-exclusive boundaries are consistent | `evidence/permission.txt`, `permission.test.ts` | **PASS** — a law active `[100, 200)` covers 100 and 199 and not 99 or 200. A test walks **every tick from 90 to 210** asserting the service's verdict matches the `isActiveAt` predicate exactly, so there is no off-by-one between the predicate and the service that uses it. A zero-length interval covers nothing. Spatial boundaries are inclusive per TP §10, checked exactly on the radius |
| 2. New law wins over same-tick action resolution | `evidence/permission.txt`, `permission.test.ts` | **PASS** — the same effect at the same tick applies before the law is installed and is denied after, which is the stage-1-installs-before-stage-6-resolves ordering TP §4 requires. An amendment's new window takes effect from its own activation tick, and an amendment that does not increment the version is **refused with the previous law left intact** (TP §10: "failure leaves the previous event intact") |
| 3. Denied action produces no effect and retains a truthful reason | `evidence/permission.txt`, `permission.test.ts` | **PASS** — a denial returns no effect at all, not a reduced one. It names the rule, its version, its scope and a reason ID the test checks against the **frozen v0 registry**, plus a detail giving the interval: `law.sanctuary v1 forbids SentientHarm at tick 10 (region scope, active [0, 1000))`. When several laws would deny, the same one is named every time. What no law forbids is allowed, with no rule ID and no reason — the service never invents a refusal of its own |

Commands executed: `npm run verify` → **0** (build, lint, **674/674** vitest across 42 files — 663 at the packet baseline; 6 python; workboard PASS).

Design decisions within scope:
1. **One service, no opinions.** Laws are data; this interprets them. Every denial names the law that produced it, so "the AI cannot bypass it" is checkable: there is no refusal without a law behind it.
2. **Both points are tested** for an interaction, because standing outside a sanctuary does not license reaching into it and standing inside does not license reaching out (TP §10).
3. **Candidate laws are considered in ID order**, so when several would deny, two runs name the same one. A denial that varies between runs is a replay divergence dressed as a gameplay detail.
4. **An amendment must increment the version**, and a failed amendment throws rather than half-applying — the previous law stays exactly as it was.

Contract proposals or deferred work outside scope — this is the interval and scope engine. **Not here:** the six-point Influence budget, the 60-second notice rule, the three-active-modifier cap, category overlap, the start-by-48:00 / end-by-50:00 windows, cancellation history, or concurrency evaluated across the whole future schedule (TP §10's "Intervention scheduling" paragraph is a packet of its own). Also absent: environmental modifiers, social commandments and religious teachings — all of which TP §10 says must never change the hard permission result, and none of which exist yet to try; Herald's Hearth capture; projectile permission at launch and impact (P1-21); and the cancellation of hostile preparations and clearing of covered statuses when protection activates.

Remaining risks: the `reasonId` on a law is supplied by its author and validated only in the tests — nothing yet refuses a law carrying a reason outside the frozen registry at install time. That check belongs with the packet that loads laws from content rather than from a literal. Reproduce with `npm run verify` and the script in `evidence/permission.txt`.

Reviewer request: reproduce the acceptance evidence and record findings in REVIEW.md.
