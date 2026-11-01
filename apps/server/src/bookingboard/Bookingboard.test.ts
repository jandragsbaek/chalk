import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as TestClock from "effect/testing/TestClock";

import * as ServerConfig from "../config.ts";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as Bookingboard from "./Bookingboard.ts";

const ME = 137765;
const OTHER = 424242;
const EXPIRES = "2026-11-30T12:06:35.000Z";
const TOKEN = `e30.${Buffer.from(JSON.stringify({ exp: Date.parse(EXPIRES) / 1000 })).toString("base64url")}.sig`;

const booking = (participantId: number, classId: number, begins: string, status = "OnTime") => ({
  id: classId * 10 + participantId,
  classId,
  className: classId === 3 ? "Open Gym" : "WOD",
  status,
  begins,
  participantId,
  participantName: participantId === ME ? "Athlete" : "Someone else",
});

// The gym's bookings from Oct 29 on, as /participations answers: everyone's, several days.
const PARTICIPATIONS = [
  booking(OTHER, 1, "2026-10-30T15:30:00+01:00"),
  booking(ME, 1, "2026-10-30T15:30:00+01:00"),
  booking(ME, 1, "2026-10-30T15:30:00+01:00", "TooLate"),
  booking(ME, 2, "2026-10-30T05:30:00+00:00", "OptedOut"),
  booking(ME, 3, "2026-10-29T23:00:00+00:00"),
  booking(ME, 4, "2026-10-29T16:30:00+01:00"),
  booking(OTHER, 5, "2026-10-30T09:00:00+01:00"),
  booking(ME, 6, "2026-10-30T07:00:00+00:00"),
];

const CLASSES: Record<string, unknown> = {
  "1": {
    title: "WOD",
    begins: "2026-10-30T14:30:00+00:00",
    instructors: [{ name: "Coach A." }],
    program: {
      workouts: [{ title: "Workout #1", text: "<p>EMOM 16&nbsp;</p><p>12 Burpee over rower</p>" }],
    },
    participants: [{ name: "Someone else" }],
  },
  "3": { title: "Open Gym", begins: "2026-10-29T23:00:00+00:00", instructors: [] },
  "6": {
    title: "Power",
    begins: "2026-10-30T07:00:00+00:00",
    instructors: [],
    program: { workouts: [{ title: "Strength", text: "<p>Back squat 5x5</p>" }] },
  },
};

interface Call {
  readonly method: string;
  readonly path: string;
  readonly params: Record<string, string>;
  readonly authorization: string | undefined;
}

/** Bookingboard as a fake: answers from the tables above, `status` overrides every answer. */
const fakeBookingboard = (calls: Array<Call>, status?: number) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) => {
      const path = url.pathname.replace(/^\/api/, "");
      calls.push({
        method: request.method,
        path,
        params: Object.fromEntries(url.searchParams),
        authorization: request.headers["authorization"],
      });
      const classId = /^\/classes\/(\d+)$/.exec(path)?.[1];
      const body =
        path === "/participations"
          ? PARTICIPATIONS
          : classId === undefined
            ? undefined
            : CLASSES[classId];
      const answer =
        status !== undefined
          ? new Response("{}", { status })
          : body === undefined
            ? new Response("{}", { status: 404 })
            : Response.json(body);
      return Effect.succeed(HttpClientResponse.fromWeb(request, answer));
    }),
  );

const layer = (calls: Array<Call>, status?: number) =>
  Bookingboard.layer.pipe(
    Layer.provide(fakeBookingboard(calls, status)),
    Layer.provideMerge(Sqlite.layer),
    Layer.provide(ServerConfig.layerTest()),
  );

