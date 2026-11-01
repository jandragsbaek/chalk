import * as Schema from "effect/Schema";

import {
  BenchmarkId,
  IsoDate,
  IsoDateTime,
  TrimmedNonEmptyString,
  WorkoutId,
} from "./baseSchemas.ts";
import { KnownBenchmarkId } from "./benchmarks/index.ts";
import { Coaching } from "./coaching.ts";

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
  /** The named workout the session is (or its first part, for an imported session). */
  benchmarkId: Schema.optionalKey(BenchmarkId),
  /** Who coached it, or that it was done alone; absent when not recorded. */
  coaching: Schema.optionalKey(Coaching),
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
  /** Logs the benchmark: the session gets its blocks and movements, and the score counts. */
  benchmarkId: Schema.optionalKey(KnownBenchmarkId),
  coaching: Schema.optionalKey(Coaching),
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

/** One attempt at a benchmark: a logged workout, or a part of an imported session. */
export const BenchmarkResult = Schema.Struct({
  benchmarkId: BenchmarkId,
  workoutId: WorkoutId,
  performedOn: IsoDate,
  /** As written: "4:32", "18+7"; empty when the session has none. */
  score: Schema.String,
  /** Rx or scaled as logged; `null` for an imported session, where it is not recorded. */
  rx: Schema.NullOr(Schema.Boolean),
  imported: Schema.Boolean,
}).annotate({ identifier: "BenchmarkResult" });
export type BenchmarkResult = typeof BenchmarkResult.Type;
