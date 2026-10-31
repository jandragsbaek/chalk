import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // A lift set entered as the result of a programmed movement points at its item, in set order.
  yield* sql`ALTER TABLE lift_sets ADD COLUMN workout_item_id TEXT REFERENCES workout_items (id)`;
  yield* sql`ALTER TABLE lift_sets ADD COLUMN set_number INTEGER`;
  yield* sql`CREATE INDEX lift_sets_workout_item ON lift_sets (workout_item_id, set_number)`;
});
