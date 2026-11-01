import { LiftSet } from "@chalk/contracts";
import * as Schema from "effect/Schema";

import { placeOf } from "../workout/placeColumns.ts";

/** A `lift_sets` row as `LIFT_SET_COLUMNS` selects it. */
export const LiftSetRow = Schema.Struct({
  ...LiftSet.fields,
  place: Schema.String,
  placeName: Schema.NullOr(Schema.String),
});

export const LIFT_SET_COLUMNS = `
  id, movement_id AS "movementId", performed_on AS "performedOn", reps, load_kg AS "loadKg",
  notes, place, place_name AS "placeName", created_at AS "createdAt"
`;

export const toLiftSet = ({ place, placeName, ...row }: typeof LiftSetRow.Type): LiftSet => ({
  ...row,
  place: placeOf({ place, placeName }),
});
