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
const EXPIRES = "2026-11-30T12:06:35.000Z";
const TOKEN = `e30.${Buffer.from(JSON.stringify({ exp: Date.parse(EXPIRES) / 1000 })).toString("base64url")}.sig`;

const booking = (classId: number, begins: string, status = "OnTime", onWaitingList = false) => ({
  id: classId * 10,
  accountId: ME,
  accountEmailAddress: "athlete@example.com",
  classId,
  className: classId === 3 ? "Open Gym" : "WOD",
  name: "Athlete",
  status,
  classBegins: begins,
  onWaitingList,
});

// The athlete's own classes, as /account/{id}/classes answers them.
const BOOKINGS = [
  booking(1, "2026-10-30T15:30:00+01:00"),
  booking(1, "2026-10-30T15:30:00+01:00", "TooLate"),
  booking(2, "2026-10-30T05:30:00+00:00", "OptedOut"),
  booking(3, "2026-10-29T23:00:00+00:00"),
  booking(4, "2026-10-29T16:30:00+01:00"),
  booking(5, "2026-10-30T09:00:00+01:00", "SignedUp", true),
  booking(6, "2026-10-30T07:00:00+00:00"),
  booking(7, "2026-11-03T16:00:00+01:00", "SignedUp"),
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
  readonly host: string;
  readonly method: string;
  readonly path: string;
  readonly params: Record<string, string>;
  readonly authorization: string | undefined;
}

/** The account's classes between `from` and `to`, newest first, one page of them. */
const classesPage = (
  history: ReadonlyArray<ReturnType<typeof booking>>,
  params: URLSearchParams,
) => {
  const from = params.get("from");
  const to = params.get("to");
  const page = Number(params.get("page") ?? 0);
  const size = Number(params.get("pageSize") ?? 20);
  return history
    .filter(
      (entry) =>
        (from === null || Date.parse(entry.classBegins) >= Date.parse(from)) &&
        (to === null || Date.parse(entry.classBegins) <= Date.parse(to)),
    )
    .sort((a, b) => Date.parse(b.classBegins) - Date.parse(a.classBegins))
    .slice(page * size, (page + 1) * size);
};

type Status = number | (() => number | undefined);

/**
 * Bookingboard as a fake: the web API answers the account and its classes (`history`), the
 * mobile API the classes' programs; `status` overrides every answer.
 */
const fakeBookingboard = (calls: Array<Call>, status?: Status, history = BOOKINGS) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) => {
      const path = url.pathname.replace(/^\/api/, "");
      calls.push({
        host: url.hostname,
        method: request.method,
        path,
        params: Object.fromEntries(url.searchParams),
        authorization: request.headers["authorization"],
      });
      const web = url.hostname === "box7100.bookingboard.io";
      const classId = /^\/classes\/(\d+)$/.exec(path)?.[1];
      const body = web
        ? path === "/account"
          ? { id: ME, fullName: "Athlete" }
          : path === `/account/${ME}/classes`
            ? classesPage(history, url.searchParams)
            : undefined
        : classId === undefined
          ? undefined
          : CLASSES[classId];
      const failWith = typeof status === "function" ? status() : status;
      const answer =
        failWith !== undefined
          ? new Response("{}", { status: failWith })
          : body === undefined
            ? new Response("{}", { status: 404 })
            : Response.json(body);
      return Effect.succeed(HttpClientResponse.fromWeb(request, answer));
    }),
  );

const layer = (calls: Array<Call>, status?: Status, history = BOOKINGS) =>
  Bookingboard.layer.pipe(
    Layer.provide(fakeBookingboard(calls, status, history)),
    Layer.provideMerge(Sqlite.layer),
    Layer.provide(ServerConfig.layerTest()),
  );

const CLASSES_PATH = `/account/${ME}/classes`;
const classListCalls = (calls: ReadonlyArray<Call>) =>
  calls.filter((call) => call.path === CLASSES_PATH);

