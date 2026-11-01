import {
  ATTENDED_STATUSES,
  BookingboardNotConnectedError,
  BookingboardTokenExpiredError,
  BookingboardTokenInvalidError,
  BookingboardUnavailableError,
  type BookingboardAttendance,
  type BookingboardAttendanceInput,
  type BookingboardClass,
  type BookingboardDay,
  type BookingboardStatus,
  type ConnectBookingboardInput,
  type IsoDate,
  type SkipBookingboardDayInput,
} from "@chalk/contracts";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";

import { boxLocal, dayBefore, daysBefore, programText, tokenExpiry } from "./program.ts";

/** Box 7100's mobile API, as its app calls it: class programs. */
export const BOOKINGBOARD_API = "https://box7100.mobile.api.bookingboard.io/api";

/** Box 7100's web API, as its site calls it: the account, and the athlete's own classes. */
export const BOOKINGBOARD_WEB_API = "https://box7100.bookingboard.io/api";

const REQUEST_TIMEOUT = Duration.seconds(30);

/** `/account/{id}/classes` pages; the site asks for 100. A year of classes is two pages. */
const PAGE_SIZE = 100;
/** A runaway guard: 5000 classes is more than a decade of training. */
const MAX_PAGES = 50;

/** Statuses bookingboard gives a booking the athlete pulled out of; any other one counts. */
const CANCELLED_STATUSES = new Set(["OptedOut", "OptedOutTooLate", "Cancelled"]);

const ATTENDED = new Set(ATTENDED_STATUSES);

/**
 * The attendance copy: the whole history on the first read (two pages a year), then at most
 * every half hour on its own (every minute when asked), from a few days before the last read,
 * as check-ins land after the class.
 */
const STALE_AFTER_MS = 30 * 60_000;
const MIN_GAP_MS = 60_000;
const RECHECK_DAYS = 3;

