import { ChalkAdminApi, ImportStorageError, WorkoutStorageError } from "@chalk/contracts";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";

import * as CatalogStore from "./catalog/CatalogStore.ts";
import * as ImportStore from "./import/ImportStore.ts";
import * as PlanStore from "./plan/PlanStore.ts";
import * as WorkoutStore from "./workout/WorkoutStore.ts";

// Persistence causes stay in the server log; clients only see which operation failed.
const reportStorageError = (error: WorkoutStore.WorkoutPersistenceError) =>
  Effect.logError(error.message, error.cause).pipe(
    Effect.andThen(Effect.fail(new WorkoutStorageError({ operation: error.operation }))),
  );

const reportImportStorageError = (
  error:
    | CatalogStore.CatalogPersistenceError
    | ImportStore.ImportPersistenceError
    | PlanStore.PlanPersistenceError,
) =>
  Effect.logError(error.message, error.cause).pipe(
    Effect.andThen(Effect.fail(new ImportStorageError({ operation: error.operation }))),
  );

/** Thin transport: HttpApiBuilder decodes the request, the handler calls one service method and maps errors. */
export const layerWorkouts = HttpApiBuilder.group(
  ChalkAdminApi,
  "workouts",
  Effect.fn("AdminApi.workouts")(function* (handlers) {
    const store = yield* WorkoutStore.WorkoutStore;
    return handlers.handleAll({
      search: ({ query }) =>
        (query.q === undefined ? store.list() : store.search(query.q)).pipe(
          Effect.catchTags({ WorkoutPersistenceError: reportStorageError }),
        ),
      stats: () =>
        store.stats().pipe(Effect.catchTags({ WorkoutPersistenceError: reportStorageError })),
      sessions: () =>
        store.sessions().pipe(Effect.catchTags({ WorkoutPersistenceError: reportStorageError })),
      similar: () =>
        store.similar().pipe(Effect.catchTags({ WorkoutPersistenceError: reportStorageError })),
      remove: ({ params }) =>
        store
          .remove(params.id)
          .pipe(Effect.catchTags({ WorkoutPersistenceError: reportStorageError })),
    });
  }),
);

export const layerMovements = HttpApiBuilder.group(
  ChalkAdminApi,
  "movements",
  Effect.fn("AdminApi.movements")(function* (handlers) {
    const store = yield* CatalogStore.CatalogStore;
    return handlers.handleAll({
      list: () =>
        store.list().pipe(Effect.catchTags({ CatalogPersistenceError: reportImportStorageError })),
      create: ({ payload }) =>
        store
          .create(payload)
          .pipe(Effect.catchTags({ CatalogPersistenceError: reportImportStorageError })),
      addAlias: ({ params, payload }) =>
        store
          .addAlias(params.id, payload.alias)
          .pipe(Effect.catchTags({ CatalogPersistenceError: reportImportStorageError })),
      setVariationOf: ({ params, payload }) =>
        store
          .setVariationOf(params.id, payload.variationOf)
          .pipe(Effect.catchTags({ CatalogPersistenceError: reportImportStorageError })),
      setLevels: ({ params, payload }) =>
        store
          .setLevels(params.id, payload)
          .pipe(Effect.catchTags({ CatalogPersistenceError: reportImportStorageError })),
    });
  }),
);

export const layerImports = HttpApiBuilder.group(
  ChalkAdminApi,
  "imports",
  Effect.fn("AdminApi.imports")(function* (handlers) {
    const store = yield* ImportStore.ImportStore;
    return handlers.handleAll({
      list: () =>
        store.list().pipe(Effect.catchTags({ ImportPersistenceError: reportImportStorageError })),
      get: ({ params }) =>
        store
          .get(params.workoutId)
          .pipe(Effect.catchTags({ ImportPersistenceError: reportImportStorageError })),
      save: ({ payload }) =>
        store
          .save(payload)
          .pipe(Effect.catchTags({ ImportPersistenceError: reportImportStorageError })),
    });
  }),
);

export const layerPlans = HttpApiBuilder.group(
  ChalkAdminApi,
  "plans",
  Effect.fn("AdminApi.plans")(function* (handlers) {
    const store = yield* PlanStore.PlanStore;
    return handlers.handleAll({
      list: () =>
        store.list().pipe(Effect.catchTags({ PlanPersistenceError: reportImportStorageError })),
      get: ({ params }) =>
        store
          .get(params.id)
          .pipe(Effect.catchTags({ PlanPersistenceError: reportImportStorageError })),
      save: ({ payload }) =>
        store
          .save(payload)
          .pipe(Effect.catchTags({ PlanPersistenceError: reportImportStorageError })),
      remove: ({ params }) =>
        store
          .remove(params.id)
          .pipe(Effect.catchTags({ PlanPersistenceError: reportImportStorageError })),
    });
  }),
);
