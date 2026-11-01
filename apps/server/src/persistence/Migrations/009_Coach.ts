import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // A coach conversation. `history` is the model's own transcript (the Chat export, tool calls
  // and results included), so a thread resumes with everything the coach read before. Empty until the coach first answers.
  yield* sql`
    CREATE TABLE coach_threads (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      model TEXT NOT NULL,
      history TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  // What the athlete sees: one row per turn, the coach's receipts as JSON.
  yield* sql`
    CREATE TABLE coach_turns (
      thread_id TEXT NOT NULL REFERENCES coach_threads (id),
      seq INTEGER NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('athlete', 'coach')),
      text TEXT NOT NULL,
      receipts TEXT NOT NULL DEFAULT '[]',
      stopped TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY (thread_id, seq)
    )
  `;
});
