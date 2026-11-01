import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // The athlete's body: one row, absent until the settings page first saves it (the store then
  // reads sex "m" and nulls). Lengths in centimetres.
  yield* sql`
    CREATE TABLE athlete_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      sex TEXT NOT NULL CHECK (sex IN ('m', 'f')),
      height_cm REAL,
      arm_length_cm REAL,
      leg_length_cm REAL,
      updated_at TEXT NOT NULL
    )
  `;

  // Bodyweight over time, one weigh-in per local day; logging a day again replaces it.
  yield* sql`
    CREATE TABLE bodyweights (
      performed_on TEXT PRIMARY KEY,
      kg REAL NOT NULL,
      created_at TEXT NOT NULL
    )
  `;
});
