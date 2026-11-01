import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // Who coached a session (the bookingboard class's instructor), or that it was done alone.
  // Both unset: not recorded. An import's document carries the same, as its source of truth.
  yield* sql`ALTER TABLE workouts ADD COLUMN coach TEXT`;
  yield* sql`ALTER TABLE workouts ADD COLUMN solo INTEGER NOT NULL DEFAULT 0`;
});
