import type { BookingboardAttendance } from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import { backlogOf, nextOpenDay } from "./backlog.ts";

const wod = (classId: number, date: string, startsAt = "17:00") => ({
  classId,
  date,
  startsAt,
  title: "WOD",
  coach: null,
});

const attendance: BookingboardAttendance = {
  coveredFrom: "2026-08-06",
  checkedAt: "2026-11-01T12:00:00.000Z",
  classes: [
    wod(1, "2026-08-06"),
    wod(2, "2026-10-08"),
    wod(3, "2026-10-08", "18:00"),
    wod(4, "2026-10-10"),
    wod(5, "2026-10-12"),
  ],
  skippedDays: ["2026-10-10"],
  checkFailed: null,
};

const backlog = backlogOf(attendance, new Map([["2026-08-06", ["Fran"]]]));

describe("backlogOf", () => {
  it("gives each class day its state, oldest first, one day for two classes", () => {
    expect(backlog.days.map((day) => [day.date, day.state, day.classes.length])).toEqual([
      ["2026-08-06", "logged", 1],
      ["2026-10-08", "open", 2],
      ["2026-10-10", "skipped", 1],
      ["2026-10-12", "open", 1],
    ]);
    expect([backlog.open, backlog.logged, backlog.skipped]).toEqual([2, 1, 1]);
  });

  it("runs every month from the first class to the last, empty ones too", () => {
    expect(
      backlog.months.map((month) => [month.month, month.open, month.logged, month.skipped]),
    ).toEqual([
      ["2026-08", 0, 1, 0],
      ["2026-09", 0, 0, 0],
      ["2026-10", 2, 0, 1],
    ]);
  });
});

describe("nextOpenDay", () => {
  it("starts at the oldest open day", () => {
    expect(nextOpenDay(backlog)?.date).toBe("2026-10-08");
  });

  it("moves on past a day just saved, before the backlog knows it is logged", () => {
    expect(nextOpenDay(backlog, "2026-10-08")?.date).toBe("2026-10-12");
  });

  it("wraps to the oldest open day after the newest", () => {
    expect(nextOpenDay(backlog, "2026-10-12")?.date).toBe("2026-10-08");
  });
});
