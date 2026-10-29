import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as Schema from "effect/Schema";

import { WorkoutId } from "./baseSchemas.ts";
import { LogWorkoutInput, Workout, WorkoutNotFoundError, WorkoutStorageError } from "./workout.ts";

export const RPC_METHODS = {
  workoutsList: "workouts.list",
  workoutsLog: "workouts.log",
  workoutsDelete: "workouts.delete",
} as const;

/** Mount point for the RPC endpoint on the server, and the web dev proxy. */
export const RPC_PATH = "/rpc";

const WorkoutsListRpc = Rpc.make(RPC_METHODS.workoutsList, {
  success: Schema.Array(Workout),
  error: WorkoutStorageError,
});

const WorkoutsLogRpc = Rpc.make(RPC_METHODS.workoutsLog, {
  payload: LogWorkoutInput,
  success: Workout,
  error: WorkoutStorageError,
});

const WorkoutsDeleteRpc = Rpc.make(RPC_METHODS.workoutsDelete, {
  payload: { id: WorkoutId },
  error: Schema.Union([WorkoutNotFoundError, WorkoutStorageError]),
});

export const ChalkRpcGroup = RpcGroup.make(WorkoutsListRpc, WorkoutsLogRpc, WorkoutsDeleteRpc);
