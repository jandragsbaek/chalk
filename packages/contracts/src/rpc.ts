import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as Schema from "effect/Schema";

import { LiftSetId, WorkoutId } from "./baseSchemas.ts";
import {
  CoachEvent,
  CoachSendInput,
  CoachStatus,
  CoachStorageError,
  CoachThread,
  CoachThreadDetail,
  CoachThreadId,
  CoachThreadNotFoundError,
  CoachUnavailableError,
} from "./coach.ts";
import { LevelOverview, LevelStorageError } from "./levelOverview.ts";
import {
  LiftSet,
  LiftSetNotFoundError,
  LogLiftSetInput,
  Movement,
  MovementNotFoundError,
  MovementRecords,
  StrengthStorageError,
} from "./strength.ts";
import {
  BenchmarkResult,
  LogWorkoutInput,
  Workout,
  WorkoutNotFoundError,
  WorkoutStorageError,
} from "./workout.ts";

export const RPC_METHODS = {
  workoutsList: "workouts.list",
  workoutsLog: "workouts.log",
  workoutsDelete: "workouts.delete",
  movementsList: "movements.list",
  liftsList: "lifts.list",
  liftsLog: "lifts.log",
  liftsDelete: "lifts.delete",
  liftsRecords: "lifts.records",
  levelsList: "levels.list",
  benchmarksResults: "benchmarks.results",
  coachStatus: "coach.status",
  coachThreads: "coach.threads",
  coachThread: "coach.thread",
  coachSend: "coach.send",
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

const MovementsListRpc = Rpc.make(RPC_METHODS.movementsList, {
  success: Schema.Array(Movement),
  error: StrengthStorageError,
});

const LiftsListRpc = Rpc.make(RPC_METHODS.liftsList, {
  success: Schema.Array(LiftSet),
  error: StrengthStorageError,
});

const LiftsLogRpc = Rpc.make(RPC_METHODS.liftsLog, {
  payload: LogLiftSetInput,
  success: LiftSet,
  error: Schema.Union([MovementNotFoundError, StrengthStorageError]),
});

const LiftsDeleteRpc = Rpc.make(RPC_METHODS.liftsDelete, {
  payload: { id: LiftSetId },
  error: Schema.Union([LiftSetNotFoundError, StrengthStorageError]),
});

const LiftsRecordsRpc = Rpc.make(RPC_METHODS.liftsRecords, {
  success: Schema.Array(MovementRecords),
  error: StrengthStorageError,
});

const LevelsListRpc = Rpc.make(RPC_METHODS.levelsList, {
  success: LevelOverview,
  error: LevelStorageError,
});

/** Every attempt at a named workout, newest first; the benchmarks themselves are contracts data. */
const BenchmarksResultsRpc = Rpc.make(RPC_METHODS.benchmarksResults, {
  success: Schema.Array(BenchmarkResult),
  error: WorkoutStorageError,
});

const CoachStatusRpc = Rpc.make(RPC_METHODS.coachStatus, { success: CoachStatus });

/** Every coach thread, most recently answered first. */
const CoachThreadsRpc = Rpc.make(RPC_METHODS.coachThreads, {
  success: Schema.Array(CoachThread),
  error: CoachStorageError,
});

const CoachThreadRpc = Rpc.make(RPC_METHODS.coachThread, {
  payload: { id: CoachThreadId },
  success: CoachThreadDetail,
  error: Schema.Union([CoachThreadNotFoundError, CoachStorageError]),
});

/** Saves the athlete's message, then streams the coach's reads and its saved reply. */
const CoachSendRpc = Rpc.make(RPC_METHODS.coachSend, {
  payload: CoachSendInput,
  success: CoachEvent,
  error: Schema.Union([CoachUnavailableError, CoachThreadNotFoundError, CoachStorageError]),
  stream: true,
});

export const ChalkRpcGroup = RpcGroup.make(
  WorkoutsListRpc,
  WorkoutsLogRpc,
  WorkoutsDeleteRpc,
  MovementsListRpc,
  LiftsListRpc,
  LiftsLogRpc,
  LiftsDeleteRpc,
  LiftsRecordsRpc,
  LevelsListRpc,
  BenchmarksResultsRpc,
  CoachStatusRpc,
  CoachThreadsRpc,
  CoachThreadRpc,
  CoachSendRpc,
);
