import { ChalkAdminApi, WorkoutId, type LogWorkoutInput } from "@chalk/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as HttpApiTest from "effect/http-api/HttpApiTest";
import * as HttpServer from "effect/http/HttpServer";
import * as Layer from "effect/Layer";

import * as AdminApi from "./adminApi.ts";
import * as ServerConfig from "./config.ts";
import * as Sqlite from "./persistence/Sqlite.ts";
import * as WorkoutStore from "./workout/WorkoutStore.ts";

// Real handlers and SQLite store, in-memory HTTP: same encoding, routing and decoding as the server.
const layer = AdminApi.layerWorkouts.pipe(
  Layer.provideMerge(WorkoutStore.layer),
  Layer.provide(Layer.mergeAll(Sqlite.layer, SecureRandom.layerWebCrypto)),
  Layer.provide(ServerConfig.layerTest()),
  Layer.merge(HttpServer.layerServices),
);

const makeClient = HttpApiTest.groups(ChalkAdminApi, ["workouts"]);

const fran: LogWorkoutInput = {
  performedOn: "2026-10-28",
  name: "Fran",
  kind: "for_time",
  score: "4:32",
  rx: true,
  notes: "",
};

const seed = Effect.gen(function* () {
  const store = yield* WorkoutStore.WorkoutStore;
  yield* store.log(fran);
  yield* store.log({ ...fran, performedOn: "2026-10-29", name: "Cindy", kind: "amrap", rx: false });
  yield* store.log({ ...fran, name: "Back squat", kind: "strength", score: "5x5 @ 100%" });
});

describe("ChalkAdminApi workouts", () => {
  it.effect("searches by name, score and notes, treating LIKE wildcards literally", () =>
    Effect.gen(function* () {
      yield* seed;
      const client = yield* makeClient;

      const all = yield* client.workouts.search({ query: {} });
      expect(all.map((workout) => workout.name)).toEqual(["Cindy", "Back squat", "Fran"]);

      const byName = yield* client.workouts.search({ query: { q: "  fRaN " } });
      expect(byName.map((workout) => workout.name)).toEqual(["Fran"]);

      const literalPercent = yield* client.workouts.search({ query: { q: "100%" } });
      expect(literalPercent.map((workout) => workout.name)).toEqual(["Back squat"]);

      expect(yield* client.workouts.search({ query: { q: "%" } })).toHaveLength(1);
    }).pipe(Effect.scoped, Effect.provide(layer)),
  );

  it.effect("counts workouts per kind", () =>
    Effect.gen(function* () {
      yield* seed;
      const client = yield* makeClient;

      expect(yield* client.workouts.stats()).toEqual({
        total: 3,
        rxCount: 2,
        byKind: [
          { kind: "amrap", count: 1 },
          { kind: "for_time", count: 1 },
          { kind: "strength", count: 1 },
        ],
      });
    }).pipe(Effect.scoped, Effect.provide(layer)),
  );

  it.effect("removes a workout, and answers 404 with a typed error for a missing one", () =>
    Effect.gen(function* () {
      yield* seed;
      const client = yield* makeClient;
      const [first] = yield* client.workouts.search({ query: {} });
      if (!first) return expect.unreachable("seeded workouts are listed");

      yield* client.workouts.remove({ params: { id: first.id } });
      expect(yield* client.workouts.search({ query: {} })).toHaveLength(2);

      const error = yield* client.workouts
        .remove({ params: { id: WorkoutId.make("missing") } })
        .pipe(Effect.flip);
      expect(error._tag).toBe("WorkoutNotFoundError");
    }).pipe(Effect.scoped, Effect.provide(layer)),
  );
});
