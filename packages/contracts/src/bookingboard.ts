import * as Schema from "effect/Schema";

import { IsoDate, IsoDateTime, TrimmedNonEmptyString } from "./baseSchemas.ts";
import type { ClassType, Coaching, SessionMarks } from "./coaching.ts";

/**
 * The box's booking system (bookingboard.io): Chalk reads the program of the classes the athlete
 * booked or attended on a day, so the plan and the importer start from what the box posted.
 * Read-only; the token is the athlete's own, pasted in Settings, and never leaves the server.
 */

/** The athlete's id in the box's bookingboard; the token does not carry it. */
export const BookingboardParticipantId = Schema.Int.check(Schema.isGreaterThan(0));

/** What Settings shows; never the token itself. */
export const BookingboardStatus = Schema.Union([
  Schema.TaggedStruct("disconnected", {}),
  Schema.TaggedStruct("connected", {
    participantId: BookingboardParticipantId,
    /** When the pasted token stops working (bookingboard tokens last 30 days). */
    expiresAt: IsoDateTime,
  }),
]).annotate({ identifier: "BookingboardStatus" });
export type BookingboardStatus = typeof BookingboardStatus.Type;

/** The `jwt` cookie from the box's bookingboard site, and whose classes to read. */
export const ConnectBookingboardInput = Schema.Struct({
  token: TrimmedNonEmptyString,
  participantId: BookingboardParticipantId,
}).annotate({ identifier: "ConnectBookingboardInput" });
export type ConnectBookingboardInput = typeof ConnectBookingboardInput.Type;

/** One class the athlete was on that day, its program ready for the importer. */
export const BookingboardClass = Schema.Struct({
  classId: Schema.Int,
  /** The class type as the box names it: "WOD", "Power". */
  title: Schema.String,
  /** Start, box-local "HH:MM". */
  startsAt: Schema.String,
  /** The class's instructors as bookingboard names them ("Rikke L."); `null` when none is set. */
  coach: Schema.NullOr(Schema.String),
  /** Bookingboard's attendance: "OnTime" / "TooLate" attended; anything else booked only. */
  status: Schema.String,
  /** The program as plain text: each workout's title on its own line, its lines under it. */
  text: Schema.String,
}).annotate({ identifier: "BookingboardClass" });
export type BookingboardClass = typeof BookingboardClass.Type;

/** The classes with a program on a day, earliest first; empty when there were none. */
export const BookingboardDay = Schema.Struct({
  date: IsoDate,
  classes: Schema.Array(BookingboardClass),
  /** Booked on a class without a program that day: open gym, trained without a coach. */
  openGym: Schema.Boolean,
}).annotate({ identifier: "BookingboardDay" });
export type BookingboardDay = typeof BookingboardDay.Type;

/** Bookingboard statuses for a booking the athlete turned up to; any other one was booked only. */
export const ATTENDED_STATUSES: ReadonlyArray<string> = ["OnTime", "TooLate"];

/** One class the athlete checked in to, as Chalk's copy of their bookings has it. */
export const BookingboardAttendedClass = Schema.Struct({
  classId: Schema.Int,
  /** Box-local day. */
  date: IsoDate,
  /** Start, box-local "HH:MM". */
  startsAt: Schema.String,
  /** The class type as the box names it: "WOD", "Open Gym". */
  title: Schema.String,
  /** Known once the class has been pulled; `null` before that, or when it names nobody. */
  coach: Schema.NullOr(Schema.String),
}).annotate({ identifier: "BookingboardAttendedClass" });
export type BookingboardAttendedClass = typeof BookingboardAttendedClass.Type;

/**
 * The classes the athlete attended, from Chalk's own copy of their bookings: their whole history
 * on the first read, then read again at most every half hour (every minute when asked). The
 * athlete's sessions are matched against it in the browser.
 */
export const BookingboardAttendance = Schema.Struct({
  /** The day of the athlete's first booking: the copy holds everything since. */
  coveredFrom: IsoDate,
  /** When bookingboard was last read for it. */
  checkedAt: IsoDateTime,
  /** Attended classes from `coveredFrom` on, oldest first. */
  classes: Schema.Array(BookingboardAttendedClass),
  /** Days the athlete said they will not log, oldest first. */
  skippedDays: Schema.Array(IsoDate),
  /** Why the last read failed (an expired token, bookingboard down); the copy is as it was. */
  checkFailed: Schema.NullOr(Schema.String),
}).annotate({ identifier: "BookingboardAttendance" });
export type BookingboardAttendance = typeof BookingboardAttendance.Type;

