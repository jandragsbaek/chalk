import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    CREATE TABLE workouts (
      id TEXT PRIMARY KEY,
      performed_on TEXT NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      score TEXT NOT NULL,
      rx INTEGER NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )
  `;
  yield* sql`CREATE INDEX workouts_performed_on ON workouts (performed_on DESC, id DESC)`;
});
