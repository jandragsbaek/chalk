import {
  BookingboardStorageError,
  ChalkRpcGroup,
  LevelStorageError,
  ProfileStorageError,
  PowerStorageError,
  RestDayStorageError,
  RPC_METHODS,
  StrengthStorageError,
  WorkoutStorageError,
} from "@chalk/contracts";
import * as Effect from "effect/Effect";

import * as Bookingboard from "./bookingboard/Bookingboard.ts";
import * as CoachService from "./coach/CoachService.ts";
import * as LevelStore from "./levels/LevelStore.ts";
import * as ProfileStore from "./profile/ProfileStore.ts";
import * as PowerStore from "./power/PowerStore.ts";
import * as RestDayStore from "./rest/RestDayStore.ts";
import * as StrengthStore from "./strength/StrengthStore.ts";
import * as WorkoutStore from "./workout/WorkoutStore.ts";

// Persistence causes stay in the server log; clients only see which operation failed.
const reportStorageError = (error: WorkoutStore.WorkoutPersistenceError) =>
  Effect.logError(error.message, error.cause).pipe(
    Effect.andThen(Effect.fail(new WorkoutStorageError({ operation: error.operation }))),
  );

const reportStrengthStorageError = (error: StrengthStore.StrengthPersistenceError) =>
  Effect.logError(error.message, error.cause).pipe(
    Effect.andThen(Effect.fail(new StrengthStorageError({ operation: error.operation }))),
  );

const reportLevelStorageError = (error: LevelStore.LevelPersistenceError) =>
  Effect.logError(error.message, error.cause).pipe(
    Effect.andThen(Effect.fail(new LevelStorageError({ operation: error.operation }))),
  );

const reportProfileStorageError = (error: ProfileStore.ProfilePersistenceError) =>
  Effect.logError(error.message, error.cause).pipe(
    Effect.andThen(Effect.fail(new ProfileStorageError({ operation: error.operation }))),
  );

const reportPowerStorageError = (error: PowerStore.PowerPersistenceError) =>
  Effect.logError(error.message, error.cause).pipe(
    Effect.andThen(Effect.fail(new PowerStorageError({ operation: error.operation }))),
  );

const reportBookingboardStorageError = (error: Bookingboard.BookingboardPersistenceError) =>
  Effect.logError(error.message, error.cause).pipe(
    Effect.andThen(Effect.fail(new BookingboardStorageError({ operation: error.operation }))),
  );

const reportRestDayStorageError = (error: RestDayStore.RestDayPersistenceError) =>
  Effect.logError(error.message, error.cause).pipe(
    Effect.andThen(Effect.fail(new RestDayStorageError({ operation: error.operation }))),
  );

/** Thin transport: RpcServer decodes the payload, the handler calls one service method and maps errors. */
export const layer = ChalkRpcGroup.toLayer(
  Effect.gen(function* () {
    const store = yield* WorkoutStore.WorkoutStore;
    const strength = yield* StrengthStore.StrengthStore;
    const levels = yield* LevelStore.LevelStore;
    const power = yield* PowerStore.PowerStore;
    const coach = yield* CoachService.CoachService;
    const profile = yield* ProfileStore.ProfileStore;
    const bookingboard = yield* Bookingboard.Bookingboard;
    const onStrengthError = { StrengthPersistenceError: reportStrengthStorageError };
    const onProfileError = { ProfilePersistenceError: reportProfileStorageError };
    const onBookingboardError = { BookingboardPersistenceError: reportBookingboardStorageError };
    const restDays = yield* RestDayStore.RestDayStore;
    const onRestDayError = { RestDayPersistenceError: reportRestDayStorageError };
    return ChalkRpcGroup.of({
      [RPC_METHODS.workoutsList]: () =>
        store.list().pipe(Effect.catchTags({ WorkoutPersistenceError: reportStorageError })),
      [RPC_METHODS.workoutsLog]: (input) =>
        store.log(input).pipe(Effect.catchTags({ WorkoutPersistenceError: reportStorageError })),
      [RPC_METHODS.workoutsDelete]: ({ id }) =>
        store.remove(id).pipe(Effect.catchTags({ WorkoutPersistenceError: reportStorageError })),
      [RPC_METHODS.movementsList]: () =>
        strength.movements().pipe(Effect.catchTags(onStrengthError)),
      [RPC_METHODS.liftsList]: () => strength.list().pipe(Effect.catchTags(onStrengthError)),
      [RPC_METHODS.liftsLog]: (input) =>
        strength.log(input).pipe(Effect.catchTags(onStrengthError)),
      [RPC_METHODS.liftsDelete]: ({ id }) =>
        strength.remove(id).pipe(Effect.catchTags(onStrengthError)),
      [RPC_METHODS.liftsRecords]: () => strength.records().pipe(Effect.catchTags(onStrengthError)),
      [RPC_METHODS.benchmarksResults]: () =>
        store.results().pipe(Effect.catchTags({ WorkoutPersistenceError: reportStorageError })),
      [RPC_METHODS.levelsList]: () =>
        levels
          .overview()
          .pipe(Effect.catchTags({ LevelPersistenceError: reportLevelStorageError })),
      [RPC_METHODS.powerSessions]: () =>
        power.sessions().pipe(Effect.catchTags({ PowerPersistenceError: reportPowerStorageError })),
      [RPC_METHODS.coachStatus]: () => coach.status(),
      [RPC_METHODS.coachThreads]: () => coach.threads(),
      [RPC_METHODS.coachThread]: ({ id }) => coach.thread(id),
      [RPC_METHODS.coachSend]: (input) => coach.send(input),
      [RPC_METHODS.profileGet]: () => profile.get().pipe(Effect.catchTags(onProfileError)),
      [RPC_METHODS.profileUpdate]: (body) =>
        profile.update(body).pipe(Effect.catchTags(onProfileError)),
      [RPC_METHODS.bodyweightsLog]: (entry) =>
        profile.logBodyweight(entry).pipe(Effect.catchTags(onProfileError)),
      [RPC_METHODS.bodyweightsDelete]: ({ performedOn }) =>
        profile.removeBodyweight(performedOn).pipe(Effect.catchTags(onProfileError)),
      [RPC_METHODS.bookingboardStatus]: () =>
        bookingboard.status().pipe(Effect.catchTags(onBookingboardError)),
      [RPC_METHODS.bookingboardConnect]: (input) =>
        bookingboard.connect(input).pipe(Effect.catchTags(onBookingboardError)),
      [RPC_METHODS.bookingboardDisconnect]: () =>
        bookingboard.disconnect().pipe(Effect.catchTags(onBookingboardError)),
      [RPC_METHODS.bookingboardDay]: ({ date }) =>
        bookingboard.day(date).pipe(Effect.catchTags(onBookingboardError)),
      [RPC_METHODS.restDaysList]: () => restDays.list().pipe(Effect.catchTags(onRestDayError)),
      [RPC_METHODS.restDaysMark]: (input) =>
        restDays.mark(input, "athlete").pipe(Effect.catchTags(onRestDayError)),
      [RPC_METHODS.restDaysClear]: ({ day }) =>
        restDays.clear(day).pipe(Effect.catchTags(onRestDayError)),
    });
  }),
);
