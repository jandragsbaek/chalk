import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // Chalk's copy of the athlete's own bookings (not opted out), so the import backlog does not
  // re-read the whole gym's bookings from bookingboard each time. Only ever the athlete's rows.
  yield* sql`
    CREATE TABLE bookingboard_bookings (
      class_id INTEGER PRIMARY KEY,
      day TEXT NOT NULL,
      begins TEXT NOT NULL,
      class_name TEXT NOT NULL,
      status TEXT NOT NULL
    )
  `;
  yield* sql`CREATE INDEX bookingboard_bookings_day ON bookingboard_bookings (day)`;

  // What the copy covers: box-local days from covered_from on, as read at checked_at, for whom.
  yield* sql`
    CREATE TABLE bookingboard_ledger (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      participant_id INTEGER NOT NULL,
      covered_from TEXT NOT NULL,
      checked_at TEXT NOT NULL
    )
  `;

  // A past class's program, read once: it does not change after the class. text '' = no program.
  yield* sql`
    CREATE TABLE bookingboard_classes (
      class_id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      begins TEXT NOT NULL,
      coach TEXT,
      text TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    )
  `;

  // Attended days the athlete will not log (a class they only watched); they leave the backlog.
  yield* sql`
    CREATE TABLE bookingboard_skipped_days (
      day TEXT PRIMARY KEY,
      skipped_at TEXT NOT NULL
    )
  `;
});
