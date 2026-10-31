import {
  makeMovementMatcher,
  MovementId,
  suggestSpans,
  type ImportDocument,
  type Span,
} from "@chalk/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as CatalogStore from "../catalog/CatalogStore.ts";
import * as ServerConfig from "../config.ts";
import * as ImportStore from "../import/ImportStore.ts";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as LevelStore from "./LevelStore.ts";

const layer = Layer.mergeAll(
  LevelStore.layer.pipe(Layer.provideMerge(CatalogStore.layer)),
  ImportStore.layer,
).pipe(
  Layer.provideMerge(Layer.mergeAll(Sqlite.layer, SecureRandom.layerWebCrypto)),
  Layer.provide(ServerConfig.layerTest()),
);

const SESSION = `** Session 170 <2026-10-30 to>
*** Workout
**** Workout #1
- 5 rounds for time
- 10 Pull ups
- 6 Power cleans @60/40
- 60 Double under or 90 Single unders`;

const withPerformance = (spans: ReadonlyArray<Span>, movementId: string, performance: object) =>
  spans.map((span) =>
    span._tag === "movement" && span.movementId === movementId ? { ...span, performance } : span,
  );

describe("LevelStore", () => {
  it.effect("seeds the sheet's variations and the row each movement is graded on", () =>
    Effect.gen(function* () {
      const catalog = yield* (yield* CatalogStore.CatalogStore).list();
      const byId = new Map(catalog.map((movement) => [movement.id, movement]));
      expect(byId.get(MovementId.make("power-clean"))?.levelFamily).toBe("bb-clean");
      expect(byId.get(MovementId.make("jumping-pull-up"))).toMatchObject({
        variationOf: "pull-up",
        levelFamily: "pull-ups",
      });
      expect(byId.get(MovementId.make("single-under"))?.levelFamily).toBe("skipping-rope");
      expect(byId.get(MovementId.make("hanging-knee-raise"))?.aliases).toContain(
        "Heels above hips",
      );
      expect(byId.get(MovementId.make("burpee"))?.levelFamily).toBeUndefined();
    }).pipe(Effect.provide(layer)),
  );

  it.effect("tags an accessory with what it complements, and clears it again", () =>
    Effect.gen(function* () {
      const store = yield* CatalogStore.CatalogStore;
      const created = yield* store.create({
        name: "Gorilla row",
        category: "dumbbell_kettlebell",
        aliases: [],
      });
      const tagged = yield* store.setLevels(created.id, {
        levelFamily: null,
        accessory: true,
        complements: ["horizontal_pull", "lats", "grip", "lats"],
        supports: ["pull-ups"],
      });
      expect(tagged).toMatchObject({
        accessory: true,
        complements: ["horizontal_pull", "lats", "grip"],
        supports: ["pull-ups"],
      });
      expect(tagged.levelFamily).toBeUndefined();

      const cleared = yield* store.setLevels(created.id, {
        levelFamily: "db-squat",
        accessory: false,
        complements: [],
        supports: [],
      });
      expect(cleared).toEqual({
        id: "gorilla-row",
        name: "Gorilla row",
        category: "dumbbell_kettlebell",
        aliases: [],
        levelFamily: "db-squat",
      });

      const missing = yield* store
        .setLevels(MovementId.make("nope"), {
          levelFamily: null,
          accessory: false,
          complements: [],
          supports: [],
        })
        .pipe(Effect.flip);
      expect(missing._tag).toBe("CatalogNotFoundError");
    }).pipe(Effect.provide(layer)),
  );

  it.effect("lists every saved item with how it was done", () =>
    Effect.gen(function* () {
      const catalog = yield* (yield* CatalogStore.CatalogStore).list();
      let next = 0;
      const suggested = suggestSpans(SESSION, makeMovementMatcher(catalog), () => `s${++next}`);
      const pullUps = { variants: [{ movementId: MovementId.make("jumping-pull-up"), reps: 44 }] };
      const spans = withPerformance(
        withPerformance(suggested, "pull-up", pullUps),
        "power-clean",
        {},
      );
      const document: ImportDocument = { text: SESSION, spans };
      yield* (yield* ImportStore.ImportStore).save({ document });

      const { items, movements } = yield* (yield* LevelStore.LevelStore).overview();
      expect(movements.length).toBe(catalog.length);
      expect(items.map((item) => [item.movementId, item.alternative])).toEqual([
        ["pull-up", false],
        ["power-clean", false],
        ["double-under", false],
        ["single-under", true],
      ]);
      expect(items[0]).toMatchObject({ performedOn: "2026-10-30", performance: pullUps });
      expect(items[1]?.performance).toEqual({});
      expect(items[1]?.sets[0]?.quantities).toContainEqual({
        measure: "load_kg",
        amount: { min: 60, max: 60 },
        female: { min: 40, max: 40 },
      });
      expect(items[2]?.performance).toBeUndefined();
    }).pipe(Effect.provide(layer)),
  );
});