/** `ifStale` reads bookingboard when the copy is half an hour old; `now` when a minute old. */
export const BookingboardAttendanceInput = Schema.Struct({
  check: Schema.Literals(["ifStale", "now"]),
}).annotate({ identifier: "BookingboardAttendanceInput" });
export type BookingboardAttendanceInput = typeof BookingboardAttendanceInput.Type;

/** Marks a day as one the athlete will not log, or takes the mark back. */
export const SkipBookingboardDayInput = Schema.Struct({
  date: IsoDate,
  skipped: Schema.Boolean,
}).annotate({ identifier: "SkipBookingboardDayInput" });
export type SkipBookingboardDayInput = typeof SkipBookingboardDayInput.Type;

/** A pulled class's coach; none when bookingboard names nobody for it. */
export const classCoaching = (entry: BookingboardClass): Coaching | undefined =>
  entry.coach === null ? undefined : { _tag: "coached", coach: entry.coach };

/**
 * What a pulled class is, by the name the box gives it: "WOD" the WOD class, "Power" (or
 * strength, styrke) a strength class; any other name is left to the athlete.
 */
export const classTypeOf = (entry: BookingboardClass): ClassType | undefined => {
  const title = entry.title.toLowerCase();
  if (/\bwod\b/.test(title)) return "wod";
  if (/\b(power|strength|styrke)\b/.test(title)) return "strength";
  return undefined;
};

/** What a pulled class puts on the draft: its coach and, by its name, what class it was. */
export const classMarks = (entry: BookingboardClass): SessionMarks => {
  const coaching = classCoaching(entry);
  const classType = classTypeOf(entry);
  return {
    ...(coaching === undefined ? {} : { coaching }),
    ...(classType === undefined ? {} : { classType }),
  };
};

/**
 * Who coached the athlete on a day, by its bookings: its one class's coach, or solo when no class
 * with a program was booked (open gym, or nothing). Several classes leave it to the athlete.
 */
export const dayCoaching = (day: BookingboardDay): Coaching | undefined => {
  const [only, ...rest] = day.classes;
  if (only === undefined) return { _tag: "solo" };
  return rest.length === 0 ? classCoaching(only) : undefined;
};

export class BookingboardNotConnectedError extends Schema.TaggedError<BookingboardNotConnectedError>()(
  "BookingboardNotConnectedError",
  {},
  { httpApiStatus: 409 },
) {
  override get message(): string {
    return "Bookingboard is not connected. Paste your token in Settings, Connections.";
  }
}

/** Not a bookingboard token: not a JWT, or one without an expiry. */
export class BookingboardTokenInvalidError extends Schema.TaggedError<BookingboardTokenInvalidError>()(
  "BookingboardTokenInvalidError",
  {},
  { httpApiStatus: 400 },
) {
  override get message(): string {
    return "That is not a bookingboard token. Copy the whole jwt cookie value.";
  }
}

export class BookingboardTokenExpiredError extends Schema.TaggedError<BookingboardTokenExpiredError>()(
  "BookingboardTokenExpiredError",
  {},
  { httpApiStatus: 401 },
) {
  override get message(): string {
    return "The bookingboard token has expired. Log in to bookingboard again and paste the new jwt in Settings, Connections.";
  }
}

/** Bookingboard did not answer, or answered with something Chalk cannot read. */
export class BookingboardUnavailableError extends Schema.TaggedError<BookingboardUnavailableError>()(
  "BookingboardUnavailableError",
  { reason: Schema.String },
  { httpApiStatus: 502 },
) {
  override get message(): string {
    return `Could not read bookingboard: ${this.reason}`;
  }
}

/** Server-side storage failed; the cause stays on the server. */
export class BookingboardStorageError extends Schema.TaggedError<BookingboardStorageError>()(
  "BookingboardStorageError",
  { operation: Schema.String },
  { httpApiStatus: 500 },
) {
  override get message(): string {
    return `Could not ${this.operation}.`;
  }
}
