/**
 * Deterministic randomness (TP v2.0 §4; TP v1.1 §4, §15; GDD 15.4).
 *
 * Algorithm: **sfc32** — four 32-bit words (a, b, c, counter), arithmetic in
 * `| 0` / `>>> 0` / `Math.imul` only. Output is the raw 32-bit word `t`; no
 * float is ever produced, so a stream is exactly reproducible anywhere the
 * integer operations are (Node and a browser Worker; verified at W0-07/W0-10).
 *
 *   t = ((a + b) | 0) + d | 0
 *   d = (d + 1) | 0
 *   a = b ^ (b >>> 9)
 *   b = (c + (c << 3)) | 0
 *   c = (c << 21) | (c >>> 11)
 *   c = (c + t) | 0
 *   return t >>> 0
 *
 * **Seeding rule** (project-defined, versioned by `RANDOM_SEEDING_RULE`):
 * a stream is derived from a match seed and an ASCII label. The label is
 * reduced with FNV-1a/32; that word is combined with the match seed and run
 * through splitmix32 to produce a, b, c and the counter; the generator is then
 * advanced `WARMUP_DRAWS` times and those outputs are discarded.
 *
 * Deriving a stream consumes nothing from any other stream: every stream is a
 * pure function of (matchSeed, label). Adding a guest or cosmetic stream
 * therefore cannot shift a core stream's sequence.
 *
 * `RandomStream` is mutable by design (it is drawn from every tick); the whole
 * state is snapshot- and byte-serializable, which is what replay needs.
 */
import { fnv1a32, FNV_OFFSET_BASIS } from "./hash.js";
import { asInt, IntegerError, type Int } from "./int.js";
import { type ByteWriter, readSection, SerializationError, writeSection } from "./serialize.js";

export const RANDOM_ALGORITHM = "sfc32" as const;
/** Bump when the seeding rule changes; pinned vectors are keyed by this string. */
export const RANDOM_SEEDING_RULE = "splitmix32(matchSeed,label-fnv1a32)/warmup-12/v1" as const;
export const RANDOM_BYTE_ORDER = "little-endian uint32 words a,b,c,counter" as const;
export const WARMUP_DRAWS = 12;
export const RANDOM_STATE_FORMAT_VERSION = 1;

const U32 = 4294967296;

/** The complete generator state: four unsigned 32-bit words. */
export interface RandomState {
  readonly a: Int;
  readonly b: Int;
  readonly c: Int;
  readonly counter: Int;
}

function requireU32(n: number, what: string): Int {
  if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff) {
    throw new IntegerError("INVALID_UNIT", "randomState", [n], `${what} must be a uint32`);
  }
  return n as Int;
}

/**
 * splitmix32: one 32-bit word in, one out. Used only for seeding, never for
 * consequential draws.
 */
export function splitmix32(seed: Int): Int {
  let z = (seed + 0x9e3779b9) | 0;
  z = z ^ (z >>> 16);
  z = Math.imul(z, 0x21f0aaad);
  z = z ^ (z >>> 15);
  z = Math.imul(z, 0x735a2d97);
  z = z ^ (z >>> 15);
  return asInt(z >>> 0, "splitmix32");
}

/** FNV-1a/32 over the ASCII bytes of a stream label. Labels are ASCII by convention. */
export function labelWord(label: string): Int {
  const bytes = new Uint8Array(label.length);
  for (let i = 0; i < label.length; i += 1) {
    const code = label.charCodeAt(i);
    if (code > 0x7f) throw new IntegerError("INVALID_UNIT", "labelWord", [code], `stream label must be ASCII: ${label}`);
    bytes[i] = code;
  }
  return fnv1a32(bytes, FNV_OFFSET_BASIS);
}

export class RandomStream {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  /** Draws taken since construction — diagnostics only, never part of the state. */
  private draws = 0;

  constructor(state: RandomState) {
    this.a = requireU32(state.a, "a");
    this.b = requireU32(state.b, "b");
    this.c = requireU32(state.c, "c");
    this.d = requireU32(state.counter, "counter");
  }

