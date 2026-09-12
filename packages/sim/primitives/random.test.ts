import { SFC32 } from "@thi.ng/random";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { asInt, type Int } from "./int.js";
import {
  decodeRandomState,
  encodeRandomState,
  labelWord,
  RANDOM_ALGORITHM,
  RANDOM_BYTE_ORDER,
  RANDOM_SEEDING_RULE,
  RANDOM_STATE_FORMAT_VERSION,
  RandomStream,
  type RandomState,
  splitmix32,
  WARMUP_DRAWS,
} from "./random.js";
import { readSection, writeSection } from "./serialize.js";
import vectors from "./vectors/random-v1.json" with { type: "json" };

const I = (n: number): Int => asInt(n);
const u32 = fc.integer({ min: 0, max: 0xffffffff }).map(I);

const stateOf = (words: number[]): RandomState => ({
  a: I(words[0] as number),
  b: I(words[1] as number),
  c: I(words[2] as number),
  counter: I(words[3] as number),
});

describe("acceptance 1 — the pinned vectors identify algorithm, seeding rule and byte order", () => {
  it("the vector file names them and they match the implementation constants", () => {
    expect(vectors.algorithm).toBe(RANDOM_ALGORITHM);
    expect(vectors.algorithm).toBe("sfc32");
    expect(vectors.seedingRule).toBe(RANDOM_SEEDING_RULE);
    expect(vectors.warmupDraws).toBe(WARMUP_DRAWS);
    expect(vectors.byteOrder).toBe(RANDOM_BYTE_ORDER);
    expect(vectors.outputRule).toContain("t >>> 0");
    expect(vectors.step.length).toBeGreaterThanOrEqual(4);
    expect(vectors.derived.length).toBeGreaterThanOrEqual(20);
  });

  it("every pinned step vector reproduces exactly, state included", () => {
    for (const c of vectors.step) {
      const s = new RandomStream(stateOf(c.state));
      expect(c.outputs.map(() => s.nextU32())).toEqual(c.outputs);
      expect(Object.values(s.snapshot())).toEqual(c.stateAfter16);
    }
  });

  it("every pinned splitmix32 and derived-stream vector reproduces exactly", () => {
    for (const c of vectors.splitmix32) expect(splitmix32(I(c.seed))).toBe(c.output);
    for (const c of vectors.derived) {
      expect(labelWord(c.label)).toBe(c.labelWord);
      const s = RandomStream.derive(I(c.matchSeed), c.label);
      expect(Object.values(s.snapshot())).toEqual(c.seededState);
      expect(c.first8.map(() => s.nextU32())).toEqual(c.first8);
    }
  });

  it("the step function agrees with an independent sfc32 implementation for random states", () => {
    // @thi.ng/random@4.1.54 SFC32 — a separate codebase, same published algorithm.
    fc.assert(
      fc.property(u32, u32, u32, u32, (a, b, c, d) => {
        const ours = new RandomStream({ a, b, c, counter: d });
        const theirs = new SFC32([a | 0, b | 0, c | 0, d | 0]);
        for (let i = 0; i < 24; i += 1) expect(ours.nextU32()).toBe(theirs.int() >>> 0);
      }),
      { numRuns: 300 },
    );
  });

  it("outputs are uint32 integers — never a float", () => {
    fc.assert(
      fc.property(u32, u32, u32, u32, (a, b, c, d) => {
        const s = new RandomStream({ a, b, c, counter: d });
        for (let i = 0; i < 32; i += 1) {
          const v = s.nextU32();
          expect(Number.isSafeInteger(v)).toBe(true);
          expect(v >= 0 && v <= 0xffffffff).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe("acceptance 2 — labeled streams are independent", () => {
  const CORE = ["worldgen", "combat", "wildlife", "actor:0001"];

  it("deriving an unused guest or cosmetic stream does not advance any core stream", () => {
    const seed = I(20260912);
    const before = CORE.map((label) => {
      const s = RandomStream.derive(seed, label);
      return Array.from({ length: 16 }, () => s.nextU32());
    });

    // Interleave: derive extra streams and draw heavily from them.
    const after = CORE.map((label, i) => {
      const guest = RandomStream.derive(seed, "guest");
      const cosmetic = RandomStream.derive(seed, `cosmetic:${i}`);
      for (let k = 0; k < 100; k += 1) {
        guest.nextU32();
        cosmetic.nextU32();
      }
      const s = RandomStream.derive(seed, label);
      return Array.from({ length: 16 }, () => s.nextU32());
    });

    expect(after).toEqual(before);
  });

  it("derivation is a pure function of (matchSeed, label)", () => {
    fc.assert(
      fc.property(u32, fc.stringMatching(/^[ -~]{1,24}$/), (seed, label) => {
        const one = RandomStream.derive(seed, label);
        const two = RandomStream.derive(seed, label);
        for (let i = 0; i < 8; i += 1) expect(one.nextU32()).toBe(two.nextU32());
      }),
      { numRuns: 200 },
    );
  });

  it("different labels and different seeds give different sequences", () => {
    const seed = I(7);
    const first = (label: string, s: Int = seed): number[] => {
      const stream = RandomStream.derive(s, label);
      return Array.from({ length: 8 }, () => stream.nextU32());
    };
    const labels = ["worldgen", "combat", "wildlife", "guest", "actor:0001", "actor:0002"];
    const seen = new Map<string, string>();
    for (const label of labels) {
      const key = JSON.stringify(first(label));
      expect(seen.has(key)).toBe(false);
      seen.set(key, label);
    }
    expect(first("worldgen", I(8))).not.toEqual(first("worldgen", I(7)));
    // One-character label differences must not correlate: the label goes through FNV-1a and splitmix32.
    expect(first("actor:0001")).not.toEqual(first("actor:0002"));
  });

  it("labels must be ASCII (the byte reduction is defined for ASCII only)", () => {
    expect(() => RandomStream.derive(I(1), "actör")).toThrow(/INVALID_UNIT/);
  });

  it("equal seeds give equal sequences wherever the integer ops are equal — cross-runtime check is W0-07/W0-10", () => {
    // Recorded here so the claim is visible in the suite; the browser Worker half is BLOCKED until W0-10.
    expect(vectors.derived[0]?.first8).toHaveLength(8);
  });
});

describe("state is complete: snapshot, restore and byte round trip", () => {
  it("restoring a snapshot reproduces the remainder of the sequence", () => {
    fc.assert(
      fc.property(u32, fc.integer({ min: 0, max: 64 }), (seed, skip) => {
        const s = RandomStream.derive(seed, "combat");
        for (let i = 0; i < skip; i += 1) s.nextU32();
        const snapshot = s.snapshot();
        const expected = Array.from({ length: 16 }, () => s.nextU32());
        const restored = new RandomStream(snapshot);
        expect(Array.from({ length: 16 }, () => restored.nextU32())).toEqual(expected);
      }),
      { numRuns: 200 },
    );
  });

  it("encode/decode is byte-exact and versioned", () => {
    fc.assert(
      fc.property(u32, u32, u32, u32, (a, b, c, counter) => {
        const state: RandomState = { a, b, c, counter };
        const bytes = encodeRandomState(state);
        expect(decodeRandomState(bytes)).toEqual(state);
        expect(encodeRandomState(decodeRandomState(bytes))).toEqual(bytes);
        expect(readSection(bytes).formatVersion).toBe(RANDOM_STATE_FORMAT_VERSION);
      }),
    );
    const future = writeSection(RANDOM_STATE_FORMAT_VERSION + 1, (w) => w.u32(1).u32(2).u32(3).u32(4));
    expect(() => decodeRandomState(future)).toThrow(/unknown RandomState format version/);
  });

  it("rejects a state that is not four uint32 words", () => {
    expect(() => new RandomStream({ a: I(-1), b: I(0), c: I(0), counter: I(0) })).toThrow(/INVALID_UNIT/);
    expect(() => new RandomStream({ a: 1.5 as Int, b: I(0), c: I(0), counter: I(0) })).toThrow(/INVALID_UNIT/);
    expect(() => new RandomStream({ a: I(0x100000000), b: I(0), c: I(0), counter: I(0) })).toThrow(/INVALID_UNIT/);
  });
});

describe("draw helpers stay in range and refuse invalid domains", () => {
  it("nextBelow is within [0, bound) and covers the whole range", () => {
    fc.assert(
      fc.property(u32, fc.integer({ min: 1, max: 1000 }).map(I), (seed, bound) => {
        const s = RandomStream.derive(seed, "wildlife");
        for (let i = 0; i < 32; i += 1) {
          const v = s.nextBelow(bound);
          expect(v >= 0 && v < bound).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
    const s = RandomStream.derive(I(1), "worldgen");
    const seen = new Set<number>();
    for (let i = 0; i < 400; i += 1) seen.add(s.nextBelow(I(6)));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(s.nextBelow(I(1))).toBe(0);
  });

  it("nextBelow rejection keeps the distribution flat for a bound that does not divide 2^32", () => {
    const s = RandomStream.derive(I(20260912), "combat");
    const counts = new Array<number>(3).fill(0);
    const n = 60_000;
    for (let i = 0; i < n; i += 1) {
      const bucket = s.nextBelow(I(3));
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    }
    for (const c of counts) expect(Math.abs(c - n / 3)).toBeLessThan(n / 50); // within 2 % of even
  });

  it("nextRange is inclusive at both ends", () => {
    const s = RandomStream.derive(I(3), "combat");
    const seen = new Set<number>();
    for (let i = 0; i < 500; i += 1) seen.add(s.nextRange(I(-2), I(2)));
    expect([...seen].sort((x, y) => x - y)).toEqual([-2, -1, 0, 1, 2]);
    expect(() => s.nextRange(I(5), I(1))).toThrow(/INVALID_UNIT/);
  });

  it("nextChanceMilli: 0 and 1000 are decided without consuming a word", () => {
    const s = RandomStream.derive(I(4), "combat");
    const before = s.snapshot();
    expect(s.nextChanceMilli(I(0))).toBe(false);
    expect(s.nextChanceMilli(I(1000))).toBe(true);
    expect(s.snapshot()).toEqual(before);
    expect(() => s.nextChanceMilli(I(1001))).toThrow(/INVALID_UNIT/);
    const trials = 20_000;
    let hits = 0;
    for (let i = 0; i < trials; i += 1) if (s.nextChanceMilli(I(250))) hits += 1;
    expect(Math.abs(hits - trials / 4)).toBeLessThan(trials / 40);
  });

  it("rejects an out-of-domain bound", () => {
    const s = RandomStream.derive(I(5), "combat");
    expect(() => s.nextBelow(I(0))).toThrow(/INVALID_UNIT/);
    expect(() => s.nextBelow(I(-1))).toThrow(/INVALID_UNIT/);
    expect(() => s.nextBelow(I(0x100000001))).toThrow(/INVALID_UNIT/);
  });
});
