import {
  BenchmarkId,
  ImportDocument,
  IsoDate,
  WorkoutId,
  type PowerSession,
} from "@chalk/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";

export class PowerPersistenceError extends Schema.TaggedError<PowerPersistenceError>()(
  "PowerPersistenceError",
  { operation: Schema.Literals(["load sessions for power"]), cause: Schema.Defect() },
) {
  override get message(): string {
    return `Failed to ${this.operation}.`;
  }
}

const ImportedRow = Schema.Struct({
  workoutId: WorkoutId,
  performedOn: IsoDate,
  name: Schema.String,
  document: Schema.fromJsonString(ImportDocument),
});

const LoggedRow = Schema.Struct({
  workoutId: WorkoutId,
  performedOn: IsoDate,
  name: Schema.String,
  benchmarkId: BenchmarkId,
  score: Schema.String,
});

export class PowerStore extends Context.Service<
  PowerStore,
  {
    /**
     * Every saved session work can be estimated for, oldest first: each import's document, and
     * each benchmark logged as prescribed with a score. The client does the estimating.
     */
    readonly sessions: () => Effect.Effect<ReadonlyArray<PowerSession>, PowerPersistenceError>;
  }
>()("chalk/power/PowerStore") {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const selectImported = SqlSchema.findAll({
    Request: Schema.Void,
    Result: ImportedRow,
    execute: () => sql`
      SELECT w.id AS "workoutId", w.performed_on AS "performedOn", w.name, si.document
      FROM session_imports si
      JOIN workouts w ON w.id = si.workout_id
    `,
  });

  // Logged benchmarks have no import; a scaled one is not known as done, so only Rx counts.
  const selectLogged = SqlSchema.findAll({
    Request: Schema.Void,
    Result: LoggedRow,
    execute: () => sql`
      SELECT w.id AS "workoutId", w.performed_on AS "performedOn", w.name,
             p.benchmark_id AS "benchmarkId", w.score
      FROM workouts w
      JOIN workout_parts p ON p.workout_id = w.id AND p.benchmark_id IS NOT NULL
      WHERE w.rx = 1 AND TRIM(w.score) <> ''
        AND NOT EXISTS (SELECT 1 FROM session_imports si WHERE si.workout_id = w.id)
    `,
  });

  const sessions = Effect.fn("PowerStore.sessions")(
    function* () {
      const imported = yield* selectImported(undefined);
      const logged = yield* selectLogged(undefined);
      const all: Array<PowerSession> = [
        ...imported.map((row) => ({ _tag: "imported" as const, ...row })),
        ...logged.map((row) => ({ _tag: "logged" as const, ...row })),
      ];
      return all.sort(
        (left, right) =>
          left.performedOn.localeCompare(right.performedOn) ||
          left.workoutId.localeCompare(right.workoutId),
      );
    },
    Effect.mapError(
      (cause) => new PowerPersistenceError({ operation: "load sessions for power", cause }),
    ),
  );

  return PowerStore.of({ sessions });
});

export const layer = Layer.effect(PowerStore, make);
