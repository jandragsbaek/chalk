import {
  BookingboardNotConnectedError,
  BookingboardTokenExpiredError,
  BookingboardTokenInvalidError,
  BookingboardUnavailableError,
  type BookingboardClass,
  type BookingboardDay,
  type BookingboardStatus,
  type ConnectBookingboardInput,
  type IsoDate,
} from "@chalk/contracts";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";

import { boxLocal, dayBefore, programText, tokenExpiry } from "./program.ts";

/** Box 7100's bookingboard API, as its own web app calls it. */
export const BOOKINGBOARD_API = "https://box7100.mobile.api.bookingboard.io/api";

/** A day further back pulls every class since, gym-wide: tens of megabytes. */
const REQUEST_TIMEOUT = Duration.seconds(60);

/** Statuses bookingboard gives a booking the athlete pulled out of; any other one counts. */
const CANCELLED_STATUSES = new Set(["OptedOut"]);

export class BookingboardPersistenceError extends Schema.TaggedError<BookingboardPersistenceError>()(
  "BookingboardPersistenceError",
  {
    operation: Schema.Literals([
      "load the bookingboard connection",
      "save the bookingboard connection",
      "remove the bookingboard connection",
    ]),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to ${this.operation}.`;
  }
}

/**
 * One booking. `/participations` answers with every member's bookings since `from`; only the
 * athlete's own are kept, and nothing else from it is stored or logged.
 */
const Participation = Schema.Struct({
  classId: Schema.Int,
  className: Schema.String,
  status: Schema.String,
  begins: Schema.String,
  participantId: Schema.Int,
});
const decodeParticipations = Schema.decodeUnknownEffect(Schema.Array(Participation));

const OptionalText = Schema.optional(Schema.NullOr(Schema.String));

/** A class with its program; its `participants` are other members' and never read. */
const ClassDetail = Schema.Struct({
  title: OptionalText,
  begins: OptionalText,
  instructors: Schema.optional(Schema.NullOr(Schema.Array(Schema.Struct({ name: OptionalText })))),
  program: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        workouts: Schema.optional(
          Schema.NullOr(
            Schema.Array(
              Schema.Struct({ title: OptionalText, text: OptionalText, description: OptionalText }),
            ),
          ),
        ),
      }),
    ),
  ),
});
const decodeClass = Schema.decodeUnknownEffect(ClassDetail);

const ConnectionRow = Schema.Struct({
  token: Schema.String,
  participantId: Schema.Int,
  expiresAt: Schema.String,
});
type ConnectionRow = typeof ConnectionRow.Type;

const statusOf = (row: ConnectionRow | undefined): BookingboardStatus =>
  row === undefined
    ? { _tag: "disconnected" }
    : { _tag: "connected", participantId: row.participantId, expiresAt: row.expiresAt };

type ReadError = BookingboardTokenExpiredError | BookingboardUnavailableError;

export class Bookingboard extends Context.Service<
  Bookingboard,
  {
    readonly status: () => Effect.Effect<BookingboardStatus, BookingboardPersistenceError>;
    /** Reads bookingboard once with the token, so a bad paste fails here, then keeps it. */
    readonly connect: (
      input: ConnectBookingboardInput,
    ) => Effect.Effect<
      BookingboardStatus,
      BookingboardTokenInvalidError | ReadError | BookingboardPersistenceError
    >;
    readonly disconnect: () => Effect.Effect<void, BookingboardPersistenceError>;
    /**
     * The programs of the athlete's classes on a box-local day (booked or attended, not opted
     * out), earliest first. Classes without a program, like open gym, only set `openGym`.
     */
    readonly day: (
      date: IsoDate,
    ) => Effect.Effect<
      BookingboardDay,
      BookingboardNotConnectedError | ReadError | BookingboardPersistenceError
    >;
  }
>()("chalk/bookingboard/Bookingboard") {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  // One retry on a network error, a 429 or a 5xx; bookingboard is a small service.
  const http = (yield* HttpClient.HttpClient).pipe(
    HttpClient.retryTransient({ times: 1, schedule: Schedule.exponential(Duration.seconds(1)) }),
  );

  const selectConnection = SqlSchema.findAll({
    Request: Schema.Void,
    Result: ConnectionRow,
    execute: () => sql`
      SELECT token, participant_id AS "participantId", expires_at AS "expiresAt"
      FROM bookingboard_connection
      WHERE id = 1
    `,
  });

  const loadConnection = selectConnection(undefined).pipe(
    Effect.map((rows) => rows[0]),
    Effect.mapError(
      (cause) =>
        new BookingboardPersistenceError({ operation: "load the bookingboard connection", cause }),
    ),
  );

  const unavailable = (reason: string) => new BookingboardUnavailableError({ reason });

  /** GET only. A 401/403 is an expired token; a 404 is `undefined`. Bodies are never logged. */
  const getJson = (token: string, path: string, params: Record<string, string> = {}) =>
    http
      .execute(
        HttpClientRequest.get(`${BOOKINGBOARD_API}${path}`).pipe(
          HttpClientRequest.bearerToken(token),
          HttpClientRequest.acceptJson,
          HttpClientRequest.setUrlParams(params),
        ),
      )
      .pipe(
        Effect.flatMap((response): Effect.Effect<unknown, ReadError | unknown> => {
          if (response.status === 401 || response.status === 403)
            return Effect.fail(new BookingboardTokenExpiredError());
          if (response.status === 404) return Effect.succeed(undefined);
          if (response.status >= 400)
            return Effect.fail(unavailable(`it answered HTTP ${response.status}.`));
          return response.json;
        }),
        Effect.timeoutOrElse({
          duration: REQUEST_TIMEOUT,
          orElse: () => Effect.fail(unavailable("it did not answer in time.")),
        }),
        Effect.catch((error) =>
          error instanceof BookingboardTokenExpiredError ||
          error instanceof BookingboardUnavailableError
            ? Effect.fail(error)
            : Effect.fail(unavailable("it could not be reached.")),
        ),
      );

  const failIfExpired = Effect.fn("Bookingboard.failIfExpired")(function* (expiresAt: string) {
    if (Date.parse(expiresAt) <= (yield* Clock.currentTimeMillis))
      return yield* new BookingboardTokenExpiredError();
  });

  /** The athlete's bookings on the box-local `date`, one per class. */
  const bookingsOn = Effect.fn("Bookingboard.bookingsOn")(function* (
    connection: ConnectionRow,
    date: IsoDate,
  ) {
    // `from` is a lower bound (`to` is ignored) read in UTC; a day early catches the box's
    // midnight hour, and the day itself is picked out below in box time.
    const body = yield* getJson(connection.token, "/participations", { from: dayBefore(date) });
    const all = yield* decodeParticipations(body ?? []).pipe(
      Effect.mapError(() => unavailable("its bookings came back in a shape Chalk does not know.")),
    );
    const mine = new Map<number, typeof Participation.Type>();
    for (const booking of all)
      if (
        booking.participantId === connection.participantId &&
        !CANCELLED_STATUSES.has(booking.status) &&
        boxLocal(booking.begins).date === date &&
        !mine.has(booking.classId)
      )
        mine.set(booking.classId, booking);
    return [...mine.values()];
  });

  const classOf = Effect.fn("Bookingboard.classOf")(function* (
    token: string,
    booking: typeof Participation.Type,
  ) {
    const body = yield* getJson(token, `/classes/${booking.classId}`);
    if (body === undefined) {
      yield* Effect.logWarning(`Bookingboard class ${booking.classId} is gone; skipping it.`);
      return undefined;
    }
    const detail = yield* decodeClass(body).pipe(
      Effect.mapError(() => unavailable("a class came back in a shape Chalk does not know.")),
    );
    const text = programText(detail.program?.workouts ?? []);
    if (text === "") return "openGym" as const;
    const coaches = (detail.instructors ?? []).flatMap((instructor) =>
      instructor.name?.trim() ? [instructor.name.trim()] : [],
    );
    return {
      classId: booking.classId,
      title: detail.title?.trim() || booking.className,
      startsAt: boxLocal(detail.begins ?? booking.begins).time,
      coach: coaches.length === 0 ? null : coaches.join(", "),
      status: booking.status,
      text,
    } satisfies BookingboardClass;
  });

  const status = Effect.fn("Bookingboard.status")(function* () {
    return statusOf(yield* loadConnection);
  });

  const connect = Effect.fn("Bookingboard.connect")(function* (input: ConnectBookingboardInput) {
    const expiresAt = tokenExpiry(input.token);
    if (expiresAt === undefined) return yield* new BookingboardTokenInvalidError();
    yield* failIfExpired(expiresAt);
    const now = yield* DateTime.now;
    // The smallest read there is: bookings from today on, about a week of the box's schedule.
    yield* getJson(input.token, "/participations", {
      from: boxLocal(DateTime.formatIso(now)).date,
    });
    const row: ConnectionRow = {
      token: input.token,
      participantId: input.participantId,
      expiresAt,
    };
    yield* sql`
      INSERT INTO bookingboard_connection (id, token, participant_id, expires_at, updated_at)
      VALUES (1, ${row.token}, ${row.participantId}, ${row.expiresAt}, ${DateTime.formatIso(now)})
      ON CONFLICT (id) DO UPDATE SET
        token = excluded.token,
        participant_id = excluded.participant_id,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `.pipe(
      Effect.mapError(
        (cause) =>
          new BookingboardPersistenceError({
            operation: "save the bookingboard connection",
            cause,
          }),
      ),
    );
    return statusOf(row);
  });

  const disconnect = Effect.fn("Bookingboard.disconnect")(function* () {
    yield* sql`DELETE FROM bookingboard_connection WHERE id = 1`.pipe(
      Effect.mapError(
        (cause) =>
          new BookingboardPersistenceError({
            operation: "remove the bookingboard connection",
            cause,
          }),
      ),
    );
  });

  const day = Effect.fn("Bookingboard.day")(function* (date: IsoDate) {
    const connection = yield* loadConnection;
    if (connection === undefined) return yield* new BookingboardNotConnectedError();
    yield* failIfExpired(connection.expiresAt);
    const bookings = yield* bookingsOn(connection, date);
    const classes = yield* Effect.forEach(bookings, (booking) =>
      classOf(connection.token, booking),
    );
    return {
      date,
      classes: classes
        .filter((entry) => typeof entry === "object")
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      openGym: classes.includes("openGym"),
    } satisfies BookingboardDay;
  });

  return Bookingboard.of({ status, connect, disconnect, day });
});

/** Needs an `HttpClient`: fetch in the server, a fake in tests. */
export const layer = Layer.effect(Bookingboard, make);
