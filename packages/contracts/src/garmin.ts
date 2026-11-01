import * as Schema from "effect/Schema";

import { IsoDate, IsoDateTime, TrimmedNonEmptyString } from "./baseSchemas.ts";

/**
 * Garmin Connect: Chalk reads the athlete's smart-scale weigh-ins into bodyweight. Garmin has no
 * personal API and its login only lets a real browser through, so the athlete logs in once on
 * their own machine (`pnpm garmin:login`) and pastes the tokens it prints. The server renews
 * them itself, reads weigh-ins only, and never returns a token to the browser.
 */

/** What Settings shows; never a token. */
export const GarminStatus = Schema.Union([
  Schema.TaggedStruct("disconnected", {
    /** Where an import would start: the first logged session, `null` before any. */
    suggestedFrom: Schema.NullOr(IsoDate),
  }),
  Schema.TaggedStruct("connected", {
    /** The first day read from Garmin; weigh-ins before it stay there. */
    importFrom: IsoDate,
    /** Days whose bodyweight came from the scale. */
    weighIns: Schema.Int,
    /** When the last read finished, good or not; `null` before the first. */
    lastSyncAt: Schema.NullOr(IsoDateTime),
    /** Why the last read failed; `null` when it worked. */
    lastError: Schema.NullOr(Schema.String),
  }),
]).annotate({ identifier: "GarminStatus" });
export type GarminStatus = typeof GarminStatus.Type;

/** The token file `pnpm garmin:login` prints, as pasted, and the first day to read. */
export const ConnectGarminInput = Schema.Struct({
  tokens: TrimmedNonEmptyString,
  importFrom: IsoDate,
}).annotate({ identifier: "ConnectGarminInput" });
export type ConnectGarminInput = typeof ConnectGarminInput.Type;

export class GarminNotConnectedError extends Schema.TaggedError<GarminNotConnectedError>()(
  "GarminNotConnectedError",
  {},
  { httpApiStatus: 409 },
) {
  override get message(): string {
    return "Garmin is not connected. Paste your tokens in Settings, Connections.";
  }
}

/** The paste is not the token file: not JSON, or without the refresh token and client id. */
export class GarminTokensInvalidError extends Schema.TaggedError<GarminTokensInvalidError>()(
  "GarminTokensInvalidError",
  {},
  { httpApiStatus: 400 },
) {
  override get message(): string {
    return "That is not a Garmin token file. Paste everything pnpm garmin:login printed.";
  }
}

/** Garmin turned the tokens away: revoked, or the refresh token ran out. */
export class GarminTokensRefusedError extends Schema.TaggedError<GarminTokensRefusedError>()(
  "GarminTokensRefusedError",
  {},
  { httpApiStatus: 401 },
) {
  override get message(): string {
    return "Garmin refused the tokens. Run pnpm garmin:login again and paste the new ones.";
  }
}

/** Garmin did not answer, or answered with something Chalk cannot read. */
export class GarminUnavailableError extends Schema.TaggedError<GarminUnavailableError>()(
  "GarminUnavailableError",
  { reason: Schema.String },
  { httpApiStatus: 502 },
) {
  override get message(): string {
    return `Could not read Garmin: ${this.reason}`;
  }
}

/** Server-side storage failed; the cause stays on the server. */
export class GarminStorageError extends Schema.TaggedError<GarminStorageError>()(
  "GarminStorageError",
  { operation: Schema.String },
  { httpApiStatus: 500 },
) {
  override get message(): string {
    return `Could not ${this.operation}.`;
  }
}
