/**
 * Law timeline and player command UI (P1-30; TP v1.1 §3, §10, §14; TIME 01).
 *
 * Three ways a view can lie to a player, and the three rules that stop it:
 *
 *   - **A rejected law must never appear active.** The view shows the state the
 *     core **acknowledged**, not the state the player asked for. Optimistic
 *     display is the standing temptation here — the law looks installed the
 *     instant it is clicked, and then the truce that was never real is the one
 *     the player planned around.
 *   - **A paused command stays visibly pending.** Submitting into a paused
 *     simulation is legitimate and the command really is queued; showing it as
 *     done, or dropping it from the list, both produce a player who does not
 *     know what will happen when they resume.
 *   - **The delivered speed is shown, not the requested one.** If 4× is not
 *     sustainable the display says what is actually being delivered. A speed
 *     control that reads 4× while the world runs at 1.7× is a lie about the
 *     thing the player is most likely to blame for everything else.
 */
import type { Int } from "@lastclan/sim";

export type CommandStatus = "Pending" | "PendingPaused" | "Accepted" | "Rejected";

export interface CommandRow {
  readonly sequence: number;
  readonly label: string;
  readonly submittedAtTick: Int;
  readonly status: CommandStatus;
  /** Present on Rejected: the reason from the frozen registry. */
  readonly reasonId?: string;
  /** Present on Accepted: the tick the core acknowledged it. */
  readonly acknowledgedAtTick?: Int;
}

export type LawDisplayState = "Scheduled" | "Active" | "Ended" | "Rejected";

export interface LawRow {
  readonly lawId: string;
  readonly version: number;
  readonly label: string;
  readonly activationTick: Int;
  readonly endTick: Int;
  readonly state: LawDisplayState;
  /** Present on Rejected: why the core refused it. */
  readonly reasonId?: string;
}

/**
 * Build the law timeline from **acknowledged** laws only.
 *
 * `acknowledgedLaws` is what the core has confirmed; `rejected` is what it
 * refused. A law the player submitted and the core has not answered yet appears
 * in neither — it is a pending *command*, and it belongs in the command list
 * until the core says otherwise.
 */
export function buildLawTimeline(
  acknowledgedLaws: readonly { readonly lawId: string; readonly version: number; readonly label: string; readonly activationTick: Int; readonly endTick: Int }[],
  rejected: readonly { readonly lawId: string; readonly version: number; readonly label: string; readonly activationTick: Int; readonly endTick: Int; readonly reasonId: string }[],
  tick: Int,
): readonly LawRow[] {
  const live: LawRow[] = acknowledgedLaws.map((law) => ({
    ...law,
    state: tick < law.activationTick ? "Scheduled" : tick < law.endTick ? "Active" : "Ended",
  }));

  // Rejected laws are listed so the player can see what did not happen, and are
  // never given a live state however plausible their interval looks.
  const refused: LawRow[] = rejected.map((law) => ({ ...law, state: "Rejected" }));

  return [...live, ...refused].sort((a, b) =>
    a.activationTick !== b.activationTick ? (a.activationTick as number) - (b.activationTick as number) : a.lawId < b.lawId ? -1 : 1,
  );
}

/** Is this row one a player could act on as though it were in force? */
export function isDisplayedAsInForce(row: LawRow): boolean {
  return row.state === "Active";
}

/**
 * Command rows from what was submitted and what the core has answered.
 *
 * A command with no acknowledgement is `Pending`, or `PendingPaused` while the
 * simulation is paused — never absent, and never shown as accepted.
 */
export function buildCommandList(
  submitted: readonly { readonly sequence: number; readonly label: string; readonly submittedAtTick: Int }[],
  acknowledgements: readonly { readonly sequence: number; readonly accepted: boolean; readonly tick: Int; readonly reasonId?: string }[],
  paused: boolean,
): readonly CommandRow[] {
  const bySequence = new Map(acknowledgements.map((ack) => [ack.sequence, ack]));
  return [...submitted]
    .sort((a, b) => a.sequence - b.sequence)
    .map((command) => {
      const ack = bySequence.get(command.sequence);
      if (ack === undefined) {
        return { ...command, status: paused ? ("PendingPaused" as const) : ("Pending" as const) };
      }
      return ack.accepted
        ? { ...command, status: "Accepted" as const, acknowledgedAtTick: ack.tick }
        : { ...command, status: "Rejected" as const, ...(ack.reasonId === undefined ? {} : { reasonId: ack.reasonId }) };
    });
}

/** Commands the player is still waiting on — the ones a pause must keep visible. */
export function pendingCommands(rows: readonly CommandRow[]): readonly CommandRow[] {
  return rows.filter((row) => row.status === "Pending" || row.status === "PendingPaused");
}

// ---------------------------------------------------------------------------
// Speed
// ---------------------------------------------------------------------------

export interface SpeedReading {
  /** What the player asked for, in thousandths (1000 = 1x). */
  readonly requestedMilli: number;
  /** What is actually being delivered, measured from committed ticks. */
  readonly deliveredMilli: number;
  /** True when the two differ enough to be worth saying. */
  readonly throttled: boolean;
  readonly label: string;
}

/** Below this fraction of the request, the display stops claiming the request. TUNE. */
export const THROTTLE_NOTICE_MILLI = 900;

/**
 * Report speed honestly.
 *
 * `deliveredMilli` comes from counting committed ticks against elapsed real
 * time — a measurement, not the setting echoed back. When delivery falls short
 * the label shows both numbers, because the player needs to know the world is
 * slow **and** that the game knows it.
 */
export function readSpeed(requestedMilli: number, ticksCommitted: number, elapsedMs: number, tickHz = 10): SpeedReading {
  const expectedTicks = Math.max(1, Math.trunc((elapsedMs * tickHz) / 1_000));
  const deliveredMilli = Math.max(0, Math.trunc((ticksCommitted * 1_000) / expectedTicks));
  const throttled = deliveredMilli * 1_000 < requestedMilli * THROTTLE_NOTICE_MILLI;
  const format = (milli: number): string => `${(milli / 1_000).toFixed(milli % 1_000 === 0 ? 0 : 1)}x`;
  return {
    requestedMilli,
    deliveredMilli,
    throttled,
    label: throttled ? `${format(deliveredMilli)} (requested ${format(requestedMilli)})` : format(requestedMilli),
  };
}

/** A paused world delivers nothing, and says so rather than reporting 0x of a request. */
export function pausedSpeedReading(requestedMilli: number): SpeedReading {
  return { requestedMilli, deliveredMilli: 0, throttled: false, label: "paused" };
}
