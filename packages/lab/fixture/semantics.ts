/**
 * Semantic validation beyond the envelope (W0-05; contracts/FIXTURE_DSL.md, Addendum D07).
 *
 * These are the rules JSON Schema cannot express: profile rosters, the 600-tick
 * notice for runtime laws, duplicate actors and sequences, law intervals,
 * region geometry, ordered match intervals, hash-variant range and known-fact
 * provenance. They run **before any world is constructed**.
 *
 * Checks that need a compiled content catalog (item, goal and profile-override
 * IDs) cannot run yet. They are reported as skipped checks with the packet that
 * will make them runnable — never silently passed.
 */
import { FIXTURE_LIMITS, fixtureError, MINIMUM_LAW_NOTICE_TICKS } from "./errors.js";
import type { FixtureError, FixtureSkippedCheck } from "./errors.js";
import type { Fixture, LawSpec } from "./envelope.js";

/** Contestant roster sizes a profile must declare (Addendum D07). */
export const PROFILE_CONTESTANT_COUNTS: Readonly<Record<string, number | null>> = {
  Fixture: null, // an explicitly declared subset of any size
  Prototype8: 8,
  Trial24: 24,
  Standard100: 100,
};

/** Reason IDs a fixture may name in `expectedReasonId` — the v0 registry from W0-04. */
export interface SemanticOptions {
  /** Known reason IDs; defaults to the contract registry when the caller passes none. */
  readonly knownReasonIds: ReadonlySet<string>;
  /** Present once a compiled catalog exists (content packets); absent means those checks are skipped. */
  readonly catalog?: {
    readonly itemIds: ReadonlySet<string>;
    readonly goalIds: ReadonlySet<string>;
    readonly profileOverrideIds: ReadonlySet<string>;
  };
}

export interface SemanticReport {
  readonly errors: readonly FixtureError[];
  readonly skipped: readonly FixtureSkippedCheck[];
}

const isContestant = (id: string): boolean => id.startsWith("C");

