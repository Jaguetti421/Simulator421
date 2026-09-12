import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  domainSeed,
  FNV_OFFSET_BASIS,
  fnv1a32,
  formatDigest,
  HashAccumulator,
  HashDomain,
  HashError,
  hashBytes,
  mixInt53,
  mixWord,
} from "./hash.js";
import { asInt, type Int } from "./int.js";
import { ByteWriter } from "./serialize.js";
import vectors from "./vectors/random-v1.json" with { type: "json" };

const I = (n: number): Int => asInt(n);
const ascii = (s: string): Uint8Array => Uint8Array.from(s, (ch) => ch.charCodeAt(0));

describe("FNV-1a/32 matches the published vectors and the pinned file", () => {
  it("known vectors", () => {
    // Independently recomputed in Python during W0-03 (see handoffs/W0-03/evidence/fnv-crosscheck.txt).
    expect(fnv1a32(ascii(""))).toBe(0x811c9dc5);
    expect(fnv1a32(ascii("a"))).toBe(0xe40c292c);
    expect(fnv1a32(ascii("b"))).toBe(0xe70c2de5);
    expect(fnv1a32(ascii("abc"))).toBe(0x1a47e90b);
    expect(fnv1a32(ascii("foobar"))).toBe(0xbf9cf968);
    expect(FNV_OFFSET_BASIS).toBe(0x811c9dc5);
  });

  it("the pinned hash vectors reproduce", () => {
    expect(domainSeed(HashDomain.Authoritative)).toBe(vectors.hash.domainSeeds.authoritative);
    expect(domainSeed(HashDomain.Observer)).toBe(vectors.hash.domainSeeds.observer);
    for (const c of vectors.hashCases) {
      const bytes = Uint8Array.from(c.bytes);
      expect(fnv1a32(bytes)).toBe(c.fnv1a32);
      expect(hashBytes(HashDomain.Authoritative, bytes)).toBe(c.authoritative);
      expect(hashBytes(HashDomain.Observer, bytes)).toBe(c.observer);
    }
  });

  it("digests are uint32 and the hex form is eight characters", () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 512 }), (bytes) => {
        const h = fnv1a32(bytes);
        expect(Number.isSafeInteger(h) && h >= 0 && h <= 0xffffffff).toBe(true);
        expect(formatDigest(h)).toMatch(/^[0-9a-f]{8}$/);
      }),
    );
    expect(formatDigest(I(0))).toBe("00000000");
    expect(formatDigest(I(0x811c9dc5))).toBe("811c9dc5");
  });

  it("mixWord and mixInt53 are the little-endian byte mixes of the same values", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }).map(I), (w) => {
        expect(mixWord(FNV_OFFSET_BASIS, w)).toBe(fnv1a32(new ByteWriter().u32(w).toUint8Array()));
      }),
    );
    fc.assert(
      fc.property(fc.integer({ min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER }).map(I), (v) => {
        expect(mixInt53(FNV_OFFSET_BASIS, v)).toBe(fnv1a32(new ByteWriter().int53(v).toUint8Array()));
      }),
    );
  });

  it("any single-byte change changes the digest", () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 1, maxLength: 64 }), fc.nat(), fc.integer({ min: 1, max: 255 }), (bytes, at, delta) => {
        const i = at % bytes.length;
        const changed = Uint8Array.from(bytes);
        changed[i] = ((changed[i] as number) + delta) & 0xff;
        if (changed[i] === bytes[i]) return;
        expect(fnv1a32(changed)).not.toBe(fnv1a32(bytes));
      }),
    );
  });
});

