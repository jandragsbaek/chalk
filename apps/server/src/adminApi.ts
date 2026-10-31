import { ChalkAdminApi, WorkoutStorageError } from "@chalk/contracts";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";

import * as WorkoutStore from "./workout/WorkoutStore.ts";

// Persistence causes stay in the server log; clients only see which operation failed.
const reportStorageError = (error: WorkoutStore.WorkoutPersistenceError) =>
  Effect.logError(error.message, error.cause).pipe(
    Effect.andThen(Effect.fail(new WorkoutStorageError({ operation: error.operation }))),
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
      remove: ({ params }) =>
        store
          .remove(params.id)
          .pipe(Effect.catchTags({ WorkoutPersistenceError: reportStorageError })),
    });
  }),
);
