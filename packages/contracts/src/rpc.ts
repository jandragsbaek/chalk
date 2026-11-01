import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as Schema from "effect/Schema";

import { IsoDate, LiftSetId, WorkoutId } from "./baseSchemas.ts";
import {
  BookingboardDay,
  BookingboardNotConnectedError,
  BookingboardStatus,
  BookingboardStorageError,
  BookingboardTokenExpiredError,
  BookingboardTokenInvalidError,
  BookingboardUnavailableError,
  ConnectBookingboardInput,
} from "./bookingboard.ts";
import {
  CoachEvent,
  CoachModelNotAllowedError,
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
import { PowerSession, PowerStorageError } from "./power/history.ts";
import {
  AthleteBody,
  AthleteProfile,
  BodyweightEntry,
  BodyweightNotFoundError,
  ProfileStorageError,
} from "./profile.ts";
import { MarkRestDayInput, RestDay, RestDayNotFoundError, RestDayStorageError } from "./restDay.ts";
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
  BlockId,
  BlockNotFoundError,
  ProgrammedSession,
  ProgrammedSessionId,
  ProgrammedSessionNotFoundError,
  TrainingBlock,
  TrainingMax,
  TrainingStorageError,
} from "./training.ts";
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
  powerSessions: "power.sessions",
  coachStatus: "coach.status",
  coachThreads: "coach.threads",
  coachThread: "coach.thread",
  coachSend: "coach.send",
  profileGet: "profile.get",
  profileUpdate: "profile.update",
  bodyweightsLog: "bodyweights.log",
  bodyweightsDelete: "bodyweights.delete",
  bookingboardStatus: "bookingboard.status",
  bookingboardConnect: "bookingboard.connect",
  bookingboardDisconnect: "bookingboard.disconnect",
  bookingboardDay: "bookingboard.day",
  restDaysList: "restDays.list",
  restDaysMark: "restDays.mark",
  restDaysClear: "restDays.clear",
  blocksList: "blocks.list",
  blocksSchedule: "blocks.schedule",
  blocksRemove: "blocks.remove",
  blocksSetTrainingMax: "blocks.setTrainingMax",
  sessionsMove: "sessions.move",
  sessionsTick: "sessions.tick",
  sessionsRemove: "sessions.remove",
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

/** Every saved session work can be estimated for, oldest first: imports and Rx benchmarks. */
const PowerSessionsRpc = Rpc.make(RPC_METHODS.powerSessions, {
  success: Schema.Array(PowerSession),
  error: PowerStorageError,
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
  error: Schema.Union([
    CoachUnavailableError,
    CoachModelNotAllowedError,
    CoachThreadNotFoundError,
    CoachStorageError,
  ]),
  stream: true,
});

/** The athlete's whole profile (sex, height, limbs, every weigh-in), so a page loads it once. */
const ProfileGetRpc = Rpc.make(RPC_METHODS.profileGet, {
  success: AthleteProfile,
  error: ProfileStorageError,
});

const ProfileUpdateRpc = Rpc.make(RPC_METHODS.profileUpdate, {
  payload: AthleteBody,
  success: AthleteProfile,
  error: ProfileStorageError,
});

/** Logs the day's weigh-in; logging a day again replaces its reading. */
const BodyweightsLogRpc = Rpc.make(RPC_METHODS.bodyweightsLog, {
  payload: BodyweightEntry,
  success: BodyweightEntry,
  error: ProfileStorageError,
});

const BodyweightsDeleteRpc = Rpc.make(RPC_METHODS.bodyweightsDelete, {
  payload: { performedOn: IsoDate },
  error: Schema.Union([BodyweightNotFoundError, ProfileStorageError]),
});

const BookingboardStatusRpc = Rpc.make(RPC_METHODS.bookingboardStatus, {
  success: BookingboardStatus,
  error: BookingboardStorageError,
});

/** Checks the token against bookingboard, then keeps it with the athlete's participant id. */
const BookingboardConnectRpc = Rpc.make(RPC_METHODS.bookingboardConnect, {
  payload: ConnectBookingboardInput,
  success: BookingboardStatus,
  error: Schema.Union([
    BookingboardTokenInvalidError,
    BookingboardTokenExpiredError,
    BookingboardUnavailableError,
    BookingboardStorageError,
  ]),
});

