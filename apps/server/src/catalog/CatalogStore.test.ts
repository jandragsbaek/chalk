import {
  BENCHMARK_MOVEMENT_IDS,
  BENCHMARKS,
  benchmarkMovementIds,
  makeMovementMatcher,
  MovementId,
  normalizeMovementPhrase,
  scalingOptions,
  WORK_MODELS,
  workModelsFor,
} from "@chalk/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";

import * as ServerConfig from "../config.ts";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as CatalogStore from "./CatalogStore.ts";

const layer = CatalogStore.layer.pipe(
  Layer.provideMerge(Sqlite.layer),
  Layer.provide(ServerConfig.layerTest()),
);

describe("CatalogStore", () => {
  it.effect("lists the seeded catalog with whiteboard aliases keyed like the matcher", () =>
    Effect.gen(function* () {
      const store = yield* CatalogStore.CatalogStore;
      const catalog = yield* store.list();
      expect(catalog.find((movement) => movement.id === "double-under")?.aliases).toEqual(["DU"]);

      // The migration hardcodes keys; they must stay what the matcher computes.
      const sql = yield* SqlClient.SqlClient;
      const rows = yield* sql<{
        key: string;
        alias: string;
      }>`SELECT key, alias FROM movement_aliases`;
      expect(rows.filter((row) => row.key !== normalizeMovementPhrase(row.alias))).toEqual([]);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("holds every movement the benchmarks use, with its core and sheet row", () =>
    Effect.gen(function* () {
      const store = yield* CatalogStore.CatalogStore;
      const catalog = yield* store.list();
      const ids = new Set(catalog.map((movement) => movement.id));
      expect(BENCHMARK_MOVEMENT_IDS.filter((id) => !ids.has(MovementId.make(id)))).toEqual([]);
      const used = BENCHMARKS.flatMap((benchmark) => benchmarkMovementIds(benchmark));
      expect(used.filter((id) => !ids.has(id))).toEqual([]);

      const byId = new Map(catalog.map((movement) => [movement.id, movement]));
      expect(byId.get(MovementId.make("push-jerk"))?.variationOf).toBe("jerk");
      expect(byId.get(MovementId.make("hang-squat-clean"))).toMatchObject({
        variationOf: "clean",
        levelFamily: "bb-clean",
      });
      expect(byId.get(MovementId.make("air-squat"))?.aliases).toContain("Squat");
      // One level only: no core of a variation is itself a variation.
      expect(
        catalog.filter(
          (movement) =>
            movement.variationOf !== undefined &&
            byId.get(movement.variationOf)?.variationOf !== undefined,
        ),
      ).toEqual([]);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("has a work model for every seeded movement, and none for a movement it lacks", () =>
    Effect.gen(function* () {
      const store = yield* CatalogStore.CatalogStore;
      const catalog = yield* store.list();
      const ids = new Set<string>(catalog.map((movement) => movement.id));
      expect(Object.keys(WORK_MODELS).filter((id) => !ids.has(id))).toEqual([]);
      const modelOf = workModelsFor(catalog);
      // Swimming and the VersaClimber report nothing that turns into work against gravity.
      expect(
        catalog.filter((movement) => modelOf(movement.id) === undefined).map((m) => m.id),
      ).toEqual(["swim", "versaclimber"]);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("seeds the weightlifting pulls as accessories of the lift, not variations of it", () =>
    Effect.gen(function* () {
      const store = yield* CatalogStore.CatalogStore;
      const catalog = yield* store.list();
      const byId = new Map(catalog.map((movement) => [movement.id, movement]));
      const snatchPull = byId.get(MovementId.make("snatch-pull"));
      expect(snatchPull).toMatchObject({
        category: "barbell",
        accessory: true,
        supports: ["bb-snatch"],
      });
      expect(snatchPull?.variationOf).toBeUndefined();
      expect(snatchPull?.levelFamily).toBeUndefined();
      expect(byId.get(MovementId.make("deficit-clean-pull"))?.variationOf).toBe("clean-pull");

      const matcher = makeMovementMatcher(catalog);
      const line = "1 Snatch pull + 1 snatch + 2 overhead squat";
      expect(matcher.find(line).map((match) => match.movementId)).toEqual([
        "snatch-pull",
        "snatch",
        "overhead-squat",
      ]);
      expect(matcher.lookup("SGDL")).toBe("snatch-deadlift");
      expect(matcher.lookup("CL pulls")).toBe("clean-pull");
    }).pipe(Effect.provide(layer)),
  );

  it.effect("seeds the usual scalings: ring rows for pull-ups, walk-outs for wall walks", () =>
    Effect.gen(function* () {
      const store = yield* CatalogStore.CatalogStore;
      const catalog = yield* store.list();
      const names = (id: string) =>
        scalingOptions(MovementId.make(id), catalog).map((option) => option.name);
      expect(names("pull-up")).toEqual(["Ring row", "Jumping pull-up"]);
      expect(names("wall-walk")).toEqual(["Walk-out", "Bear crawl"]);
      expect(makeMovementMatcher(catalog).find("10 walkouts")[0]?.movementId).toBe("walk-out");
    }).pipe(Effect.provide(layer)),
  );

  it.effect("sets a movement's scalings in order, without itself or repeats", () =>
    Effect.gen(function* () {
      const store = yield* CatalogStore.CatalogStore;
      const id = MovementId.make("pistol");
      const set = (scalings: ReadonlyArray<string>) =>
        store.setScalings(
          id,
          scalings.map((other) => MovementId.make(other)),
        );
      expect(
        (yield* set(["goblet-squat", "pistol", "air-squat", "goblet-squat"])).scalings,
      ).toEqual(["goblet-squat", "air-squat"]);
      expect((yield* set([])).scalings).toBeUndefined();
      const missing = yield* Effect.flip(set(["no-such-movement"]));
      expect(missing).toMatchObject({ _tag: "CatalogNotFoundError", id: "no-such-movement" });
    }).pipe(Effect.provide(layer)),
  );

  it.effect('reads the box\'s burpee variations and devil presses, "o." for over', () =>
    Effect.gen(function* () {
      const store = yield* CatalogStore.CatalogStore;
      const catalog = yield* store.list();
      const byId = new Map(catalog.map((movement) => [movement.id, movement]));
      expect(byId.get(MovementId.make("burpee-over-line"))?.variationOf).toBe("burpee");
      expect(byId.get(MovementId.make("single-arm-devil-press"))?.variationOf).toBe("devil-press");
      expect(byId.get(MovementId.make("devil-press"))?.scalings).toEqual([
        "single-arm-devil-press",
        "dumbbell-burpee-deadlift",
      ]);

      const matcher = makeMovementMatcher(catalog);
      const found = (line: string) => matcher.find(line).map((match) => match.movementId);
      expect(found("12 Burpee o. line")).toEqual(["burpee-over-line"]);
      expect(found("10 Burpees o. DB + 5 burpee broad jumps")).toEqual([
        "burpee-over-dumbbell",
        "burpee-broad-jump",
      ]);
      expect(found("Burpee o. bar, burpee o. rower")).toEqual([
        "bar-facing-burpee",
        "burpee-over-rower",
      ]);
      expect(found("8 Devils press @2x22.5, 8 DB devil's press")).toEqual([
        "devil-press",
        "devil-press",
      ]);
      expect(found("10 SA devil press @22.5/15, single DB devils press")).toEqual([
        "single-arm-devil-press",
        "single-arm-devil-press",
      ]);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("creates a movement with a slug id and aliases, and refuses duplicates", () =>
    Effect.gen(function* () {
      const store = yield* CatalogStore.CatalogStore;
      const created = yield* store.create({
        name: "Man maker",
        category: "dumbbell_kettlebell",
        aliases: ["MM", "Man makers with two dumbbells"],
      });
      expect(created).toEqual({
        id: "man-maker",
        name: "Man maker",
        category: "dumbbell_kettlebell",
        aliases: ["MM", "Man makers with two dumbbells"],
      });

      const duplicate = yield* store
        .create({ name: "MAN MAKER", category: "dumbbell_kettlebell", aliases: [] })
        .pipe(Effect.flip);
      expect(duplicate._tag).toBe("MovementExistsError");

      // A failed alias rolls the whole creation back.
      const taken = yield* store
        .create({ name: "Sandbag squat", category: "other", aliases: ["DU"] })
        .pipe(Effect.flip);
      expect(taken).toMatchObject({ _tag: "AliasTakenError", movementId: "double-under" });
      expect((yield* store.list()).some((movement) => movement.id === "sandbag-squat")).toBe(false);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("adds aliases idempotently and rejects one that means another movement", () =>
    Effect.gen(function* () {
      const store = yield* CatalogStore.CatalogStore;
      const squat = MovementId.make("back-squat");
      yield* store.addAlias(squat, "BS");
      const again = yield* store.addAlias(squat, "bs");
      expect(again.aliases).toEqual(["BS"]);
      // Its own name is not stored as an alias.
      expect((yield* store.addAlias(squat, "Back squats")).aliases).toEqual(["BS"]);

      const clash = yield* store.addAlias(squat, "Front squat").pipe(Effect.flip);
      expect(clash).toMatchObject({ _tag: "AliasTakenError", movementId: "front-squat" });

      const missing = yield* store.addAlias(MovementId.make("nope"), "x").pipe(Effect.flip);
      expect(missing._tag).toBe("CatalogNotFoundError");
    }).pipe(Effect.provide(layer)),
  );
  it.effect("keeps variations one level under a core movement", () =>
    Effect.gen(function* () {
      const store = yield* CatalogStore.CatalogStore;
      const snatch = MovementId.make("snatch");
      const variationsOf = (catalog: ReadonlyArray<{ id: string; variationOf?: string }>) =>
        catalog
          .filter((movement) => movement.variationOf === snatch)
          .map((movement) => movement.id);
      expect(variationsOf(yield* store.list())).toEqual([
        "hang-power-snatch",
        "power-snatch",
        "split-snatch",
      ]);

      // "Squat snatch" was an alias of Snatch; the new movement's name takes the phrase over.
      const squat = yield* store.create({
        name: "Squat snatch",
        category: "barbell",
        aliases: [],
        variationOf: snatch,
      });
      expect(squat).toMatchObject({ id: "squat-snatch", variationOf: "snatch" });
      const catalog = yield* store.list();
      expect(catalog.find((movement) => movement.id === snatch)?.aliases).toEqual([]);

      const underVariation = yield* store
        .create({
          name: "High-hang power snatch",
          category: "barbell",
          aliases: [],
          variationOf: MovementId.make("power-snatch"),
        })
        .pipe(Effect.flip);
      expect(underVariation).toMatchObject({
        _tag: "VariationInvalidError",
        reason: "core-is-variation",
      });
      const unknownCore = yield* store
        .create({
          name: "Hang squat",
          category: "barbell",
          aliases: [],
          variationOf: MovementId.make("squat"),
        })
        .pipe(Effect.flip);
      expect(unknownCore._tag).toBe("CatalogNotFoundError");

      const coreWithVariations = yield* store
        .setVariationOf(snatch, MovementId.make("clean"))
        .pipe(Effect.flip);
      expect(coreWithVariations).toMatchObject({ reason: "has-variations" });
      const self = yield* store.setVariationOf(snatch, snatch).pipe(Effect.flip);
      expect(self).toMatchObject({ reason: "self" });

      const promoted = yield* store.setVariationOf(MovementId.make("power-snatch"), null);
      expect(promoted.variationOf).toBeUndefined();
      const moved = yield* store.setVariationOf(
        MovementId.make("sumo-deadlift"),
        MovementId.make("deadlift"),
      );
      expect(moved.variationOf).toBe("deadlift");
      expect(variationsOf(yield* store.list())).toEqual([
        "hang-power-snatch",
        "split-snatch",
        "squat-snatch",
      ]);
    }).pipe(Effect.provide(layer)),
  );
});
