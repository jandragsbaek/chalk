import {
  BenchmarkId,
  makeMovementMatcher,
  suggestSpans,
  type ImportDocument,
} from "@chalk/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as CatalogStore from "../catalog/CatalogStore.ts";
import * as ServerConfig from "../config.ts";
import * as ImportStore from "../import/ImportStore.ts";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as WorkoutStore from "../workout/WorkoutStore.ts";
import * as PowerStore from "./PowerStore.ts";

const layer = Layer.mergeAll(
  PowerStore.layer,
  CatalogStore.layer,
  ImportStore.layer,
  WorkoutStore.layer,
).pipe(
  Layer.provideMerge(Layer.mergeAll(Sqlite.layer, SecureRandom.layerWebCrypto)),
  Layer.provide(ServerConfig.layerTest()),
);

const SESSION = `** Session 170 <2026-10-30 to>
*** Workout
**** Workout #1
- 5 rounds for time
- 10 Pull ups
- 6 Power cleans @60/40`;

describe("PowerStore", () => {
  it.effect("lists imports with their documents and Rx benchmarks with a score, oldest first", () =>
    Effect.gen(function* () {
      const catalog = yield* (yield* CatalogStore.CatalogStore).list();
      let next = 0;
      const document: ImportDocument = {
        text: SESSION,
        spans: suggestSpans(SESSION, makeMovementMatcher(catalog), () => `s${++next}`),
      };
      yield* (yield* ImportStore.ImportStore).save({ document });
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
      // Scaled: what was done is unknown, so there is nothing to estimate.
      yield* workouts.log({
        ...fran,
        performedOn: "2026-10-02",
        score: "3:50",
        rx: false,
        benchmarkId,
      });

      const sessions = yield* (yield* PowerStore.PowerStore).sessions();
      expect(sessions.map((session) => [session._tag, session.performedOn])).toEqual([
        ["logged", "2026-10-01"],
        ["imported", "2026-10-30"],
      ]);
      expect(sessions[0]).toMatchObject({ benchmarkId: "fran", score: "4:10" });
      expect(sessions[1]).toMatchObject({
        name: "For time · Pull-up, Power clean",
        document: { text: SESSION },
      });
    }).pipe(Effect.provide(layer)),
  );
});
