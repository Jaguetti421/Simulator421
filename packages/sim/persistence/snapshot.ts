/**
 * The world snapshot codec (W0-08, slice 2; TP v1.1 §15 "Snapshot contents").
 *
 * This module deliberately knows nothing about the kernel. `packages/sim/persistence`
 * may import only `primitives` and `contracts` (the dependency direction in
 * INTERFACES.md, enforced by lint), so the shape here is **plain data**: numbers,
 * strings and arrays. `packages/sim/host` maps a live `World` onto it and back.
 * That is not a workaround — it is what keeps a save format from being coupled to
 * whatever the kernel's object graph looks like this month.
 *
 * Everything is fixed-width little-endian inside length-prefixed, checksummed
 * container sections, so a truncated or altered save is caught before any of it
 * is interpreted.
 */
import { asInt, ByteReader, ByteWriter } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";
import { PersistenceError, readContainer, writeContainer } from "./index.js";
import type { ContainerSection } from "./index.js";

export const WORLD_SNAPSHOT_FORMAT = 1;

export interface StreamStateRecord {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly counter: number;
}

export interface ActorRecord {
  readonly id: string;
  readonly idNumber: number;
  readonly kind: string;
  readonly xMm: number;
  readonly yMm: number;
  readonly vxMm: number;
  readonly vyMm: number;
  readonly healthMilli: number;
  readonly staminaMilli: number;
}

export interface LawRecord {
  readonly lawId: string;
  readonly startTick: number;
  readonly endTick: number;
  readonly centerXMm: number | null;
  readonly centerYMm: number | null;
  readonly radiusMm: number | null;
  readonly installed: boolean;
}

export interface PendingCommandRecord {
  readonly sequence: number;
  readonly atTick: number;
  readonly expectedRulesVersion: number;
  readonly lawId: string;
  readonly startTick: number;
  readonly endTick: number;
}

export interface WorldSnapshot {
  readonly tick: number;
  readonly rulesVersion: number;
  readonly matchSeed: number;
  readonly lastAppliedSequence: number;
  readonly nextSequence: number;
  readonly eventDigest: number;
  readonly actors: readonly ActorRecord[];
  readonly laws: readonly LawRecord[];
  readonly pending: readonly PendingCommandRecord[];
  readonly streams: { readonly motion: StreamStateRecord; readonly laws: StreamStateRecord };
}

const ACTOR_KINDS = ["Contestant", "Wildlife", "Guest"] as const;

function writeString(w: ByteWriter, text: string): void {
  if (text.length > 255) throw new PersistenceError("NameTooLong", `string "${text.slice(0, 24)}…" exceeds 255 bytes`);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code > 0x7f) throw new PersistenceError("NameTooLong", `snapshot strings are ASCII: ${text}`);
    bytes[i] = code;
  }
  w.u8(bytes.byteLength).raw(bytes);
}

function readString(r: ByteReader): string {
  return String.fromCharCode(...r.raw(r.u8()));
}

const OPTIONAL_ABSENT = 0;
const OPTIONAL_PRESENT = 1;

function writeOptionalInt(w: ByteWriter, value: number | null): void {
  if (value === null) w.u8(OPTIONAL_ABSENT);
  else w.u8(OPTIONAL_PRESENT).int53(asInt(value, "optionalInt"));
}

function readOptionalInt(r: ByteReader): number | null {
  return r.u8() === OPTIONAL_ABSENT ? null : r.int53();
}

function section(name: string, write: (w: ByteWriter) => void): ContainerSection {
  const w = new ByteWriter();
  write(w);
  return { name, formatVersion: WORLD_SNAPSHOT_FORMAT, bytes: w.toUint8Array() };
}

function payload(sections: readonly ContainerSection[], name: string): ByteReader {
  const found = sections.find((s) => s.name === name);
  if (found === undefined) throw new PersistenceError("Truncated", `snapshot has no "${name}" section`);
  if (found.formatVersion !== WORLD_SNAPSHOT_FORMAT) {
    throw new PersistenceError("UnknownSchemaVersion", `section ${name} is format v${found.formatVersion}; this build reads v${WORLD_SNAPSHOT_FORMAT}`);
  }
  return new ByteReader(found.bytes);
}

function writeStream(w: ByteWriter, state: StreamStateRecord): void {
  w.u32(state.a).u32(state.b).u32(state.c).u32(state.counter);
}

function readStream(r: ByteReader): StreamStateRecord {
  return { a: r.u32(), b: r.u32(), c: r.u32(), counter: r.u32() };
}

