/**
 * Drawing and PNG output for the readability renderer (W0-09).
 *
 * node-canvas does the rasterizing; everything it is told to draw comes from the
 * pure scene, so "same snapshot, same bytes" is a property of the scene plus a
 * deterministic encoder rather than a hope about the drawing code.
 *
 * Metadata is written into the PNG itself as `tEXt` chunks — fixture, tick,
 * build hash, renderer. A screenshot with no provenance is not evidence, and a
 * sidecar file gets separated from its image the first time anyone moves it.
 */
import { createCanvas } from "canvas";
import { createHash } from "node:crypto";
import { ACTION_ICONS, buildScene, PALETTE, hex } from "./scene.js";
import type { ActionIcon, Scene, SceneActor, WorldSnapshot } from "./scene.js";


export const RENDERER_ID = "clanlab-readability-2d-v1";

/**
 * The drawing surface this renderer uses, declared structurally.
 *
 * node-canvas names its context type `CanvasRenderingContext2D`, which the lab's
 * lint rule bans by name because that name normally means the DOM. Rather than
 * weaken the rule — the ban is doing its job everywhere else — the surface is
 * named here explicitly: this is exactly what the renderer needs from a 2D
 * context, and nothing in `packages/lab` reaches for a browser.
 */
export interface DrawingContext {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  fillText: (text: string, x: number, y: number) => void;
  beginPath: () => void;
  closePath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  rect: (x: number, y: number, w: number, h: number) => void;
  arc: (x: number, y: number, r: number, start: number, end: number) => void;
  stroke: () => void;
  fill: () => void;
  setLineDash: (segments: readonly number[]) => void;
}

// ---------------------------------------------------------------------------
// PNG metadata
// ---------------------------------------------------------------------------

const CRC_TABLE = ((): Uint32Array => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) === 1 ? 0xedb8_8320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffff_ffff;
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffff_ffff) >>> 0;
}

/**
 * PNG `tEXt` is Latin-1. Anything outside it would be silently mangled into a
 * different character, so non-Latin-1 text is transliterated here on purpose
 * rather than written and quietly corrupted — an em dash becomes "-", and
 * anything else becomes "?".
 */
export function toLatin1(text: string): string {
  return [...text.replace(/[\u2012-\u2015]/gu, "-").replace(/[\u2018\u2019]/gu, "'").replace(/[\u201c\u201d]/gu, '"')]
    .map((ch) => (ch.charCodeAt(0) <= 0xff ? ch : "?"))
    .join("");
}

function textChunk(keyword: string, text: string): Uint8Array {
  const payload = Buffer.from(`${toLatin1(keyword)}\0${toLatin1(text)}`, "latin1");
  const type = Buffer.from("tEXt", "latin1");
  const body = Buffer.concat([type, payload]);
  const out = Buffer.alloc(body.byteLength + 8);
  out.writeUInt32BE(payload.byteLength, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.byteLength + 4);
  return out;
}

/** Insert `tEXt` chunks before IEND. Throws rather than returning an unlabelled PNG. */
export function embedPngText(png: Buffer, entries: Readonly<Record<string, string>>): Buffer {
  const iend = png.lastIndexOf(Buffer.from("IEND", "latin1"));
  if (iend < 4) throw new Error("not a PNG: no IEND chunk found, refusing to write metadata into an unknown format");
  const head = png.subarray(0, iend - 4);
  const tail = png.subarray(iend - 4);
  const chunks = Object.entries(entries)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, value]) => Buffer.from(textChunk(key, value)));
  return Buffer.concat([head, ...chunks, tail]);
}

