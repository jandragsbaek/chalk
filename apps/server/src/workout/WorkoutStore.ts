import {
  LogWorkoutInput,
  Workout,
  WorkoutId,
  WorkoutNotFoundError,
} from "@chalk/contracts";
import * as Context from "effect/Context";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";

export class WorkoutPersistenceError extends Schema.TaggedError<WorkoutPersistenceError>()(
  "WorkoutPersistenceError",
  {
    operation: Schema.Literals(["list workouts", "log workout", "delete workout"]),
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

const toWorkout = (row: typeof WorkoutRow.Type): Workout => ({ ...row, rx: row.rx === 1 });

export class WorkoutStore extends Context.Service<
  WorkoutStore,
  {
    /** Newest first. */
    readonly list: () => Effect.Effect<ReadonlyArray<Workout>, WorkoutPersistenceError>;
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

  const list = Effect.fn("WorkoutStore.list")(function* () {
    const rows = yield* selectAll(undefined).pipe(
      Effect.mapError((cause) => new WorkoutPersistenceError({ operation: "list workouts", cause })),
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
    const deleted = yield* sql<{ id: string }>`DELETE FROM workouts WHERE id = ${id} RETURNING id`.pipe(
      Effect.mapError((cause) => new WorkoutPersistenceError({ operation: "delete workout", cause })),
    );
    if (deleted.length === 0) return yield* new WorkoutNotFoundError({ id });
  });

  return WorkoutStore.of({ list, log, remove });
});

export const layer = Layer.effect(WorkoutStore, make);
