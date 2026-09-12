import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  arr,
  bool,
  ContractError,
  decodeJson,
  encodeJson,
  encodeJsonPretty,
  enumOf,
  int,
  obj,
  opt,
  parse,
  refine,
  str,
  toJsonSchema,
  union,
  validate,
} from "./schema.js";
import type { Infer } from "./schema.js";

const Point = obj("Point", { x: int(), y: int(), label: opt(str({ maxLength: 8 })) });
type Point = Infer<typeof Point>;
/** Test helper: contract records hold branded Ints, so literals are branded here. */
const pt = (x: number, y: number, label?: string): Point => ({ x, y, ...(label === undefined ? {} : { label }) }) as unknown as Point;

const Tagged = union("kind", [
  obj("Circle", { kind: enumOf(["Circle"] as const), radius: int({ min: 1 }) }),
  obj("Rect", { kind: enumOf(["Rect"] as const), w: int({ min: 1 }), h: int({ min: 1 }) }),
]);

describe("validation reports every problem with a path", () => {
  it("accepts a well-formed record", () => {
    const result = validate(Point, { x: 1, y: -2 });
    expect(result.ok).toBe(true);
  });

  it("names each bad field, not just the first", () => {
    const result = validate(Point, { x: 1.5, y: "no" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.path)).toEqual(["/x", "/y"]);
    expect(result.errors[0]?.message).toContain("safe integer");
  });

  it("reports missing required fields and rejects unknown ones (records are closed)", () => {
    const missing = validate(Point, { x: 1 });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.errors[0]?.message).toContain('missing required field "y"');

    const extra = validate(Point, { x: 1, y: 2, z: 3 });
    expect(extra.ok).toBe(false);
    if (!extra.ok) expect(extra.errors[0]?.message).toContain('unknown field "z"');
  });

  it("treats an absent optional and an undefined optional the same, and always rejects null", () => {
    expect(validate(Point, { x: 1, y: 2 }).ok).toBe(true);
    expect(validate(Point, { x: 1, y: 2, label: undefined }).ok).toBe(true);
    expect(validate(Point, { x: 1, y: 2, label: null }).ok).toBe(false);
    expect(validate(Point, { x: 1, y: 2, label: "ok" }).ok).toBe(true);
    expect(validate(Point, { x: 1, y: 2, label: "far too long" }).ok).toBe(false);
  });

  it("indexes array paths", () => {
    const List = obj("List", { points: arr(Point, { maxItems: 3 }) });
    const bad = validate(List, { points: [{ x: 1, y: 2 }, { x: 1 }] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]?.path).toBe("/points/1");
    expect(validate(List, { points: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }] }).ok).toBe(false);
  });

  it("selects a union variant by its discriminant and reports an unmatched tag", () => {
    expect(validate(Tagged, { kind: "Circle", radius: 3 }).ok).toBe(true);
    expect(validate(Tagged, { kind: "Rect", w: 2, h: 5 }).ok).toBe(true);
    expect(validate(Tagged, { kind: "Circle", w: 2, h: 5 }).ok).toBe(false);
    const unmatched = validate(Tagged, { kind: "Triangle" });
    expect(unmatched.ok).toBe(false);
    if (!unmatched.ok) expect(unmatched.errors[0]?.message).toContain("no variant matches");
  });

  it("checks refinements only once the fields themselves are valid", () => {
    const Ordered = obj("Ordered", { lo: int(), hi: int() }, { refinements: [refine("lo <= hi", (v) => (v["lo"] as number) <= (v["hi"] as number))] });
    expect(validate(Ordered, { lo: 1, hi: 2 }).ok).toBe(true);
    const violated = validate(Ordered, { lo: 5, hi: 2 });
    expect(violated.ok).toBe(false);
    if (!violated.ok) expect(violated.errors[0]?.message).toBe("violates: lo <= hi");
    // A type error must not be masked by a refinement that would also fail.
    const typeError = validate(Ordered, { lo: "x", hi: 2 });
    expect(typeError.ok).toBe(false);
    if (!typeError.ok) expect(typeError.errors.map((e) => e.path)).toEqual(["/lo"]);
  });

  it("enforces int bounds, string patterns and enums", () => {
    expect(validate(int({ min: 0, max: 10 }), 11).ok).toBe(false);
    expect(validate(int({ min: 0, max: 10 }), -1).ok).toBe(false);
    expect(validate(int(), Number.MAX_SAFE_INTEGER + 2).ok).toBe(false);
    expect(validate(str({ pattern: "^C[0-9]{3}$" }), "C001").ok).toBe(true);
    expect(validate(str({ pattern: "^C[0-9]{3}$" }), "c001").ok).toBe(false);
    expect(validate(enumOf(["a", "b"] as const), "c").ok).toBe(false);
    expect(validate(bool(), 1).ok).toBe(false);
  });

  it("parse throws a ContractError carrying the errors", () => {
    expect(() => parse(Point, { x: 1 }, "Point")).toThrow(ContractError);
    try {
      parse(Point, { x: 1 }, "Point");
    } catch (e) {
      expect((e as ContractError).errors).toHaveLength(1);
      expect((e as Error).message).toContain("Point:");
    }
  });
});

