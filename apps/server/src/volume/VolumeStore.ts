import {
  benchmarkById,
  BenchmarkId,
  countBenchmark,
  countSession,
  deriveSession,
  ImportDocument,
  IsoDate,
  MovementId,
  volumeEntries,
  volumeLeftOut,
  volumeWeeks,
  WorkoutId,
  workModelsFor,
  type Counted,
  type CountOptions,
  type VolumeEntry,
  type VolumeLeftOut,
  type VolumeWeek,
} from "@chalk/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";

import * as CatalogStore from "../catalog/CatalogStore.ts";
import * as ProfileStore from "../profile/ProfileStore.ts";

export class VolumePersistenceError extends Schema.TaggedError<VolumePersistenceError>()(
  "VolumePersistenceError",
  { operation: Schema.Literals(["load volume"]), cause: Schema.Defect() },
) {
  override get message(): string {
    return `Failed to ${this.operation}.`;
  }
}

const ImportedRow = Schema.Struct({
  workoutId: WorkoutId,
  performedOn: IsoDate,
  document: Schema.fromJsonString(ImportDocument),
});

const BenchmarkRow = Schema.Struct({
  workoutId: WorkoutId,
  performedOn: IsoDate,
  benchmarkId: BenchmarkId,
  score: Schema.String,
});

const LiftSetRow = Schema.Struct({
  workoutId: Schema.NullOr(WorkoutId),
  performedOn: IsoDate,
  movementId: MovementId,
  reps: Schema.Finite,
  loadKg: Schema.Finite,
});

export class VolumeStore extends Context.Service<
  VolumeStore,
  {
    /**
     * Every ISO week with something done, oldest first: each movement per session in every unit
     * it was counted in, and what could not be counted. Imports count from their document as
     * done (the athlete's side of an M/F split, from the profile); a benchmark logged Rx counts
     * as prescribed; strength sets logged outside an import count set by set.
     */
    readonly weeks: () => Effect.Effect<ReadonlyArray<VolumeWeek>, VolumePersistenceError>;
  }
>()("chalk/volume/VolumeStore") {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const catalogStore = yield* CatalogStore.CatalogStore;
  const profileStore = yield* ProfileStore.ProfileStore;

  const selectImported = SqlSchema.findAll({
    Request: Schema.Void,
    Result: ImportedRow,
    execute: () => sql`
      SELECT w.id AS "workoutId", w.performed_on AS "performedOn", si.document
      FROM session_imports si
      JOIN workouts w ON w.id = si.workout_id
    `,
  });

  // A scaled benchmark is not known as done, so only Rx with a score counts (as on /power).
  const selectBenchmarks = SqlSchema.findAll({
    Request: Schema.Void,
    Result: BenchmarkRow,
    execute: () => sql`
      SELECT w.id AS "workoutId", w.performed_on AS "performedOn",
             p.benchmark_id AS "benchmarkId", w.score
      FROM workouts w
      JOIN workout_parts p ON p.workout_id = w.id AND p.benchmark_id IS NOT NULL
      WHERE w.rx = 1 AND TRIM(w.score) <> ''
        AND NOT EXISTS (SELECT 1 FROM session_imports si WHERE si.workout_id = w.id)
    `,
  });

  // An import's lift sets are counted through its document, so only the others here.
  const selectLiftSets = SqlSchema.findAll({
    Request: Schema.Void,
    Result: LiftSetRow,
    execute: () => sql`
      SELECT ls.workout_id AS "workoutId", ls.performed_on AS "performedOn",
             ls.movement_id AS "movementId", ls.reps, ls.load_kg AS "loadKg"
      FROM lift_sets ls
      WHERE ls.workout_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM session_imports si WHERE si.workout_id = ls.workout_id)
    `,
  });

  const weeks = Effect.fn("VolumeStore.weeks")(
    function* () {
      const catalog = yield* catalogStore.list();
      const { sex } = yield* profileStore.get();
      const nameById = new Map(catalog.map((movement) => [movement.id, movement.name]));
      const modelOf = workModelsFor(catalog);
      const options: CountOptions = {
        sex,
        pairOf: (movementId) => modelOf(movementId)?.pair === true,
        seconds: true,
      };
      const entries: Array<VolumeEntry> = [];
      const leftOut: Array<VolumeLeftOut> = [];

      for (const row of yield* selectImported(undefined)) {
        const session = deriveSession(row.document, (id) => nameById.get(id), { sex });
        const count = countSession(session, options);
        entries.push(...volumeEntries(row.workoutId, row.performedOn, count.counted));
        leftOut.push(...volumeLeftOut(row.workoutId, row.performedOn, count.leftOut));
      }

      for (const row of yield* selectBenchmarks(undefined)) {
        const benchmark = benchmarkById(row.benchmarkId);
        if (benchmark === undefined) continue;
        const count = countBenchmark(benchmark, row.score, options);
        entries.push(...volumeEntries(row.workoutId, row.performedOn, count.counted));
        leftOut.push(...volumeLeftOut(row.workoutId, row.performedOn, count.leftOut));
      }

      // Lift sets by session, or by day for sets logged on their own.
      const lifted = new Map<
        string,
        { workoutId: WorkoutId | null; performedOn: IsoDate; counted: Array<Counted> }
      >();
      for (const set of yield* selectLiftSets(undefined)) {
        const key = `${set.workoutId ?? ""} ${set.performedOn}`;
        const group = lifted.get(key) ?? {
          workoutId: set.workoutId,
          performedOn: set.performedOn,
          counted: [],
        };
        group.counted.push({
          movementId: set.movementId,
          writtenAs: set.movementId,
          amount: set.reps,
          unit: "reps",
          loadKg: set.loadKg,
          text: "Strength set",
          lifted: true,
        });
        lifted.set(key, group);
      }
      for (const group of lifted.values())
        entries.push(...volumeEntries(group.workoutId, group.performedOn, group.counted));

      return volumeWeeks(entries, leftOut);
    },
    Effect.mapError((cause) => new VolumePersistenceError({ operation: "load volume", cause })),
  );

  return VolumeStore.of({ weeks });
});

export const layer = Layer.effect(VolumeStore, make);
