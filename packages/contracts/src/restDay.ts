import * as Schema from "effect/Schema";

import { IsoDate, IsoDateTime } from "./baseSchemas.ts";

/**
 * A day the athlete decided not to train, and why. Rest is a choice, never inferred: a day with
 * nothing logged and no mark is just a day with nothing logged. One mark per local day; the
 * athlete marks days on Today, and the coach may put one in the calendar for today or later.
 */
export const RestDayKind = Schema.Literals(["rest", "sick", "injured", "travel"]);
export type RestDayKind = typeof RestDayKind.Type;

export const REST_DAY_KINDS: ReadonlyArray<RestDayKind> = ["rest", "sick", "injured", "travel"];

export const REST_DAY_LABELS: Record<RestDayKind, string> = {
  rest: "Rest day",
  sick: "Sick",
  injured: "Injured",
  travel: "Travel",
};

/** Who put the mark in the calendar. */
export const RestDaySource = Schema.Literals(["athlete", "coach"]);
export type RestDaySource = typeof RestDaySource.Type;

export const RestDay = Schema.Struct({
  day: IsoDate,
  kind: RestDayKind,
  source: RestDaySource,
  createdAt: IsoDateTime,
}).annotate({ identifier: "RestDay" });
export type RestDay = typeof RestDay.Type;

/** Marks a day; marking it again replaces the kind. */
export const MarkRestDayInput = Schema.Struct({
  day: IsoDate,
  kind: RestDayKind,
}).annotate({ identifier: "MarkRestDayInput" });
export type MarkRestDayInput = typeof MarkRestDayInput.Type;

export class RestDayNotFoundError extends Schema.TaggedError<RestDayNotFoundError>()(
  "RestDayNotFoundError",
  { day: IsoDate },
  { httpApiStatus: 404 },
) {
  override get message(): string {
    return `${this.day} is not marked as a rest day.`;
  }
}

/** Server-side storage failed; the cause stays on the server. */
export class RestDayStorageError extends Schema.TaggedError<RestDayStorageError>()(
  "RestDayStorageError",
  { operation: Schema.String },
  { httpApiStatus: 500 },
) {
  override get message(): string {
    return `Could not ${this.operation}.`;
  }
}