/** Read `tEXt` chunks back out — used by the tests and by anyone auditing a capture. */
export function readPngText(png: Buffer): Record<string, string> {
  const out: Record<string, string> = {};
  let offset = 8;
  while (offset + 8 <= png.byteLength) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("latin1", offset + 4, offset + 8);
    if (type === "tEXt") {
      const payload = png.toString("latin1", offset + 8, offset + 8 + length);
      const split = payload.indexOf("\0");
      if (split > 0) out[payload.slice(0, split)] = payload.slice(split + 1);
    }
    if (type === "IEND") break;
    offset += length + 12;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function drawHeadwear(ctx: DrawingContext, actor: SceneActor): void {
  ctx.strokeStyle = hex(PALETTE.glyph);
  ctx.lineWidth = 1;
  const r = actor.radius;
  const { x, y } = actor;
  ctx.beginPath();
  switch (actor.headwear) {
    case "band":
      ctx.moveTo(x - r, y - r * 0.4);
      ctx.lineTo(x + r, y - r * 0.4);
      break;
    case "hood":
      ctx.arc(x, y - r * 0.2, r * 0.7, Math.PI, 0);
      break;
    case "cap":
      ctx.moveTo(x - r * 0.8, y - r * 0.5);
      ctx.lineTo(x + r * 0.2, y - r * 0.9);
      break;
    case "horns":
      ctx.moveTo(x - r, y - r);
      ctx.lineTo(x - r * 0.4, y - r * 0.3);
      ctx.moveTo(x + r, y - r);
      ctx.lineTo(x + r * 0.4, y - r * 0.3);
      break;
    case "feather":
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.6, y - r * 1.6);
      break;
    case "crown":
      ctx.moveTo(x - r, y - r * 0.6);
      ctx.lineTo(x - r * 0.5, y - r * 1.2);
      ctx.lineTo(x, y - r * 0.6);
      ctx.lineTo(x + r * 0.5, y - r * 1.2);
      ctx.lineTo(x + r, y - r * 0.6);
      break;
    case "wrap":
      ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
      break;
    case "helm":
      ctx.moveTo(x - r * 0.8, y - r * 0.2);
      ctx.lineTo(x - r * 0.8, y - r);
      ctx.lineTo(x + r * 0.8, y - r);
      ctx.lineTo(x + r * 0.8, y - r * 0.2);
      break;
    case "braid":
      ctx.moveTo(x, y + r * 0.2);
      ctx.lineTo(x - r * 0.4, y + r);
      ctx.lineTo(x + r * 0.2, y + r * 1.4);
      break;
    default:
      break; // "none" draws nothing, on purpose: absence must be a visible option
  }
  ctx.stroke();
}

/** One icon, drawn into a box. Kept in its own function so the distinctness check can render each alone. */
export function drawActionIcon(ctx: DrawingContext, icon: ActionIcon, cx: number, cy: number, size: number): void {
  const s = size / 2;
  ctx.strokeStyle = hex(PALETTE.glyph);
  ctx.fillStyle = hex(PALETTE.glyph);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  switch (icon) {
    case "idle":
      ctx.arc(cx, cy, s * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "walk":
      ctx.moveTo(cx - s, cy + s * 0.6);
      ctx.lineTo(cx, cy - s * 0.6);
      ctx.lineTo(cx + s, cy + s * 0.6);
      ctx.stroke();
      break;
    case "carry":
      ctx.rect(cx - s * 0.7, cy - s * 0.2, s * 1.4, s * 0.9);
      ctx.stroke();
      break;
    case "gather":
      ctx.arc(cx, cy + s * 0.4, s * 0.8, Math.PI, 0);
      ctx.stroke();
      break;
    case "craft":
      ctx.moveTo(cx - s, cy - s);
      ctx.lineTo(cx + s, cy + s);
      ctx.moveTo(cx + s, cy - s);
      ctx.lineTo(cx - s, cy + s);
      ctx.stroke();
      break;
    case "build":
      ctx.rect(cx - s * 0.8, cy - s * 0.8, s * 1.6, s * 1.6);
      ctx.stroke();
      break;
    case "eat":
      ctx.arc(cx, cy, s * 0.8, 0.4, Math.PI * 2 - 0.4);
      ctx.stroke();
      break;
    case "drink":
      ctx.moveTo(cx - s * 0.6, cy - s * 0.8);
      ctx.lineTo(cx + s * 0.6, cy - s * 0.8);
      ctx.lineTo(cx, cy + s * 0.9);
      ctx.closePath();
      ctx.stroke();
      break;
    case "rest":
      ctx.moveTo(cx - s, cy + s * 0.5);
      ctx.lineTo(cx + s, cy + s * 0.5);
      ctx.moveTo(cx - s * 0.5, cy - s * 0.4);
      ctx.lineTo(cx + s * 0.5, cy - s * 0.4);
      ctx.stroke();
      break;
    case "attack":
      ctx.moveTo(cx - s, cy + s);
      ctx.lineTo(cx + s, cy - s);
      ctx.moveTo(cx + s * 0.3, cy - s);
      ctx.lineTo(cx + s, cy - s);
      ctx.lineTo(cx + s, cy - s * 0.3);
      ctx.stroke();
      break;
    case "flee":
      ctx.moveTo(cx + s, cy - s);
      ctx.lineTo(cx - s, cy + s);
      ctx.moveTo(cx - s, cy + s * 0.3);
      ctx.lineTo(cx - s, cy + s);
      ctx.lineTo(cx - s * 0.3, cy + s);
      ctx.stroke();
      break;
    case "talk":
      ctx.rect(cx - s * 0.9, cy - s * 0.8, s * 1.8, s * 1.1);
      ctx.moveTo(cx - s * 0.3, cy + s * 0.3);
      ctx.lineTo(cx - s * 0.6, cy + s);
      ctx.lineTo(cx + s * 0.1, cy + s * 0.3);
      ctx.stroke();
      break;
    default:
      break;
  }
}

/** Rasterize a scene. Deterministic: the same scene always produces the same buffer. */
export function drawScene(scene: Scene): Buffer {
  const canvas = createCanvas(scene.width, scene.height);
  const ctx = canvas.getContext("2d") as unknown as DrawingContext;

  ctx.fillStyle = hex(PALETTE.background);
  ctx.fillRect(0, 0, scene.width, scene.height);
  ctx.fillStyle = hex(PALETTE.terrainUnavailable);
  ctx.fillRect(24, 24, scene.width - 48, scene.height - 48);

  ctx.strokeStyle = hex(PALETTE.grid);
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i += 1) {
    const at = 24 + ((scene.width - 48) * i) / 8;
    ctx.beginPath();
    ctx.moveTo(at, 24);
    ctx.lineTo(at, scene.height - 24);
    ctx.moveTo(24, at);
    ctx.lineTo(scene.width - 24, at);
    ctx.stroke();
  }

  for (const law of scene.laws) {
    ctx.beginPath();
    ctx.arc(law.x, law.y, law.radius, 0, Math.PI * 2);
    ctx.fillStyle = hex(PALETTE.lawFill);
    ctx.fill();
    ctx.strokeStyle = hex(PALETTE.lawBoundary);
    ctx.lineWidth = law.installed ? 2 : 1;
    if (!law.installed) ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.font = "9px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const actor of scene.actors) {
    ctx.beginPath();
    ctx.arc(actor.x, actor.y, actor.radius, 0, Math.PI * 2);
    ctx.fillStyle = hex(PALETTE.discFill);
    ctx.fill();
    ctx.strokeStyle = actor.ringColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    drawHeadwear(ctx, actor);
    drawActionIcon(ctx, actor.action, actor.x + actor.radius * 2, actor.y - actor.radius, actor.radius * 1.6);

    if (actor.label !== "") {
      ctx.fillStyle = hex(PALETTE.nameplateShadow);
      ctx.fillText(actor.label, actor.x + 1, actor.nameplate.y + 1);
      ctx.fillStyle = hex(PALETTE.nameplate);
      ctx.fillText(actor.label, actor.x, actor.nameplate.y);
    }
  }

  return canvas.toBuffer("image/png");
}

