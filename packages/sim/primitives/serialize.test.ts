import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { asInt, type Int, MAX_SAFE, MIN_SAFE } from "./int.js";
import {
  ByteReader,
  ByteWriter,
  decodeRateState,
  encodeRateState,
  RATE_STATE_FORMAT_VERSION,
  readSection,
  SECTION_HEADER_BYTES,
  SECTION_MAGIC,
  SerializationError,
  writeSection,
} from "./serialize.js";

const I = (n: number): Int => asInt(n);
const safeInt = fc.integer({ min: MIN_SAFE, max: MAX_SAFE }).map(I);

describe("ByteWriter / ByteReader are little-endian and byte-exact", () => {
  it("fixed layouts", () => {
    const bytes = new ByteWriter(1).u8(0xab).u16(0x1234).u32(0xdeadbeef).i32(-2).int53(I(1)).int53(I(-1)).toUint8Array();
    expect(Array.from(bytes)).toEqual([
      0xab, // u8
      0x34, 0x12, // u16 LE
      0xef, 0xbe, 0xad, 0xde, // u32 LE
      0xfe, 0xff, 0xff, 0xff, // i32 -2
      0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // int53 1: lo=1, hi=0
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, // int53 -1: lo=2^32-1, hi=-1
    ]);
    const r = new ByteReader(bytes);
    expect(r.u8()).toBe(0xab);
    expect(r.u16()).toBe(0x1234);
    expect(r.u32()).toBe(0xdeadbeef);
    expect(r.i32()).toBe(-2);
    expect(r.int53()).toBe(1);
    expect(r.int53()).toBe(-1);
    expect(() => r.expectEnd()).not.toThrow();
  });
  it("int53 covers the whole safe range and round-trips every value", () => {
    fc.assert(
      fc.property(fc.array(safeInt, { maxLength: 64 }), (values) => {
        const w = new ByteWriter();
        for (const v of values) w.int53(v);
        const bytes = w.toUint8Array();
        expect(bytes.byteLength).toBe(values.length * 8);
        const r = new ByteReader(bytes);
        for (const v of values) expect(r.int53()).toBe(v);
        r.expectEnd();
      }),
    );
    for (const v of [MAX_SAFE, MIN_SAFE, 0, 4294967295, 4294967296, -4294967296, -4294967297]) {
      const bytes = new ByteWriter().int53(I(v)).toUint8Array();
      expect(new ByteReader(bytes).int53()).toBe(v);
    }
  });
  it("identical values produce identical bytes (canonical form, no ambiguity)", () => {
    fc.assert(
      fc.property(safeInt, (v) => {
        expect(new ByteWriter().int53(v).toUint8Array()).toEqual(new ByteWriter(1).int53(v).toUint8Array());
      }),
    );
  });
  it("range violations are refused at write time", () => {
    expect(() => new ByteWriter().u8(256)).toThrow(SerializationError);
    expect(() => new ByteWriter().u16(-1)).toThrow(/OUT_OF_RANGE/);
    expect(() => new ByteWriter().u32(2 ** 32)).toThrow(/OUT_OF_RANGE/);
    expect(() => new ByteWriter().i32(2 ** 31)).toThrow(/OUT_OF_RANGE/);
    expect(() => new ByteWriter().u8(1.5)).toThrow(/OUT_OF_RANGE/);
    expect(() => new ByteWriter().int53(2 ** 53 as Int)).toThrow(/OUT_OF_RANGE/);
  });
  it("truncated input is an error, not a partial value", () => {
    const bytes = new ByteWriter().u32(7).toUint8Array();
    const r = new ByteReader(bytes.subarray(0, 3));
    expect(() => r.u32()).toThrow(/TRUNCATED/);
    expect(() => new ByteReader(bytes).int53()).toThrow(/TRUNCATED/);
  });
  it("length-prefixed byte strings round-trip and the writer grows", () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 5000 }), (payload) => {
        const bytes = new ByteWriter(1).bytesWithLength(payload).toUint8Array();
        const r = new ByteReader(bytes);
        expect(Array.from(r.bytesWithLength())).toEqual(Array.from(payload));
        r.expectEnd();
      }),
    );
  });
});

describe("sections record a format version", () => {
  it("header layout: magic, u16 version, u32 length, payload", () => {
    const bytes = writeSection(7, (w) => w.u8(1).u8(2));
    expect(bytes.byteLength).toBe(SECTION_HEADER_BYTES + 2);
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0x4c, 0x43, 0x53, 0x00]); // "LCS\0"
    expect(Array.from(bytes.subarray(4, 6))).toEqual([7, 0]);
    expect(Array.from(bytes.subarray(6, 10))).toEqual([2, 0, 0, 0]);
    expect(SECTION_MAGIC).toBe(0x0053434c);
    const s = readSection(bytes);
    expect(s.formatVersion).toBe(7);
    expect(s.payload.u8()).toBe(1);
    expect(s.payload.u8()).toBe(2);
    s.payload.expectEnd();
  });
  it("bad magic, truncation and trailing bytes are distinct explicit errors", () => {
    const good = writeSection(1, (w) => w.int53(I(42)));
    const badMagic = good.slice();
    badMagic[0] = 0x58;
    expect(() => readSection(badMagic)).toThrow(/BAD_MAGIC/);
    expect(() => readSection(good.subarray(0, good.byteLength - 1))).toThrow(/TRUNCATED/);
    const trailing = new Uint8Array(good.byteLength + 1);
    trailing.set(good);
    expect(() => readSection(trailing)).toThrow(/TRAILING_BYTES/);
    expect(() => readSection(good.subarray(0, 5))).toThrow(/TRUNCATED/);
  });
  it("payload that decodes short of its length is caught by expectEnd", () => {
    const bytes = writeSection(1, (w) => w.u8(1).u8(2));
    const s = readSection(bytes);
    s.payload.u8();
    expect(() => s.payload.expectEnd()).toThrow(/TRAILING_BYTES/);
  });
});

describe("RateState codec (format version 1) round-trips remainders byte-exactly", () => {
  it("property", () => {
    fc.assert(
      fc.property(safeInt, (remainder) => {
        const bytes = encodeRateState({ remainder });
        expect(bytes.byteLength).toBe(SECTION_HEADER_BYTES + 8);
        expect(decodeRateState(bytes)).toEqual({ remainder });
        expect(encodeRateState(decodeRateState(bytes))).toEqual(bytes);
      }),
    );
  });
  it("records and checks the version", () => {
    const bytes = encodeRateState({ remainder: I(5) });
    expect(readSection(bytes).formatVersion).toBe(RATE_STATE_FORMAT_VERSION);
    const future = writeSection(RATE_STATE_FORMAT_VERSION + 1, (w) => w.int53(I(5)));
    expect(() => decodeRateState(future)).toThrow(/unknown RateState format version/);
    const long = writeSection(RATE_STATE_FORMAT_VERSION, (w) => w.int53(I(5)).u8(0));
    expect(() => decodeRateState(long)).toThrow(/TRAILING_BYTES/);
  });
});
