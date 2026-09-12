/**
 * Identifier shapes shared by every contract record (CONVENTIONS.md; TP v1.1 §12).
 *
 * Durable IDs are strings (C001–C100 contestants, G001 guest, Wxxx wildlife) and
 * appear in files and events. Runtime entity slots are integers and never leave
 * the simulation. A display name is never an identifier.
 */
import { int, str } from "./schema.js";
import type { Infer, Shape } from "./schema.js";
import type { Int } from "../primitives/index.js";

/** C001–C100, G001, W001–W999. */
export const ACTOR_ID_PATTERN = "^(C0(0[1-9]|[1-9][0-9])|C100|G001|W[0-9]{3})$";
export const DURABLE_ID_PATTERN = "^[A-Za-z][A-Za-z0-9_.:-]{0,63}$";
export const HEX32_PATTERN = "^[0-9a-f]{8}$";

export const actorId = (description = "Durable actor ID (C001–C100, G001, Wxxx)"): Shape<string> =>
  str({ pattern: ACTOR_ID_PATTERN, maxLength: 8, description });
/** Definition/catalog/run/branch identifiers: stable, never a display name. */
export const durableId = (description: string): Shape<string> => str({ pattern: DURABLE_ID_PATTERN, maxLength: 64, description });
/** A 32-bit canonical hash rendered as eight lowercase hex characters. */
export const hash32 = (description: string): Shape<string> => str({ pattern: HEX32_PATTERN, maxLength: 8, description });
/** Entity slot: a runtime integer, stable within a run. */
export const entityId = (description = "Runtime entity slot"): Shape<Int> => int({ min: 0, description });
/** Simulation tick at 10 Hz. */
export const tick = (description = "Simulation tick (10 Hz)"): Shape<Int> => int({ min: 0, description });
/** A monotonically increasing sequence number. */
export const sequence = (description: string): Shape<Int> => int({ min: 0, description });
/** A rules/law/content version counter. */
export const version = (description: string): Shape<Int> => int({ min: 0, description });
/** Thousandths of a displayed unit (vitals, rates, probabilities). */
export const milli = (description: string): Shape<Int> => int({ description });
/** Millimetres. */
export const mm = (description: string): Shape<Int> => int({ description });

/** Tick stages 1–10 of the tick transaction (TP v1.1 §4). */
export const TICK_STAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const tickStage = (): Shape<Int> => int({ min: 1, max: 10, description: "Tick transaction stage 1–10 (TP v1.1 §4)" });

export type ActorId = Infer<ReturnType<typeof actorId>>;
export type DurableId = Infer<ReturnType<typeof durableId>>;
