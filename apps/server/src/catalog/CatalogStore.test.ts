import { MovementId, normalizeMovementPhrase } from "@chalk/contracts";
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

  it.effect("creates a movement with a slug id and aliases, and refuses duplicates", () =>
    Effect.gen(function* () {
      const store = yield* CatalogStore.CatalogStore;
      const created = yield* store.create({
        name: "Burpee over rower",
        category: "gymnastics",
        aliases: ["BOR", "Burpees over the rower"],
      });
      expect(created).toEqual({
        id: "burpee-over-rower",
        name: "Burpee over rower",
        category: "gymnastics",
        aliases: ["BOR", "Burpees over the rower"],
      });

      const duplicate = yield* store
        .create({ name: "burpee over rowers", category: "gymnastics", aliases: [] })
        .pipe(Effect.flip);
      expect(duplicate._tag).toBe("MovementExistsError");

      // A failed alias rolls the whole creation back.
      const taken = yield* store
        .create({ name: "Wall walk", category: "gymnastics", aliases: ["DU"] })
        .pipe(Effect.flip);
      expect(taken).toMatchObject({ _tag: "AliasTakenError", movementId: "double-under" });
      expect((yield* store.list()).some((movement) => movement.id === "wall-walk")).toBe(false);
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
      expect(variationsOf(yield* store.list())).toEqual(["hang-power-snatch", "power-snatch"]);

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
        MovementId.make("thruster"),
        MovementId.make("front-squat"),
      );
      expect(moved.variationOf).toBe("front-squat");
      expect(variationsOf(yield* store.list())).toEqual(["hang-power-snatch", "squat-snatch"]);
    }).pipe(Effect.provide(layer)),
  );
});
