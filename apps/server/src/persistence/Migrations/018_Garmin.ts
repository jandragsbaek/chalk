import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // Where a day's bodyweight came from. A Garmin read only writes days that are not 'manual', so
  // a weigh-in the athlete typed always wins. `measured_at` is the scale's local "HH:MM".
  yield* sql`
    ALTER TABLE bodyweights
    ADD COLUMN source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'garmin'))
  `;
  yield* sql`ALTER TABLE bodyweights ADD COLUMN measured_at TEXT`;

  // The athlete's Garmin Connect login: one row, absent until Settings connects it. The tokens
  // come from a login on the athlete's own machine; Chalk renews them (the refresh token turns
  // over on each renewal) and never returns them to the browser. `synced_through` is the last
  // day a read covered; the next read starts a few days before it.
  yield* sql`
    CREATE TABLE garmin_connection (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      client_id TEXT NOT NULL,
      access_expires_at TEXT NOT NULL,
      import_from TEXT NOT NULL,
      synced_through TEXT,
      last_sync_at TEXT,
      last_error TEXT,
      updated_at TEXT NOT NULL
    )
  `;
});
