import { describe, expect, it } from "vitest";
import type { Int } from "../primitives/index.js";
import { checkPlacement, claimSocket, PROTOTYPE_SOCKETS, SALVAGE_RETURN_MILLI, salvage, stepBuild, totalItems } from "./construction.js";
import type { BuildSite, SocketDefinition } from "./construction.js";
import { ReservationBook } from "./reservation.js";

/** P1-20. */
const T = (n: number): Int => n as Int;
const firepit = PROTOTYPE_SOCKETS[0] as SocketDefinition;
const shelter = PROTOTYPE_SOCKETS[1] as SocketDefinition;

function build(definition: SocketDefinition, ticks: number, builderId = "C003"): BuildSite {
  const book = new ReservationBook();
  const claim = claimSocket(definition, "site.1", builderId, book, T(0));
  if (claim.kind !== "Building") throw new Error("expected a claim");
  let site = claim.site;
  for (let tick = 0; tick < ticks; tick += 1) {
    const step = stepBuild(site, definition, builderId, T(tick));
    if (step.kind === "Refused") throw new Error(step.detail);
    site = step.site;
    if (step.kind === "Finished") break;
  }
  return site;
}

describe("half-progress consumption and salvage conserve inputs (criterion 1)", () => {
  it("consumes a milestone's inputs as it is reached, not all at the start", () => {
    const early = build(firepit, 10);
    expect(early.consumed).toEqual({});
    expect(early.milestonesPassed).toBe(0);

    const past33 = build(firepit, 42);
    expect(past33.consumed).toEqual({ "item.stone": 2 });
    expect(past33.milestonesPassed).toBe(1);
  });

  it("has consumed everything by the time it finishes", () => {
    const done = build(firepit, 130);
    expect(done.finished).toBe(true);
    expect(done.consumed).toEqual({ "item.stone": 4, "item.branch": 3 });
    expect(done.milestonesPassed).toBe(firepit.milestones.length);
  });

  it("returns half and destroys half when a build is abandoned, losing nothing unaccounted", () => {
    const book = new ReservationBook();
    const claim = claimSocket(firepit, "site.1", "C003", book, T(0));
    if (claim.kind !== "Building") throw new Error("expected a claim");
    let site = claim.site;
    for (let tick = 0; tick < 85; tick += 1) {
      const step = stepBuild(site, firepit, "C003", T(tick));
      if (step.kind === "Refused") throw new Error(step.detail);
      site = step.site;
    }
    expect(site.consumed).toEqual({ "item.stone": 4 });

    const result = salvage(site, firepit, book, T(90));
    expect(totalItems(result.returned) + totalItems(result.lost)).toBe(totalItems(site.consumed));
    expect(result.returned).toEqual({ "item.stone": 2 });
    expect(result.lost).toEqual({ "item.stone": 2 });
    expect(SALVAGE_RETURN_MILLI).toBe(500);
  });

  it("conserves inputs across every abandonment point of a build", () => {
    for (const ticks of [1, 20, 45, 80, 119]) {
      const book = new ReservationBook();
      const claim = claimSocket(shelter, `site.${ticks}`, "C003", book, T(0));
      if (claim.kind !== "Building") throw new Error("expected a claim");
      let site = claim.site;
      for (let tick = 0; tick < ticks; tick += 1) {
        const step = stepBuild(site, shelter, "C003", T(tick));
        if (step.kind === "Refused") throw new Error(step.detail);
        site = step.site;
      }
      const result = salvage(site, shelter, book, T(ticks));
      expect(totalItems(result.returned) + totalItems(result.lost), `abandoned at ${ticks}`).toBe(totalItems(site.consumed));
    }
  });

  it("releases the socket when a build is abandoned, so someone else may try", () => {
    const book = new ReservationBook();
    const claim = claimSocket(firepit, "site.1", "C003", book, T(0));
    if (claim.kind !== "Building") throw new Error("expected a claim");
    salvage(claim.site, firepit, book, T(10));
    expect(book.holderOf(firepit.reservationKey)).toBeUndefined();
    expect(claimSocket(firepit, "site.2", "C009", book, T(11)).kind).toBe("Building");
  });

  it("passes a milestone once, not on every later tick", () => {
    const site = build(firepit, 130);
    expect(site.consumed["item.stone"]).toBe(4);
    expect(site.milestonesPassed).toBe(3);
  });
});

describe("two actors cannot claim the same socket (criterion 2)", () => {
  it("refuses the second claimant before any input is spent", () => {
    const book = new ReservationBook();
    expect(claimSocket(firepit, "site.1", "C003", book, T(0)).kind).toBe("Building");
    const second = claimSocket(firepit, "site.2", "C009", book, T(0));
    expect(second.kind).toBe("Refused");
    if (second.kind !== "Refused") return;
    expect(second.reason).toBe("SocketTaken");
    expect(second.detail).toContain("C003");
  });

  it("refuses a non-builder trying to advance someone else's site", () => {
    const book = new ReservationBook();
    const claim = claimSocket(firepit, "site.1", "C003", book, T(0));
    if (claim.kind !== "Building") throw new Error("expected a claim");
    const stolen = stepBuild(claim.site, firepit, "C009", T(5));
    expect(stolen.kind).toBe("Refused");
    if (stolen.kind !== "Refused") return;
    expect(stolen.reason).toBe("NotTheBuilder");
  });

  it("lets a different socket be claimed at the same time", () => {
    const book = new ReservationBook();
    expect(claimSocket(firepit, "site.1", "C003", book, T(0)).kind).toBe("Building");
    expect(claimSocket(shelter, "site.2", "C009", book, T(0)).kind).toBe("Building");
  });
});

describe("filling sockets preserves the required routes and exits (criterion 3)", () => {
  const routes = [
    { label: "the path to water", cells: [[10, 10], [11, 10], [12, 10]] as const },
    { label: "the camp exit", cells: [[10, 12], [10, 13]] as const },
  ];

  it("accepts a placement clear of every required route", () => {
    const result = checkPlacement(shelter, [20, 20], routes);
    for (const finding of result.findings) expect(finding.ok, finding.rule).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("refuses a placement that blocks the path to water, naming the route", () => {
    const result = checkPlacement(shelter, [11, 10], routes);
    expect(result.ok).toBe(false);
    const blocked = result.findings.find((f) => f.rule.includes("path to water"));
    expect(blocked?.ok).toBe(false);
    expect(blocked?.detail).toContain("blocks");
  });

  it("refuses a placement that seals the camp exit", () => {
    const result = checkPlacement(shelter, [10, 12], routes);
    expect(result.findings.find((f) => f.rule.includes("camp exit"))?.ok).toBe(false);
  });

  it("checks the whole footprint, not only its origin", () => {
    // The shelter is 2x2; its origin is clear but a far corner lands on the route.
    const result = checkPlacement(shelter, [9, 9], routes);
    expect(result.findings.find((f) => f.rule.includes("path to water"))?.ok).toBe(false);
  });

  it("ships prototype sockets whose milestones and footprints are well formed", () => {
    for (const socket of PROTOTYPE_SOCKETS) {
      expect(socket.footprintCells.length).toBeGreaterThan(0);
      expect(socket.milestones.length).toBeGreaterThan(0);
      const points = socket.milestones.map((m) => m.atProgressMilli);
      expect(points).toEqual([...points].sort((a, b) => a - b));
      expect(points.at(-1)).toBe(100_000);
      for (const milestone of socket.milestones) {
        for (const count of Object.values(milestone.consumes)) expect(Number.isInteger(count) && count > 0).toBe(true);
      }
    }
  });
});
