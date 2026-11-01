import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // Days the athlete chose not to train, one per local day; marking a day again replaces it.
  // `source` says who put it in the calendar: the athlete on Today, or the coach.
  yield* sql`
    CREATE TABLE rest_days (
      day TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('rest', 'sick', 'injured', 'travel')),
      source TEXT NOT NULL CHECK (source IN ('athlete', 'coach')),
      created_at TEXT NOT NULL
    )
  `;
});
