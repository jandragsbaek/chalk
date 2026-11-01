import {
  GarminNotConnectedError,
  GarminTokensInvalidError,
  GarminTokensRefusedError,
  GarminUnavailableError,
  type ConnectGarminInput,
  type GarminStatus,
} from "@chalk/contracts";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";

import { boxLocal } from "../bookingboard/program.ts";
import { ProfileStore, type ProfilePersistenceError } from "../profile/ProfileStore.ts";
import {
  firstReadings,
  jwtClaims,
  parseTokenFile,
  shiftDate,
  WeightRange,
  windows,
  type GarminTokens,
} from "./weighIns.ts";

/** Garmin Connect's API for its mobile app; it takes the DI bearer token. */
export const GARMIN_API = "https://connectapi.garmin.com";
/** Where a DI refresh token buys a new access token (and a new refresh token). */
export const GARMIN_TOKEN_URL = "https://diauth.garmin.com/di-oauth2-service/oauth/token";

/** The Android app's headers, as python-garminconnect sends them; Garmin checks the client. */
const APP_HEADERS = {
  "User-Agent": "GCM-Android-5.23",
  "X-Garmin-User-Agent":
    "com.garmin.android.apps.connectmobile/5.23; ; Google/sdk_gphone64_arm64/google; Android/33; Dalvik/2.1.0",
  "X-Garmin-Paired-App-Version": "10861",
  "X-Garmin-Client-Platform": "Android",
  "X-App-Ver": "10861",
  "X-Lang": "en",
  "X-GCExperience": "GC5",
  "Accept-Language": "en-US,en;q=0.9",
};

const REQUEST_TIMEOUT = Duration.seconds(60);
/** Renew the access token when it has less than this left. */
const RENEW_BEFORE = Duration.minutes(5);
/** Days per weight read; a year of daily weigh-ins is a few small answers. */
const WINDOW_DAYS = 120;
/** A read starts this many days before the last one ended, for late syncs from the scale. */
const OVERLAP_DAYS = 3;
/** How often the server reads new weigh-ins while it runs. */
const SYNC_EVERY = Duration.hours(6);

