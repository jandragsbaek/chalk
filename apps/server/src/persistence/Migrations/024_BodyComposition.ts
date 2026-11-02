import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // What a smart scale measures beside the weight, on the same weigh-in: body fat as percent of
  // bodyweight and skeletal muscle mass in kilograms. Null when the reading had none (a typed
  // weigh-in left blank, a Garmin reading taken in shoes, an older scale).
  yield* sql`ALTER TABLE bodyweights ADD COLUMN body_fat_pct REAL`;
  yield* sql`ALTER TABLE bodyweights ADD COLUMN muscle_mass_kg REAL`;

  // The scale days already imported came without composition: the next Garmin read starts over
  // from the import day and fills it in (a scale day takes the new reading, a typed day stays).
  yield* sql`UPDATE garmin_connection SET synced_through = NULL`;
});
