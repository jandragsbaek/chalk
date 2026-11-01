import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // A block of programmed sessions: a strength cycle or a run of accessory work, drafted by the
  // coach (or written by the athlete) and put in the calendar when the athlete accepts it.
  // `training_maxes` is JSON [{ movementId, kg }]: what the sessions' percents are taken from.
  yield* sql`
    CREATE TABLE training_blocks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      goal TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'scheduled')),
      source TEXT NOT NULL CHECK (source IN ('athlete', 'coach')),
      training_maxes TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  // One prescribed session on a day. `lines` is JSON [ProgrammedLine]; `ticked` is JSON [index]
  // of lines the athlete ticked done. `position` keeps the order the block was written in.
  yield* sql`
    CREATE TABLE programmed_sessions (
      id TEXT PRIMARY KEY,
      block_id TEXT NOT NULL REFERENCES training_blocks (id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      title TEXT NOT NULL,
      note TEXT,
      lines TEXT NOT NULL,
      ticked TEXT NOT NULL,
      position INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;
  yield* sql`CREATE INDEX programmed_sessions_block ON programmed_sessions (block_id, day)`;
});
