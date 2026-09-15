import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { LEASE_TICKS, ReservationBook } from "./reservation.js";

/** P1-08. */
const T = (n: number): Int => n as Int;

describe("one scarce item is granted once (criterion 1)", () => {
  it("grants to the first asker and tells the loser who holds it and until when", () => {
    const book = new ReservationBook();
    expect(book.grant("stack.flint.01", "ItemStack", "C003", T(10)).ok).toBe(true);

    const loser = book.grant("stack.flint.01", "ItemStack", "C009", T(10));
    expect(loser.ok).toBe(false);
    if (loser.ok) return;
    expect(loser.reason).toBe("AlreadyReserved");
    expect(loser.heldBy).toBe("C003");
    expect(loser.detail).toContain("until tick 60");
  });

  it("lets the holder re-grant its own lease without losing it", () => {
    const book = new ReservationBook();
    book.grant("station.bench", "Station", "C003", T(10));
    expect(book.grant("station.bench", "Station", "C003", T(12)).ok).toBe(true);
    expect(book.holderOf("station.bench")).toBe("C003");
  });

  it("hands the key to the next asker only once it is released", () => {
    const book = new ReservationBook();
    book.grant("station.bench", "Station", "C003", T(10));
    expect(book.grant("station.bench", "Station", "C009", T(11)).ok).toBe(false);
    book.complete("station.bench", "C003", T(20));
    expect(book.grant("station.bench", "Station", "C009", T(21)).ok).toBe(true);
  });

  it("refuses a grant on a target that no longer exists", () => {
    const book = new ReservationBook();
    book.invalidateTarget("stack.flint.01", T(5));
    const result = book.grant("stack.flint.01", "ItemStack", "C003", T(10));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("TargetInvalidated");
  });
});

describe("fifty-tick leases renew only with progress (criterion 2)", () => {
  it("runs for fifty ticks and expires on its own", () => {
    const book = new ReservationBook();
    book.grant("station.bench", "Station", "C003", T(100));
    expect(book.remainingTicks("station.bench", T(100))).toBe(LEASE_TICKS);
    expect(book.advance(T(149))).toEqual([]);
    const expired = book.advance(T(150));
    expect(expired).toHaveLength(1);
    expect(expired[0]?.cause).toBe("Expired");
    expect(book.holderOf("station.bench")).toBeUndefined();
  });

  it("extends the lease when progress has actually been made", () => {
    const book = new ReservationBook();
    book.grant("station.bench", "Station", "C003", T(100));
    const renewed = book.renew("station.bench", "C003", T(20_000), T(140));
    expect(renewed.ok).toBe(true);
    if (!renewed.ok) return;
    expect(renewed.lease.expiresAtTick).toBe(190);
    expect(renewed.lease.renewals).toBe(1);
  });

  it("releases the lease when a renewal shows no progress, rather than refusing quietly", () => {
    const book = new ReservationBook();
    book.grant("station.bench", "Station", "C003", T(100));
    book.renew("station.bench", "C003", T(20_000), T(120));
    const stalled = book.renew("station.bench", "C003", T(20_000), T(140));
    expect(stalled.ok).toBe(false);
    if (stalled.ok) return;
    expect(stalled.reason).toBe("NoProgress");
    expect(stalled.released?.cause).toBe("NoProgress");
    // And the key is free for someone who will use it.
    expect(book.grant("station.bench", "Station", "C009", T(141)).ok).toBe(true);
  });

  it("cannot be renewed forever by an actor achieving nothing", () => {
    const book = new ReservationBook();
    book.grant("station.bench", "Station", "C003", T(0));
    let held = true;
    for (let tick = 10; tick <= 200 && held; tick += 10) {
      held = book.renew("station.bench", "C003", T(5_000), T(tick)).ok;
    }
    expect(held).toBe(false);
    expect(book.holderOf("station.bench")).not.toBe("C003");
  });

  it("refuses a renewal from anyone but the holder", () => {
    const book = new ReservationBook();
    book.grant("station.bench", "Station", "C003", T(100));
    const other = book.renew("station.bench", "C009", T(50_000), T(110));
    expect(other.ok).toBe(false);
    if (other.ok) return;
    expect(other.reason).toBe("NotTheHolder");
    expect(book.holderOf("station.bench")).toBe("C003");
  });
});

describe("every exit path releases every handle (criterion 3)", () => {
  function withThree(): ReservationBook {
    const book = new ReservationBook();
    book.grant("station.bench", "Station", "C003", T(10));
    book.grant("stack.flint.01", "ItemStack", "C003", T(10));
    book.grant("work.position.7", "WorkPosition", "C003", T(10));
    book.grant("station.fire", "Station", "C009", T(10));
    return book;
  }

  it("releases everything an actor held when it dies", () => {
    const book = withThree();
    const released = book.releaseAllHeldBy("C003", "Death", T(40));
    expect(released.map((r) => r.key).sort()).toEqual(["stack.flint.01", "station.bench", "work.position.7"]);
    expect(released.every((r) => r.cause === "Death")).toBe(true);
    expect(book.heldBy("C003")).toEqual([]);
    // Another actor's lease is untouched.
    expect(book.holderOf("station.fire")).toBe("C009");
  });

  it("releases everything on departure and on cancellation the same way", () => {
    for (const cause of ["Departure", "Cancelled"] as const) {
      const book = withThree();
      expect(book.releaseAllHeldBy("C003", cause, T(40))).toHaveLength(3);
      expect(book.heldBy("C003")).toEqual([]);
    }
  });

  it("releases the lease when the target itself is invalidated", () => {
    const book = withThree();
    const release = book.invalidateTarget("stack.flint.01", T(30));
    expect(release?.cause).toBe("TargetInvalidated");
    expect(book.holderOf("stack.flint.01")).toBeUndefined();
    expect(book.isInvalidated("stack.flint.01")).toBe(true);
    // The rest of the actor's handles are unaffected.
    expect(book.heldBy("C003").map((l) => l.key)).toEqual(["station.bench", "work.position.7"]);
  });

  it("records every release with its cause, so no handle disappears unexplained", () => {
    const book = withThree();
    book.complete("station.bench", "C003", T(20));
    book.cancel("work.position.7", "C003", T(25));
    book.invalidateTarget("stack.flint.01", T(30));
    book.advance(T(100));
    expect(book.releases.map((r) => r.cause)).toEqual(["Completed", "Cancelled", "TargetInvalidated", "Expired"]);
    expect(book.heldBy("C003")).toEqual([]);
    expect(book.heldBy("C009")).toEqual([]);
  });

  it("leaves nothing behind after every actor exits by a different route", () => {
    const book = withThree();
    book.releaseAllHeldBy("C003", "Death", T(40));
    book.releaseAllHeldBy("C009", "Departure", T(41));
    expect(book.holderOf("station.fire")).toBeUndefined();
    expect(book.releases).toHaveLength(4);
  });
});
