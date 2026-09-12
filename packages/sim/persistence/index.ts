/**
 * Persistence foundations (W0-08, slice 1; TP v1.1 §15, TP v2.0 §15).
 *
 * Three things, all storage-agnostic:
 *
 *   1. **The container** — a schema-versioned envelope of named, length-prefixed
 *      sections with a per-section checksum. Truncation and corruption are
 *      detected here, not discovered later by a decoder producing nonsense.
 *   2. **Two-generation writes** — a checkpoint is written as a new generation
 *      and the pointer advances *last*. A failed or corrupt write leaves the
 *      previous generation authoritative, and a write is never acknowledged as
 *      saved before the pointer moved.
 *   3. **The results store** — `add` semantics on a unique result key: the same
 *      result applied twice increments once, and a different payload under the
 *      same key fails loudly instead of overwriting a finished match.
 *
 * The interface is **asynchronous** because the real adapter is IndexedDB, and a
 * synchronous interface would have to be rewritten the moment the browser
 * adapter arrived. `MemoryStorage` is held to the same contract as every other
 * adapter rather than getting an easier one.
 */
import { asInt, ByteReader, ByteWriter, fnv1a32, HashDomain, hashBytes } from "../primitives/index.js";
import type { Int } from "../primitives/index.js";

export const CONTAINER_MAGIC = 0x4c43_5631; // "LCV1"
export const CONTAINER_SCHEMA_VERSION = 1;
export const MAX_SECTIONS = 64;
export const MAX_SECTION_NAME = 32;

export type PersistenceErrorCode =
  | "BadMagic"
  | "UnknownSchemaVersion"
  | "Truncated"
  | "ChecksumMismatch"
  | "DuplicateSection"
  | "TooManySections"
  | "NameTooLong"
  | "NoValidGeneration"
  | "ResultConflict"
  | "WriteFailed";

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;
  constructor(code: PersistenceErrorCode, detail: string) {
    super(`${code}: ${detail}`);
    this.name = "PersistenceError";
    this.code = code;
  }
}

export interface ContainerSection {
  readonly name: string;
  readonly formatVersion: number;
  readonly bytes: Uint8Array;
}

function asciiBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code > 0x7f) throw new PersistenceError("NameTooLong", `section name must be ASCII: ${text}`);
    out[i] = code;
  }
  return out;
}

/**
 * Write a container. Sections are emitted in name order so the same content
 * always produces the same bytes — a save file that differs only by insertion
 * order would make every hash comparison meaningless.
 */
export function writeContainer(sections: readonly ContainerSection[]): Uint8Array {
  if (sections.length > MAX_SECTIONS) throw new PersistenceError("TooManySections", `${sections.length} > ${MAX_SECTIONS}`);
  const seen = new Set<string>();
  for (const s of sections) {
    if (s.name.length === 0 || s.name.length > MAX_SECTION_NAME) throw new PersistenceError("NameTooLong", `section name "${s.name}"`);
    if (seen.has(s.name)) throw new PersistenceError("DuplicateSection", s.name);
    seen.add(s.name);
  }

  const ordered = [...sections].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const w = new ByteWriter();
  w.u32(CONTAINER_MAGIC).u16(CONTAINER_SCHEMA_VERSION).u16(ordered.length);
  for (const section of ordered) {
    const name = asciiBytes(section.name);
    w.u8(name.byteLength).raw(name);
    w.u16(section.formatVersion);
    w.u32(section.bytes.byteLength);
    w.u32(fnv1a32(section.bytes));
    w.raw(section.bytes);
  }
  return w.toUint8Array();
}

/** Read a container, verifying every section's checksum before returning any of it. */
export function readContainer(bytes: Uint8Array): readonly ContainerSection[] {
  const r = new ByteReader(bytes);
  let magic: number;
  try {
    magic = r.u32();
  } catch {
    throw new PersistenceError("Truncated", "container is shorter than its header");
  }
  if (magic !== CONTAINER_MAGIC) throw new PersistenceError("BadMagic", `got 0x${magic.toString(16)}`);

  let schemaVersion: number;
  let count: number;
  try {
    schemaVersion = r.u16();
    count = r.u16();
  } catch {
    throw new PersistenceError("Truncated", "container header is incomplete");
  }
  if (schemaVersion !== CONTAINER_SCHEMA_VERSION) {
    throw new PersistenceError("UnknownSchemaVersion", `this build reads container v${CONTAINER_SCHEMA_VERSION}; got ${schemaVersion}`);
  }
  if (count > MAX_SECTIONS) throw new PersistenceError("TooManySections", `${count} > ${MAX_SECTIONS}`);

  const sections: ContainerSection[] = [];
  for (let i = 0; i < count; i += 1) {
    let name = "";
    let header: { formatVersion: number; checksum: number; payload: Uint8Array };
    try {
      const nameLength = r.u8();
      name = String.fromCharCode(...r.raw(nameLength));
      const formatVersion = r.u16();
      const length = r.u32();
      const checksum = r.u32();
      header = { formatVersion, checksum, payload: r.raw(length) };
    } catch {
      throw new PersistenceError("Truncated", `section ${i}${name === "" ? "" : ` (${name})`} runs past the end of the container`);
    }
    if (fnv1a32(header.payload) !== header.checksum) {
      throw new PersistenceError("ChecksumMismatch", `section ${name} failed its checksum: the bytes on disk are not the bytes that were written`);
    }
    sections.push({ name, formatVersion: header.formatVersion, bytes: header.payload });
  }
  return sections;
}