describe("Bookingboard", () => {
  it.effect("pulls the programs of the athlete's own classes on a box-local day", () => {
    const calls: Array<Call> = [];
    return Effect.gen(function* () {
      const board = yield* Bookingboard.Bookingboard;
      yield* board.connect({ token: TOKEN, participantId: ME });
      calls.length = 0;

      const day = yield* board.day("2026-10-30");

      // Class 1 once despite two bookings; 2 opted out; 3 is open gym (no program) at the box's
      // midnight; 4 the day before; 5 someone else's.
      expect(day).toEqual({
        date: "2026-10-30",
        classes: [
          {
            classId: 6,
            title: "Power",
            startsAt: "08:00",
            coach: null,
            status: "OnTime",
            text: "*** Workout\n**** Strength\n- Back squat 5x5",
          },
          {
            classId: 1,
            title: "WOD",
            startsAt: "15:30",
            coach: "Coach A.",
            status: "OnTime",
            text: "*** Workout\n**** Workout #1\n- EMOM 16\n- 12 Burpee over rower",
          },
        ],
      });
      expect(calls.every((call) => call.method === "GET")).toBe(true);
      expect(calls.every((call) => call.authorization === `Bearer ${TOKEN}`)).toBe(true);
      expect(calls[0]).toMatchObject({ path: "/participations", params: { from: "2026-10-29" } });
    }).pipe(Effect.provide(layer(calls)));
  });

  it.effect("shows Settings whether it is connected, never the token", () =>
    Effect.gen(function* () {
      const board = yield* Bookingboard.Bookingboard;
      expect(yield* board.status()).toEqual({ _tag: "disconnected" });
      expect((yield* board.day("2026-10-30").pipe(Effect.flip))._tag).toBe(
        "BookingboardNotConnectedError",
      );

      const connected = yield* board.connect({ token: TOKEN, participantId: ME });
      expect(connected).toEqual({ _tag: "connected", participantId: ME, expiresAt: EXPIRES });
      expect(yield* board.status()).toEqual(connected);

      yield* board.disconnect();
      expect(yield* board.status()).toEqual({ _tag: "disconnected" });
    }).pipe(Effect.provide(layer([]))),
  );

  it.effect("refuses a paste that is not a token, and keeps nothing", () => {
    const calls: Array<Call> = [];
    return Effect.gen(function* () {
      const board = yield* Bookingboard.Bookingboard;
      const error = yield* board.connect({ token: "jwt=abc", participantId: ME }).pipe(Effect.flip);
      expect(error._tag).toBe("BookingboardTokenInvalidError");
      expect(calls).toEqual([]);
      expect(yield* board.status()).toEqual({ _tag: "disconnected" });
    }).pipe(Effect.provide(layer(calls)));
  });

  it.effect("says the token expired when bookingboard turns it away, and keeps nothing", () =>
    Effect.gen(function* () {
      const board = yield* Bookingboard.Bookingboard;
      const error = yield* board.connect({ token: TOKEN, participantId: ME }).pipe(Effect.flip);
      expect(error._tag).toBe("BookingboardTokenExpiredError");
      expect(yield* board.status()).toEqual({ _tag: "disconnected" });
    }).pipe(Effect.provide(layer([], 401))),
  );

  it.effect("asks for a new token once the stored one is past its expiry, without calling", () => {
    const calls: Array<Call> = [];
    return Effect.gen(function* () {
      const board = yield* Bookingboard.Bookingboard;
      yield* board.connect({ token: TOKEN, participantId: ME });
      calls.length = 0;
      yield* TestClock.setTime(Date.parse(EXPIRES) + 1);

      const error = yield* board.day("2026-12-01").pipe(Effect.flip);
      expect(error._tag).toBe("BookingboardTokenExpiredError");
      expect(calls).toEqual([]);
    }).pipe(Effect.provide(layer(calls)));
  });

  it.effect("reports a bookingboard that is down after one retry", () => {
    const calls: Array<Call> = [];
    return Effect.gen(function* () {
      const board = yield* Bookingboard.Bookingboard;
      const fiber = yield* board
        .connect({ token: TOKEN, participantId: ME })
        .pipe(Effect.flip, Effect.forkChild);
      yield* TestClock.adjust("10 seconds");
      const error = yield* Fiber.join(fiber);
      expect(error).toMatchObject({
        _tag: "BookingboardUnavailableError",
        reason: "it answered HTTP 503.",
      });
      expect(calls).toHaveLength(2);
    }).pipe(Effect.provide(layer(calls, 503)));
  });
});