/** Encode a snapshot into a checksummed container. */
export function encodeWorldSnapshot(snapshot: WorldSnapshot): Uint8Array {
  const int = (v: number, what: string): Int => asInt(v, what);
  return writeContainer([
    section("frontier", (w) => {
      w.int53(int(snapshot.tick, "tick"))
        .int53(int(snapshot.rulesVersion, "rulesVersion"))
        .u32(snapshot.matchSeed)
        .int53(int(snapshot.lastAppliedSequence, "lastAppliedSequence"))
        .int53(int(snapshot.nextSequence, "nextSequence"))
        .u32(snapshot.eventDigest);
    }),
    section("actors", (w) => {
      w.u32(snapshot.actors.length);
      for (const a of snapshot.actors) {
        writeString(w, a.id);
        const kind = ACTOR_KINDS.indexOf(a.kind as (typeof ACTOR_KINDS)[number]);
        if (kind < 0) throw new PersistenceError("Truncated", `unknown actor kind ${a.kind}`);
        w.u8(kind)
          .int53(int(a.idNumber, "idNumber"))
          .int53(int(a.xMm, "xMm"))
          .int53(int(a.yMm, "yMm"))
          .int53(int(a.vxMm, "vxMm"))
          .int53(int(a.vyMm, "vyMm"))
          .int53(int(a.healthMilli, "healthMilli"))
          .int53(int(a.staminaMilli, "staminaMilli"));
      }
    }),
    section("laws", (w) => {
      w.u32(snapshot.laws.length);
      for (const l of snapshot.laws) {
        writeString(w, l.lawId);
        w.int53(int(l.startTick, "startTick")).int53(int(l.endTick, "endTick")).u8(l.installed ? 1 : 0);
        writeOptionalInt(w, l.centerXMm);
        writeOptionalInt(w, l.centerYMm);
        writeOptionalInt(w, l.radiusMm);
      }
    }),
    section("pending", (w) => {
      w.u32(snapshot.pending.length);
      for (const c of snapshot.pending) {
        writeString(w, c.lawId);
        w.int53(int(c.sequence, "sequence"))
          .int53(int(c.atTick, "atTick"))
          .int53(int(c.expectedRulesVersion, "expectedRulesVersion"))
          .int53(int(c.startTick, "startTick"))
          .int53(int(c.endTick, "endTick"));
      }
    }),
    section("streams", (w) => {
      writeStream(w, snapshot.streams.motion);
      writeStream(w, snapshot.streams.laws);
    }),
  ]);
}

/** Decode a snapshot. Every section is checksum-verified by `readContainer` first. */
export function decodeWorldSnapshot(bytes: Uint8Array): WorldSnapshot {
  const sections = readContainer(bytes);

  const frontier = payload(sections, "frontier");
  const tick = frontier.int53();
  const rulesVersion = frontier.int53();
  const matchSeed = frontier.u32();
  const lastAppliedSequence = frontier.int53();
  const nextSequence = frontier.int53();
  const eventDigest = frontier.u32();
  frontier.expectEnd();

  const actorReader = payload(sections, "actors");
  const actorCount = actorReader.u32();
  const actors: ActorRecord[] = [];
  for (let i = 0; i < actorCount; i += 1) {
    const id = readString(actorReader);
    const kindIndex = actorReader.u8();
    const kind = ACTOR_KINDS[kindIndex];
    if (kind === undefined) throw new PersistenceError("Truncated", `actor ${id} has unknown kind index ${kindIndex}`);
    actors.push({
      id,
      kind,
      idNumber: actorReader.int53(),
      xMm: actorReader.int53(),
      yMm: actorReader.int53(),
      vxMm: actorReader.int53(),
      vyMm: actorReader.int53(),
      healthMilli: actorReader.int53(),
      staminaMilli: actorReader.int53(),
    });
  }
  actorReader.expectEnd();

  const lawReader = payload(sections, "laws");
  const lawCount = lawReader.u32();
  const laws: LawRecord[] = [];
  for (let i = 0; i < lawCount; i += 1) {
    const lawId = readString(lawReader);
    const startTick = lawReader.int53();
    const endTick = lawReader.int53();
    const installed = lawReader.u8() === 1;
    laws.push({ lawId, startTick, endTick, installed, centerXMm: readOptionalInt(lawReader), centerYMm: readOptionalInt(lawReader), radiusMm: readOptionalInt(lawReader) });
  }
  lawReader.expectEnd();

  const pendingReader = payload(sections, "pending");
  const pendingCount = pendingReader.u32();
  const pending: PendingCommandRecord[] = [];
  for (let i = 0; i < pendingCount; i += 1) {
    const lawId = readString(pendingReader);
    pending.push({
      lawId,
      sequence: pendingReader.int53(),
      atTick: pendingReader.int53(),
      expectedRulesVersion: pendingReader.int53(),
      startTick: pendingReader.int53(),
      endTick: pendingReader.int53(),
    });
  }
  pendingReader.expectEnd();

  const streamReader = payload(sections, "streams");
  const streams = { motion: readStream(streamReader), laws: readStream(streamReader) };
  streamReader.expectEnd();

  return { tick, rulesVersion, matchSeed, lastAppliedSequence, nextSequence, eventDigest, actors, laws, pending, streams };
}
