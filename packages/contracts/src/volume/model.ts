import * as Schema from "effect/Schema";

import { IsoDate, MovementId, WorkoutId } from "../baseSchemas.ts";

const Amount = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));

/**
 * One movement done in one session, in every unit it was counted in: a row written once in
 * metres and once in calories keeps both. `tonnageKg` is reps × external load (bodyweight adds
 * nothing; a weighted pull-up adds its added load).
 */
export const VolumeEntry = Schema.Struct({
  /** The session; `null` for strength sets logged on their own. */
  workoutId: Schema.NullOr(WorkoutId),
  performedOn: IsoDate,
  /** The movement done: the variation reps were scaled to, or the "or" that was picked. */
  movementId: MovementId,
  /** The movement the board wrote; the same as `movementId` when done as written. */
  writtenAs: MovementId,
  reps: Amount,
  metres: Amount,
  calories: Amount,
  seconds: Amount,
  tonnageKg: Amount,
}).annotate({ identifier: "VolumeEntry" });
export type VolumeEntry = typeof VolumeEntry.Type;

/** A line of a session that could not be counted, and why. */
export const VolumeLeftOut = Schema.Struct({
  workoutId: WorkoutId,
  performedOn: IsoDate,
  movementId: Schema.optionalKey(MovementId),
  text: Schema.String,
  reason: Schema.String,
}).annotate({ identifier: "VolumeLeftOut" });
export type VolumeLeftOut = typeof VolumeLeftOut.Type;

/** One ISO week (Monday to Sunday) with anything done in it. */
export const VolumeWeek = Schema.Struct({
  /** The week's Monday. */
  weekStart: IsoDate,
  entries: Schema.Array(VolumeEntry),
  leftOut: Schema.Array(VolumeLeftOut),
}).annotate({ identifier: "VolumeWeek" });
export type VolumeWeek = typeof VolumeWeek.Type;

/** Server-side storage failed; the cause stays on the server. */
export class VolumeStorageError extends Schema.TaggedError<VolumeStorageError>()(
  "VolumeStorageError",
  { operation: Schema.String },
  { httpApiStatus: 500 },
) {
  override get message(): string {
    return `Could not ${this.operation}.`;
  }
}