  /**
   * The stream for (matchSeed, label). Pure: two calls with the same arguments
   * produce identical streams, and no other stream is touched.
   */
  static derive(matchSeed: Int, label: string): RandomStream {
    const seed = requireU32(matchSeed, "matchSeed");
    let z = asInt((seed ^ labelWord(label)) >>> 0, "derive");
    z = splitmix32(z);
    const a = splitmix32(z);
    const b = splitmix32(a);
    const c = splitmix32(b);
    const counter = splitmix32(c);
    const stream = new RandomStream({ a, b, c, counter });
    for (let i = 0; i < WARMUP_DRAWS; i += 1) stream.nextU32();
    stream.draws = 0;
    return stream;
  }

  /** The next 32-bit word. This is the only primitive draw. */
  nextU32(): Int {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    this.draws += 1;
    return (t >>> 0) as Int;
  }

  /**
   * Uniform in [0, bound). Unbiased by rejection: words at or above the
   * largest multiple of `bound` are discarded, so a draw may consume more than
   * one word — deterministic, and recorded in the state either way.
   */
  nextBelow(bound: Int): Int {
    if (!Number.isSafeInteger(bound) || bound <= 0 || bound > U32) {
      throw new IntegerError("INVALID_UNIT", "nextBelow", [bound], "bound must be in [1, 2^32]");
    }
    const limit = U32 - (U32 % bound);
    for (;;) {
      const r = this.nextU32();
      if (r < limit) return (r % bound) as Int;
    }
  }

  /** Uniform in [lo, hi], both inclusive. */
  nextRange(lo: Int, hi: Int): Int {
    if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi) || hi < lo || hi - lo + 1 > U32) {
      throw new IntegerError("INVALID_UNIT", "nextRange", [lo, hi], "need lo <= hi and a span of at most 2^32");
    }
    return (lo + this.nextBelow(((hi - lo + 1) as Int))) as Int;
  }

  /** True with probability `chanceMilli` / 1000 (thousandths, clamped domain 0..1000). */
  nextChanceMilli(chanceMilli: Int): boolean {
    if (!Number.isSafeInteger(chanceMilli) || chanceMilli < 0 || chanceMilli > 1000) {
      throw new IntegerError("INVALID_UNIT", "nextChanceMilli", [chanceMilli], "chance must be 0..1000 thousandths");
    }
    if (chanceMilli === 0) return false;
    if (chanceMilli === 1000) return true;
    return this.nextBelow(1000 as Int) < chanceMilli;
  }

  /** The complete state; restoring it reproduces the rest of the sequence exactly. */
  snapshot(): RandomState {
    return { a: (this.a >>> 0) as Int, b: (this.b >>> 0) as Int, c: (this.c >>> 0) as Int, counter: (this.d >>> 0) as Int };
  }

  /** Draws taken since construction or the last `resetDrawCount` (diagnostics). */
  get drawCount(): number {
    return this.draws;
  }

  resetDrawCount(): void {
    this.draws = 0;
  }
}

/** Versioned section: four little-endian uint32 words in the order a, b, c, counter. */
export function encodeRandomState(state: RandomState): Uint8Array {
  return writeSection(RANDOM_STATE_FORMAT_VERSION, (w: ByteWriter) => {
    w.u32(state.a).u32(state.b).u32(state.c).u32(state.counter);
  });
}

export function decodeRandomState(bytes: Uint8Array): RandomState {
  const section = readSection(bytes);
  if (section.formatVersion !== RANDOM_STATE_FORMAT_VERSION) {
    throw new SerializationError("OUT_OF_RANGE", 4, `unknown RandomState format version ${section.formatVersion}`);
  }
  const a = requireU32(section.payload.u32(), "a");
  const b = requireU32(section.payload.u32(), "b");
  const c = requireU32(section.payload.u32(), "c");
  const counter = requireU32(section.payload.u32(), "counter");
  section.payload.expectEnd();
  return { a, b, c, counter };
}