/**
 * Render every action icon alone and compare pixels. Two icons that rasterize
 * identically are not distinguishable, whatever their names suggest.
 */
export function iconDistinctness(): { distinct: number; duplicates: string[]; digests: Record<string, string> } {
  const digests: Record<string, string> = {};
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const icon of ACTION_ICONS) {
    const canvas = createCanvas(24, 24);
    const ctx = canvas.getContext("2d") as unknown as DrawingContext;
    ctx.fillStyle = hex(PALETTE.discFill);
    ctx.fillRect(0, 0, 24, 24);
    drawActionIcon(ctx, icon, 12, 12, 16);
    const digest = createHash("sha256").update(canvas.toBuffer("raw")).digest("hex").slice(0, 16);
    digests[icon] = digest;
    const previous = seen.get(digest);
    if (previous === undefined) seen.set(digest, icon);
    else duplicates.push(`${previous} == ${icon}`);
  }
  return { distinct: seen.size, duplicates, digests };
}

export interface RenderMetadata {
  readonly fixture: string;
  readonly tick: number;
  readonly buildHash: string;
  readonly [key: string]: string | number;
}

/** Render a snapshot to a PNG carrying its own provenance. */
export function renderSnapshot(snapshot: WorldSnapshot, metadata: RenderMetadata, options?: Parameters<typeof buildScene>[1]): { png: Buffer; scene: Scene } {
  const scene = buildScene(snapshot, options);
  const png = drawScene(scene);
  return {
    scene,
    png: embedPngText(png, {
      Software: RENDERER_ID,
      Fixture: metadata.fixture,
      Tick: String(metadata.tick),
      BuildHash: metadata.buildHash,
      SceneVersion: String(scene.sceneVersion),
      Terrain: `${scene.terrain.status}: ${scene.terrain.availableFrom}`,
      Actors: String(scene.actors.length),
    }),
  };
}