describe("acceptance 3a — insertion order does not change the digest", () => {
  it("a shuffled accumulator finalizes to the same value", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.tuple(fc.integer({ min: -1000, max: 1000 }).map(I), fc.integer({ min: 0, max: 0xffffffff }).map(I)), {
          selector: ([k]) => k,
          maxLength: 40,
        }),
        fc.array(fc.nat(), { maxLength: 40 }),
        (entries, permutation) => {
          const ordered = new HashAccumulator(HashDomain.Authoritative);
          for (const [k, d] of entries) ordered.add(k, d);

          const shuffled = [...entries];
          for (let i = shuffled.length - 1; i > 0; i -= 1) {
            const j = (permutation[i % permutation.length] ?? i) % (i + 1);
            const tmp = shuffled[i] as [Int, Int];
            shuffled[i] = shuffled[j] as [Int, Int];
            shuffled[j] = tmp;
          }
          const other = new HashAccumulator(HashDomain.Authoritative);
          for (const [k, d] of shuffled) other.add(k, d);

          expect(other.finalize()).toBe(ordered.finalize());
        },
      ),
    );
  });

  it("but different content does change it, and entry count is part of the digest", () => {
    const a = new HashAccumulator(HashDomain.Authoritative).add(I(1), I(10)).add(I(2), I(20));
    const b = new HashAccumulator(HashDomain.Authoritative).add(I(2), I(20)).add(I(1), I(10));
    const c = new HashAccumulator(HashDomain.Authoritative).add(I(1), I(10)).add(I(2), I(21));
    const d = new HashAccumulator(HashDomain.Authoritative).add(I(1), I(10));
    expect(b.finalize()).toBe(a.finalize());
    expect(c.finalize()).not.toBe(a.finalize());
    expect(d.finalize()).not.toBe(a.finalize());
    // Swapping which key carries which digest is a real change, not a reordering.
    const swapped = new HashAccumulator(HashDomain.Authoritative).add(I(1), I(20)).add(I(2), I(10));
    expect(swapped.finalize()).not.toBe(a.finalize());
  });

  it("a duplicate key is an error, not a silent overwrite", () => {
    const acc = new HashAccumulator(HashDomain.Authoritative).add(I(1), I(10));
    expect(() => acc.add(I(1), I(11))).toThrow(HashError);
    expect(() => acc.add(I(1), I(11))).toThrow(/DUPLICATE_KEY/);
    expect(() => acc.add(I(2), I(-1))).toThrow(/INVALID_DIGEST/);
    expect(() => acc.add(I(3), 1.5 as Int)).toThrow(/INVALID_DIGEST/);
  });
});

describe("acceptance 3b — a consequential change moves the authoritative hash; observer data does not", () => {
  /**
   * A deliberately small model of what W0-04/W0-08 will hash for real: each
   * actor has consequential fields (health, position) and observer-only fields
   * (a feed line and a camera hint). Each domain hashes only its own fields.
   */
  interface Actor {
    readonly id: number;
    healthMilli: number;
    xMm: number;
    feedLine: number;
    cameraHint: number;
  }
  const world = (): Actor[] => [
    { id: 1, healthMilli: 100_000, xMm: 12_345, feedLine: 7, cameraHint: 2 },
    { id: 2, healthMilli: 84_500, xMm: -900, feedLine: 9, cameraHint: 4 },
    { id: 3, healthMilli: 0, xMm: 640_000, feedLine: 1, cameraHint: 0 },
  ];
  const authoritativeHash = (actors: readonly Actor[]): Int => {
    const acc = new HashAccumulator(HashDomain.Authoritative);
    for (const a of actors) acc.addBytes(I(a.id), new ByteWriter().int53(I(a.healthMilli)).int53(I(a.xMm)).toUint8Array());
    return acc.finalize();
  };
  const observerHash = (actors: readonly Actor[]): Int => {
    const acc = new HashAccumulator(HashDomain.Observer);
    for (const a of actors) acc.addBytes(I(a.id), new ByteWriter().int53(I(a.feedLine)).int53(I(a.cameraHint)).toUint8Array());
    return acc.finalize();
  };

  it("changing one milli of health changes the authoritative hash and leaves the observer hash alone", () => {
    const base = world();
    const changed = world();
    (changed[1] as Actor).healthMilli += 1;
    expect(authoritativeHash(changed)).not.toBe(authoritativeHash(base));
    expect(observerHash(changed)).toBe(observerHash(base));
  });

  it("changing observer-only data changes only the observer hash", () => {
    const base = world();
    const changed = world();
    (changed[0] as Actor).feedLine = 8;
    (changed[2] as Actor).cameraHint = 5;
    expect(authoritativeHash(changed)).toBe(authoritativeHash(base));
    expect(observerHash(changed)).not.toBe(observerHash(base));
  });

  it("iteration order of the actor list never changes either hash", () => {
    const base = world();
    const reversed = [...world()].reverse();
    expect(authoritativeHash(reversed)).toBe(authoritativeHash(base));
    expect(observerHash(reversed)).toBe(observerHash(base));
  });

  it("the two domains give different digests for identical bytes", () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 128 }), (bytes) => {
        expect(hashBytes(HashDomain.Authoritative, bytes)).not.toBe(hashBytes(HashDomain.Observer, bytes));
      }),
    );
    const empty = new HashAccumulator(HashDomain.Authoritative).finalize();
    const emptyObserver = new HashAccumulator(HashDomain.Observer).finalize();
    expect(empty).not.toBe(emptyObserver);
  });
});
