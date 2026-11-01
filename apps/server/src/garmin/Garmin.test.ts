import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as TestClock from "effect/testing/TestClock";

import * as ServerConfig from "../config.ts";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as ProfileStore from "../profile/ProfileStore.ts";
import * as Garmin from "./Garmin.ts";

const NOW = Date.parse("2026-11-01T09:00:00Z");
const CLIENT = "GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2";

const jwt = (claims: Record<string, unknown>) =>
  `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;

/** The file `pnpm garmin:login` prints; its access token is long dead. */
const tokenFile = (refresh: string) =>
  JSON.stringify({
    di_token: jwt({ exp: 1, client_id: CLIENT }),
    di_refresh_token: refresh,
    di_client_id: CLIENT,
  });

const metric = (calendarDate: string, kg: number, clock: string) => ({
  samplePk: 1,
  calendarDate,
  weight: kg * 1000,
  date: Date.parse(`${calendarDate}T${clock}:00Z`),
  timestampGMT: Date.parse(`${calendarDate}T${clock}:00Z`) - 3_600_000,
  sourceType: "INDEX_SCALE",
});

/** Every weigh-in on the Garmin account; a range answers the ones inside it. */
const SCALE = [
  metric("2025-08-30", 90, "07:00"),
  metric("2025-09-02", 88.4, "06:55"),
  metric("2026-10-30", 84.6, "18:20"),
  metric("2026-10-30", 84.3, "06:48"),
  metric("2026-10-31", 84.1, "07:02"),
];

interface Fake {
  /** Refresh tokens Garmin still takes; each renewal turns the one used over. */
  readonly live: Set<string>;
  /** The access token weight-service takes right now. */
  access: string | undefined;
  readonly calls: Array<{ readonly method: string; readonly path: string }>;
  renewals: number;
}

const newFake = (refresh = "r1"): Fake => ({
  live: new Set([refresh]),
  access: undefined,
  calls: [],
  renewals: 0,
});

const fakeGarmin = (fake: Fake) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) => {
      fake.calls.push({ method: request.method, path: url.pathname });
      let answer: Response;
      if (url.host === "diauth.garmin.com") {
        const body =
          request.body._tag === "Uint8Array" ? new TextDecoder().decode(request.body.body) : "";
        const params = new URLSearchParams(body);
        const refresh = params.get("refresh_token") ?? "";
        if (params.get("grant_type") !== "refresh_token" || !fake.live.delete(refresh)) {
          answer = Response.json({ error: "invalid_grant" }, { status: 400 });
        } else {
          fake.renewals += 1;
          const next = `r${fake.renewals + 1}`;
          fake.live.add(next);
          fake.access = jwt({ exp: NOW / 1000 + 3600, client_id: CLIENT, n: fake.renewals });
          answer = Response.json({ access_token: fake.access, refresh_token: next });
        }
      } else {
        const range = /^\/weight-service\/weight\/range\/([\d-]+)\/([\d-]+)$/.exec(url.pathname);
        if (request.headers["authorization"] !== `Bearer ${fake.access}`) {
          answer = new Response("{}", { status: 401 });
        } else if (range === null || url.searchParams.get("includeAll") !== "true") {
          answer = new Response("{}", { status: 404 });
        } else {
          const [, from = "", to = ""] = range;
          const inside = SCALE.filter((m) => m.calendarDate >= from && m.calendarDate <= to);
          const days = [...new Set(inside.map((m) => m.calendarDate))];
          answer = Response.json({
            dailyWeightSummaries: days.map((day) => ({
              summaryDate: day,
              allWeightMetrics: inside.filter((m) => m.calendarDate === day),
            })),
          });
        }
      }
      return Effect.succeed(HttpClientResponse.fromWeb(request, answer));
    }),
  );

const layer = (fake: Fake) =>
  Garmin.layer.pipe(
    Layer.provideMerge(ProfileStore.layer),
    Layer.provide(fakeGarmin(fake)),
    Layer.provideMerge(Sqlite.layer),
    Layer.provide(ServerConfig.layerTest()),
  );

describe("Garmin", () => {
  it.effect(
    "renews the pasted tokens, then imports the first reading of each day since a date",
    () => {
      const fake = newFake();
      return Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        const garmin = yield* Garmin.Garmin;
        const profile = yield* ProfileStore.ProfileStore;
        yield* profile.logBodyweight({ performedOn: "2026-10-31", kg: 85 });

        const status = yield* garmin.connect({ tokens: tokenFile("r1"), importFrom: "2025-09-01" });

        // Before the import date stays in Garmin; Oct 30 takes its morning reading; Oct 31 was
        // typed, so it keeps the athlete's.
        expect((yield* profile.get()).bodyweights).toEqual([
          { performedOn: "2025-09-02", kg: 88.4, source: "garmin", measuredAt: "06:55" },
          { performedOn: "2026-10-30", kg: 84.3, source: "garmin", measuredAt: "06:48" },
          { performedOn: "2026-10-31", kg: 85, source: "manual", measuredAt: null },
        ]);
        expect(status).toEqual({
          _tag: "connected",
          importFrom: "2025-09-01",
          weighIns: 2,
          lastSyncAt: new Date(NOW).toISOString(),
          lastError: null,
        });
        // One renewal, then the range in windows up to tomorrow, all reads.
        expect(fake.renewals).toBe(1);
        const reads = fake.calls.filter((call) => call.method === "GET").map((call) => call.path);
        expect(reads[0]).toBe("/weight-service/weight/range/2025-09-01/2025-12-29");
        expect(reads.at(-1)).toMatch(/\/2026-11-02$/);
      }).pipe(Effect.provide(layer(fake)));
    },
  );

  it.effect(
    "reads from a few days before the last read, renewing a token Garmin turned away",
    () => {
      const fake = newFake();
      return Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        const garmin = yield* Garmin.Garmin;
        yield* garmin.connect({ tokens: tokenFile("r1"), importFrom: "2025-09-01" });
        fake.calls.length = 0;
        fake.access = "revoked";

        yield* garmin.sync();

        expect(fake.renewals).toBe(2);
        expect(fake.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
          "GET /weight-service/weight/range/2026-10-29/2026-11-02",
          "POST /di-oauth2-service/oauth/token",
          "GET /weight-service/weight/range/2026-10-29/2026-11-02",
        ]);
      }).pipe(Effect.provide(layer(fake)));
    },
  );

  it.effect(
    "keeps nothing from a paste that is not the token file, or tokens Garmin refuses",
    () => {
      const fake = newFake();
      return Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        const garmin = yield* Garmin.Garmin;

        const invalid = yield* garmin
          .connect({ tokens: "eyJhbGciOi", importFrom: "2025-09-01" })
          .pipe(Effect.flip);
        expect(invalid._tag).toBe("GarminTokensInvalidError");
        expect(fake.calls).toEqual([]);

        const refused = yield* garmin
          .connect({ tokens: tokenFile("revoked"), importFrom: "2025-09-01" })
          .pipe(Effect.flip);
        expect(refused._tag).toBe("GarminTokensRefusedError");
        expect(yield* garmin.status()).toEqual({ _tag: "disconnected", suggestedFrom: null });
      }).pipe(Effect.provide(layer(fake)));
    },
  );

  it.effect("records a refused renewal for Settings, and keeps what was imported", () => {
    const fake = newFake();
    return Effect.gen(function* () {
      yield* TestClock.setTime(NOW);
      const garmin = yield* Garmin.Garmin;
      yield* garmin.connect({ tokens: tokenFile("r1"), importFrom: "2025-09-01" });
      fake.live.clear();
      fake.access = "revoked";
      yield* TestClock.setTime(NOW + 2 * 3_600_000);

      const error = yield* garmin.sync().pipe(Effect.flip);
      expect(error._tag).toBe("GarminTokensRefusedError");
      expect(yield* garmin.status()).toMatchObject({
        _tag: "connected",
        weighIns: 3,
        lastError: "Garmin refused the tokens. Run pnpm garmin:login again and paste the new ones.",
      });

      yield* garmin.disconnect();
      expect((yield* garmin.sync().pipe(Effect.flip))._tag).toBe("GarminNotConnectedError");
    }).pipe(Effect.provide(layer(fake)));
  });
});
