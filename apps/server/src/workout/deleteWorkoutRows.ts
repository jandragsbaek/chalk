import * as Effect from "effect/Effect";
import type * as SqlClient from "effect/sql/SqlClient";

/**
 * Deletes a workout and everything hanging off it: imported parts, blocks and items, lift sets
 * logged from its notes, and the import document. Returns the deleted workout ids (empty when it
 * did not exist). Run it inside a transaction.
 */
export const deleteWorkoutRows = Effect.fn("deleteWorkoutRows")(function* (
  sql: SqlClient.SqlClient,
  id: string,
) {
  yield* sql`
    DELETE FROM workout_items
    WHERE block_id IN (
      SELECT b.id FROM workout_blocks b JOIN workout_parts p ON p.id = b.part_id
      WHERE p.workout_id = ${id}
    )
  `;
  yield* sql`
    DELETE FROM workout_blocks
    WHERE part_id IN (SELECT id FROM workout_parts WHERE workout_id = ${id})
  `;
  yield* sql`DELETE FROM workout_parts WHERE workout_id = ${id}`;
  yield* sql`DELETE FROM lift_sets WHERE workout_id = ${id}`;
  yield* sql`DELETE FROM session_imports WHERE workout_id = ${id}`;
  return yield* sql<{ id: string }>`DELETE FROM workouts WHERE id = ${id} RETURNING id`;
});
