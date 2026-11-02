import {
  BenchmarkId,
  makeMovementMatcher,
  MovementId,
  suggestSpans,
  type ImportDocument,
  type VolumeWeek,
} from "@chalk/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as CatalogStore from "../catalog/CatalogStore.ts";
import * as ServerConfig from "../config.ts";
import * as ImportStore from "../import/ImportStore.ts";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as ProfileStore from "../profile/ProfileStore.ts";
import * as StrengthStore from "../strength/StrengthStore.ts";
import * as WorkoutStore from "../workout/WorkoutStore.ts";
import * as VolumeStore from "./VolumeStore.ts";

const layer = VolumeStore.layer.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      CatalogStore.layer,
      ImportStore.layer,
      WorkoutStore.layer,
      StrengthStore.layer,
      ProfileStore.layer,
    ),
  ),
  Layer.provideMerge(Layer.mergeAll(Sqlite.layer, SecureRandom.layerWebCrypto)),
  Layer.provide(ServerConfig.layerTest()),
);

const SESSION = `** Session 170 <2026-10-30 to>
*** Workout
**** Workout #1
- 5 rounds for time
- 10 Pull ups
- 6 Power cleans @60/40
- 12/10 cal Row`;

/** One movement's totals in a week, over every entry. */
const totalsOf = (week: VolumeWeek | undefined, movementId: string) =>
  week?.entries
    .filter((entry) => entry.movementId === movementId)
    .reduce(
      (sum, entry) => ({
        reps: sum.reps + entry.reps,
        calories: sum.calories + entry.calories,
        tonnageKg: sum.tonnageKg + entry.tonnageKg,
      }),
      { reps: 0, calories: 0, tonnageKg: 0 },
    );

describe("VolumeStore", () => {
  it.effect("counts imports as done, Rx benchmarks as prescribed and lone sets, by ISO week", () =>
    Effect.gen(function* () {
      const catalog = yield* (yield* CatalogStore.CatalogStore).list();
      let next = 0;
      const document: ImportDocument = {
        text: SESSION,
        spans: suggestSpans(SESSION, makeMovementMatcher(catalog), () => `s${++next}`),
      };
      const saved = yield* (yield* ImportStore.ImportStore).save({ document });
      const workouts = yield* WorkoutStore.WorkoutStore;
      const fran = { name: "Fran", kind: "for_time", notes: "" } as const;
      const benchmarkId = BenchmarkId.make("fran");
      yield* workouts.log({
        ...fran,
        performedOn: "2026-10-01",
        score: "4:10",
        rx: true,
        benchmarkId,
      });
      // Scaled: what was done is unknown, so it counts nothing.
      yield* workouts.log({
        ...fran,
        performedOn: "2026-10-02",
        score: "3:50",
        rx: false,
        benchmarkId,
      });
      yield* (yield* StrengthStore.StrengthStore).log({
        movementId: MovementId.make("back-squat"),
        performedOn: "2026-10-27",
        reps: 5,
        loadKg: 100,
        notes: "",
      });

      const volume = yield* VolumeStore.VolumeStore;
      const weeks = yield* volume.weeks();
      expect(weeks.map((week) => week.weekStart)).toEqual(["2026-09-28", "2026-10-26"]);
      const [franWeek, sessionWeek] = weeks;
      expect(totalsOf(franWeek, "thruster")).toEqual({ reps: 45, calories: 0, tonnageKg: 45 * 43 });
      expect(totalsOf(franWeek, "pull-up")).toEqual({ reps: 45, calories: 0, tonnageKg: 0 });

      expect(totalsOf(sessionWeek, "pull-up")).toEqual({ reps: 50, calories: 0, tonnageKg: 0 });
      expect(totalsOf(sessionWeek, "power-clean")).toEqual({
        reps: 30,
        calories: 0,
        tonnageKg: 30 * 60,
      });
      expect(totalsOf(sessionWeek, "row")).toEqual({ reps: 0, calories: 60, tonnageKg: 0 });
      expect(sessionWeek?.entries.find((entry) => entry.movementId === "back-squat")).toMatchObject(
        { workoutId: null, performedOn: "2026-10-27", reps: 5, tonnageKg: 500 },
      );
      expect(sessionWeek?.entries.find((entry) => entry.movementId === "pull-up")?.workoutId).toBe(
        saved.workoutId,
      );

      // The athlete's side of every M/F split, from the profile.
      yield* (yield* ProfileStore.ProfileStore).update({
        sex: "f",
        heightCm: null,
        armLengthCm: null,
        legLengthCm: null,
      });
      const asWoman = (yield* volume.weeks())[1];
      expect(totalsOf(asWoman, "row")).toEqual({ reps: 0, calories: 50, tonnageKg: 0 });
      expect(totalsOf(asWoman, "power-clean")?.tonnageKg).toBe(30 * 40);
    }).pipe(Effect.provide(layer)),
  );
});
