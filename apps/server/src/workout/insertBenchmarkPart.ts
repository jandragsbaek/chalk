import type { Benchmark, BenchmarkItem, WorkoutId } from "@chalk/contracts";
import * as Effect from "effect/Effect";
import type * as SqlClient from "effect/sql/SqlClient";

/**
 * Writes a benchmark as one part of a session, the way an import writes a whiteboard: blocks
 * with their format and intent, items with their prescription. `asPrescribed` (a logged Rx)
 * records each item as done as written; otherwise how it was done stays unknown.
 */
export const insertBenchmarkPart = Effect.fn("insertBenchmarkPart")(function* (
  sql: SqlClient.SqlClient,
  newId: Effect.Effect<string>,
  options: {
    readonly workoutId: WorkoutId;
    readonly benchmark: Benchmark;
    readonly score: string;
    readonly asPrescribed: boolean;
  },
) {
  const { benchmark } = options;
  const partId = yield* newId;
  yield* sql`
    INSERT INTO workout_parts (id, workout_id, position, title, raw_text, benchmark_id)
    VALUES (${partId}, ${options.workoutId}, 0, ${benchmark.name}, ${benchmark.posted},
            ${benchmark.id})
  `;
  const scoredAt = Math.max(
    0,
    benchmark.blocks.findIndex((block) => block.format !== "rest"),
  );
  /** An item and its alternatives ("row or ski"), which point back at it. */
  const insertItem = Effect.fn("insertBenchmarkPart.item")(function* (
    blockId: string,
    position: number,
    item: BenchmarkItem,
  ) {
    const queue: Array<readonly [BenchmarkItem, string | null]> = [[item, null]];
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      const [current, alternativeOf] = next;
      const id = yield* newId;
      yield* sql`
        INSERT INTO workout_items (id, block_id, position, movement_id, alternative_of,
                                   prescription, performance)
        VALUES (${id}, ${blockId}, ${position}, ${current.movementId}, ${alternativeOf},
                ${JSON.stringify([{ line: 0, quantities: current.quantities }])},
                ${options.asPrescribed ? "{}" : null})
      `;
      for (const alternative of current.alternatives ?? []) queue.push([alternative, id]);
    }
  });
  for (const [blockPosition, block] of benchmark.blocks.entries()) {
    const blockId = yield* newId;
    yield* sql`
      INSERT INTO workout_blocks (id, part_id, position, title, format, params, score, intent)
      VALUES (${blockId}, ${partId}, ${blockPosition}, ${block.title}, ${block.format},
              ${JSON.stringify(block.params)}, ${blockPosition === scoredAt ? options.score : ""},
              ${JSON.stringify(block.intents.map((text) => ({ text, quantities: [] })))})
    `;
    for (const [itemPosition, item] of block.items.entries())
      yield* insertItem(blockId, itemPosition, item);
  }
});
