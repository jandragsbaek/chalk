import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // Where a session (and a lift set logged by hand) was trained: 'box', 'home', or 'away' with
  // the other box's name. Everything before places existed was at the box.
  yield* sql`ALTER TABLE workouts ADD COLUMN place TEXT NOT NULL DEFAULT 'box'`;
  yield* sql`ALTER TABLE workouts ADD COLUMN place_name TEXT`;
  yield* sql`ALTER TABLE lift_sets ADD COLUMN place TEXT NOT NULL DEFAULT 'box'`;
  yield* sql`ALTER TABLE lift_sets ADD COLUMN place_name TEXT`;

  // Who named a session: 'typed' by the athlete, 'derived' by Chalk from the board (kind and
  // first movements, waiting for a better one), or 'model' by the coach's model. An import's
  // name was always derived ("Session 171", "Session 2026-10-27"), and so is a logged workout
  // named only by its number.
  yield* sql`ALTER TABLE workouts ADD COLUMN name_source TEXT NOT NULL DEFAULT 'typed'`;
  yield* sql`
    UPDATE workouts SET name_source = 'derived'
    WHERE id IN (SELECT workout_id FROM session_imports)
       OR (name GLOB 'Session [0-9]*' AND substr(name, 9) NOT GLOB '*[^0-9]*')
  `;
});
