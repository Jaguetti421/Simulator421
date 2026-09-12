/**
 * Contract schema DSL (W0-04).
 *
 * A contract record is declared **once**. From that single declaration come
 * four things that therefore cannot drift apart:
 *
 *   1. the TypeScript type      — `type X = Infer<typeof XShape>`
 *   2. the runtime validator    — `validate(XShape, value)`
 *   3. the JSON Schema          — `toJsonSchema(XShape)` (draft 2020-12)
 *   4. the canonical codec      — `encodeJson` / `decodeJson`
 *
 * Canonical encoding: keys are emitted in declaration order (not insertion or
 * alphabetical order), absent optional fields are omitted, numbers are integers
 * only, and the text is minified. Re-encoding a decoded record therefore
 * reproduces the exact bytes — which is what the golden samples assert.
 *
 * Validation returns every error with a JSON-pointer-style path instead of
 * throwing on the first one: a rejected command must be able to say what was
 * wrong, not merely that something was.
 */
import type { Int } from "../primitives/index.js";

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

export interface IntNode {
  readonly kind: "int";
  readonly min?: number;
  readonly max?: number;
  readonly description?: string;
}
export interface StringNode {
  readonly kind: "string";
  readonly pattern?: string;
  readonly maxLength?: number;
  readonly description?: string;
}
export interface BoolNode {
  readonly kind: "bool";
  readonly description?: string;
}
export interface EnumNode {
  readonly kind: "enum";
  readonly values: readonly string[];
  readonly description?: string;
}
export interface ArrayNode {
  readonly kind: "array";
  readonly items: AnyShape;
  readonly maxItems?: number;
  readonly description?: string;
}
export interface ObjectNode {
  readonly kind: "object";
  readonly name?: string;
  readonly fields: readonly (readonly [string, AnyShape, boolean])[]; // [key, shape, optional]
  readonly refinements: readonly Refinement[];
  readonly description?: string;
}
export interface UnionNode {
  readonly kind: "union";
  readonly discriminant: string;
  readonly variants: readonly AnyShape[];
  readonly description?: string;
}
export type SchemaNode = IntNode | StringNode | BoolNode | EnumNode | ArrayNode | ObjectNode | UnionNode;

export interface Refinement {
  /** Human-readable rule, also emitted into the JSON Schema `$comment`. */
  readonly rule: string;
  readonly check: (value: Record<string, unknown>) => boolean;
}

/** A shape carries its node and, phantom-typed, the value it describes. */
export interface Shape<T> {
  readonly node: SchemaNode;
  readonly optional?: boolean;
  readonly __t?: T;
}
export type AnyShape = Shape<unknown>;

export type Infer<S> =
  S extends Shape<infer T> ? T : never;

