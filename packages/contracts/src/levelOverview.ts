import * as Schema from "effect/Schema";

import { IsoDate, MovementId, WorkoutId } from "./baseSchemas.ts";
import { Performance } from "./levels.ts";
import { CatalogMovement, Quantity } from "./sessionImport.ts";

/**
 * One programmed movement of a saved session, as the levels page grades it: the prescription as
 * written, how it was done, and the heaviest set of any lift result.
 */
export const LevelItem = Schema.Struct({
  workoutId: WorkoutId,
  performedOn: IsoDate,
  movementId: MovementId,
  /** Set when this movement was an alternative ("or 90 single unders") of another item. */
  alternative: Schema.Boolean,
  sets: Schema.Array(Schema.Struct({ quantities: Schema.Array(Quantity) })),
  performance: Schema.optionalKey(Performance),
  liftedKg: Schema.optionalKey(Schema.Finite),
}).annotate({ identifier: "LevelItem" });
export type LevelItem = typeof LevelItem.Type;

/** Everything the levels page needs: the catalog with its grading, and every programmed item. */
export const LevelOverview = Schema.Struct({
  movements: Schema.Array(CatalogMovement),
  items: Schema.Array(LevelItem),
}).annotate({ identifier: "LevelOverview" });
export type LevelOverview = typeof LevelOverview.Type;

/** Server-side storage failed; the cause stays on the server. */
export class LevelStorageError extends Schema.TaggedError<LevelStorageError>()(
  "LevelStorageError",
  { operation: Schema.String },
  { httpApiStatus: 500 },
) {
  override get message(): string {
    return `Could not ${this.operation}.`;
  }
}
