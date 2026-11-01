import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // The model slug that wrote each coach reply, now that the athlete picks it per message. Null
  // on athlete turns, and on replies saved before: which model wrote those was never recorded.
  yield* sql`ALTER TABLE coach_turns ADD COLUMN model TEXT`;
});
