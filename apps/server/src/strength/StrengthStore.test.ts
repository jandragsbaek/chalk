import { LiftSetId, MovementId, type LogLiftSetInput } from "@chalk/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ServerConfig from "../config.ts";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as StrengthStore from "./StrengthStore.ts";

const layer = StrengthStore.layer.pipe(
  Layer.provide(Layer.mergeAll(Sqlite.layer, SecureRandom.layerWebCrypto)),
  Layer.provide(ServerConfig.layerTest()),
);

const squat: LogLiftSetInput = {
  movementId: MovementId.make("back-squat"),
  performedOn: "2026-10-28",
  reps: 5,
  loadKg: 100,
  notes: "",
};

describe("StrengthStore", () => {
  it.effect("ships a seeded movement catalog", () =>
    Effect.gen(function* () {
      const store = yield* StrengthStore.StrengthStore;
      const movements = yield* store.movements();
      expect(movements.find((movement) => movement.id === "back-squat")).toEqual({
        id: "back-squat",
        name: "Back squat",
        category: "barbell",
      });
      expect(movements.length).toBeGreaterThan(30);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("logs sets, keeps fractional loads, and derives rep maxes from them", () =>
    Effect.gen(function* () {
      const store = yield* StrengthStore.StrengthStore;
      yield* store.log(squat);
      yield* store.log({ ...squat, performedOn: "2026-10-30", reps: 1, loadKg: 122.5 });

      const sets = yield* store.list();
      expect(sets.map((set) => [set.performedOn, set.reps, set.loadKg])).toEqual([
        ["2026-10-30", 1, 122.5],
        ["2026-10-28", 5, 100],
      ]);

      const [records] = yield* store.records();
      expect(records?.movementId).toBe("back-squat");
      expect(records?.repMaxes.map(({ reps, loadKg }) => [reps, loadKg])).toEqual([
        [1, 122.5],
        [2, 100],
        [3, 100],
        [5, 100],
      ]);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("rejects a movement outside the catalog, and removes sets by id", () =>
    Effect.gen(function* () {
      const store = yield* StrengthStore.StrengthStore;

      const unknown = yield* store
        .log({ ...squat, movementId: MovementId.make("zercher-squat") })
        .pipe(Effect.flip);
      expect(unknown._tag).toBe("MovementNotFoundError");

      const logged = yield* store.log(squat);
      yield* store.remove(logged.id);
      expect(yield* store.list()).toEqual([]);

      const missing = yield* store.remove(LiftSetId.make("missing")).pipe(Effect.flip);
      expect(missing._tag).toBe("LiftSetNotFoundError");
    }).pipe(Effect.provide(layer)),
  );
});
