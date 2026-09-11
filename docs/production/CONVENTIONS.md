# Repository conventions (web build)

- Durable actor IDs are C001–C100 and G001, independent of runtime entity slots; wildlife use Wxxx. Never use a display name as an ID.
- Tick is an integer at 10 Hz. Positions are millimeters; normalized vitals are thousandths of displayed units. Names expose units (`positionMm`, `fullnessMilli`, `durationTicks`).
- Positive action durations round up after their single skill modifier (`divCeil`). Rates accumulate integer remainders in saved state.
- All consequential arithmetic uses `checkedMath` from `packages/sim/primitives`; bare `+ - * /` on branded `Int` values fails lint in `packages/sim`.
- Serialization is little-endian fixed-width via `DataView`, or a versioned canonical JSON equivalent for small views. Every state section has an explicit version.
- Canonical hashes exclude diagnostics, camera, notes, forecasts and generated language. Observer persistence has its own hash domain.
- Random streams are labeled and derived per subsystem from the match seed; `Math.random` is banned in `packages/sim` and `packages/lab`.
- TypeScript strict; ESM; Node 22+; npm workspaces. Package pins and lint rules are chosen and locked at W0-01 and changed only with a note in STATUS.
- Test names describe observable behavior. Fixture IDs are stable. A golden change explains why behavior changed and which GDD/addendum section authorizes it; never regenerate expected files to hide a regression.
- Content JSON lives in many small files under `packages/content/definitions`; compiled catalogs, `dist/`, logs and evidence outputs are git-ignored except where a card requires a checked-in reproducible artifact.
- Module path map from the kit's role briefs: `src/Sim.Primitives` → `packages/sim/primitives`; `Sim.Contracts` → `packages/sim/contracts`; `Sim.Core` → `packages/sim/core`; `Sim.Spatial` → `packages/sim/spatial`; `Sim.AI` → `packages/sim/ai`; `Sim.Story` → `packages/sim/story`; `Observer` → `packages/sim/observer`; `Persistence` → `packages/sim/persistence` + `apps/web/src/persistence`; `Sim.Host` → `packages/sim/host`; `game/` → `apps/web/`; `tools/ClanLab` → `packages/lab`; `tests/fixtures` → `tests/fixtures`.