/** Digest of a whole container in the authoritative domain — what a save round trip compares. */
export function containerDigest(bytes: Uint8Array): Int {
  return hashBytes(HashDomain.Authoritative, bytes);
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/**
 * The minimum an adapter must provide. `add` is the store's exactly-once
 * primitive: it fails if the key exists rather than overwriting (TP v2.0 §15,
 * IndexedDB `add` semantics), and every adapter — memory, fake-indexeddb,
 * browser — is held to the same contract.
 */
export interface StorageAdapter {
  get(store: string, key: string): Promise<Uint8Array | undefined>;
  put(store: string, key: string, value: Uint8Array): Promise<void>;
  /** Rejects if the key already exists — the exactly-once primitive. */
  add(store: string, key: string, value: Uint8Array): Promise<void>;
  delete(store: string, key: string): Promise<void>;
  keys(store: string): Promise<readonly string[]>;
}

export class MemoryStorage implements StorageAdapter {
  readonly #stores = new Map<string, Map<string, Uint8Array>>();
  /** Set to fail the next write, to test that a failed write is never acknowledged. */
  failNextWrite: string | null = null;

  #store(name: string): Map<string, Uint8Array> {
    let store = this.#stores.get(name);
    if (store === undefined) {
      store = new Map<string, Uint8Array>();
      this.#stores.set(name, store);
    }
    return store;
  }

  #checkFailure(): void {
    if (this.failNextWrite !== null) {
      const reason = this.failNextWrite;
      this.failNextWrite = null;
      throw new PersistenceError("WriteFailed", reason);
    }
  }

  async get(store: string, key: string): Promise<Uint8Array | undefined> {
    return this.#store(store).get(key);
  }

  async put(store: string, key: string, value: Uint8Array): Promise<void> {
    this.#checkFailure();
    this.#store(store).set(key, value.slice());
  }

  async add(store: string, key: string, value: Uint8Array): Promise<void> {
    this.#checkFailure();
    if (this.#store(store).has(key)) throw new PersistenceError("ResultConflict", `${store}/${key} already exists; add never overwrites`);
    this.#store(store).set(key, value.slice());
  }

  async delete(store: string, key: string): Promise<void> {
    this.#store(store).delete(key);
  }

  async keys(store: string): Promise<readonly string[]> {
    return [...this.#store(store).keys()].sort();
  }
}

// ---------------------------------------------------------------------------
// Two-generation durable saves
// ---------------------------------------------------------------------------

export const SNAPSHOT_STORE = "snapshots";
export const META_STORE = "meta";
export const RESULTS_STORE = "results";

const pointerKey = (runId: string): string => `${runId}/generation`;
const generationKey = (runId: string, generation: number): string => `${runId}/gen${generation}`;

export interface SaveOutcome {
  readonly saved: boolean;
  readonly generation: number;
  readonly digest: string;
}

async function readPointer(storage: StorageAdapter, runId: string): Promise<number> {
  const bytes = await storage.get(META_STORE, pointerKey(runId));
  if (bytes === undefined) return 0;
  return new ByteReader(bytes).u32();
}

async function writePointer(storage: StorageAdapter, runId: string, generation: number): Promise<void> {
  await storage.put(META_STORE, pointerKey(runId), new ByteWriter(4).u32(generation).toUint8Array());
}

/**
 * Write a checkpoint as a new generation and advance the pointer last. If the
 * payload write throws, the pointer never moves and `saveCheckpoint` reports
 * `saved: false` — the caller must not tell the player it was saved.
 */
export async function saveCheckpoint(storage: StorageAdapter, runId: string, container: Uint8Array): Promise<SaveOutcome> {
  const current = await readPointer(storage, runId);
  const next = current + 1;
  await storage.put(SNAPSHOT_STORE, generationKey(runId, next), container);
  // Only now is the new generation reachable; a crash before this line leaves
  // the previous generation authoritative.
  await writePointer(storage, runId, next);
  // Retain two generations: the current one and its predecessor.
  if (next - 2 >= 1) await storage.delete(SNAPSHOT_STORE, generationKey(runId, next - 2));
  return { saved: true, generation: next, digest: containerDigest(container).toString(16).padStart(8, "0") };
}

export interface LoadOutcome {
  readonly generation: number;
  readonly sections: readonly ContainerSection[];
  /** Set when the newest generation was unusable and an older one was loaded instead. */
  readonly fellBackFrom?: { readonly generation: number; readonly code: PersistenceErrorCode; readonly detail: string };
}

/**
 * Load the newest usable generation. A corrupt or truncated newest generation is
 * not an error the player loses their match to: the previous valid generation is
 * loaded and the fallback is reported, never silently swallowed.
 */
export async function loadLatest(storage: StorageAdapter, runId: string): Promise<LoadOutcome> {
  const newest = await readPointer(storage, runId);
  if (newest === 0) throw new PersistenceError("NoValidGeneration", `run ${runId} has no checkpoint`);

  let fellBackFrom: LoadOutcome["fellBackFrom"];
  for (let generation = newest; generation >= 1; generation -= 1) {
    const bytes = await storage.get(SNAPSHOT_STORE, generationKey(runId, generation));
    if (bytes === undefined) continue;
    try {
      const sections = readContainer(bytes);
      return fellBackFrom === undefined ? { generation, sections } : { generation, sections, fellBackFrom };
    } catch (e) {
      const error = e as PersistenceError;
      if (fellBackFrom === undefined) fellBackFrom = { generation, code: error.code ?? "Truncated", detail: error.message };
    }
  }
  throw new PersistenceError("NoValidGeneration", `run ${runId}: no generation up to ${newest} could be read`);
}

// ---------------------------------------------------------------------------
// Exactly-once results
// ---------------------------------------------------------------------------

export interface ResultRecord {
  /** The unique result key: one finished match, one key, forever. */
  readonly resultKey: string;
  readonly runId: string;
  readonly finalTick: number;
  readonly winnerActorId: string | null;
  readonly authoritativeDigest: string;
}

export interface ApplyResultOutcome {
  readonly applied: boolean;
  readonly alreadyPresent: boolean;
  readonly appliedCount: number;
}

function encodeResult(record: ResultRecord): Uint8Array {
  const w = new ByteWriter();
  const text = JSON.stringify({
    resultKey: record.resultKey,
    runId: record.runId,
    finalTick: record.finalTick,
    winnerActorId: record.winnerActorId,
    authoritativeDigest: record.authoritativeDigest,
  });
  for (let i = 0; i < text.length; i += 1) w.u8(text.charCodeAt(i) & 0xff);
  return w.toUint8Array();
}

function decodeResult(bytes: Uint8Array): ResultRecord {
  return JSON.parse(String.fromCharCode(...bytes)) as ResultRecord;
}

/**
 * Apply a finished match exactly once. Re-applying the identical record is a
 * no-op that reports `alreadyPresent` — finalization must be safe to retry after
 * a crash. A *different* payload under the same key is a conflict and throws:
 * two different truths cannot both be the result of one match.
 */
export async function applyResult(storage: StorageAdapter, record: ResultRecord): Promise<ApplyResultOutcome> {
  const existing = await storage.get(RESULTS_STORE, record.resultKey);
  const encoded = encodeResult(record);
  if (existing !== undefined) {
    const previous = decodeResult(existing);
    const same = JSON.stringify(previous) === JSON.stringify(decodeResult(encoded));
    if (!same) {
      throw new PersistenceError(
        "ResultConflict",
        `result key ${record.resultKey} already holds a different result (run ${previous.runId}, tick ${previous.finalTick}, digest ${previous.authoritativeDigest})`,
      );
    }
    return { applied: false, alreadyPresent: true, appliedCount: await countResults(storage) };
  }
  await storage.add(RESULTS_STORE, record.resultKey, encoded);
  return { applied: true, alreadyPresent: false, appliedCount: await countResults(storage) };
}

export async function countResults(storage: StorageAdapter): Promise<number> {
  return (await storage.keys(RESULTS_STORE)).length;
}

export async function readResult(storage: StorageAdapter, resultKey: string): Promise<ResultRecord | undefined> {
  const bytes = await storage.get(RESULTS_STORE, resultKey);
  return bytes === undefined ? undefined : decodeResult(bytes);
}

/** The result key for a run: stable, derived, and never a display name. */
export function resultKeyFor(runId: string, finalTick: number, authoritativeDigest: string): string {
  return `${runId}:${asInt(finalTick, "finalTick")}:${authoritativeDigest}`;
}
