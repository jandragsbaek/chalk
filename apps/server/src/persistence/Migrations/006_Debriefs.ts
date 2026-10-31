import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // The athlete's debrief of a session, one row per workout, in columns a coach can query.
  // The import document stays the source of truth; this row is re-derived on every save.
  yield* sql`
    CREATE TABLE workout_debriefs (
      workout_id TEXT PRIMARY KEY REFERENCES workouts (id),
      result TEXT,
      feel INTEGER CHECK (feel BETWEEN 1 AND 5),
      effort INTEGER CHECK (effort BETWEEN 1 AND 10),
      capacity INTEGER CHECK (capacity BETWEEN 1 AND 5),
      minutes INTEGER CHECK (minutes BETWEEN 1 AND 600),
      limiters TEXT NOT NULL DEFAULT '[]',
      pain TEXT,
      next_time TEXT,
      notes TEXT
    )
  `;
});
