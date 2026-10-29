import { WorkoutId, type LogWorkoutInput } from "@chalk/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ServerConfig from "../config.ts";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as WorkoutStore from "./WorkoutStore.ts";

const layer = WorkoutStore.layer.pipe(
  Layer.provide(Layer.mergeAll(Sqlite.layer, SecureRandom.layerWebCrypto)),
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
});
