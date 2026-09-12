/** The readability renderer (W0-09): pure scene, deterministic raster, `clanlab render`. */
export * from "./scene.js";
export { drawActionIcon, drawScene, embedPngText, iconDistinctness, readPngText, renderSnapshot, RENDERER_ID, toLatin1 } from "./draw.js";
export type { DrawingContext, RenderMetadata } from "./draw.js";
export { renderFixture } from "./command.js";
export type { RenderOptions, RenderSummary } from "./command.js";
