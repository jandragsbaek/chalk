import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ServerConfig from "../config.ts";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as RestDayStore from "./RestDayStore.ts";

const layer = RestDayStore.layer.pipe(
  Layer.provide(Sqlite.layer),
  Layer.provide(ServerConfig.layerTest()),
);

describe("RestDayStore", () => {
  it.effect("keeps one mark per day, oldest first, the latest kind and marker winning", () =>
    Effect.gen(function* () {
      const store = yield* RestDayStore.RestDayStore;
      yield* store.mark({ day: "2026-11-04", kind: "rest" }, "coach");
      yield* store.mark({ day: "2026-10-28", kind: "sick" }, "athlete");
      yield* store.mark({ day: "2026-11-04", kind: "travel" }, "athlete");

      const days = yield* store.list();
      expect(days.map(({ day, kind, source }) => ({ day, kind, source }))).toEqual([
        { day: "2026-10-28", kind: "sick", source: "athlete" },
        { day: "2026-11-04", kind: "travel", source: "athlete" },
      ]);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("clears a marked day, and says so when the day was not marked", () =>
    Effect.gen(function* () {
      const store = yield* RestDayStore.RestDayStore;
      yield* store.mark({ day: "2026-11-04", kind: "rest" }, "athlete");
      yield* store.clear("2026-11-04");
      expect(yield* store.list()).toEqual([]);

      const missing = yield* store.clear("2026-11-04").pipe(Effect.flip);
      expect(missing._tag).toBe("RestDayNotFoundError");
    }).pipe(Effect.provide(layer)),
  );
});