describe("canonical JSON codec", () => {
  it("emits keys in declaration order regardless of the object's own key order", () => {
    expect(encodeJson(Point, { y: 2, x: 1 } as unknown as Point)).toBe('{"x":1,"y":2}');
    expect(encodeJson(Point, pt(1, 2, "L"))).toBe('{"x":1,"y":2,"label":"L"}');
  });

  it("omits absent optionals rather than writing null", () => {
    expect(encodeJson(Point, pt(1, 2))).toBe('{"x":1,"y":2}');
  });

  it("round-trips: decode(encode(v)) === v and encode(decode(t)) === t", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -1000, max: 1000 }), fc.option(fc.stringMatching(/^[a-z]{0,8}$/), { nil: undefined }), (x, y, label) => {
        const value = pt(x, y, label);
        const text = encodeJson(Point, value);
        expect(decodeJson(Point, text)).toEqual(value);
        expect(encodeJson(Point, decodeJson(Point, text))).toBe(text);
      }),
    );
  });

  it("refuses to encode a value that violates its own contract", () => {
    expect(() => encodeJson(Point, { x: 1.5, y: 2 } as unknown as Point)).toThrow(ContractError);
  });

  it("decode rejects malformed JSON and contract violations with the same error type", () => {
    expect(() => decodeJson(Point, "{oops")).toThrow(ContractError);
    expect(() => decodeJson(Point, '{"x":1}')).toThrow(ContractError);
  });

  it("the pretty form is the canonical form with indent 1 and a trailing newline", () => {
    const pretty = encodeJsonPretty(Point, pt(1, 2));
    expect(pretty).toBe('{\n "x": 1,\n "y": 2\n}\n');
    expect(encodeJson(Point, decodeJson(Point, pretty))).toBe('{"x":1,"y":2}');
  });
});

describe("JSON Schema emission", () => {
  it("emits draft 2020-12 with closed objects and the required list", () => {
    const schema = toJsonSchema(Point, "Point") as Record<string, unknown>;
    expect(schema["$schema"]).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema["title"]).toBe("Point");
    expect(schema["additionalProperties"]).toBe(false);
    expect(schema["required"]).toEqual(["x", "y"]);
    expect(Object.keys(schema["properties"] as object)).toEqual(["x", "y", "label"]);
  });

  it("carries bounds, patterns, enums and array limits through", () => {
    const schema = toJsonSchema(obj("S", { n: int({ min: 1, max: 9 }), s: str({ pattern: "^a+$", maxLength: 4 }), e: enumOf(["x", "y"] as const), a: arr(int(), { maxItems: 2 }) })) as Record<string, unknown>;
    const props = schema["properties"] as Record<string, Record<string, unknown>>;
    expect(props["n"]).toMatchObject({ type: "integer", minimum: 1, maximum: 9 });
    expect(props["s"]).toMatchObject({ type: "string", pattern: "^a+$", maxLength: 4 });
    expect(props["e"]).toMatchObject({ type: "string", enum: ["x", "y"] });
    expect(props["a"]).toMatchObject({ type: "array", maxItems: 2 });
  });

  it("records refinements as annotations, since JSON Schema cannot express them", () => {
    const Ordered = obj("Ordered", { lo: int(), hi: int() }, { refinements: [refine("lo <= hi", (v) => (v["lo"] as number) <= (v["hi"] as number))] });
    const schema = toJsonSchema(Ordered) as Record<string, unknown>;
    expect(schema["x-refinements"]).toEqual(["lo <= hi"]);
  });

  it("emits a oneOf for unions", () => {
    const schema = toJsonSchema(Tagged) as Record<string, unknown>;
    expect((schema["oneOf"] as unknown[]).length).toBe(2);
    expect(schema["$comment"]).toContain("discriminated by kind");
  });
});
