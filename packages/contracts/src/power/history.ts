import * as Schema from "effect/Schema";

import { BenchmarkId, IsoDate, TrimmedNonEmptyString, WorkoutId } from "../baseSchemas.ts";
import { ImportDocument } from "../sessionImport.ts";

/**
 * A saved session as the power page reads it: an import's stored document, or a benchmark logged
 * as prescribed with its score. The client estimates work with its profile, like levels grading.
 */
export const PowerSession = Schema.TaggedUnion({
  imported: {
    workoutId: WorkoutId,
    performedOn: IsoDate,
    name: TrimmedNonEmptyString,
    document: ImportDocument,
  },
  logged: {
    workoutId: WorkoutId,
    performedOn: IsoDate,
    name: TrimmedNonEmptyString,
    benchmarkId: BenchmarkId,
    score: Schema.String,
  },
}).annotate({ identifier: "PowerSession" });
export type PowerSession = typeof PowerSession.Type;

/** Server-side storage failed; the cause stays on the server. */
export class PowerStorageError extends Schema.TaggedError<PowerStorageError>()(
  "PowerStorageError",
  { operation: Schema.String },
  { httpApiStatus: 500 },
) {
  override get message(): string {
    return `Could not ${this.operation}.`;
  }
}
