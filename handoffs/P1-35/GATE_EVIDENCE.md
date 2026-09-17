# G1 gate evidence — first playable

**Requested:** 14 September 2026 · **Build:** tag `g1-candidate` on `main`, `github.com/Jaguetti421/Simulator421`
**Decision required from Jani.** Under the 14 September standing authorization I accept packets myself; **a gate is the thing that authorization exists to reach, and it stops here.**

## What this build is

Eight contestants on a validated island, deciding what they need, planning for it, walking there over real terrain, and eating. Not a demonstration that the pieces could work — the pieces working.

| G1 criterion | Artifact | Result |
| --- | --- | --- |
| Eight contestants complete meaningful tasks with traceable reasons | `evidence/g1-evidence.txt` §1 | **PASS** — 1,200 ticks; `goal.eat` completed repeatedly with the tick recorded per actor; fullness rises from `[40, 38, 36, 34, 32, 30, 28, 26]`; all eight alive. One decision trace printed in full |
| All G1-mapped scenes execute | `evidence/g1-evidence.txt` §2 | **PASS** — survival, island compile and validation, scene sockets, first night, law denial, 600-tick replay |
| Omitted full-game behaviours are listed | `evidence/g1-evidence.txt` §2 | **PASS** — six named, and asserted by test so the list cannot go stale |
| Synthetic counters separate from real evidence | `evidence/g1-evidence.txt` §3 | **PASS** — the 137-actor numbers are printed with their own eight omissions attached and declared incomparable |
| Save/load reproduces the next 600 ticks | `handoffs/P1-33/evidence/replay.txt` | **PASS** — eight save points, 600 ticks clean from tick 120 |
| The build a player runs is the build the evidence describes | this packet | **PASS as of P1-35** — `apps/web` now runs the composed host, not the W0-07 synthetic workload |
| GPU frame timing at 1920×1080 | — | **HUMAN_REQUIRED** — no GPU has ever run this; every number here is from a single-CPU sandbox with software rendering |
| Visual judgement of the eight identities | `handoffs/W0-10/evidence/identity-kit-prototype8.png` | **HUMAN_REQUIRED** — carried from G0 |

Verification: `npm run verify` → **0** (build, lint, **1,050** vitest across 68 files, 6 python, workboard). `npm run test:e2e` → **0**, 17 Playwright tests including browser/Node digest parity and an offline boot.

## What it is not

Stated plainly, because a gate package that blurs this is worse than no package:

- **Building and combat are composed and unchosen.** Every system is wired into the host; no goal in the library selects them. The code is there; the behaviour does not happen.
- **Knowledge is given, not earned.** Actors are told where food is rather than perceiving it through the P1-15 sensory adapter. That join changes what actors can plan about and I deliberately did not make it in the packet that first ran them.
- **No clans, trust, teaching, promises, votes or careers.** All of P2.
- **No inventory economy.** Transfers, ownership policy and item reservations exist and the goal library does not use them.
- **Fourteen of fifteen packet reviews were written in the same session as the code.** The external fresh-context review (REVIEW-EXTERNAL-01) covered W0 and early P1 and found a High I had missed — empty capture images cited as gate evidence. The P1 packets from P1-05 onward have **not** had that treatment.

## The test path

`handoffs/P1-35/PLAYTEST_BRIEF.md` — about twenty minutes, four things to look at, five questions. The one that decides something: do these read as people surviving, or as markers moving?

## What I am asking for

1. **Approve or refuse G1.** If refused, name what would change it.
2. **The two human checks** — GPU frame timing, and the visual judgement carried from G0.
3. **A fresh-context review of P1-05 … P1-35**, through the same reviewing agent. It found a real High last time.
4. **P2 does not start until you record approval.** That is the rule and I am not treating silence as consent.