/** Forgets the token. */
const BookingboardDisconnectRpc = Rpc.make(RPC_METHODS.bookingboardDisconnect, {
  error: BookingboardStorageError,
});

/** The programs of the classes the athlete booked or attended on a box-local day. */
const BookingboardDayRpc = Rpc.make(RPC_METHODS.bookingboardDay, {
  payload: { date: IsoDate },
  success: BookingboardDay,
  error: Schema.Union([
    BookingboardNotConnectedError,
    BookingboardTokenExpiredError,
    BookingboardUnavailableError,
    BookingboardStorageError,
  ]),
});

/** Every day marked as rest, oldest first. */
const RestDaysListRpc = Rpc.make(RPC_METHODS.restDaysList, {
  success: Schema.Array(RestDay),
  error: RestDayStorageError,
});

/** Marks a day as rest, sick, injured or travel; marking it again replaces the kind. */
const RestDaysMarkRpc = Rpc.make(RPC_METHODS.restDaysMark, {
  payload: MarkRestDayInput,
  success: RestDay,
  error: RestDayStorageError,
});

const RestDaysClearRpc = Rpc.make(RPC_METHODS.restDaysClear, {
  payload: { day: IsoDate },
  error: Schema.Union([RestDayNotFoundError, RestDayStorageError]),
});

/** Every training block, drafts included, oldest first; each carries its sessions by day. */
const BlocksListRpc = Rpc.make(RPC_METHODS.blocksList, {
  success: Schema.Array(TrainingBlock),
  error: TrainingStorageError,
});

/** Puts a draft in the calendar: its sessions stop being a proposal. */
const BlocksScheduleRpc = Rpc.make(RPC_METHODS.blocksSchedule, {
  payload: { id: BlockId },
  success: TrainingBlock,
  error: Schema.Union([BlockNotFoundError, TrainingStorageError]),
});

/** Removes a block and every session in it; a draft discarded, or a cycle abandoned. */
const BlocksRemoveRpc = Rpc.make(RPC_METHODS.blocksRemove, {
  payload: { id: BlockId },
  error: Schema.Union([BlockNotFoundError, TrainingStorageError]),
});

/** Sets one lift's training max; every percent of it in the block rescales. */
const BlocksSetTrainingMaxRpc = Rpc.make(RPC_METHODS.blocksSetTrainingMax, {
  payload: { id: BlockId, max: TrainingMax },
  success: TrainingBlock,
  error: Schema.Union([BlockNotFoundError, TrainingStorageError]),
});

/** Moves one session to another day; the rest of its block stays put. */
const SessionsMoveRpc = Rpc.make(RPC_METHODS.sessionsMove, {
  payload: { id: ProgrammedSessionId, day: IsoDate },
  success: ProgrammedSession,
  error: Schema.Union([ProgrammedSessionNotFoundError, TrainingStorageError]),
});

/** Ticks one line done, or clears the tick. */
const SessionsTickRpc = Rpc.make(RPC_METHODS.sessionsTick, {
  payload: {
    id: ProgrammedSessionId,
    line: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    done: Schema.Boolean,
  },
  success: ProgrammedSession,
  error: Schema.Union([ProgrammedSessionNotFoundError, TrainingStorageError]),
});

const SessionsRemoveRpc = Rpc.make(RPC_METHODS.sessionsRemove, {
  payload: { id: ProgrammedSessionId },
  error: Schema.Union([ProgrammedSessionNotFoundError, TrainingStorageError]),
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
  PowerSessionsRpc,
  CoachStatusRpc,
  CoachThreadsRpc,
  CoachThreadRpc,
  CoachSendRpc,
  ProfileGetRpc,
  ProfileUpdateRpc,
  BodyweightsLogRpc,
  BodyweightsDeleteRpc,
  BookingboardStatusRpc,
  BookingboardConnectRpc,
  BookingboardDisconnectRpc,
  BookingboardDayRpc,
  RestDaysListRpc,
  RestDaysMarkRpc,
  RestDaysClearRpc,
  BlocksListRpc,
  BlocksScheduleRpc,
  BlocksRemoveRpc,
  BlocksSetTrainingMaxRpc,
  SessionsMoveRpc,
  SessionsTickRpc,
  SessionsRemoveRpc,
);
