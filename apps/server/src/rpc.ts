import { ChalkRpcGroup, RPC_METHODS, WorkoutStorageError } from "@chalk/contracts";
import * as Effect from "effect/Effect";

import * as WorkoutStore from "./workout/WorkoutStore.ts";

// Persistence causes stay in the server log; clients only see which operation failed.
const reportStorageError = (error: WorkoutStore.WorkoutPersistenceError) =>
  Effect.logError(error.message, error.cause).pipe(
    Effect.andThen(Effect.fail(new WorkoutStorageError({ operation: error.operation }))),
  );

/** Thin transport: RpcServer decodes the payload, the handler calls one service method and maps errors. */
export const layer = ChalkRpcGroup.toLayer(
  Effect.gen(function* () {
    const store = yield* WorkoutStore.WorkoutStore;
    return ChalkRpcGroup.of({
      [RPC_METHODS.workoutsList]: () =>
        store.list().pipe(Effect.catchTags({ WorkoutPersistenceError: reportStorageError })),
      [RPC_METHODS.workoutsLog]: (input) =>
        store.log(input).pipe(Effect.catchTags({ WorkoutPersistenceError: reportStorageError })),
      [RPC_METHODS.workoutsDelete]: ({ id }) =>
        store.remove(id).pipe(Effect.catchTags({ WorkoutPersistenceError: reportStorageError })),
    });
  }),
);
