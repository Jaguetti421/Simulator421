# Review decisions — technical plan v1.1 and work phases v2

11 September 2026. Both supplied review files were read in full and assessed against the actual GDD v1 and technical plan source. The reviewer had v0.2; sixteen provenance concerns are resolved by the existing v1 text, not by retroactively inventing GDD requirements. See GDD_TRACEABILITY.md.

| Finding | Decision | Result and reason |
| --- | --- | --- |
| T1 Human-staff calendar | Adopt | Replace 48–60 weeks and 270 person-weeks with accepted-packet throughput and measured integration/rework. No unsupported agent delivery date. |
| T2 Agent verifiability | Adopt | G0 scores clean build, repeatable fixture/replay, export and real image capture. Retain Godot recommendation and bounded TypeScript comparison. |
| T3 GDD provenance | Resolve | All sixteen listed items exist in GDD v1. Exact sections are supplied. The genuinely new timing/body/bow/Trial details are explicit v1.1 addendum decisions. |
| T4 Map scale | Adapt | Keep 3.5 m/s GDD walking and initial 800 m envelope. Test strategic route times and local accessibility; sampled anchors are not called an exhaustive all-cell diameter. |
| T5 Code-first client | Adopt with correction | Minimal root, C# composition/theme and text shaders; deterministic generated/imported scenes are allowed. Text .tscn files are editable by agents. Rendering still needs a real verified backend. |
| T6 Art dependency | Adapt | Procedural identity and motion first, full visual quality gate retained. Rigged GLB replacement is optional if procedural quality passes; no automatic requirement to hire an artist. |
| T7 Session-sized tickets | Adopt | One coherent work packet per dispatch, explicit checkpoints and fresh-chat resumes. No promise that any packet can never hit a model limit. |
| T8 Atomic searches | Adapt | No cross-tick A* frontier initially. Partial paths require certified progress; BudgetExhausted is not Partial or NoKnownRoute. Save queues, retry history and committed routes. |
| T9 Shared route cache | Adapt | Share only routes derived from public topology. Actor-private known graphs use structural hashes or local caches. Validating an omniscient route afterward does not prevent hidden information leaking through choices or failures. |
| T10 Visibility data | Adopt | Static height, openness and cover only; counted LOS queries on demand. No enormous precomputed visibility matrix. |
| T11 Deterministic budgets in CI | Adopt with correction | Route/LOS/method/candidate/reservation counts are deterministic ceilings. Allocation bytes, wall time and GPU time are measured diagnostics, not assumed deterministic. Counts cannot substitute for actual hardware performance. |
| T12 Contracts before lanes | Adopt | A0 freezes versioned schemas and samples before consumers, with controlled changes. Fakes support client work but never pass production behavior gates. |
| T13 Catalog profiles | Adopt | Fixture/Prototype8/Trial24/Standard100 permit staged delivery while keeping exact shipping counts. |
| T14 Verification gaps | Adopt with repairs | Define the DSL now; add replay subset, random-tick save/restore, checkpoint-frequency invariance, malformed-input fuzz, Why trace checks, content hashes, reason coverage and operation budgets. |
| T15 Packet done contract | Adapt | Return actual files, baselines, commands and evidence; independent reviewer reproduces checks. Only A0 writes shared project status. A second model brand is not required. |
| T16 Runtime comparison | Retain and bound | Two small equivalent feasibility workloads, no second full game. G0 resolves ADR 001 from evidence. Synthetic workload cannot claim full AI or finale validation. |
| T17 Preserved decisions | Retain | Strict forecast influence, no occupancy victory, current maintenance pin, deferred authoring dock, and the isolated optional LLM boundary remain. |

## Corrections to the proposed fixture and workflow

The review's fixture mixed a two-actor roster with Trial, unspecified hunger units, and an immediate ScheduleLaw at tick zero that could violate public notice. The replacement declares a test-only Fixture profile, typed units and precommitted setup laws separately from runtime commands. A valid preflight denial may emit a rejected-attempt event; absence of all attempts is not a legality test. Invariants test absence of illegal effects. Event assertions require explicit count or an existence check so empty logs cannot pass a claimed behavior.

The companion plan was a good starting decomposition, but late phases were incomplete. This kit decomposes beta/release and the Story/LLM work, adds the shipping Custom commandments/whispers, all six chronicle threads, dossiers, scenario files and Saga export, and moves shared status to the integrator. The first-playable gate uses real providers and the full visual action vocabulary. A failed comprehension study is a failed gate until repairs and new evidence satisfy it; a plan to repair is not acceptance.

Technical claims are labeled by evidence maturity: proposed target, synthetic measurement, production fixture measurement, or real player/reference-machine result. Automated screenshot generation is separate from subjective visual approval. New model rankings, prices and named-model role prescriptions in a review are not adopted without evidence; all roles are model-neutral and require suitable coding/reasoning/vision capability.

## Maintenance update

The runtime candidate is Godot 4.7.2 .NET, whose official archive lists release on 18 August 2026. Freeze the actual SDK, matching templates and native dependencies only after G0 export evidence. This update is a verified available candidate, not a claim that it is installed or benchmarked here. [Godot 4.7.2 stable archive](https://godotengine.org/download/archive/4.7.2-stable/).

## Intentional scope choices

Ship the existing offline Windows product, complete adaptive conventional AI, 100-person Standard, Trial, supported Custom, factual careers and optional-to-play Story. Local LLM conversations stay an independent experiment. Multiplayer, cloud backends, freeform construction, arbitrary scripting, permanent Standard stat growth, seasons, Workshop publishing and a divine creature remain deferred. Spending more context does not make these free; quality comes from complete systems and independent evidence.
