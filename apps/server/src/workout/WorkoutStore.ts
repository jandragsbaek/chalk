import {
  LogWorkoutInput,
  Workout,
  WorkoutId,
  WorkoutKind,
  WorkoutNotFoundError,
  type WorkoutStats,
} from "@chalk/contracts";
import * as Context from "effect/Context";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";

import { deleteWorkoutRows } from "./deleteWorkoutRows.ts";

export class WorkoutPersistenceError extends Schema.TaggedError<WorkoutPersistenceError>()(
  "WorkoutPersistenceError",
  {
    operation: Schema.Literals([
      "list workouts",
      "search workouts",
      "count workouts",
      "log workout",
      "delete workout",
    ]),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to ${this.operation}.`;
  }
}

const WorkoutRow = Schema.Struct({
  id: WorkoutId,
  performedOn: Workout.fields.performedOn,
  name: Workout.fields.name,
  kind: Workout.fields.kind,
  score: Workout.fields.score,
  rx: Schema.Number,
  notes: Schema.String,
  createdAt: Workout.fields.createdAt,
});

const KindCountRow = Schema.Struct({
  kind: WorkoutKind,
  count: Schema.Number,
  rxCount: Schema.Number,
});

const toWorkout = (row: typeof WorkoutRow.Type): Workout => ({ ...row, rx: row.rx === 1 });

export class WorkoutStore extends Context.Service<
  WorkoutStore,
  {
    /** Newest first. */
    readonly list: () => Effect.Effect<ReadonlyArray<Workout>, WorkoutPersistenceError>;
    /** Case-insensitive match on name, score or notes; newest first. */
    readonly search: (
      query: string,
    ) => Effect.Effect<ReadonlyArray<Workout>, WorkoutPersistenceError>;
    readonly stats: () => Effect.Effect<WorkoutStats, WorkoutPersistenceError>;
    readonly log: (input: LogWorkoutInput) => Effect.Effect<Workout, WorkoutPersistenceError>;
    readonly remove: (
      id: WorkoutId,
    ) => Effect.Effect<void, WorkoutNotFoundError | WorkoutPersistenceError>;
  }
>()("chalk/workout/WorkoutStore") {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const random = yield* SecureRandom.SecureRandom;

  const selectAll = SqlSchema.findAll({
    Request: Schema.Void,
    Result: WorkoutRow,
    execute: () => sql`
      SELECT id, performed_on AS "performedOn", name, kind, score, rx, notes, created_at AS "createdAt"
      FROM workouts
      ORDER BY performed_on DESC, id DESC
    `,
  });

  const selectMatching = SqlSchema.findAll({
    Request: Schema.String,
    Result: WorkoutRow,
    execute: (pattern) => sql`
      SELECT id, performed_on AS "performedOn", name, kind, score, rx, notes, created_at AS "createdAt"
      FROM workouts
      WHERE name LIKE ${pattern} ESCAPE '!' OR score LIKE ${pattern} ESCAPE '!'
         OR notes LIKE ${pattern} ESCAPE '!'
      ORDER BY performed_on DESC, id DESC
    `,
  });

  const selectKindCounts = SqlSchema.findAll({
    Request: Schema.Void,
    Result: KindCountRow,
    execute: () => sql`
      SELECT kind, COUNT(*) AS count, SUM(rx) AS "rxCount"
      FROM workouts
      GROUP BY kind
      ORDER BY count DESC, kind
    `,
  });

  const search = Effect.fn("WorkoutStore.search")(function* (query: string) {
    const escaped = query.trim().replace(/[!%_]/g, (char) => `!${char}`);
    const rows = yield* selectMatching(`%${escaped}%`).pipe(
      Effect.mapError(
        (cause) => new WorkoutPersistenceError({ operation: "search workouts", cause }),
      ),
    );
    return rows.map(toWorkout);
  });

  const stats = Effect.fn("WorkoutStore.stats")(function* () {
    const rows = yield* selectKindCounts(undefined).pipe(
      Effect.mapError(
        (cause) => new WorkoutPersistenceError({ operation: "count workouts", cause }),
      ),
    );
    return {
      total: rows.reduce((sum, row) => sum + row.count, 0),
      rxCount: rows.reduce((sum, row) => sum + row.rxCount, 0),
      byKind: rows.map(({ kind, count }) => ({ kind, count })),
    } satisfies WorkoutStats;
  });

  const list = Effect.fn("WorkoutStore.list")(function* () {
    const rows = yield* selectAll(undefined).pipe(
      Effect.mapError(
        (cause) => new WorkoutPersistenceError({ operation: "list workouts", cause }),
      ),
    );
    return rows.map(toWorkout);
  });

  const log = Effect.fn("WorkoutStore.log")(function* (input: LogWorkoutInput) {
    const workout: Workout = {
      ...input,
      id: WorkoutId.make(yield* random.uuidV7()),
      createdAt: DateTime.formatIso(yield* DateTime.now),
    };
    yield* sql`
      INSERT INTO workouts (id, performed_on, name, kind, score, rx, notes, created_at)
      VALUES (${workout.id}, ${workout.performedOn}, ${workout.name}, ${workout.kind},
              ${workout.score}, ${workout.rx ? 1 : 0}, ${workout.notes}, ${workout.createdAt})
    `.pipe(
      Effect.mapError((cause) => new WorkoutPersistenceError({ operation: "log workout", cause })),
    );
    return workout;
  });

  const remove = Effect.fn("WorkoutStore.remove")(function* (id: WorkoutId) {
    const deleted = yield* sql
      .withTransaction(deleteWorkoutRows(sql, id))
      .pipe(
        Effect.mapError(
          (cause) => new WorkoutPersistenceError({ operation: "delete workout", cause }),
        ),
      );
    if (deleted.length === 0) return yield* new WorkoutNotFoundError({ id });
  });

  return WorkoutStore.of({ list, search, stats, log, remove });
});

export const layer = Layer.effect(WorkoutStore, make);
