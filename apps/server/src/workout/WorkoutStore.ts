import {
  BenchmarkId,
  benchmarkById,
  LiftSet,
  MovementId,
  findBenchmark,
  LogWorkoutInput,
  Workout,
  WorkoutId,
  WorkoutKind,
  WorkoutNotFoundError,
  type BenchmarkResult,
  type SessionEntry,
  type PlanSimilarity,
  type SimilarParts,
  type SimilarToPlanInput,
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

import { coachingColumns, coachingOf } from "./coaching.ts";
import { deleteWorkoutRows } from "./deleteWorkoutRows.ts";
import { insertBenchmarkPart } from "./insertBenchmarkPart.ts";
import { makeLoadSimilarParts } from "./similarParts.ts";

export class WorkoutPersistenceError extends Schema.TaggedError<WorkoutPersistenceError>()(
  "WorkoutPersistenceError",
  {
    operation: Schema.Literals([
      "list workouts",
      "search workouts",
      "count workouts",
      "log workout",
      "delete workout",
      "list benchmark results",
      "list sessions",
      "compare sessions",
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
  benchmarkId: Schema.NullOr(BenchmarkId),
  coach: Schema.NullOr(Schema.String),
  solo: Schema.Number,
  createdAt: Workout.fields.createdAt,
});

const ResultRow = Schema.Struct({
  benchmarkId: BenchmarkId,
  workoutId: WorkoutId,
  performedOn: Workout.fields.performedOn,
  score: Schema.String,
  rx: Schema.Number,
  imported: Schema.Number,
});

/** Workouts logged before benchmarks existed: no parts, so only the name says which one. */
const UnlinkedRow = Schema.Struct({
  workoutId: WorkoutId,
  performedOn: Workout.fields.performedOn,
  name: Schema.String,
  score: Schema.String,
  rx: Schema.Number,
});

const SessionRow = Schema.Struct({
  ...WorkoutRow.fields,
  sessionNumber: Schema.NullOr(Schema.Number),
  imported: Schema.Number,
  liftSetCount: Schema.Number,
  tonnageKg: Schema.Number,
});

/** A movement of a session, in session order: programmed items first, then lift sets. */
const SessionMovementRow = Schema.Struct({ workoutId: WorkoutId, movementId: MovementId });

const KindCountRow = Schema.Struct({
  kind: WorkoutKind,
  count: Schema.Number,
  rxCount: Schema.Number,
});

const toWorkout = ({ benchmarkId, coach, solo, ...row }: typeof WorkoutRow.Type): Workout => {
  const coaching = coachingOf({ coach, solo });
  return {
    ...row,
    rx: row.rx === 1,
    ...(benchmarkId === null ? {} : { benchmarkId }),
    ...(coaching === undefined ? {} : { coaching }),
  };
};

// The first benchmark part names the session's benchmark.
const WORKOUT_COLUMNS = `
  w.id, w.performed_on AS "performedOn", w.name, w.kind, w.score, w.rx, w.notes,
  (SELECT p.benchmark_id FROM workout_parts p
   WHERE p.workout_id = w.id AND p.benchmark_id IS NOT NULL
   ORDER BY p.position LIMIT 1) AS "benchmarkId",
  w.coach, w.solo, w.created_at AS "createdAt"
`;

export class WorkoutStore extends Context.Service<
  WorkoutStore,
  {
    /** Newest first. */
    readonly list: () => Effect.Effect<ReadonlyArray<Workout>, WorkoutPersistenceError>;
    /** Case-insensitive match on name, score, notes or coach; newest first. */
    readonly search: (
      query: string,
    ) => Effect.Effect<ReadonlyArray<Workout>, WorkoutPersistenceError>;
    readonly stats: () => Effect.Effect<WorkoutStats, WorkoutPersistenceError>;
    /** With a benchmark, the session also gets its part, blocks and prescribed movements. */
    readonly log: (input: LogWorkoutInput) => Effect.Effect<Workout, WorkoutPersistenceError>;
    /**
     * The session register, newest day first and newest entry first within a day: every
     * workout, and every day with lift sets but no workout.
     */
    readonly sessions: () => Effect.Effect<ReadonlyArray<SessionEntry>, WorkoutPersistenceError>;
    /** Every saved part's repeats and look-alikes among the other sessions' parts. */
    readonly similar: () => Effect.Effect<SimilarParts, WorkoutPersistenceError>;
    /** What a plan's parts repeat or resemble among the saved parts, before it is done. */
    readonly similarToPlan: (
      input: SimilarToPlanInput,
    ) => Effect.Effect<PlanSimilarity, WorkoutPersistenceError>;
    /** Every attempt at a benchmark, newest first, logged or imported. */
    readonly results: () => Effect.Effect<ReadonlyArray<BenchmarkResult>, WorkoutPersistenceError>;
    readonly remove: (
      id: WorkoutId,
    ) => Effect.Effect<void, WorkoutNotFoundError | WorkoutPersistenceError>;
  }
>()("chalk/workout/WorkoutStore") {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const random = yield* SecureRandom.SecureRandom;
  const loadSimilarParts = yield* makeLoadSimilarParts;

  const selectAll = SqlSchema.findAll({
    Request: Schema.Void,
    Result: WorkoutRow,
    execute: () => sql`
      SELECT ${sql.unsafe(WORKOUT_COLUMNS)} FROM workouts w
      ORDER BY w.performed_on DESC, w.id DESC
    `,
  });

  const selectMatching = SqlSchema.findAll({
    Request: Schema.String,
    Result: WorkoutRow,
    execute: (pattern) => sql`
      SELECT ${sql.unsafe(WORKOUT_COLUMNS)} FROM workouts w
      WHERE w.name LIKE ${pattern} ESCAPE '!' OR w.score LIKE ${pattern} ESCAPE '!'
         OR w.notes LIKE ${pattern} ESCAPE '!' OR w.coach LIKE ${pattern} ESCAPE '!'
         OR (w.solo = 1 AND 'Solo' LIKE ${pattern} ESCAPE '!')
      ORDER BY w.performed_on DESC, w.id DESC
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

  // A part's own block score wins; else the session's (the debrief result of an import).
  const selectResults = SqlSchema.findAll({
    Request: Schema.Void,
    Result: ResultRow,
    execute: () => sql`
      SELECT p.benchmark_id AS "benchmarkId", w.id AS "workoutId", w.performed_on AS "performedOn",
             COALESCE((SELECT b.score FROM workout_blocks b
                       WHERE b.part_id = p.id AND b.score <> ''
                       ORDER BY b.position LIMIT 1), w.score) AS score,
             w.rx, EXISTS (SELECT 1 FROM session_imports si WHERE si.workout_id = w.id) AS imported
      FROM workout_parts p JOIN workouts w ON w.id = p.workout_id
      WHERE p.benchmark_id IS NOT NULL
      ORDER BY w.performed_on DESC, w.id DESC, p.position
    `,
  });

  const selectUnlinked = SqlSchema.findAll({
    Request: Schema.Void,
    Result: UnlinkedRow,
    execute: () => sql`
      SELECT w.id AS "workoutId", w.performed_on AS "performedOn", w.name, w.score, w.rx
      FROM workouts w
      WHERE NOT EXISTS (SELECT 1 FROM workout_parts p WHERE p.workout_id = w.id)
      ORDER BY w.performed_on DESC, w.id DESC
    `,
  });

  const selectSessions = SqlSchema.findAll({
    Request: Schema.Void,
    Result: SessionRow,
    execute: () => sql`
      SELECT ${sql.unsafe(WORKOUT_COLUMNS)}, si.session_number AS "sessionNumber",
             si.workout_id IS NOT NULL AS imported,
             (SELECT COUNT(*) FROM lift_sets l WHERE l.workout_id = w.id) AS "liftSetCount",
             (SELECT COALESCE(SUM(l.reps * l.load_kg), 0) FROM lift_sets l
              WHERE l.workout_id = w.id) AS "tonnageKg"
      FROM workouts w LEFT JOIN session_imports si ON si.workout_id = w.id
      ORDER BY w.performed_on DESC, w.id DESC
    `,
  });

  const selectSessionMovements = SqlSchema.findAll({
    Request: Schema.Void,
    Result: SessionMovementRow,
    execute: () => sql`
      SELECT workout_id AS "workoutId", movement_id AS "movementId" FROM (
        SELECT p.workout_id, i.movement_id, 0 AS source, p.position AS a, b.position AS b,
               i.position AS c, i.id AS d
        FROM workout_items i
        JOIN workout_blocks b ON b.id = i.block_id
        JOIN workout_parts p ON p.id = b.part_id
        UNION ALL
        SELECT l.workout_id, l.movement_id, 1, 0, 0, 0, l.id
        FROM lift_sets l WHERE l.workout_id IS NOT NULL
      )
      ORDER BY workout_id, source, a, b, c, d
    `,
  });

  // Logged by hand, outside any session: a strength day, or extra sets next to a workout.
  const selectDaySets = SqlSchema.findAll({
    Request: Schema.Void,
    Result: LiftSet,
    execute: () => sql`
      SELECT id, movement_id AS "movementId", performed_on AS "performedOn", reps,
             load_kg AS "loadKg", notes, created_at AS "createdAt"
      FROM lift_sets
      WHERE workout_id IS NULL
      ORDER BY performed_on DESC, created_at, id
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
    const benchmark =
      input.benchmarkId === undefined ? undefined : benchmarkById(input.benchmarkId);
    const { coach, solo } = coachingColumns(input.coaching);
    yield* Effect.gen(function* () {
      yield* sql`
        INSERT INTO workouts (id, performed_on, name, kind, score, rx, notes, coach, solo,
                              created_at)
        VALUES (${workout.id}, ${workout.performedOn}, ${workout.name}, ${workout.kind},
                ${workout.score}, ${workout.rx ? 1 : 0}, ${workout.notes}, ${coach}, ${solo},
                ${workout.createdAt})
      `;
      if (benchmark)
        yield* insertBenchmarkPart(sql, random.uuidV7(), {
          workoutId: workout.id,
          benchmark,
          score: workout.score,
          asPrescribed: workout.rx,
        });
    }).pipe(
      sql.withTransaction,
      Effect.mapError((cause) => new WorkoutPersistenceError({ operation: "log workout", cause })),
    );
    return workout;
  });

  const sessions = Effect.fn("WorkoutStore.sessions")(function* () {
    const { rows, movements, daySets } = yield* Effect.all({
      rows: selectSessions(undefined),
      movements: selectSessionMovements(undefined),
      daySets: selectDaySets(undefined),
    }).pipe(
      Effect.mapError(
        (cause) => new WorkoutPersistenceError({ operation: "list sessions", cause }),
      ),
    );
    const uniqueMovements = (sets: Iterable<MovementId>) => [...new Set(sets)];
    const setsByDay = new Map<string, Array<LiftSet>>();
    for (const set of daySets) {
      const day = setsByDay.get(set.performedOn);
      if (day) day.push(set);
      else setsByDay.set(set.performedOn, [set]);
    }
    const movementsByWorkout = new Map<string, Array<MovementId>>();
    for (const { workoutId, movementId } of movements) {
      const list = movementsByWorkout.get(workoutId);
      if (list) list.push(movementId);
      else movementsByWorkout.set(workoutId, [movementId]);
    }

    const workoutDays = new Set(rows.map((row) => row.performedOn));
    const entries: Array<SessionEntry> = rows.map(
      ({ sessionNumber, imported, liftSetCount, tonnageKg, ...row }) => {
        const sets = setsByDay.get(row.performedOn) ?? [];
        return {
          _tag: "workout",
          workout: toWorkout(row),
          sessionNumber,
          imported: imported === 1,
          movementIds: uniqueMovements([
            ...(movementsByWorkout.get(row.id) ?? []),
            ...sets.map((set) => set.movementId),
          ]),
          liftSetCount,
          tonnageKg,
          daySets: sets,
        };
      },
    );
    for (const [performedOn, sets] of setsByDay)
      if (!workoutDays.has(performedOn))
        entries.push({
          _tag: "strengthDay",
          performedOn,
          movementIds: uniqueMovements(sets.map((set) => set.movementId)),
          daySets: sets,
        });
    const dayOf = (entry: SessionEntry) =>
      entry._tag === "workout" ? entry.workout.performedOn : entry.performedOn;
    // Stable: workouts keep their newest-first order within a day.
    return entries.sort((left, right) => dayOf(right).localeCompare(dayOf(left)));
  });

  const similar = Effect.fn("WorkoutStore.similar")(function* () {
    return yield* loadSimilarParts
      .all()
      .pipe(
        Effect.mapError(
          (cause) => new WorkoutPersistenceError({ operation: "compare sessions", cause }),
        ),
      );
  });

  const similarToPlan = Effect.fn("WorkoutStore.similarToPlan")(function* (
    input: SimilarToPlanInput,
  ) {
    return yield* loadSimilarParts
      .toPlan(input)
      .pipe(
        Effect.mapError(
          (cause) => new WorkoutPersistenceError({ operation: "compare sessions", cause }),
        ),
      );
  });

  const results = Effect.fn("WorkoutStore.results")(function* () {
    const { linked, unlinked } = yield* Effect.all({
      linked: selectResults(undefined),
      unlinked: selectUnlinked(undefined),
    }).pipe(
      Effect.mapError(
        (cause) => new WorkoutPersistenceError({ operation: "list benchmark results", cause }),
      ),
    );
    const fromParts = linked.map((row): BenchmarkResult => ({
      ...row,
      rx: row.imported === 1 ? null : row.rx === 1,
      imported: row.imported === 1,
    }));
    const byName = unlinked.flatMap((row): ReadonlyArray<BenchmarkResult> => {
      const benchmark = findBenchmark(row.name);
      if (benchmark === undefined) return [];
      const { name: _name, ...rest } = row;
      return [{ ...rest, benchmarkId: benchmark.id, rx: row.rx === 1, imported: false }];
    });
    return [...fromParts, ...byName].sort((left, right) =>
      right.performedOn.localeCompare(left.performedOn),
    );
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

  return WorkoutStore.of({
    list,
    search,
    stats,
    log,
    sessions,
    similar,
    similarToPlan,
    results,
    remove,
  });
});

export const layer = Layer.effect(WorkoutStore, make);
