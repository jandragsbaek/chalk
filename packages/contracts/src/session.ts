import * as Schema from "effect/Schema";

import { IsoDate, MovementId } from "./baseSchemas.ts";
import { Place } from "./place.ts";
import { LiftSet } from "./strength.ts";
import { Workout } from "./workout.ts";

/**
 * One entry of the session register: every training day the front page counts. A workout is a
 * session; a day with lift sets and no workout is a strength day. Lift sets logged by hand next
 * to a workout are read as part of it, as on the front page.
 */
export const SessionEntry = Schema.TaggedUnion({
  workout: {
    workout: Workout,
    /** Its number at its place, counted in Chalk's log; see `numberSessions`. */
    number: Schema.Int,
    /** Imported from pasted text, so its protocol can be read back from the stored document. */
    imported: Schema.Boolean,
    /** Programmed movements, then lifted ones, each once, in session order. */
    movementIds: Schema.Array(MovementId),
    /** Lift sets the session wrote (an import's results and notes). */
    liftSetCount: Schema.Int,
    /** Sum of reps × load over those lift sets. */
    tonnageKg: Schema.Finite,
    /** Lift sets logged by hand that day, outside any session; oldest first. */
    daySets: Schema.Array(LiftSet),
  },
  strengthDay: {
    performedOn: IsoDate,
    /** Where its first set was lifted. */
    place: Place,
    /** Its number at its place, counted in Chalk's log; see `numberSessions`. */
    number: Schema.Int,
    /** Movements lifted that day, each once, in logged order. */
    movementIds: Schema.Array(MovementId),
    /** Oldest first. */
    daySets: Schema.Array(LiftSet),
  },
}).annotate({ identifier: "SessionEntry" });
export type SessionEntry = typeof SessionEntry.Type;
