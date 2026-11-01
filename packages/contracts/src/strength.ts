import * as Schema from "effect/Schema";

import {
  IsoDate,
  IsoDateTime,
  LiftSetId,
  MovementId,
  TrimmedNonEmptyString,
} from "./baseSchemas.ts";
import { Place } from "./place.ts";

/** Grouping for pickers and, later, modality balance (weightlifting / gymnastics / mono). */
export const MovementCategory = Schema.Literals([
  "barbell",
  "dumbbell_kettlebell",
  "gymnastics",
  "monostructural",
  "other",
]);
export type MovementCategory = typeof MovementCategory.Type;

/** One entry in the movement catalog. Workouts, sets and scaling all point at these ids. */
export const Movement = Schema.Struct({
  id: MovementId,
  name: TrimmedNonEmptyString,
  category: MovementCategory,
}).annotate({ identifier: "Movement" });
export type Movement = typeof Movement.Type;

export const LiftReps = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 }));

/** Kilograms; every load is stored in kg and converted only for display. */
export const LoadKg = Schema.Finite.check(
  Schema.isGreaterThan(0),
  Schema.isLessThanOrEqualTo(1000),
);

/** One working set of a loaded movement: `reps` at `loadKg`. */
export const LiftSet = Schema.Struct({
  id: LiftSetId,
  movementId: MovementId,
  performedOn: IsoDate,
  reps: LiftReps,
  loadKg: LoadKg,
  notes: Schema.String,
  /** Where it was lifted: a session's place, or picked when logged by hand. */
  place: Place,
  createdAt: IsoDateTime,
}).annotate({ identifier: "LiftSet" });
export type LiftSet = typeof LiftSet.Type;

export const LogLiftSetInput = Schema.Struct({
  movementId: MovementId,
  performedOn: IsoDate,
  reps: LiftReps,
  loadKg: LoadKg,
  notes: Schema.String,
  /** Absent: the box. */
  place: Schema.optionalKey(Place),
});
export type LogLiftSetInput = typeof LogLiftSetInput.Type;

/** The rep maxes Chalk tracks per movement: 1RM, 2RM, 3RM, 5RM and 10RM. */
export const REP_MAX_TARGETS = [1, 2, 3, 5, 10] as const;

/**
 * Heaviest load lifted for at least `reps` reps. A set of 5 at 100 kg also proves a 3RM of at
 * least 100 kg, so `fromReps` says which set the record comes from.
 */
export const RepMax = Schema.Struct({
  reps: LiftReps,
  loadKg: LoadKg,
  fromReps: LiftReps,
  performedOn: IsoDate,
  liftSetId: LiftSetId,
}).annotate({ identifier: "RepMax" });
export type RepMax = typeof RepMax.Type;

/** Rep maxes of one movement, ascending by `reps`; a target with no qualifying set is absent. */
export const MovementRecords = Schema.Struct({
  movementId: MovementId,
  repMaxes: Schema.Array(RepMax),
}).annotate({ identifier: "MovementRecords" });
export type MovementRecords = typeof MovementRecords.Type;

export class MovementNotFoundError extends Schema.TaggedError<MovementNotFoundError>()(
  "MovementNotFoundError",
  { id: MovementId },
  { httpApiStatus: 404 },
) {
  override get message(): string {
    return `Movement ${this.id} is not in the catalog.`;
  }
}

export class LiftSetNotFoundError extends Schema.TaggedError<LiftSetNotFoundError>()(
  "LiftSetNotFoundError",
  { id: LiftSetId },
  { httpApiStatus: 404 },
) {
  override get message(): string {
    return `Lift set ${this.id} was not found.`;
  }
}

/** Server-side storage failed; the cause stays on the server. */
export class StrengthStorageError extends Schema.TaggedError<StrengthStorageError>()(
  "StrengthStorageError",
  { operation: Schema.String },
  { httpApiStatus: 500 },
) {
  override get message(): string {
    return `Could not ${this.operation}.`;
  }
}
