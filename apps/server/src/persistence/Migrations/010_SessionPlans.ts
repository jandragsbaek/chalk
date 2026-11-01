import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // A posted workout entered before it is done, with the planned scaling on its spans. Not a
  // workout: it counts nowhere until logged, and logging it removes the row.
  yield* sql`
    CREATE TABLE session_plans (
      id TEXT PRIMARY KEY,
      planned_on TEXT NOT NULL,
      name TEXT NOT NULL,
      document TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;
  yield* sql`CREATE INDEX session_plans_planned_on ON session_plans (planned_on)`;
});
