import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // The class a session was: 'wod' or 'strength'; unset when solo or not recorded. An import's
  // document carries the same, as its source of truth.
  yield* sql`ALTER TABLE workouts ADD COLUMN class_type TEXT`;
});