export function validateSemantics(fixture: Fixture, options: SemanticOptions): SemanticReport {
  const errors: FixtureError[] = [];
  const skipped: FixtureSkippedCheck[] = [];
  const add = (...e: FixtureError[]): void => {
    errors.push(...e);
  };

  // ---- profile -----------------------------------------------------------
  if (fixture.profile.writeCareer !== false) {
    add(fixtureError("CareerWriteForbidden", "/profile/writeCareer", "a fixture may never write a production career (FIXTURE_DSL.md, Addendum D07)"));
  }

  const contestants = fixture.setup.actors.filter((a) => isContestant(a.id));
  const required = PROFILE_CONTESTANT_COUNTS[fixture.profile.kind];
  if (required !== null && required !== undefined && fixture.profile.contestantCount !== required) {
    add(
      fixtureError(
        "ProfileCountMismatch",
        "/profile/contestantCount",
        `${fixture.profile.kind} requires exactly ${required} contestants, fixture declares ${fixture.profile.contestantCount}`,
      ),
    );
  }
  if (contestants.length !== fixture.profile.contestantCount) {
    add(
      fixtureError(
        "ProfileCountMismatch",
        "/setup/actors",
        `declared contestantCount ${fixture.profile.contestantCount} but setup declares ${contestants.length} contestants (wildlife Wxxx and guest G001 are excluded from the count)`,
      ),
    );
  }

  // ---- limits (tool limits; profile limits are stricter and checked above) ---
  if (fixture.setup.actors.length > FIXTURE_LIMITS.setupActors) {
    add(fixtureError("LimitExceeded", "/setup/actors", `at most ${FIXTURE_LIMITS.setupActors} setup actors`));
  }
  if (fixture.schedule.length > FIXTURE_LIMITS.scheduledCommands) {
    add(fixtureError("LimitExceeded", "/schedule", `at most ${FIXTURE_LIMITS.scheduledCommands} scheduled commands`));
  }
  if (fixture.assertions.length > FIXTURE_LIMITS.assertions) {
    add(fixtureError("LimitExceeded", "/assertions", `at most ${FIXTURE_LIMITS.assertions} assertions`));
  }

  // ---- actors ------------------------------------------------------------
  const actorIds = new Set<string>();
  fixture.setup.actors.forEach((actor, i) => {
    if (actorIds.has(actor.id)) {
      add(fixtureError("DuplicateActor", `/setup/actors/${i}/id`, `actor ${actor.id} is declared more than once`));
    }
    actorIds.add(actor.id);

    if (options.catalog === undefined) {
      if (Object.keys(actor.inventory).length > 0 || actor.profileOverride !== undefined || actor.initialGoal !== undefined) {
        skipped.push({
          code: "ContentCatalogUnavailable",
          path: `/setup/actors/${i}`,
          message: "item, goal and profile-override IDs cannot be checked before a compiled content catalog exists",
          availableFrom: "content packets (P1+)",
        });
      }
    } else {
      for (const itemId of Object.keys(actor.inventory)) {
        if (!options.catalog.itemIds.has(itemId)) {
          add(fixtureError("StructureInvalid", `/setup/actors/${i}/inventory/${itemId}`, `unknown item ID ${itemId}`));
        }
      }
      if (actor.initialGoal !== undefined && !options.catalog.goalIds.has(actor.initialGoal)) {
        add(fixtureError("StructureInvalid", `/setup/actors/${i}/initialGoal`, `unknown goal ID ${actor.initialGoal}`));
      }
      if (actor.profileOverride !== undefined && !options.catalog.profileOverrideIds.has(actor.profileOverride)) {
        add(fixtureError("StructureInvalid", `/setup/actors/${i}/profileOverride`, `unknown profile override ${actor.profileOverride}`));
      }
    }
  });

  // Known facts must refer to authored setup evidence, not to an actor that does
  // not exist — otherwise a fixture becomes a backdoor to production omniscience.
  fixture.setup.actors.forEach((actor, i) => {
    (actor.knownFacts ?? []).forEach((fact, j) => {
      const path = `/setup/actors/${i}/knownFacts/${j}`;
      if (/^(C[0-9]{3}|G001|W[0-9]{3})$/.test(fact.subject) && !actorIds.has(fact.subject)) {
        add(fixtureError("UnknownFactSubject", `${path}/subject`, `fact refers to actor ${fact.subject}, which the fixture does not declare`));
      }
      if (fact.source === "Report") {
        if (fact.sourceActor === undefined) {
          add(fixtureError("FactSourceInvalid", path, "a Report fact must name its sourceActor"));
        } else if (!actorIds.has(fact.sourceActor)) {
          add(fixtureError("UnknownFactSubject", `${path}/sourceActor`, `reporter ${fact.sourceActor} is not declared in this fixture`));
        }
      } else if (fact.sourceActor !== undefined) {
        add(fixtureError("FactSourceInvalid", `${path}/sourceActor`, `sourceActor is only meaningful for Report facts, not ${fact.source}`));
      }
      if (fact.source === "Self" && fact.subject !== actor.id) {
        add(fixtureError("FactSourceInvalid", `${path}/subject`, `a Self fact must be about ${actor.id}`));
      }
      if (fact.observedTick > 0) {
        add(fixtureError("StructureInvalid", `${path}/observedTick`, "setup facts are tick-zero state; observedTick must be 0"));
      }
    });
  });

  // ---- laws --------------------------------------------------------------
  const checkLaw = (law: LawSpec, path: string): void => {
    if (law.endTick <= law.startTick) {
      add(fixtureError("LawIntervalInvalid", `${path}/endTick`, `endTick ${law.endTick} must exceed startTick ${law.startTick}`));
    }
    // Deliberately NOT checked: "the law starts after maxTicks". FIXTURE_DSL.md
    // enumerates the semantic law checks (end exceeds start, region geometry),
    // and a rejection fixture such as LAW-NOTICE-REJECTION legitimately schedules
    // a law that never takes effect. An invented stricter rule would reject a
    // supplied example, so it was removed.
    const hasCentre = law.centerMm !== undefined;
    const hasRadius = law.radiusMm !== undefined;
    if (hasCentre !== hasRadius) {
      add(fixtureError("RegionGeometryInvalid", path, "a region law needs both centerMm and radiusMm"));
    }
  };
  fixture.setup.precommittedLaws.forEach((law, i) => {
    checkLaw(law, `/setup/precommittedLaws/${i}`);
  });

  // ---- schedule ----------------------------------------------------------
  const sequences = new Set<number>();
  fixture.schedule.forEach((entry, i) => {
    const path = `/schedule/${i}`;
    if (sequences.has(entry.sequence)) {
      add(fixtureError("DuplicateSequence", `${path}/sequence`, `sequence ${entry.sequence} is used more than once`));
    }
    sequences.add(entry.sequence);

    // Setup-only state versus validated player commands: tick zero is setup.
    // The envelope pins atTick >= 1 (as the supplied schema does), so this is a
    // guard for callers that build a fixture object without the envelope.
    if (entry.atTick < 1) {
      add(
        fixtureError(
          "SetupOnlyInSchedule",
          `${path}/atTick`,
          "tick 0 is setup state; an already-announced rule belongs in setup.precommittedLaws, not in the schedule (a schedule entry goes through the real validator at atTick >= 1)",
        ),
      );
    }
    if (entry.atTick > fixture.maxTicks) {
      add(fixtureError("StructureInvalid", `${path}/atTick`, `atTick ${entry.atTick} is beyond maxTicks ${fixture.maxTicks}`));
    }

    checkLaw(entry.payload, `${path}/payload`);

    // A runtime law needs 600 ticks of notice. A fixture may still submit one
    // with less — that is a legitimate rejection test — but it must then say it
    // expects a rejection, and name the reason.
    const notice = entry.payload.startTick - entry.atTick;
    if (notice < MINIMUM_LAW_NOTICE_TICKS && entry.expectAck === "Accepted") {
      add(
        fixtureError(
          "NoticeTooShort",
          `${path}/payload/startTick`,
          `a runtime law needs at least ${MINIMUM_LAW_NOTICE_TICKS} ticks of notice; this gives ${notice} and the fixture expects Accepted`,
        ),
      );
    }
    if (entry.expectAck === "Rejected") {
      if (entry.expectedReasonId === undefined) {
        add(fixtureError("ExpectedReasonMissing", path, "a fixture expecting a rejection must name the expected reason ID"));
      } else if (!options.knownReasonIds.has(entry.expectedReasonId)) {
        add(fixtureError("ExpectedReasonUnknown", `${path}/expectedReasonId`, `unknown reason ID ${entry.expectedReasonId}`));
      }
    } else if (entry.expectedReasonId !== undefined) {
      add(fixtureError("ExpectedReasonMissing", `${path}/expectedReasonId`, "expectedReasonId is only meaningful when a rejection is expected"));
    }
  });

  // ---- assertions --------------------------------------------------------
  fixture.assertions.forEach((assertion, i) => {
    const path = `/assertions/${i}`;
    if (assertion.kind === "EventCountGte" || assertion.kind === "EventCountEq") {
      const { fromTick, throughTick } = assertion.match;
      if (fromTick !== undefined && throughTick !== undefined && throughTick < fromTick) {
        add(fixtureError("MatchIntervalInvalid", `${path}/match`, `throughTick ${throughTick} is before fromTick ${fromTick}`));
      }
      if (fromTick !== undefined && fromTick > fixture.maxTicks) {
        add(fixtureError("MatchIntervalInvalid", `${path}/match/fromTick`, `fromTick ${fromTick} is beyond maxTicks ${fixture.maxTicks}`));
      }
      if (assertion.match.reasonId !== undefined && !options.knownReasonIds.has(assertion.match.reasonId)) {
        add(fixtureError("ExpectedReasonUnknown", `${path}/match/reasonId`, `unknown reason ID ${assertion.match.reasonId}`));
      }
    }
    if (assertion.kind === "HashEqualVariant") {
      if (assertion.startTick + assertion.advanceTicks > fixture.maxTicks) {
        add(
          fixtureError(
            "HashVariantOutOfRange",
            path,
            `startTick ${assertion.startTick} + advanceTicks ${assertion.advanceTicks} exceeds maxTicks ${fixture.maxTicks}`,
          ),
        );
      }
    }
  });

  return { errors, skipped };
}
