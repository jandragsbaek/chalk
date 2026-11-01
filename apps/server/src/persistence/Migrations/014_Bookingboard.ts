import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // The athlete's bookingboard login: one row, absent until Settings connects it. The token is
  // the site's own jwt (30 days); Chalk only reads with it and never returns it to the browser.
  yield* sql`
    CREATE TABLE bookingboard_connection (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      token TEXT NOT NULL,
      participant_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;
});
