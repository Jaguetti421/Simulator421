/**
 * Player commands and acknowledgements (contracts/INTERFACES.md; TP v2.0 §3).
 *
 * The player's only write path into the simulation. The main thread posts a
 * `PlayerCommand` to the Worker; the Worker answers exactly one `CommandAck`
 * per client sequence number.
 *
 * The **operation payload is deliberately an extension point at v0**: the
 * envelope (sequence, run, expected rules version, operation ID, notice,
 * influence) is frozen here, while each concrete operation's payload schema is
 * frozen by the packet that implements that operation (laws in P2, and so on).
 * Inventing law payload fields now would be design work this packet does not
 * own; `payload.kind` + `payload.version` make the later freeze additive.
 */
import { durableId, milli, sequence, tick, version } from "./ids.js";
import { reasonId } from "./reasons.js";
import { arr, enumOf, int, obj, opt, refine, str } from "./schema.js";
import type { Infer } from "./schema.js";

export const CONTRACT_SCHEMA_VERSION = 0;

/** Schema version field: v0 records carry 0. Decoders reject anything else. */
const schemaVersion = () => int({ min: 0, max: 0, description: "Contract schema version (0 = design version 0)" });

/** An operation-specific payload. Concrete field schemas are frozen per operation later. */
export const OperationPayloadShape = obj("OperationPayload", {
  kind: durableId("Payload kind, unique per operation and version"),
  version: version("Payload schema version"),
  fields: obj("OperationPayloadFields", {}, { description: "Frozen per operation by the packet that implements it; empty at v0" }),
});
export type OperationPayload = Infer<typeof OperationPayloadShape>;

export const PlayerCommandShape = obj(
  "PlayerCommand",
  {
    schemaVersion: schemaVersion(),
    runId: durableId("Run this command belongs to"),
    clientSequence: sequence("Client-assigned, strictly increasing per run"),
    issuedAtTick: tick("Tick the client believed current when issuing"),
    expectedRulesVersion: version("Rules version the client believed current"),
    operation: durableId("Operation ID, e.g. law.propose"),
    payload: OperationPayloadShape,
    /** Present for operations that announce something ahead of time. */
    requestedEffectiveTick: opt(tick("Tick the player wants the effect to begin")),
    /** Present for operations that cost Influence. */
    influenceCostMilli: opt(milli("Influence the client expects to spend, in thousandths")),
  },
  {
    refinements: [
      refine("requestedEffectiveTick, when present, is not before issuedAtTick", (v) => {
        const eff = v["requestedEffectiveTick"];
        return eff === undefined || (typeof eff === "number" && typeof v["issuedAtTick"] === "number" && eff >= (v["issuedAtTick"] as number));
      }),
    ],
    description: "A player write request. The journal assigns the execution tick; the client never does.",
  },
);
export type PlayerCommand = Infer<typeof PlayerCommandShape>;

/**
 * Exactly one ack per command. The refinements are the "no false successful UI
 * state" rule from INTERFACES.md made mechanical: an accepted ack must carry
 * the assigned tick and no reason, a rejected ack must carry a reason and no
 * assigned tick.
 */
export const CommandAckShape = obj(
  "CommandAck",
  {
    schemaVersion: schemaVersion(),
    runId: durableId("Run this ack belongs to"),
    clientSequence: sequence("The sequence number being answered"),
    status: enumOf(["Accepted", "Rejected"] as const, "Outcome of admission control"),
    assignedTick: opt(tick("Tick at which an accepted command executes")),
    reasonId: opt(reasonId("Why a rejected command was refused")),
    reasonDetail: opt(
      obj("ReasonDetail", { fields: arr(obj("ReasonField", { name: str({ maxLength: 64 }), value: str({ maxLength: 256 }) }), { maxItems: 32 }) }),
    ),
    resultingRulesVersion: version("Rules version in force after admission control"),
  },
  {
    refinements: [
      refine("Accepted acks carry assignedTick and no reasonId", (v) => v["status"] !== "Accepted" || (v["assignedTick"] !== undefined && v["reasonId"] === undefined)),
      refine("Rejected acks carry reasonId and no assignedTick", (v) => v["status"] !== "Rejected" || (v["reasonId"] !== undefined && v["assignedTick"] === undefined)),
    ],
    description: "The only truthful answer to a command; a UI that shows success without one is a defect.",
  },
);
export type CommandAck = Infer<typeof CommandAckShape>;

/** A command as recorded in the journal: the command plus the tick the simulation assigned it. */
export const JournaledCommandShape = obj("JournaledCommand", {
  schemaVersion: schemaVersion(),
  command: PlayerCommandShape,
  assignedTick: tick("Execution tick assigned by the simulation"),
  journalSequence: sequence("Position in the append-only journal"),
});
export type JournaledCommand = Infer<typeof JournaledCommandShape>;
