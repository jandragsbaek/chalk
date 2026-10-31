import * as Schema from "effect/Schema";

import { IsoDate, IsoDateTime, TrimmedNonEmptyString, WorkoutId } from "./baseSchemas.ts";

export const WorkoutKind = Schema.Literals(["for_time", "amrap", "emom", "strength", "other"]);
export type WorkoutKind = typeof WorkoutKind.Type;

export const Workout = Schema.Struct({
  id: WorkoutId,
  performedOn: IsoDate,
  name: TrimmedNonEmptyString,
  kind: WorkoutKind,
  /** Free-form so every format fits: "4:32", "12+5", "225 lb". Empty for imported sessions without one. */
  score: Schema.String,
  rx: Schema.Boolean,
  notes: Schema.String,
  createdAt: IsoDateTime,
}).annotate({ identifier: "Workout" });
export type Workout = typeof Workout.Type;

export const LogWorkoutInput = Schema.Struct({
  performedOn: IsoDate,
  name: TrimmedNonEmptyString,
  kind: WorkoutKind,
  score: TrimmedNonEmptyString,
  rx: Schema.Boolean,
  notes: Schema.String,
});
export type LogWorkoutInput = typeof LogWorkoutInput.Type;

export class WorkoutNotFoundError extends Schema.TaggedError<WorkoutNotFoundError>()(
  "WorkoutNotFoundError",
  { id: WorkoutId },
  { httpApiStatus: 404 },
) {
  override get message(): string {
    return `Workout ${this.id} was not found.`;
  }
}

/** Server-side storage failed; the cause stays on the server. */
export class WorkoutStorageError extends Schema.TaggedError<WorkoutStorageError>()(
  "WorkoutStorageError",
  { operation: Schema.String },
  { httpApiStatus: 500 },
) {
  override get message(): string {
    return `Could not ${this.operation}.`;
  }
}
