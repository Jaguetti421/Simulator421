/**
 * Little-endian fixed-width serialization (CONVENTIONS.md, TP v2.0 §4).
 *
 * `ByteWriter` / `ByteReader` wrap a `DataView`. Every multi-byte value is
 * little-endian. Safe integers (±2^53 − 1) are written as `int53`: 8 bytes,
 * low 32 bits then the signed high part — no BigInt, byte-exact round trip.
 *
 * A *section* is `[magic u32 "LCS\0"][formatVersion u16][payloadLength u32][payload]`.
 * `writeSection` records the version; `readSection` returns it with a reader
 * positioned on the payload and throws `SerializationError` on a bad magic,
 * a truncated payload or trailing bytes — never a silent partial read.
 * Which versions a codec accepts is the codec's decision (W0-04/W0-08).
 */
import { asInt, type Int } from "./int.js";
import type { RateState } from "./rate.js";

export type SerializationErrorCode = "BAD_MAGIC" | "TRUNCATED" | "TRAILING_BYTES" | "OUT_OF_RANGE" | "BAD_LENGTH";

export class SerializationError extends Error {
  readonly code: SerializationErrorCode;
  readonly offset: number;
  constructor(code: SerializationErrorCode, offset: number, detail?: string) {
    super(`${code} at byte ${offset}${detail === undefined ? "" : `: ${detail}`}`);
    this.name = "SerializationError";
    this.code = code;
    this.offset = offset;
  }
}

const TWO_POW_32 = 4294967296;
const LITTLE_ENDIAN = true;
/** ASCII "LCS" + 0 as a little-endian u32. */
export const SECTION_MAGIC = 0x0053434c;
export const SECTION_HEADER_BYTES = 10;

export class ByteWriter {
  private buffer: ArrayBuffer;
  private view: DataView;
  private bytes: Uint8Array;
  private length = 0;

  constructor(initialCapacity = 64) {
    this.buffer = new ArrayBuffer(initialCapacity);
    this.view = new DataView(this.buffer);
    this.bytes = new Uint8Array(this.buffer);
  }

  get byteLength(): number {
    return this.length;
  }

  private ensure(extra: number): void {
    const needed = this.length + extra;
    if (needed <= this.buffer.byteLength) return;
    let capacity = this.buffer.byteLength * 2;
    while (capacity < needed) capacity *= 2;
    const next = new ArrayBuffer(capacity);
    new Uint8Array(next).set(this.bytes.subarray(0, this.length));
    this.buffer = next;
    this.view = new DataView(next);
    this.bytes = new Uint8Array(next);
  }

  private range(value: number, lo: number, hi: number, what: string): void {
    if (!Number.isInteger(value) || value < lo || value > hi) {
      throw new SerializationError("OUT_OF_RANGE", this.length, `${what} ${value} not in [${lo}, ${hi}]`);
    }
  }

  u8(value: number): this {
    this.range(value, 0, 0xff, "u8");
    this.ensure(1);
    this.view.setUint8(this.length, value);
    this.length += 1;
    return this;
  }

  u16(value: number): this {
    this.range(value, 0, 0xffff, "u16");
    this.ensure(2);
    this.view.setUint16(this.length, value, LITTLE_ENDIAN);
    this.length += 2;
    return this;
  }

  u32(value: number): this {
    this.range(value, 0, 0xffffffff, "u32");
    this.ensure(4);
    this.view.setUint32(this.length, value, LITTLE_ENDIAN);
    this.length += 4;
    return this;
  }

  i32(value: number): this {
    this.range(value, -0x80000000, 0x7fffffff, "i32");
    this.ensure(4);
    this.view.setInt32(this.length, value, LITTLE_ENDIAN);
    this.length += 4;
    return this;
  }

  /** Safe integer as 8 bytes: u32 low word, then i32 high word (floor division by 2^32). */
  int53(value: Int): this {
    if (!Number.isSafeInteger(value)) throw new SerializationError("OUT_OF_RANGE", this.length, `int53 ${value}`);
    const hi = Math.floor(value / TWO_POW_32); // exact: value is an integer, division by a power of two
    const lo = value - hi * TWO_POW_32; // in [0, 2^32)
    return this.u32(lo).i32(hi);
  }

  /** Raw bytes, no length prefix. */
  raw(bytes: Uint8Array): this {
    this.ensure(bytes.byteLength);
    this.bytes.set(bytes, this.length);
    this.length += bytes.byteLength;
    return this;
  }

  /** u32 length prefix followed by the bytes. */
  bytesWithLength(bytes: Uint8Array): this {
    return this.u32(bytes.byteLength).raw(bytes);
  }

