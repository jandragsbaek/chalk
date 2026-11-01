import { bodyweightOn, EMPTY_ATHLETE_PROFILE } from "@chalk/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ServerConfig from "../config.ts";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as ProfileStore from "./ProfileStore.ts";

const layer = ProfileStore.layer.pipe(
  Layer.provide(Sqlite.layer),
  Layer.provide(ServerConfig.layerTest()),
);

describe("ProfileStore", () => {
  it.effect("reads a male athlete with nothing measured before the first save", () =>
    Effect.gen(function* () {
      const store = yield* ProfileStore.ProfileStore;
      expect(yield* store.get()).toEqual(EMPTY_ATHLETE_PROFILE);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("saves sex and lengths, and clears a length set back to null", () =>
    Effect.gen(function* () {
      const store = yield* ProfileStore.ProfileStore;
      const body = { sex: "f", heightCm: 171.5, armLengthCm: 74, legLengthCm: 80 } as const;
      expect(yield* store.update(body)).toEqual({ ...body, bodyweights: [] });

      yield* store.update({ ...body, armLengthCm: null });
      expect(yield* store.get()).toEqual({ ...body, armLengthCm: null, bodyweights: [] });
    }).pipe(Effect.provide(layer)),
  );

  it.effect("keeps one weigh-in per day, oldest first, and deletes by day", () =>
    Effect.gen(function* () {
      const store = yield* ProfileStore.ProfileStore;
      yield* store.logBodyweight({ performedOn: "2026-10-20", kg: 85.4 });
      yield* store.logBodyweight({ performedOn: "2026-09-01", kg: 86 });
      yield* store.logBodyweight({ performedOn: "2026-10-20", kg: 84.9 });

      const profile = yield* store.get();
      expect(profile.bodyweights).toEqual([
        { performedOn: "2026-09-01", kg: 86 },
        { performedOn: "2026-10-20", kg: 84.9 },
      ]);
      expect(bodyweightOn(profile, "2026-10-01")).toBe(86);

      yield* store.removeBodyweight("2026-09-01");
      expect((yield* store.get()).bodyweights).toEqual([{ performedOn: "2026-10-20", kg: 84.9 }]);

      const missing = yield* store.removeBodyweight("2026-09-01").pipe(Effect.flip);
      expect(missing._tag).toBe("BodyweightNotFoundError");
    }).pipe(Effect.provide(layer)),
  );
});
