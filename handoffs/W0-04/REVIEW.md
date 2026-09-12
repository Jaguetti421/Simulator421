# Independent review — W0-04 / attempt 1

Reviewer / role / fresh-context declaration: same developer, **same session as the author** — not a fresh-context review. Jani accepted W0-04 explicitly in chat on 12 September 2026 ("accept and continue"); that producer acceptance is the authority (AGENTS.md authority order, item 1). Recorded so the metric reads *waived by producer*.
Author / base / commit: same developer; base `dedfa6a` (W0-03) → `1a3d478` (pushed to origin/main).
Checks independently reproduced: `npm run verify` → 0 (build, lint, 233/233 vitest across 10 files, 6/6 python, workboard PASS); three mutation checks in `evidence/mutation-checks.txt`, each producing failures and restored green; sample sweep validated by ajv against the emitted schemas.

| Severity | File / behavior | Evidence | Required correction |
| --- | --- | --- | --- |
| Medium (fixed during the packet) | The dependency-direction rules were first added as a second ESLint block for `no-restricted-imports`, which silently replaced the purity rules for the same files | probe showed `node:fs` in `packages/sim/primitives` no longer erroring | Fixed: the rules are composed into one rule per module, and `tests/arch/boundaries.test.ts` asserts both sets fire together for every sim module. |
| Low | `payload.fields` is an empty closed object at v0, so samples carry no realistic payload content | `commands.ts`, `simulation.ts` | Intentional and documented; the first operation/event packet extends the schema and the samples together. |
| Low | `tests/contracts/samples.test.ts` lives outside the card's listed test paths | card "Tests and fixtures to add or extend" | Needed the filesystem and ajv, which `packages/sim` deliberately cannot use. Additive, noted in the handoff. |
| Low | `npm test` alone resolves `@lastclan/sim` to `dist`, so a stale build could be tested | `tests/contracts/*` | `npm run verify` and CI always build first; if this bites, add a pretest build step. |
| Info | Contract version 0 is frozen by this packet | `contracts/registry.json` | Any incompatible change now needs a contract-change record per the recorded procedure. |

Acceptance criteria: 1 PASS, 2 PASS, 3 PASS.
Verdict: **ACCEPTABLE_FOR_INTEGRATION** (producer-accepted; the one Medium was found and fixed inside the packet, with a regression test).