type OptionalKeys<F> = { [K in keyof F]: F[K] extends { optional: true } ? K : never }[keyof F];
type RequiredKeys<F> = Exclude<keyof F, OptionalKeys<F>>;
type InferFields<F> = {
  readonly [K in RequiredKeys<F>]: Infer<F[K]>;
} & {
  readonly [K in OptionalKeys<F>]?: Infer<F[K]>;
};

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export function int(opts: Omit<IntNode, "kind"> = {}): Shape<Int> {
  return { node: { kind: "int", ...opts } };
}
export function str(opts: Omit<StringNode, "kind"> = {}): Shape<string> {
  return { node: { kind: "string", ...opts } };
}
export function bool(description?: string): Shape<boolean> {
  return { node: description === undefined ? { kind: "bool" } : { kind: "bool", description } };
}
export function enumOf<const V extends readonly string[]>(values: V, description?: string): Shape<V[number]> {
  return { node: description === undefined ? { kind: "enum", values } : { kind: "enum", values, description } };
}
export function arr<S extends AnyShape>(items: S, opts: { maxItems?: number; description?: string } = {}): Shape<readonly Infer<S>[]> {
  return { node: { kind: "array", items, ...opts } };
}
export function obj<const F extends Record<string, AnyShape>>(
  name: string,
  fields: F,
  opts: { refinements?: readonly Refinement[]; description?: string } = {},
): Shape<InferFields<F>> {
  return {
    node: {
      kind: "object",
      name,
      fields: Object.entries(fields).map(([k, s]) => [k, s, s.optional === true] as const),
      refinements: opts.refinements ?? [],
      ...(opts.description === undefined ? {} : { description: opts.description }),
    },
  };
}
/** Marks a field optional. Absent and `undefined` are the same thing; `null` is never valid. */
export function opt<T>(shape: Shape<T>): Shape<T> & { optional: true } {
  return { ...shape, optional: true };
}
export function union<const V extends readonly AnyShape[]>(discriminant: string, variants: V, description?: string): Shape<Infer<V[number]>> {
  return { node: description === undefined ? { kind: "union", discriminant, variants } : { kind: "union", discriminant, variants, description } };
}
/** A cross-field invariant, e.g. "accepted acks carry an assigned tick and no reason". */
export function refine(rule: string, check: (value: Record<string, unknown>) => boolean): Refinement {
  return { rule, check };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationError {
  /** JSON-pointer-ish path, e.g. `/roster/2/actorId`. */
  readonly path: string;
  readonly message: string;
}
export type ValidationResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly errors: readonly ValidationError[] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function check(node: SchemaNode, value: unknown, path: string, errors: ValidationError[]): void {
  const fail = (message: string): void => {
    errors.push({ path: path === "" ? "/" : path, message });
  };
  switch (node.kind) {
    case "int": {
      if (typeof value !== "number" || !Number.isSafeInteger(value)) return fail(`expected a safe integer, got ${describe(value)}`);
      if (node.min !== undefined && value < node.min) return fail(`must be >= ${node.min}, got ${value}`);
      if (node.max !== undefined && value > node.max) return fail(`must be <= ${node.max}, got ${value}`);
      return;
    }
    case "string": {
      if (typeof value !== "string") return fail(`expected a string, got ${describe(value)}`);
      if (node.maxLength !== undefined && value.length > node.maxLength) return fail(`must be at most ${node.maxLength} characters`);
      if (node.pattern !== undefined && !new RegExp(node.pattern, "u").test(value)) return fail(`must match ${node.pattern}, got ${JSON.stringify(value)}`);
      return;
    }
    case "bool": {
      if (typeof value !== "boolean") fail(`expected a boolean, got ${describe(value)}`);
      return;
    }
    case "enum": {
      if (typeof value !== "string" || !node.values.includes(value)) fail(`must be one of ${node.values.join(" | ")}, got ${describe(value)}`);
      return;
    }
    case "array": {
      if (!Array.isArray(value)) return fail(`expected an array, got ${describe(value)}`);
      if (node.maxItems !== undefined && value.length > node.maxItems) fail(`must have at most ${node.maxItems} items, got ${value.length}`);
      value.forEach((item, i) => {
        check(node.items.node, item, `${path}/${i}`, errors);
      });
      return;
    }
    case "object": {
      if (!isPlainObject(value)) return fail(`expected an object, got ${describe(value)}`);
      const known = new Set<string>();
      for (const [key, shape, optional] of node.fields) {
        known.add(key);
        const present = Object.prototype.hasOwnProperty.call(value, key) && value[key] !== undefined;
        if (!present) {
          if (!optional) fail(`missing required field ${JSON.stringify(key)}`);
          continue;
        }
        check(shape.node, value[key], `${path}/${key}`, errors);
      }
      for (const key of Object.keys(value)) {
        if (!known.has(key)) fail(`unknown field ${JSON.stringify(key)} (contract records are closed)`);
      }
      if (errors.length === 0) {
        for (const r of node.refinements) {
          if (!r.check(value)) fail(`violates: ${r.rule}`);
        }
      }
      return;
    }
    case "union": {
      if (!isPlainObject(value)) return fail(`expected an object, got ${describe(value)}`);
      const tag = value[node.discriminant];
      const variant = node.variants.find((v) => {
        const f = (v.node as ObjectNode).fields.find(([k]) => k === node.discriminant);
        return f !== undefined && f[1].node.kind === "enum" && (f[1].node as EnumNode).values.includes(tag as string);
      });
      if (variant === undefined) {
        return fail(`no variant matches ${node.discriminant}=${describe(tag)}`);
      }
      check(variant.node, value, path, errors);
      return;
    }
  }
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return typeof value === "object" ? "an object" : JSON.stringify(value);
}

export function validate<S extends AnyShape>(shape: S, value: unknown): ValidationResult<Infer<S>> {
  const errors: ValidationError[] = [];
  check(shape.node, value, "", errors);
  return errors.length === 0 ? { ok: true, value: value as Infer<S> } : { ok: false, errors };
}

/** Throwing form for code that has already validated its inputs. */
export class ContractError extends Error {
  readonly errors: readonly ValidationError[];
  constructor(what: string, errors: readonly ValidationError[]) {
    super(`${what}: ${errors.map((e) => `${e.path} ${e.message}`).join("; ")}`);
    this.name = "ContractError";
    this.errors = errors;
  }
}

export function parse<S extends AnyShape>(shape: S, value: unknown, what = "contract"): Infer<S> {
  const result = validate(shape, value);
  if (!result.ok) throw new ContractError(what, result.errors);
  return result.value;
}

// ---------------------------------------------------------------------------
// Canonical JSON codec
// ---------------------------------------------------------------------------

function canonical(node: SchemaNode, value: unknown): unknown {
  switch (node.kind) {
    case "array":
      return (value as readonly unknown[]).map((item) => canonical(node.items.node, item));
    case "object": {
      const source = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [key, shape] of node.fields) {
        const v = source[key];
        if (v === undefined) continue;
        out[key] = canonical(shape.node, v);
      }
      return out;
    }
    case "union": {
      const source = value as Record<string, unknown>;
      const tag = source[node.discriminant];
      const variant = node.variants.find((v) => {
        const f = (v.node as ObjectNode).fields.find(([k]) => k === node.discriminant);
        return f !== undefined && (f[1].node as EnumNode).values.includes(tag as string);
      });
      return variant === undefined ? source : canonical(variant.node, source);
    }
    default:
      return value;
  }
}

