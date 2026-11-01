import * as Schema from "effect/Schema";

export const TrimmedNonEmptyString = Schema.String.check(Schema.isTrimmed(), Schema.isNonEmpty());

const makeEntityId = <Brand extends string>(brand: Parameters<typeof Schema.brand<Brand>>[0]) =>
  TrimmedNonEmptyString.pipe(Schema.brand<Brand>(brand));

export const WorkoutId = makeEntityId("WorkoutId");
export type WorkoutId = typeof WorkoutId.Type;

/** A planned session: a posted workout entered before it is done. */
export const PlanId = makeEntityId("PlanId");
export type PlanId = typeof PlanId.Type;

/** Stable slug from the movement catalog, e.g. "back-squat". */
export const MovementId = makeEntityId("MovementId");
export type MovementId = typeof MovementId.Type;

export const LiftSetId = makeEntityId("LiftSetId");
export type LiftSetId = typeof LiftSetId.Type;

/** Calendar day in the athlete's local time, e.g. "2026-10-29". */
export const IsoDate = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/));
export type IsoDate = typeof IsoDate.Type;

export const IsoDateTime = Schema.String;
export type IsoDateTime = typeof IsoDateTime.Type;

/** Slug of a named workout, e.g. "fran", "mr-joshua". */
export const BenchmarkId = makeEntityId("BenchmarkId");
export type BenchmarkId = typeof BenchmarkId.Type;