export class GarminPersistenceError extends Schema.TaggedError<GarminPersistenceError>()(
  "GarminPersistenceError",
  {
    operation: Schema.Literals([
      "load the Garmin connection",
      "save the Garmin connection",
      "remove the Garmin connection",
      "import scale weigh-ins",
    ]),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to ${this.operation}.`;
  }
}

const ConnectionRow = Schema.Struct({
  accessToken: Schema.String,
  refreshToken: Schema.String,
  clientId: Schema.String,
  accessExpiresAt: Schema.String,
  importFrom: Schema.String,
  syncedThrough: Schema.NullOr(Schema.String),
  lastSyncAt: Schema.NullOr(Schema.String),
  lastError: Schema.NullOr(Schema.String),
});
type ConnectionRow = typeof ConnectionRow.Type;

const TokenAnswer = Schema.Struct({
  access_token: Schema.String,
  refresh_token: Schema.optional(Schema.String),
  expires_in: Schema.optional(Schema.Number),
});
const decodeTokenAnswer = Schema.decodeUnknownEffect(TokenAnswer);
const decodeWeightRange = Schema.decodeUnknownEffect(WeightRange);

interface Renewed extends GarminTokens {
  readonly accessExpiresAt: string;
}

type ReadError = GarminTokensRefusedError | GarminUnavailableError;
type SyncError = GarminNotConnectedError | ReadError | GarminPersistenceError;

export class Garmin extends Context.Service<
  Garmin,
  {
    readonly status: () => Effect.Effect<GarminStatus, GarminPersistenceError>;
    /**
     * Renews the pasted tokens once, so a bad paste fails before anything is kept, then keeps
     * them and imports every weigh-in from `importFrom` to today.
     */
    readonly connect: (
      input: ConnectGarminInput,
    ) => Effect.Effect<GarminStatus, GarminTokensInvalidError | ReadError | GarminPersistenceError>;
    /** Reads the weigh-ins since the last read (from `importFrom` the first time). */
    readonly sync: () => Effect.Effect<GarminStatus, SyncError>;
    /** Forgets the tokens; imported weigh-ins stay. */
    readonly disconnect: () => Effect.Effect<void, GarminPersistenceError>;
  }
>()("chalk/garmin/Garmin") {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const profile = yield* ProfileStore;
  // One retry on a network error, a 429 or a 5xx.
  const http = (yield* HttpClient.HttpClient).pipe(
    HttpClient.retryTransient({ times: 1, schedule: Schedule.exponential(Duration.seconds(1)) }),
  );
  // A connect, a "Sync now" and the timed read never interleave: each renewal turns the
  // refresh token over, so two at once would leave one holding a dead token.
  const lock = yield* Semaphore.make(1);

  const persistence = (operation: GarminPersistenceError["operation"]) => (cause: unknown) =>
    new GarminPersistenceError({ operation, cause });
  const profileFailed = (cause: ProfilePersistenceError) =>
    new GarminPersistenceError({ operation: "import scale weigh-ins", cause });

  const selectConnection = SqlSchema.findAll({
    Request: Schema.Void,
    Result: ConnectionRow,
    execute: () => sql`
      SELECT access_token AS "accessToken", refresh_token AS "refreshToken",
             client_id AS "clientId", access_expires_at AS "accessExpiresAt",
             import_from AS "importFrom", synced_through AS "syncedThrough",
             last_sync_at AS "lastSyncAt", last_error AS "lastError"
      FROM garmin_connection
      WHERE id = 1
    `,
  });
  const loadConnection = selectConnection(undefined).pipe(
    Effect.map((rows) => rows[0]),
    Effect.mapError(persistence("load the Garmin connection")),
  );

  const firstSession = Effect.gen(function* () {
    const [row] = yield* sql<{ readonly first: string | null }>`
      SELECT MIN(performed_on) AS first FROM (
        SELECT performed_on FROM workouts UNION ALL SELECT performed_on FROM lift_sets
      )
    `;
    return row?.first ?? null;
  }).pipe(Effect.mapError(persistence("load the Garmin connection")));

  const statusOf = Effect.fn("Garmin.statusOf")(function* (row: ConnectionRow | undefined) {
    if (row === undefined)
      return { _tag: "disconnected", suggestedFrom: yield* firstSession } satisfies GarminStatus;
    return {
      _tag: "connected",
      importFrom: row.importFrom,
      weighIns: yield* profile.scaleWeighIns().pipe(Effect.mapError(profileFailed)),
      lastSyncAt: row.lastSyncAt,
      lastError: row.lastError,
    } satisfies GarminStatus;
  });

  const unavailable = (reason: string) => new GarminUnavailableError({ reason });

  /** Bodies are never logged: the token answer carries tokens. */
  const send = (request: HttpClientRequest.HttpClientRequest, refusedOn: ReadonlySet<number>) =>
    http.execute(HttpClientRequest.setHeaders(request, APP_HEADERS)).pipe(
      Effect.flatMap((response): Effect.Effect<unknown, ReadError | unknown> => {
        if (refusedOn.has(response.status)) return Effect.fail(new GarminTokensRefusedError());
        if (response.status >= 400)
          return Effect.fail(unavailable(`it answered HTTP ${response.status}.`));
        return response.json;
      }),
      Effect.timeoutOrElse({
        duration: REQUEST_TIMEOUT,
        orElse: () => Effect.fail(unavailable("it did not answer in time.")),
      }),
      Effect.catch((error) =>
        error instanceof GarminTokensRefusedError || error instanceof GarminUnavailableError
          ? Effect.fail(error)
          : Effect.fail(unavailable("it could not be reached.")),
      ),
    );

  /** Trades the refresh token for a new access token; Garmin may turn the refresh token over. */
  const renew = Effect.fn("Garmin.renew")(function* (tokens: GarminTokens) {
    const body = yield* send(
      HttpClientRequest.post(GARMIN_TOKEN_URL).pipe(
        HttpClientRequest.basicAuth(tokens.clientId, ""),
        HttpClientRequest.acceptJson,
        HttpClientRequest.bodyUrlParams({
          grant_type: "refresh_token",
          client_id: tokens.clientId,
          refresh_token: tokens.refreshToken,
        }),
      ),
      new Set([400, 401, 403]),
    );
    const answer = yield* decodeTokenAnswer(body).pipe(
      Effect.mapError(() => unavailable("its token answer came in a shape Chalk does not know.")),
    );
    const claims = jwtClaims(answer.access_token);
    const now = yield* DateTime.now;
    const exp = claims?.["exp"];
    const clientId = claims?.["client_id"];
    return {
      accessToken: answer.access_token,
      refreshToken: answer.refresh_token ?? tokens.refreshToken,
      clientId: typeof clientId === "string" && clientId !== "" ? clientId : tokens.clientId,
      accessExpiresAt:
        typeof exp === "number"
          ? new Date(exp * 1000).toISOString()
          : DateTime.formatIso(DateTime.add(now, { seconds: answer.expires_in ?? 3600 })),
    } satisfies Renewed;
  });

  const saveTokens = (renewed: Renewed) =>
    sql`
      UPDATE garmin_connection SET
        access_token = ${renewed.accessToken},
        refresh_token = ${renewed.refreshToken},
        client_id = ${renewed.clientId},
        access_expires_at = ${renewed.accessExpiresAt}
      WHERE id = 1
    `.pipe(Effect.mapError(persistence("save the Garmin connection")));

  /** The stored tokens, renewed and saved first when the access token is close to its end. */
  const freshTokens = Effect.fn("Garmin.freshTokens")(function* (
    row: ConnectionRow,
    force = false,
  ) {
    const now = yield* DateTime.now;
    const renewBy = DateTime.formatIso(DateTime.addDuration(now, RENEW_BEFORE));
    if (!force && row.accessToken !== "" && row.accessExpiresAt > renewBy) return row;
    const renewed = yield* renew(row);
    yield* saveTokens(renewed);
    return { ...row, ...renewed };
  });

  /** One window of weigh-ins; a 401 renews the token once and asks again. */
  const readWindow = Effect.fn("Garmin.readWindow")(function* (
    tokens: { current: ConnectionRow },
    window: { readonly from: string; readonly to: string },
  ) {
    const get = (accessToken: string) =>
      send(
        HttpClientRequest.get(
          `${GARMIN_API}/weight-service/weight/range/${window.from}/${window.to}`,
        ).pipe(
          HttpClientRequest.bearerToken(accessToken),
          HttpClientRequest.acceptJson,
          HttpClientRequest.setUrlParams({ includeAll: "true" }),
        ),
        new Set([401]),
      );
    const body = yield* get(tokens.current.accessToken).pipe(
      Effect.catchTags({
        GarminTokensRefusedError: () =>
          freshTokens(tokens.current, true).pipe(
            Effect.tap((renewed) =>
              Effect.sync(() => {
                tokens.current = renewed;
              }),
            ),
            Effect.flatMap((renewed) => get(renewed.accessToken)),
          ),
      }),
    );
    const range = yield* decodeWeightRange(body ?? {}).pipe(
      Effect.mapError(() => unavailable("its weigh-ins came in a shape Chalk does not know.")),
    );
    return firstReadings(range);
  });

  /** Reads `from`..today into bodyweight, then records how the read went. */
  const read = Effect.fn("Garmin.read")(function* (row: ConnectionRow) {
    const now = yield* DateTime.now;
    const today = boxLocal(DateTime.formatIso(now)).date;
    const from =
      row.syncedThrough === null
        ? row.importFrom
        : [row.importFrom, shiftDate(row.syncedThrough, -OVERLAP_DAYS)].sort().at(-1)!;
    const result = yield* Effect.gen(function* () {
      const tokens = { current: yield* freshTokens(row) };
      // Tomorrow too: Garmin's calendar day can run ahead of the box's.
      for (const window of windows(from, shiftDate(today, 1), WINDOW_DAYS)) {
        const readings = yield* readWindow(tokens, window);
        yield* profile.importScaleReadings(readings).pipe(Effect.mapError(profileFailed));
      }
    }).pipe(Effect.result);
    const finishedAt = DateTime.formatIso(yield* DateTime.now);
    const failure = result._tag === "Failure" ? result.failure : undefined;
    const lastError =
      failure instanceof GarminTokensRefusedError || failure instanceof GarminUnavailableError
        ? failure.message
        : failure === undefined
          ? null
          : "Could not save the weigh-ins.";
    yield* sql`
      UPDATE garmin_connection SET
        synced_through = ${failure === undefined ? today : row.syncedThrough},
        last_sync_at = ${finishedAt},
        last_error = ${lastError}
      WHERE id = 1
    `.pipe(Effect.mapError(persistence("save the Garmin connection")));
    if (failure !== undefined) return yield* Effect.fail(failure);
  });

  const status = Effect.fn("Garmin.status")(function* () {
    return yield* statusOf(yield* loadConnection);
  });

  const connect = Effect.fn("Garmin.connect")(
    function* (input: ConnectGarminInput) {
      const pasted = parseTokenFile(input.tokens);
      if (pasted === undefined) return yield* new GarminTokensInvalidError();
      const renewed = yield* renew(pasted);
      const now = DateTime.formatIso(yield* DateTime.now);
      yield* sql`
      INSERT INTO garmin_connection (
        id, access_token, refresh_token, client_id, access_expires_at, import_from,
        synced_through, last_sync_at, last_error, updated_at
      )
      VALUES (
        1, ${renewed.accessToken}, ${renewed.refreshToken}, ${renewed.clientId},
        ${renewed.accessExpiresAt}, ${input.importFrom}, NULL, NULL, NULL, ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        client_id = excluded.client_id,
        access_expires_at = excluded.access_expires_at,
        import_from = excluded.import_from,
        synced_through = NULL,
        last_sync_at = NULL,
        last_error = NULL,
        updated_at = excluded.updated_at
    `.pipe(Effect.mapError(persistence("save the Garmin connection")));
      const row = yield* loadConnection;
      if (row !== undefined) yield* read(row);
      return yield* status();
    },
    (effect) => lock.withPermits(1)(effect),
  );

  const sync = Effect.fn("Garmin.sync")(
    function* () {
      const row = yield* loadConnection;
      if (row === undefined) return yield* new GarminNotConnectedError();
      yield* read(row);
      return yield* status();
    },
    (effect) => lock.withPermits(1)(effect),
  );

  const disconnect = Effect.fn("Garmin.disconnect")(
    function* () {
      yield* sql`DELETE FROM garmin_connection WHERE id = 1`.pipe(
        Effect.mapError(persistence("remove the Garmin connection")),
      );
    },
    (effect) => lock.withPermits(1)(effect),
  );

  return Garmin.of({ status, connect, sync, disconnect });
});

/** Needs an `HttpClient`: fetch in the server, a fake in tests. */
export const layer = Layer.effect(Garmin, make);

/**
 * While the server runs, reads new weigh-ins a minute after start and then every few hours.
 * Not connected is quiet; a failed read is logged and kept for Settings to show.
 */
export const layerTimedSync = Layer.effectDiscard(
  Effect.gen(function* () {
    const garmin = yield* Garmin;
    const once = garmin.sync().pipe(
      Effect.asVoid,
      Effect.catchTags({ GarminNotConnectedError: () => Effect.void }),
      Effect.catch((error) => Effect.logWarning(`Garmin weigh-in read failed: ${error.message}`)),
    );
    yield* Effect.sleep(Duration.minutes(1)).pipe(
      Effect.andThen(once.pipe(Effect.repeat(Schedule.spaced(SYNC_EVERY)))),
      Effect.forkScoped,
    );
  }),
);