/** Canonical JSON text: declaration key order, no absent optionals, minified. */
export function encodeJson<S extends AnyShape>(shape: S, value: Infer<S>, what = "contract"): string {
  parse(shape, value, what);
  return JSON.stringify(canonical(shape.node, value));
}

/** Parse and validate. Malformed JSON and contract violations are both errors. */
export function decodeJson<S extends AnyShape>(shape: S, text: string, what = "contract"): Infer<S> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new ContractError(what, [{ path: "/", message: `not valid JSON: ${(e as Error).message}` }]);
  }
  return parse(shape, parsed, what);
}

/** Pretty (indent 1) canonical text — what the checked-in sample files hold. */
export function encodeJsonPretty<S extends AnyShape>(shape: S, value: Infer<S>, what = "contract"): string {
  parse(shape, value, what);
  return `${JSON.stringify(canonical(shape.node, value), null, 1)}\n`;
}

// ---------------------------------------------------------------------------
// JSON Schema (draft 2020-12)
// ---------------------------------------------------------------------------

export interface JsonSchema {
  readonly [key: string]: unknown;
}

export function toJsonSchema(shape: AnyShape, title?: string): JsonSchema {
  const body = nodeToSchema(shape.node);
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    ...(title === undefined ? {} : { title }),
    ...body,
  };
}

function nodeToSchema(node: SchemaNode): JsonSchema {
  const described = (s: JsonSchema): JsonSchema => (node.description === undefined ? s : { ...s, description: node.description });
  switch (node.kind) {
    case "int":
      return described({ type: "integer", ...(node.min === undefined ? {} : { minimum: node.min }), ...(node.max === undefined ? {} : { maximum: node.max }) });
    case "string":
      return described({ type: "string", ...(node.pattern === undefined ? {} : { pattern: node.pattern }), ...(node.maxLength === undefined ? {} : { maxLength: node.maxLength }) });
    case "bool":
      return described({ type: "boolean" });
    case "enum":
      return described({ type: "string", enum: [...node.values] });
    case "array":
      return described({ type: "array", items: nodeToSchema(node.items.node), ...(node.maxItems === undefined ? {} : { maxItems: node.maxItems }) });
    case "object": {
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const [key, shape, optional] of node.fields) {
        properties[key] = nodeToSchema(shape.node);
        if (!optional) required.push(key);
      }
      return described({
        type: "object",
        ...(node.name === undefined ? {} : { $comment: `record ${node.name}` }),
        properties,
        required,
        additionalProperties: false,
        ...(node.refinements.length === 0 ? {} : { "x-refinements": node.refinements.map((r) => r.rule) }),
      });
    }
    case "union":
      return described({ oneOf: node.variants.map((v) => nodeToSchema(v.node)), $comment: `discriminated by ${node.discriminant}` });
  }
}