describe("Bookingboard", () => {
  it.effect("pulls the programs of the athlete's own classes on a box-local day", () => {
    const calls: Array<Call> = [];
    return Effect.gen(function* () {
      const board = yield* Bookingboard.Bookingboard;
      yield* board.connect({ token: TOKEN, participantId: ME });
      calls.length = 0;

      const day = yield* board.day("2026-10-30");

      // Class 1 once despite two bookings; 2 opted out; 3 is open gym (no program) at the box's
      // midnight, so only `openGym`; 4 the day before; 5 wait-listed.
      expect(day).toEqual({
        date: "2026-10-30",
        classes: [
          {
            classId: 6,
            title: "Power",
            startsAt: "08:00",
            coach: null,
            status: "OnTime",
            text: "Strength\nBack squat 5x5",
          },
          {
            classId: 1,
            title: "WOD",
            startsAt: "15:30",
            coach: "Coach A.",
            status: "OnTime",
            text: "Workout #1\nEMOM 16\n12 Burpee over rower",
          },
        ],
        openGym: true,
      });
      expect(calls.every((call) => call.method === "GET")).toBe(true);
      expect(calls.every((call) => call.authorization === `Bearer ${TOKEN}`)).toBe(true);
      expect(calls[0]).toMatchObject({
        host: "box7100.bookingboard.io",
        path: CLASSES_PATH,
        params: {
          from: "2026-10-29T12:00:00.000Z",
          to: "2026-10-30T23:59:59.999Z",
          page: "0",
          pageSize: "100",
        },
      });
    }).pipe(Effect.provide(layer(calls)));
  });

  it.effect("shows Settings whether it is connected, never the token", () =>
    Effect.gen(function* () {
      const board = yield* Bookingboard.Bookingboard;
      expect(yield* board.status()).toEqual({ _tag: "disconnected" });
      expect((yield* board.day("2026-10-30").pipe(Effect.flip))._tag).toBe(
        "BookingboardNotConnectedError",
      );

      // The account names the participant: a mistyped id is put right.
      const connected = yield* board.connect({ token: TOKEN, participantId: ME + 1 });
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

  describe("attendance", () => {
    const NOW = Date.parse("2026-11-01T12:00:00Z");

    const connected = (calls: Array<Call>) =>
      Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        const board = yield* Bookingboard.Bookingboard;
        yield* board.connect({ token: TOKEN, participantId: ME });
        calls.length = 0;
        return board;
      });

    it.effect("keeps a copy of every class attended, the whole history the first time", () => {
      const calls: Array<Call> = [];
      return Effect.gen(function* () {
        const board = yield* connected(calls);

        const attendance = yield* board.attendance({ check: "ifStale" });

        // Checked in only: 2 opted out, 5 wait-listed, 7 still to come.
        expect(attendance).toEqual({
          coveredFrom: "2026-10-29",
          checkedAt: "2026-11-01T12:00:00.000Z",
          classes: [
            { classId: 4, date: "2026-10-29", startsAt: "16:30", title: "WOD", coach: null },
            { classId: 3, date: "2026-10-30", startsAt: "00:00", title: "Open Gym", coach: null },
            { classId: 6, date: "2026-10-30", startsAt: "08:00", title: "WOD", coach: null },
            { classId: 1, date: "2026-10-30", startsAt: "15:30", title: "WOD", coach: null },
          ],
          skippedDays: [],
          checkFailed: null,
        });
        expect(calls).toEqual([
          expect.objectContaining({
            path: CLASSES_PATH,
            params: { to: "2026-11-01T12:00:00.000Z", page: "0", pageSize: "100" },
          }),
        ]);
      }).pipe(Effect.provide(layer(calls)));
    });

    it.effect("reads bookingboard again only once the copy is stale", () => {
      const calls: Array<Call> = [];
      return Effect.gen(function* () {
        const board = yield* connected(calls);
        yield* board.attendance({ check: "ifStale" });

        yield* TestClock.adjust("29 minutes");
        yield* board.attendance({ check: "ifStale" });
        expect(classListCalls(calls)).toHaveLength(1);

        // Asked for, it reads at most once a minute.
        yield* board.attendance({ check: "now" });
        yield* board.attendance({ check: "now" });
        expect(classListCalls(calls)).toHaveLength(2);

        // A later read starts a few days before the last one, for late check-ins.
        yield* TestClock.adjust("31 minutes");
        yield* board.attendance({ check: "ifStale" });
        expect(classListCalls(calls)).toHaveLength(3);
        expect(calls.at(-1)?.params).toMatchObject({ from: "2026-10-28T12:00:00.000Z" });
        expect((yield* board.attendance({ check: "ifStale" })).coveredFrom).toBe("2026-10-29");
      }).pipe(Effect.provide(layer(calls)));
    });

    it.effect("reads a long history page by page", () => {
      const calls: Array<Call> = [];
      // 250 classes, one a day back from Oct 31.
      const history = Array.from({ length: 250 }, (_, index) =>
        booking(
          100 + index,
          new Date(Date.parse("2026-10-31T16:00:00Z") - index * 86_400_000).toISOString(),
        ),
      );
      return Effect.gen(function* () {
        const board = yield* connected(calls);

        const attendance = yield* board.attendance({ check: "ifStale" });
        expect(attendance.classes).toHaveLength(250);
        expect(attendance.coveredFrom).toBe("2026-02-24");
        expect(classListCalls(calls).map((call) => call.params["page"])).toEqual(["0", "1", "2"]);
      }).pipe(Effect.provide(layer(calls, undefined, history)));
    });

    it.effect("pulls a day the copy holds without reading bookings, and a past class once", () => {
      const calls: Array<Call> = [];
      return Effect.gen(function* () {
        const board = yield* connected(calls);
        yield* board.attendance({ check: "ifStale" });
        calls.length = 0;

        const first = yield* board.day("2026-10-30");
        expect(classListCalls(calls)).toEqual([]);
        expect(calls.map((call) => call.path).sort()).toEqual([
          "/classes/1",
          "/classes/3",
          "/classes/6",
        ]);
        calls.length = 0;
        expect(yield* board.day("2026-10-30")).toEqual(first);
        expect(calls).toEqual([]);

        // A pulled class lends the copy its title and coach.
        const { classes } = yield* board.attendance({ check: "ifStale" });
        expect(classes.filter((entry) => entry.date === "2026-10-30")).toEqual([
          { classId: 3, date: "2026-10-30", startsAt: "00:00", title: "Open Gym", coach: null },
          { classId: 6, date: "2026-10-30", startsAt: "08:00", title: "Power", coach: null },
          { classId: 1, date: "2026-10-30", startsAt: "15:30", title: "WOD", coach: "Coach A." },
        ]);
      }).pipe(Effect.provide(layer(calls)));
    });

    it.effect("keeps answering from the copy once the token expires, and says why", () => {
      const calls: Array<Call> = [];
      return Effect.gen(function* () {
        const board = yield* connected(calls);
        yield* board.attendance({ check: "ifStale" });
        yield* TestClock.setTime(Date.parse(EXPIRES) + 1);
        calls.length = 0;

        const attendance = yield* board.attendance({ check: "now" });
        expect(attendance.classes).toHaveLength(4);
        expect(attendance.checkFailed).toMatch(/token has expired/);
        expect(calls).toEqual([]);
      }).pipe(Effect.provide(layer(calls)));
    });

    it.effect("fails without a copy when bookingboard is down", () => {
      const calls: Array<Call> = [];
      let down = false;
      return Effect.gen(function* () {
        const board = yield* connected(calls);
        down = true;
        const fiber = yield* board
          .attendance({ check: "ifStale" })
          .pipe(Effect.flip, Effect.forkChild);
        yield* TestClock.adjust("10 seconds");
        expect((yield* Fiber.join(fiber))._tag).toBe("BookingboardUnavailableError");
      }).pipe(Effect.provide(layer(calls, () => (down ? 503 : undefined))));
    });

    it.effect("remembers the days the athlete will not log", () => {
      const calls: Array<Call> = [];
      return Effect.gen(function* () {
        const board = yield* connected(calls);
        yield* board.skipDay({ date: "2026-10-29", skipped: true });
        yield* board.skipDay({ date: "2026-10-29", skipped: true });
        expect((yield* board.attendance({ check: "ifStale" })).skippedDays).toEqual(["2026-10-29"]);
        yield* board.skipDay({ date: "2026-10-29", skipped: false });
        expect((yield* board.attendance({ check: "ifStale" })).skippedDays).toEqual([]);
      }).pipe(Effect.provide(layer(calls)));
    });

    it.effect("forgets the copy on disconnect", () => {
      const calls: Array<Call> = [];
      return Effect.gen(function* () {
        const board = yield* connected(calls);
        yield* board.attendance({ check: "ifStale" });
        yield* board.disconnect();
        yield* board.connect({ token: TOKEN, participantId: ME });
        calls.length = 0;

        yield* board.attendance({ check: "ifStale" });
        expect(classListCalls(calls)).toHaveLength(1);
      }).pipe(Effect.provide(layer(calls)));
    });
  });
});