export class BookingboardPersistenceError extends Schema.TaggedError<BookingboardPersistenceError>()(
  "BookingboardPersistenceError",
  {
    operation: Schema.Literals([
      "load the bookingboard connection",
      "save the bookingboard connection",
      "remove the bookingboard connection",
      "read the attendance copy",
      "save the attendance copy",
      "skip a day",
    ]),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to ${this.operation}.`;
  }
}

/**
 * One of the athlete's bookings from `/account/{id}/classes`, newest first. The answer also
 * carries their name and email; only these fields are read, and nothing else is kept or logged.
 */
const AccountClass = Schema.Struct({
  classId: Schema.Int,
  className: Schema.String,
  status: Schema.String,
  classBegins: Schema.String,
  onWaitingList: Schema.optional(Schema.NullOr(Schema.Boolean)),
});
const decodeAccountClasses = Schema.decodeUnknownEffect(Schema.Array(AccountClass));

/** The account the token belongs to; its id is the participant id. */
const decodeAccount = Schema.decodeUnknownEffect(Schema.Struct({ id: Schema.Int }));

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

/** What the attendance copy covers, and as of when. */
const LedgerRow = Schema.Struct({
  participantId: Schema.Int,
  coveredFrom: Schema.String,
  checkedAt: Schema.String,
});

/** One of the athlete's bookings in the copy: a participation without whose it is. */
const BookingRow = Schema.Struct({
  classId: Schema.Int,
  className: Schema.String,
  status: Schema.String,
  begins: Schema.String,
});
type BookingRow = typeof BookingRow.Type;

const CopyRow = Schema.Struct({
  ...BookingRow.fields,
  day: Schema.String,
  title: Schema.NullOr(Schema.String),
  coach: Schema.NullOr(Schema.String),
});

/** A past class as read once; `text` '' for a class without a program. */
const CachedClassRow = Schema.Struct({
  title: Schema.String,
  begins: Schema.String,
  coach: Schema.NullOr(Schema.String),
  text: Schema.String,
});

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
    /**
     * The classes the athlete attended, from Chalk's copy of their bookings, read from
     * bookingboard only when it is stale (see `BookingboardAttendanceInput`). A failed read with a
     * copy in hand is reported on it; without one, it fails.
     */
    readonly attendance: (
      input: BookingboardAttendanceInput,
    ) => Effect.Effect<
      BookingboardAttendance,
      BookingboardNotConnectedError | ReadError | BookingboardPersistenceError
    >;
    readonly skipDay: (
      input: SkipBookingboardDayInput,
    ) => Effect.Effect<void, BookingboardPersistenceError>;
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

  const failedTo = (operation: BookingboardPersistenceError["operation"]) => (cause: unknown) =>
    new BookingboardPersistenceError({ operation, cause });

  const selectLedger = SqlSchema.findAll({
    Request: Schema.Void,
    Result: LedgerRow,
    execute: () => sql`
      SELECT participant_id AS "participantId", covered_from AS "coveredFrom",
        checked_at AS "checkedAt"
      FROM bookingboard_ledger
      WHERE id = 1
    `,
  });
  const loadLedger = selectLedger(undefined).pipe(
    Effect.map((rows) => rows[0]),
    Effect.mapError(failedTo("read the attendance copy")),
  );

  const selectCopyOn = SqlSchema.findAll({
    Request: Schema.String,
    Result: BookingRow,
    execute: (day) => sql`
      SELECT class_id AS "classId", class_name AS "className", status, begins
      FROM bookingboard_bookings
      WHERE day = ${day}
    `,
  });

  const selectCopyFrom = SqlSchema.findAll({
    Request: Schema.String,
    Result: CopyRow,
    execute: (from) => sql`
      SELECT b.class_id AS "classId", b.class_name AS "className", b.status, b.begins, b.day,
        c.title, c.coach
      FROM bookingboard_bookings b
      LEFT JOIN bookingboard_classes c ON c.class_id = b.class_id
      WHERE b.day >= ${from}
      ORDER BY b.day
    `,
  });

  const selectSkippedFrom = SqlSchema.findAll({
    Request: Schema.String,
    Result: Schema.Struct({ day: Schema.String }),
    execute: (from) => sql`
      SELECT day FROM bookingboard_skipped_days WHERE day >= ${from} ORDER BY day
    `,
  });

  const selectCachedClass = SqlSchema.findAll({
    Request: Schema.Int,
    Result: CachedClassRow,
    execute: (classId) => sql`
      SELECT title, begins, coach, text FROM bookingboard_classes WHERE class_id = ${classId}
    `,
  });

  const unavailable = (reason: string) => new BookingboardUnavailableError({ reason });

  /** GET only. A 401/403 is an expired token; a 404 is `undefined`. Bodies are never logged. */
  const getJson = (token: string, url: string, params: Record<string, string> = {}) =>
    http
      .execute(
        HttpClientRequest.get(url).pipe(
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

  /** A read with the stored token; one past its expiry fails without calling. */
  const read = (connection: ConnectionRow, url: string, params: Record<string, string> = {}) =>
    failIfExpired(connection.expiresAt).pipe(
      Effect.andThen(getJson(connection.token, url, params)),
    );

  /**
   * The athlete's bookings (not opted out, not wait-listed) between two instants, one per class,
   * with their box-local day; `from` left out reads from the start. Page by page, newest first.
   */
  const bookingsBetween = Effect.fn("Bookingboard.bookingsBetween")(function* (
    connection: ConnectionRow,
    window: { readonly from?: string; readonly to: string },
    keep: (day: string) => boolean,
  ) {
    const url = `${BOOKINGBOARD_WEB_API}/account/${connection.participantId}/classes`;
    const mine = new Map<number, BookingRow & { readonly day: string }>();
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const body = yield* read(connection, url, {
        ...window,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      const rows = yield* decodeAccountClasses(body ?? []).pipe(
        Effect.mapError(() =>
          unavailable("your classes came back in a shape Chalk does not know."),
        ),
      );
      for (const row of rows) {
        if (CANCELLED_STATUSES.has(row.status) || row.onWaitingList || mine.has(row.classId))
          continue;
        const day = boxLocal(row.classBegins).date;
        if (keep(day))
          mine.set(row.classId, {
            classId: row.classId,
            className: row.className,
            status: row.status,
            begins: row.classBegins,
            day,
          });
      }
      if (rows.length < PAGE_SIZE) break;
    }
    return [...mine.values()];
  });

  const fromCachedClass = (booking: BookingRow, cached: typeof CachedClassRow.Type) =>
    cached.text === ""
      ? ("openGym" as const)
      : ({
          classId: booking.classId,
          title: cached.title,
          startsAt: boxLocal(cached.begins).time,
          coach: cached.coach,
          status: booking.status,
          text: cached.text,
        } satisfies BookingboardClass);

  /** A class's program; a class from before `today` is read once and kept, as it is done. */
  const classOf = Effect.fn("Bookingboard.classOf")(function* (
    connection: ConnectionRow,
    booking: BookingRow,
    today: string,
  ) {
    const past = boxLocal(booking.begins).date < today;
    if (past) {
      const [cached] = yield* selectCachedClass(booking.classId).pipe(
        Effect.mapError(failedTo("read the attendance copy")),
      );
      if (cached !== undefined) return fromCachedClass(booking, cached);
    }
    const body = yield* read(connection, `${BOOKINGBOARD_API}/classes/${booking.classId}`);
    if (body === undefined) {
      yield* Effect.logWarning(`Bookingboard class ${booking.classId} is gone; skipping it.`);
      return undefined;
    }
    const detail = yield* decodeClass(body).pipe(
      Effect.mapError(() => unavailable("a class came back in a shape Chalk does not know.")),
    );
    const coaches = (detail.instructors ?? []).flatMap((instructor) =>
      instructor.name?.trim() ? [instructor.name.trim()] : [],
    );
    const cached = {
      title: detail.title?.trim() || booking.className,
      begins: detail.begins ?? booking.begins,
      coach: coaches.length === 0 ? null : coaches.join(", "),
      text: programText(detail.program?.workouts ?? []),
    };
    if (past)
      yield* sql`
        INSERT INTO bookingboard_classes (class_id, title, begins, coach, text, fetched_at)
        VALUES (${booking.classId}, ${cached.title}, ${cached.begins}, ${cached.coach},
          ${cached.text}, ${DateTime.formatIso(yield* DateTime.now)})
        ON CONFLICT (class_id) DO NOTHING
      `.pipe(Effect.mapError(failedTo("save the attendance copy")));
    return fromCachedClass(booking, cached);
  });

  /** Forgets the attendance copy: on disconnect, or a connection for someone else. */
  const forgetCopy = Effect.gen(function* () {
    yield* sql`DELETE FROM bookingboard_bookings`;
    yield* sql`DELETE FROM bookingboard_ledger`;
  });

  const status = Effect.fn("Bookingboard.status")(function* () {
    return statusOf(yield* loadConnection);
  });

  const connect = Effect.fn("Bookingboard.connect")(function* (input: ConnectBookingboardInput) {
    const expiresAt = tokenExpiry(input.token);
    if (expiresAt === undefined) return yield* new BookingboardTokenInvalidError();
    yield* failIfExpired(expiresAt);
    const now = yield* DateTime.now;
    // The smallest read there is, and it names the account: its id is the participant id, so a
    // mistyped one is put right here.
    const account = yield* getJson(input.token, `${BOOKINGBOARD_WEB_API}/account`).pipe(
      Effect.flatMap((body) => decodeAccount(body)),
      Effect.mapError((error) =>
        error instanceof BookingboardTokenExpiredError ||
        error instanceof BookingboardUnavailableError
          ? error
          : unavailable("your account came back in a shape Chalk does not know."),
      ),
    );
    const row: ConnectionRow = {
      token: input.token,
      participantId: account.id,
      expiresAt,
    };
    const ledger = yield* loadLedger;
    if (ledger !== undefined && ledger.participantId !== row.participantId)
      yield* forgetCopy.pipe(Effect.mapError(failedTo("save the bookingboard connection")));
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
    yield* Effect.gen(function* () {
      yield* sql`DELETE FROM bookingboard_connection WHERE id = 1`;
      yield* forgetCopy;
    }).pipe(
      sql.withTransaction,
      Effect.mapError(
        (cause) =>
          new BookingboardPersistenceError({
            operation: "remove the bookingboard connection",
            cause,
          }),
      ),
    );
  });

  const boxToday = Effect.map(DateTime.now, (now) => boxLocal(DateTime.formatIso(now)).date);

  const day = Effect.fn("Bookingboard.day")(function* (date: IsoDate) {
    const connection = yield* loadConnection;
    if (connection === undefined) return yield* new BookingboardNotConnectedError();
    const today = yield* boxToday;
    // A day the copy holds and that was over when it was read needs no bookings download.
    const ledger = yield* loadLedger;
    const bookings =
      ledger !== undefined && date >= ledger.coveredFrom && date < boxLocal(ledger.checkedAt).date
        ? yield* selectCopyOn(date).pipe(Effect.mapError(failedTo("read the attendance copy")))
        : // Noon UTC the day before to the day's end in UTC spans the box-local day either side.
          yield* bookingsBetween(
            connection,
            { from: `${dayBefore(date)}T12:00:00.000Z`, to: `${date}T23:59:59.999Z` },
            (day) => day === date,
          );
    const classes = yield* Effect.forEach(bookings, (booking) =>
      classOf(connection, booking, today),
    );
    return {
      date,
      classes: classes
        .filter((entry) => typeof entry === "object")
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      openGym: classes.includes("openGym"),
    } satisfies BookingboardDay;
  });

  // One read of bookingboard at a time; whoever waited finds the copy fresh and reads nothing.
  const reading = yield* Semaphore.make(1);
  // The last read attempted, so a failing bookingboard is not asked again on every page view.
  const lastAttempt = yield* Ref.make<
    { readonly at: number; readonly failed: string | null } | undefined
  >(undefined);

  /**
   * Reads the athlete's bookings into the copy, replacing what it held: from the box-local day
   * `from` on, or the whole history (`from` undefined), which starts the copy at its first class.
   */
  const refreshCopy = Effect.fn("Bookingboard.refreshCopy")(function* (
    connection: ConnectionRow,
    from: IsoDate | undefined,
  ) {
    const now = yield* DateTime.now;
    const checkedAt = DateTime.formatIso(now);
    const mine = yield* bookingsBetween(
      connection,
      from === undefined
        ? { to: checkedAt }
        : { from: `${dayBefore(from)}T12:00:00.000Z`, to: checkedAt },
      (day) => from === undefined || day >= from,
    );
    const coveredFrom =
      from ??
      mine.reduce(
        (first, booking) => (booking.day < first ? booking.day : first),
        boxLocal(checkedAt).date,
      );
    yield* Effect.gen(function* () {
      yield* sql`DELETE FROM bookingboard_bookings WHERE day >= ${coveredFrom}`;
      for (const booking of mine)
        yield* sql`
          INSERT INTO bookingboard_bookings (class_id, day, begins, class_name, status)
          VALUES (${booking.classId}, ${booking.day}, ${booking.begins}, ${booking.className},
            ${booking.status})
          ON CONFLICT (class_id) DO UPDATE SET
            day = excluded.day, begins = excluded.begins, class_name = excluded.class_name,
            status = excluded.status
        `;
      yield* sql`
        INSERT INTO bookingboard_ledger (id, participant_id, covered_from, checked_at)
        VALUES (1, ${connection.participantId}, ${coveredFrom}, ${checkedAt})
        ON CONFLICT (id) DO UPDATE SET
          participant_id = excluded.participant_id,
          covered_from = MIN(bookingboard_ledger.covered_from, excluded.covered_from),
          checked_at = excluded.checked_at
      `;
    }).pipe(sql.withTransaction, Effect.mapError(failedTo("save the attendance copy")));
  });

  /**
   * What to read into the copy: `history` the first time, a day to read from once it is stale,
   * or undefined when it is fresh enough to read nothing.
   */
  const readFrom = (
    input: BookingboardAttendanceInput,
    ledger: typeof LedgerRow.Type | undefined,
    attemptedAt: number | undefined,
    now: number,
  ): { readonly from: IsoDate | undefined } | undefined => {
    if (ledger === undefined) return { from: undefined };
    const sinceRead = now - Date.parse(ledger.checkedAt);
    const sinceAttempt = attemptedAt === undefined ? Infinity : now - attemptedAt;
    const fresh =
      sinceAttempt < MIN_GAP_MS ||
      sinceRead < (input.check === "now" ? MIN_GAP_MS : STALE_AFTER_MS);
    if (fresh) return undefined;
    const recheck = daysBefore(boxLocal(ledger.checkedAt).date, RECHECK_DAYS);
    return { from: recheck > ledger.coveredFrom ? recheck : ledger.coveredFrom };
  };

  const attendance = Effect.fn("Bookingboard.attendance")(function* (
    input: BookingboardAttendanceInput,
  ) {
    const connection = yield* loadConnection;
    if (connection === undefined) return yield* new BookingboardNotConnectedError();
    return yield* Semaphore.withPermit(
      reading,
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const before = yield* loadLedger;
        const attempt = yield* Ref.get(lastAttempt);
        const toRead = readFrom(input, before, attempt?.at, now);
        if (toRead !== undefined) {
          const failed = yield* refreshCopy(connection, toRead.from).pipe(
            Effect.as(null),
            Effect.catch((error) =>
              // A copy in hand still answers; without one there is nothing to show.
              before !== undefined &&
              (error instanceof BookingboardTokenExpiredError ||
                error instanceof BookingboardUnavailableError)
                ? Effect.succeed(error.message)
                : Effect.fail(error),
            ),
          );
          yield* Ref.set(lastAttempt, { at: now, failed });
        }
        const ledger = yield* loadLedger;
        if (ledger === undefined) return yield* new BookingboardNotConnectedError();
        const latest = yield* Ref.get(lastAttempt);
        const rows = yield* selectCopyFrom(ledger.coveredFrom).pipe(
          Effect.mapError(failedTo("read the attendance copy")),
        );
        const skipped = yield* selectSkippedFrom(ledger.coveredFrom).pipe(
          Effect.mapError(failedTo("read the attendance copy")),
        );
        return {
          coveredFrom: ledger.coveredFrom,
          checkedAt: ledger.checkedAt,
          classes: rows
            .filter((row) => ATTENDED.has(row.status))
            .map((row) => ({
              classId: row.classId,
              date: row.day,
              startsAt: boxLocal(row.begins).time,
              title: row.title ?? row.className,
              coach: row.coach,
            }))
            .sort((a, b) => a.date.localeCompare(b.date) || a.startsAt.localeCompare(b.startsAt)),
          skippedDays: skipped.map((row) => row.day),
          checkFailed:
            latest?.failed != null && latest.at > Date.parse(ledger.checkedAt)
              ? latest.failed
              : null,
        } satisfies BookingboardAttendance;
      }),
    );
  });

  const skipDay = Effect.fn("Bookingboard.skipDay")(function* (input: SkipBookingboardDayInput) {
    const now = DateTime.formatIso(yield* DateTime.now);
    yield* (
      input.skipped
        ? sql`
            INSERT INTO bookingboard_skipped_days (day, skipped_at) VALUES (${input.date}, ${now})
            ON CONFLICT (day) DO NOTHING
          `
        : sql`DELETE FROM bookingboard_skipped_days WHERE day = ${input.date}`
    ).pipe(Effect.mapError(failedTo("skip a day")));
  });

  return Bookingboard.of({ status, connect, disconnect, day, attendance, skipDay });
});

/** Needs an `HttpClient`: fetch in the server, a fake in tests. */
export const layer = Layer.effect(Bookingboard, make);
