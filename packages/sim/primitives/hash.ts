/**
 * Canonical hashing (TP v2.0 §4; TP v1.1 §15).
 *
 * FNV-1a/32 over the little-endian serialization from `serialize.ts`, computed
 * with `Math.imul` — no BigInt, no floats. Two **domains** are kept apart so a
 * change to observer-only data can never move the authoritative hash: the
 * domain tag is mixed in before any payload byte, so identical bytes in
 * different domains produce different digests.
 *
 * Order independence: a `HashAccumulator` collects keyed digests and folds them
 * in ascending key order at `finalize()`. Equivalent data therefore hashes
 * identically whatever order it was inserted in — by canonicalizing the order,
 * not by using a commutative combiner (which would be far weaker).
 */
import type { Int } from "./int.js";

export const FNV_OFFSET_BASIS = 0x811c9dc5 as Int;
const FNV_PRIME = 0x01000193;

/** Hash domains. The numeric tags are part of the format; never renumber them. */
export const HashDomain = {
  /** Consequential simulation state. */
  Authoritative: 1 as Int,
  /** Observer-side read models, feed and presentation state. */
  Observer: 2 as Int,
} as const;
export type HashDomainTag = (typeof HashDomain)[keyof typeof HashDomain];

export type HashErrorCode = "DUPLICATE_KEY" | "INVALID_DIGEST";

export class HashError extends Error {
  readonly code: HashErrorCode;
  constructor(code: HashErrorCode, detail: string) {
    super(`${code}: ${detail}`);
    this.name = "HashError";
    this.code = code;
  }
}

/** FNV-1a/32 over `bytes`, continuing from `seed` (default: the FNV offset basis). */
export function fnv1a32(bytes: Uint8Array, seed: Int = FNV_OFFSET_BASIS): Int {
  let h = seed >>> 0;
  for (let i = 0; i < bytes.length; i += 1) {
    h = (h ^ (bytes[i] as number)) >>> 0;
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h as Int;
}

/** Mix one 32-bit word, little-endian, into a running digest. */
export function mixWord(h: Int, word: Int): Int {
  let x = h >>> 0;
  const w = word >>> 0;
  for (let shift = 0; shift < 32; shift += 8) {
    x = (x ^ ((w >>> shift) & 0xff)) >>> 0;
    x = Math.imul(x, FNV_PRIME) >>> 0;
  }
  return x as Int;
}

/** Mix a safe integer as its canonical 8 bytes (u32 low word, then the signed high word). */
export function mixInt53(h: Int, value: Int): Int {
  const hi = Math.floor(value / 4294967296);
  const lo = value - hi * 4294967296;
  return mixWord(mixWord(h, lo as Int), (hi | 0) as Int);
}

/** The seed a domain starts from: the offset basis with the domain tag mixed in first. */
export function domainSeed(domain: HashDomainTag): Int {
  return mixWord(FNV_OFFSET_BASIS, domain);
}

/** Digest of `bytes` in `domain`. */
export function hashBytes(domain: HashDomainTag, bytes: Uint8Array): Int {
  return fnv1a32(bytes, domainSeed(domain));
}

/**
 * Collects `(key, digest)` pairs and folds them in ascending key order.
 * Keys are the stable numeric IDs the simulation already uses for ordering
 * (TP v1.1 §4 "stable ordering uses numeric IDs"). A repeated key is an error,
 * not a silent overwrite: two entries claiming the same identity means the
 * caller built an ambiguous view.
 */
export class HashAccumulator {
  private readonly domain: HashDomainTag;
  private readonly keys: number[] = [];
  private readonly digests: number[] = [];
  private readonly seen = new Set<number>();

  constructor(domain: HashDomainTag) {
    this.domain = domain;
  }

  get size(): number {
    return this.keys.length;
  }

  /** Add one keyed digest. `digest` must be a uint32 (typically from `hashBytes`). */
  add(key: Int, digest: Int): this {
    if (!Number.isSafeInteger(digest) || digest < 0 || digest > 0xffffffff) {
      throw new HashError("INVALID_DIGEST", `digest ${digest} is not a uint32`);
    }
    if (this.seen.has(key)) throw new HashError("DUPLICATE_KEY", `key ${key} added twice`);
    this.seen.add(key);
    this.keys.push(key);
    this.digests.push(digest);
    return this;
  }

  /** Add a keyed byte payload, hashing it in this accumulator's domain. */
  addBytes(key: Int, bytes: Uint8Array): this {
    return this.add(key, hashBytes(this.domain, bytes));
  }

  /** Fold every entry in ascending key order. Insertion order does not matter. */
  finalize(): Int {
    const order = this.keys.map((_, i) => i).sort((x, y) => {
      const kx = this.keys[x] as number;
      const ky = this.keys[y] as number;
      return kx < ky ? -1 : kx > ky ? 1 : 0;
    });
    let h = domainSeed(this.domain);
    h = mixInt53(h, this.keys.length as Int);
    for (const i of order) {
      h = mixInt53(h, this.keys[i] as Int);
      h = mixWord(h, this.digests[i] as Int);
    }
    return h;
  }
}

/** Format a digest as the eight-character lowercase hex used in logs and evidence. */
export function formatDigest(digest: Int): string {
  return (digest >>> 0).toString(16).padStart(8, "0");
}
