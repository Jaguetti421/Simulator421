/**
 * Save and replay for the composed host (P1-33; TP v1.1 §15, SAVE-ROUNDTRIP,
 * SAVE-FREQUENCY).
 *
 * A save is only worth having if restoring it is indistinguishable from never
 * having stopped. Three properties make that checkable:
 *
 *   - **The next 600 ticks match.** Not the digest at the moment of restore —
 *     that only proves the write worked. Running on afterwards is what proves
 *     the *state* came back, including the parts no single tick reads.
 *   - **Checkpoint frequency changes nothing.** Saving every 100 ticks, every
 *     600, or at a scatter of arbitrary ticks must all produce the same match.
 *     A save that perturbs the run is a heisenbug generator.
 *   - **A missing section fails.** Never a default. A restore that quietly
 *     substitutes an empty inventory produces a world that is *nearly* right,
 *     which is worse than one that refuses to load, because it runs.
 */
import { asInt } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";
import { ComposedHost } from "./composed.js";
import type { Lease } from "../core/reservation.js";
import type { CompiledTerrain } from "../spatial/terrain.js";
import type { HostActor } from "./composed.js";

export const SAVE_FORMAT_VERSION = 1;

/** Every section a composed save must carry. A restore refuses if one is absent. */
export const REQUIRED_SECTIONS = ["meta", "actors", "needs", "exertion", "exposure", "health", "reservations"] as const;
export type SectionName = (typeof REQUIRED_SECTIONS)[number];

export interface ComposedSave {
  readonly formatVersion: number;
  readonly sections: Readonly<Record<string, unknown>>;
}

export type RestoreFailure =
  | { readonly ok: false; readonly reason: "UnknownFormatVersion"; readonly detail: string }
  | { readonly ok: false; readonly reason: "MissingSections"; readonly missing: readonly SectionName[]; readonly detail: string }
  | { readonly ok: false; readonly reason: "SeedMismatch"; readonly detail: string };

export type RestoreResult = { readonly ok: true; readonly host: ComposedHost } | RestoreFailure;

interface MetaSection {
  readonly seed: number;
  readonly tick: number;
  readonly hostVersion: string;
}

/**
 * Capture a host.
 *
 * Everything an actor carries is written; nothing is recomputed on load, because
 * "recompute it" is how a save and a run drift apart on the one field the
 * recomputation gets slightly wrong.
 */
export function saveHost(host: ComposedHost, seed: Int): ComposedSave {
  const actors = host.actors;
  return {
    formatVersion: SAVE_FORMAT_VERSION,
    sections: {
      meta: { seed: seed as number, tick: host.tick as number, hostVersion: "composed-1" } satisfies MetaSection,
      // The **whole** agent, not a hand-picked subset. My first version listed
      // fields and forgot the plan, so a restored actor silently re-planned and
      // the replay diverged on the very first tick. Enumerating fields is how a
      // save rots: the next field added is the next one forgotten.
      actors: actors.map((a) => ({ actorId: a.agent.actorId, agent: clone(a.agent) })),
      needs: actors.map((a) => ({ actorId: a.agent.actorId, needs: clone(a.agent.needs) })),
      exertion: actors.map((a) => ({ actorId: a.agent.actorId, exertion: clone(a.exertion) })),
      exposure: actors.map((a) => ({ actorId: a.agent.actorId, exposure: clone(a.exposure) })),
      health: actors.map((a) => ({ actorId: a.agent.actorId, health: clone(a.health) })),
      reservations: actors.flatMap((a) => host.reservations.heldBy(a.agent.actorId).map((lease) => clone(lease))),
    },
  };
}

/** Deep copy through JSON: every value in these records is plain data by construction. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Restore a host from a save.
 *
 * Refuses an unknown format, a missing section, or a seed that does not match
 * the world being restored into — each with its own reason. **No section has a
 * default**: a save missing `needs` is not a save of a world where nobody is
 * hungry.
 */
export function restoreHost(save: ComposedSave, seed: Int, terrain?: CompiledTerrain): RestoreResult {
  if (save.formatVersion !== SAVE_FORMAT_VERSION) {
    return { ok: false, reason: "UnknownFormatVersion", detail: `save is format ${save.formatVersion}; this build reads ${SAVE_FORMAT_VERSION}` };
  }

  const missing = REQUIRED_SECTIONS.filter((name) => save.sections[name] === undefined);
  if (missing.length > 0) {
    return { ok: false, reason: "MissingSections", missing, detail: `missing section(s): ${missing.join(", ")} — a decoder refuses rather than substituting defaults` };
  }

  const meta = save.sections["meta"] as MetaSection;
  if (meta.seed !== (seed as number)) {
    return { ok: false, reason: "SeedMismatch", detail: `save was taken on seed ${meta.seed}, restoring into ${seed as number}` };
  }

  const host = ComposedHost.create({ seed, ...(terrain === undefined ? {} : { terrain }) });
  const index = <T extends { actorId: string }>(rows: readonly T[]): Map<string, T> => new Map(rows.map((row) => [row.actorId, row]));
  const agents = index(save.sections["actors"] as { actorId: string; agent: HostActor["agent"] }[]);
  const exertions = index(save.sections["exertion"] as { actorId: string; exertion: HostActor["exertion"] }[]);
  const exposures = index(save.sections["exposure"] as { actorId: string; exposure: HostActor["exposure"] }[]);
  const healths = index(save.sections["health"] as { actorId: string; health: HostActor["health"] }[]);

  host.restoreState(
    asInt(meta.tick, "tick"),
    host.actors.map((actor) => {
      const id = actor.agent.actorId;
      const saved = agents.get(id);
      const exertion = exertions.get(id);
      const exposure = exposures.get(id);
      const health = healths.get(id);
      if (saved === undefined || exertion === undefined || exposure === undefined || health === undefined) return actor;
      return { ...actor, agent: saved.agent, exertion: exertion.exertion, exposure: exposure.exposure, health: health.health };
    }),
  );

  // Restored with their own expiry, not re-granted: see `restoreLease`.
  for (const lease of save.sections["reservations"] as Lease[]) host.reservations.restoreLease(lease);

  return { ok: true, host };
}

/** Run a host and collect a digest per tick — the comparison a replay check needs. */
export function digestsOver(host: ComposedHost, ticks: number): readonly string[] {
  const out: string[] = [];
  for (let i = 0; i < ticks; i += 1) out.push(host.advance().digest);
  return out;
}

/**
 * Save at a tick, restore, and compare the next `ticks` digests against a run
 * that never stopped. Returns the first tick where they diverge, or `null`.
 */
export function replayDivergence(seed: Int, saveAtTick: number, ticks: number, terrain?: CompiledTerrain): number | null {
  const shared = terrain ?? ComposedHost.create({ seed }).terrain;
  const straight = ComposedHost.create({ seed, terrain: shared });
  straight.runTicks(saveAtTick);
  const expected = digestsOver(straight, ticks);

  const interrupted = ComposedHost.create({ seed, terrain: shared });
  interrupted.runTicks(saveAtTick);
  const restored = restoreHost(saveHost(interrupted, seed), seed, shared);
  if (!restored.ok) return 0;
  const actual = digestsOver(restored.host, ticks);

  for (let i = 0; i < ticks; i += 1) {
    if (actual[i] !== expected[i]) return saveAtTick + i;
  }
  return null;
}
