import {
  BenchmarkId,
  deriveSession,
  makeMovementMatcher,
  MovementId,
  plannedPart,
  suggestSpans,
  WorkoutId,
  type LogWorkoutInput,
} from "@chalk/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";

import * as CatalogStore from "../catalog/CatalogStore.ts";
import * as ServerConfig from "../config.ts";
import * as ImportStore from "../import/ImportStore.ts";
import * as LevelStore from "../levels/LevelStore.ts";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as StrengthStore from "../strength/StrengthStore.ts";
import * as WorkoutStore from "./WorkoutStore.ts";

const layer = Layer.mergeAll(
  WorkoutStore.layer,
  StrengthStore.layer,
  ImportStore.layer,
  CatalogStore.layer,
  LevelStore.layer.pipe(Layer.provide(CatalogStore.layer)),
).pipe(
  Layer.provideMerge(Layer.mergeAll(Sqlite.layer, SecureRandom.layerWebCrypto)),
  Layer.provide(ServerConfig.layerTest()),
);

const fran: LogWorkoutInput = {
  performedOn: "2026-10-28",
  name: "Fran",
  kind: "for_time",
  score: "4:32",
  rx: true,
  notes: "",
};

describe("WorkoutStore", () => {
  it.effect("lists newest day first, and newest entry first within a day", () =>
    Effect.gen(function* () {
      const store = yield* WorkoutStore.WorkoutStore;
      yield* store.log(fran);
      yield* store.log({ ...fran, performedOn: "2026-10-29", name: "Cindy", rx: false });
      yield* store.log({ ...fran, performedOn: "2026-10-29", name: "Back squat 5x5" });

      const workouts = yield* store.list();
      expect(workouts.map((workout) => workout.name)).toEqual(["Back squat 5x5", "Cindy", "Fran"]);
      expect(workouts.map((workout) => workout.rx)).toEqual([true, false, true]);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("removes a workout, and reports one that does not exist", () =>
    Effect.gen(function* () {
      const store = yield* WorkoutStore.WorkoutStore;
      const logged = yield* store.log(fran);

      yield* store.remove(logged.id);
      expect(yield* store.list()).toEqual([]);

      const error = yield* store.remove(WorkoutId.make("missing")).pipe(Effect.flip);
      expect(error._tag).toBe("WorkoutNotFoundError");
    }).pipe(Effect.provide(layer)),
  );

  it.effect("logs a benchmark as its part, blocks and movements, done as prescribed when Rx", () =>
    Effect.gen(function* () {
      const store = yield* WorkoutStore.WorkoutStore;
      const logged = yield* store.log({ ...fran, benchmarkId: BenchmarkId.make("fran") });
      expect((yield* store.list())[0]).toMatchObject({ id: logged.id, benchmarkId: "fran" });

      const sql = yield* SqlClient.SqlClient;
      const items = yield* sql<{ movementId: string; prescription: string; performance: string }>`
        SELECT i.movement_id AS "movementId", i.prescription, i.performance, b.score
        FROM workout_items i JOIN workout_blocks b ON b.id = i.block_id
        JOIN workout_parts p ON p.id = b.part_id WHERE p.workout_id = ${logged.id}
        ORDER BY i.position
      `;
      expect(items).toEqual([
        {
          movementId: "thruster",
          prescription: JSON.stringify([
            {
              line: 0,
              quantities: [
                { measure: "load_kg", amount: { min: 43, max: 43 }, female: { min: 29, max: 29 } },
              ],
            },
          ]),
          performance: "{}",
          score: "4:32",
        },
        {
          movementId: "pull-up",
          prescription: JSON.stringify([{ line: 0, quantities: [] }]),
          performance: "{}",
          score: "4:32",
        },
      ]);

      // The levels page grades it like an imported session: thrusters at 43 kg.
      const levels = yield* LevelStore.LevelStore;
      const overview = yield* levels.overview();
      expect(overview.items.map((item) => [item.movementId, item.performance])).toEqual([
        ["thruster", {}],
        ["pull-up", {}],
      ]);

      // Scaled: the movements are on the board, how they were done is not known.
      const scaled = yield* store.log({
        ...fran,
        rx: false,
        benchmarkId: BenchmarkId.make("fran"),
      });
      const [unknown] = yield* sql<{ performance: string | null }>`
        SELECT i.performance FROM workout_items i JOIN workout_blocks b ON b.id = i.block_id
        JOIN workout_parts p ON p.id = b.part_id WHERE p.workout_id = ${scaled.id} LIMIT 1
      `;
      expect(unknown?.performance).toBeNull();

      yield* store.remove(logged.id);
      const [left] = yield* sql<{ count: number }>`SELECT COUNT(*) AS count FROM workout_items`;
      expect(left?.count).toBe(2);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("lists benchmark attempts: logged, imported, and named before benchmarks", () =>
    Effect.gen(function* () {
      const store = yield* WorkoutStore.WorkoutStore;
      yield* store.log({
        ...fran,
        performedOn: "2026-09-01",
        benchmarkId: BenchmarkId.make("fran"),
      });
      // Logged by name before benchmarks existed, and an ordinary session.
      yield* store.log({
        ...fran,
        performedOn: "2026-08-01",
        name: "cindy",
        kind: "amrap",
        score: "18+7",
      });
      yield* store.log({ ...fran, performedOn: "2026-08-02", name: "Back squat 5x5" });

      const catalog = yield* (yield* CatalogStore.CatalogStore).list();
      const text = `** Session 170 <2026-10-30 to>
**** Workout #1
- Back squat 5x5 @100kg
**** Workout #2
- Fran
*** Notes
- Fran: 3:58`;
      let next = 0;
      const spans = suggestSpans(text, makeMovementMatcher(catalog), () => `s${++next}`);
      const imports = yield* ImportStore.ImportStore;
      const saved = yield* imports.save({ document: { text, spans } });

      const results = yield* store.results();
      expect(
        results.map(({ benchmarkId, performedOn, score, rx, imported }) => ({
          benchmarkId,
          performedOn,
          score,
          rx,
          imported,
        })),
      ).toEqual([
        { benchmarkId: "fran", performedOn: "2026-10-30", score: "3:58", rx: null, imported: true },
        {
          benchmarkId: "fran",
          performedOn: "2026-09-01",
          score: "4:32",
          rx: true,
          imported: false,
        },
        {
          benchmarkId: "cindy",
          performedOn: "2026-08-01",
          score: "18+7",
          rx: true,
          imported: false,
        },
      ]);
      expect(results[0]?.workoutId).toBe(saved.workoutId);
      expect(saved.itemCount).toBe(3);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("lists sessions: workouts with their movements, and days with only lift sets", () =>
    Effect.gen(function* () {
      const store = yield* WorkoutStore.WorkoutStore;
      const strength = yield* StrengthStore.StrengthStore;
      const lift = (performedOn: string, movementId: string, loadKg: number) =>
        strength.log({
          movementId: MovementId.make(movementId),
          performedOn,
          reps: 5,
          loadKg,
          notes: "",
        });

      const catalog = yield* (yield* CatalogStore.CatalogStore).list();
      const text = `** Session 170 <2026-10-30 to>
**** Workout #1
- Back squat 5x5 @100kg
**** Workout #2
- Fran
*** Notes
- Deadlift 3x5 @ 140 kg`;
      let next = 0;
      const spans = suggestSpans(text, makeMovementMatcher(catalog), () => `s${++next}`);
      const saved = yield* (yield* ImportStore.ImportStore).save({ document: { text, spans } });

      const cindy = yield* store.log({ ...fran, performedOn: "2026-10-28", name: "Cindy" });
      yield* lift("2026-10-28", "bench-press", 60);
      yield* lift("2026-10-29", "front-squat", 80);
      yield* lift("2026-10-29", "back-squat", 100);
      yield* lift("2026-10-29", "front-squat", 85);

      const entries = yield* store.sessions();
      expect(
        entries.map((entry) =>
          entry._tag === "workout"
            ? {
                day: entry.workout.performedOn,
                name: entry.workout.name,
                sessionNumber: entry.sessionNumber,
                imported: entry.imported,
                movementIds: entry.movementIds,
                liftSetCount: entry.liftSetCount,
                daySets: entry.daySets.length,
              }
            : {
                day: entry.performedOn,
                movementIds: entry.movementIds,
                daySets: entry.daySets.length,
              },
        ),
      ).toEqual([
        {
          day: "2026-10-30",
          name: saved.name,
          sessionNumber: 170,
          imported: true,
          movementIds: ["back-squat", "thruster", "pull-up", "deadlift"],
          liftSetCount: saved.liftSetCount,
          daySets: 0,
        },
        { day: "2026-10-29", movementIds: ["front-squat", "back-squat"], daySets: 3 },
        {
          day: "2026-10-28",
          name: "Cindy",
          sessionNumber: null,
          imported: false,
          movementIds: ["bench-press"],
          liftSetCount: 0,
          daySets: 1,
        },
      ]);
      expect(entries[2]?._tag === "workout" && entries[2].workout.id).toBe(cindy.id);
    }).pipe(Effect.provide(layer)),
  );
  it.effect("compares every saved part with the other sessions' parts", () =>
    Effect.gen(function* () {
      const store = yield* WorkoutStore.WorkoutStore;
      const imports = yield* ImportStore.ImportStore;
      const catalog = yield* (yield* CatalogStore.CatalogStore).list();
      const session = (number: number, day: string, minutes: number, squatKg: number) =>
        `** Session ${number} <${day} ti>
**** Workout #1
- Back squat 5x5 @80%
**** Workout #2
- Amrap ${minutes}
- 12 Thrusters @40/25
- 10 Burpee over barbell
*** Notes
- Back squat 5x5 @ ${squatKg} kg`;
      const save = (text: string) => {
        let next = 0;
        const spans = suggestSpans(text, makeMovementMatcher(catalog), () => `s${++next}`);
        return imports.save({ document: { text, spans } });
      };
      const older = yield* save(session(150, "2026-09-01", 15, 100));
      const newer = yield* save(session(151, "2026-10-01", 12, 105));
      yield* store.log(fran);

      const { parts, echoes } = yield* store.similar();
      const refOf = (id: string) => parts.find((part) => part.id === id);
      expect(
        echoes.map((echo) => {
          const part = refOf(echo.part);
          const [match] = echo.matches;
          const other = refOf(match?.other ?? "");
          return {
            part: [part?.workoutId, part?.title, part?.top?.loadKg ?? null],
            other: [other?.workoutId, other?.title, other?.top?.loadKg ?? null],
            kind: match?.kind,
            differences: match?.differences.map((difference) => difference._tag),
          };
        }),
      ).toEqual([
        {
          part: [newer.workoutId, "Workout #1", 105],
          other: [older.workoutId, "Workout #1", 100],
          kind: "repeat",
          differences: [],
        },
        {
          part: [newer.workoutId, "Workout #2", null],
          other: [older.workoutId, "Workout #2", null],
          kind: "similar",
          differences: ["format"],
        },
        {
          part: [older.workoutId, "Workout #1", 100],
          other: [newer.workoutId, "Workout #1", 105],
          kind: "repeat",
          differences: [],
        },
        {
          part: [older.workoutId, "Workout #2", null],
          other: [newer.workoutId, "Workout #2", null],
          kind: "similar",
          differences: ["format"],
        },
      ]);
      expect(refOf(echoes[1]!.part)).toMatchObject({
        sessionNumber: 151,
        headline: { format: "amrap", params: { durationSeconds: 720 } },
        movementIds: ["thruster", "bar-facing-burpee"],
      });
    }).pipe(Effect.provide(layer)),
  );
  it.effect("compares a plan's parts with the saved parts, never with other plans", () =>
    Effect.gen(function* () {
      const store = yield* WorkoutStore.WorkoutStore;
      const imports = yield* ImportStore.ImportStore;
      const catalog = yield* (yield* CatalogStore.CatalogStore).list();
      const document = (text: string) => {
        let next = 0;
        return {
          text,
          spans: suggestSpans(text, makeMovementMatcher(catalog), () => `s${++next}`),
        };
      };
      const metcon = (minutes: number) => `**** Workout
- Amrap ${minutes}
- 12 Thrusters @40/25
- 10 Burpee over barbell`;
      const saved = yield* imports.save({
        document: document(`** Session 150 <2026-09-01 ti>
${metcon(15)}
*** Notes
- Thrusters 3x12 @ 40 kg`),
      });
      const plan = deriveSession(
        document(`${metcon(15)}\n**** Strength\n- Deadlift 5x3`),
        () => "",
      );

      const { parts, echoes } = yield* store.similarToPlan({
        plannedOn: "2026-11-01",
        parts: plan.parts.map(plannedPart),
      });
      expect(
        echoes.map((echo) => ({
          position: echo.position,
          matches: echo.matches.map((match) => [match.other, match.kind]),
          total: echo.total,
        })),
      ).toEqual([{ position: 0, matches: [[parts[0]?.id, "repeat"]], total: 1 }]);
      expect(parts).toMatchObject([
        { workoutId: saved.workoutId, top: { movementId: "thruster", reps: 12, loadKg: 40 } },
      ]);

      const another = yield* store.similarToPlan({
        plannedOn: "2026-11-01",
        parts: [...plan.parts, ...plan.parts].map(plannedPart),
      });
      expect(another.echoes.map((echo) => [echo.position, echo.total])).toEqual([
        [0, 1],
        [2, 1],
      ]);
    }).pipe(Effect.provide(layer)),
  );
});
