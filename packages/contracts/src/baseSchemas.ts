import * as Schema from "effect/Schema";

export const TrimmedNonEmptyString = Schema.String.check(Schema.isTrimmed(), Schema.isNonEmpty());

const makeEntityId = <Brand extends string>(brand: Parameters<typeof Schema.brand<Brand>>[0]) =>
  TrimmedNonEmptyString.pipe(Schema.brand<Brand>(brand));

export const WorkoutId = makeEntityId("WorkoutId");
export type WorkoutId = typeof WorkoutId.Type;

/** Calendar day in the athlete's local time, e.g. "2026-10-29". */
export const IsoDate = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/));
export type IsoDate = typeof IsoDate.Type;

export const IsoDateTime = Schema.String;
export type IsoDateTime = typeof IsoDateTime.Type;