  /** A copy of the written bytes. */
  toUint8Array(): Uint8Array {
    return this.bytes.slice(0, this.length);
  }
}

export class ByteReader {
  private readonly view: DataView;
  private readonly bytes: Uint8Array;
  private offset: number;
  readonly end: number;

  constructor(bytes: Uint8Array, start = 0, end = bytes.byteLength) {
    if (start < 0 || end > bytes.byteLength || start > end) throw new SerializationError("BAD_LENGTH", start, "reader bounds");
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.offset = start;
    this.end = end;
  }

  get position(): number {
    return this.offset;
  }

  get remaining(): number {
    return this.end - this.offset;
  }

  private need(n: number): void {
    if (this.offset + n > this.end) throw new SerializationError("TRUNCATED", this.offset, `need ${n} bytes, ${this.remaining} left`);
  }

  u8(): number {
    this.need(1);
    const v = this.view.getUint8(this.offset);
    this.offset += 1;
    return v;
  }

  u16(): number {
    this.need(2);
    const v = this.view.getUint16(this.offset, LITTLE_ENDIAN);
    this.offset += 2;
    return v;
  }

  u32(): number {
    this.need(4);
    const v = this.view.getUint32(this.offset, LITTLE_ENDIAN);
    this.offset += 4;
    return v;
  }

  i32(): number {
    this.need(4);
    const v = this.view.getInt32(this.offset, LITTLE_ENDIAN);
    this.offset += 4;
    return v;
  }

  int53(): Int {
    const lo = this.u32();
    const hi = this.i32();
    const value = hi * TWO_POW_32 + lo;
    if (!Number.isSafeInteger(value)) throw new SerializationError("OUT_OF_RANGE", this.offset - 8, `int53 decoded ${value}`);
    return asInt(value, "ByteReader.int53");
  }

  raw(n: number): Uint8Array {
    this.need(n);
    const v = this.bytes.subarray(this.offset, this.offset + n);
    this.offset += n;
    return v;
  }

  bytesWithLength(): Uint8Array {
    const n = this.u32();
    return this.raw(n);
  }

  /** Throws unless every byte up to `end` has been consumed. */
  expectEnd(): void {
    if (this.offset !== this.end) throw new SerializationError("TRAILING_BYTES", this.offset, `${this.remaining} unread bytes`);
  }
}

/** Write a versioned section: header + payload produced by `writePayload`. */
export function writeSection(formatVersion: number, writePayload: (w: ByteWriter) => void): Uint8Array {
  const payload = new ByteWriter();
  writePayload(payload);
  const out = new ByteWriter(SECTION_HEADER_BYTES + payload.byteLength);
  out.u32(SECTION_MAGIC).u16(formatVersion).u32(payload.byteLength).raw(payload.toUint8Array());
  return out.toUint8Array();
}

export interface Section {
  readonly formatVersion: number;
  /** Positioned at the payload start, bounded to the payload. Call `expectEnd()` after decoding. */
  readonly payload: ByteReader;
}

/** Parse a section header; the payload must exactly fill the rest of `bytes`. */
export function readSection(bytes: Uint8Array): Section {
  const header = new ByteReader(bytes);
  const magic = header.u32();
  if (magic !== SECTION_MAGIC) throw new SerializationError("BAD_MAGIC", 0, `got 0x${magic.toString(16)}`);
  const formatVersion = header.u16();
  const length = header.u32();
  if (SECTION_HEADER_BYTES + length !== bytes.byteLength) {
    throw new SerializationError(
      SECTION_HEADER_BYTES + length > bytes.byteLength ? "TRUNCATED" : "TRAILING_BYTES",
      SECTION_HEADER_BYTES,
      `payload length ${length}, ${bytes.byteLength - SECTION_HEADER_BYTES} bytes present`,
    );
  }
  return { formatVersion, payload: new ByteReader(bytes, SECTION_HEADER_BYTES, bytes.byteLength) };
}

// ---------------------------------------------------------------------------
// Codec for the saved rate remainder (the only state this packet owns).
// ---------------------------------------------------------------------------

export const RATE_STATE_FORMAT_VERSION = 1;

export function encodeRateState(state: RateState): Uint8Array {
  return writeSection(RATE_STATE_FORMAT_VERSION, (w) => {
    w.int53(state.remainder);
  });
}

export function decodeRateState(bytes: Uint8Array): RateState {
  const section = readSection(bytes);
  if (section.formatVersion !== RATE_STATE_FORMAT_VERSION) {
    throw new SerializationError("OUT_OF_RANGE", 4, `unknown RateState format version ${section.formatVersion}`);
  }
  const remainder = section.payload.int53();
  section.payload.expectEnd();
  return { remainder };
}
