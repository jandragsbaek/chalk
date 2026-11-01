import { describe, expect, it } from "@effect/vitest";

import { dayCoaching, type BookingboardClass } from "./bookingboard.ts";
import { parseCoaching } from "./coaching.ts";

const wod = (coach: string | null, startsAt = "16:30"): BookingboardClass => ({
  classId: startsAt === "16:30" ? 1 : 2,
  title: "WOD",
  startsAt,
  coach,
  status: "OnTime",
  text: "*** Workout",
});

describe("parseCoaching", () => {
  it("reads Solo in any case as alone, other text as a coach, blank as not recorded", () => {
    expect(parseCoaching(" solo ")).toEqual({ _tag: "solo" });
    expect(parseCoaching("Rikke  L. ")).toEqual({ _tag: "coached", coach: "Rikke L." });
    expect(parseCoaching("  ")).toBeUndefined();
  });
});

describe("dayCoaching", () => {
  it("names the day's one class's coach, and solo when only open gym or nothing was booked", () => {
    expect(dayCoaching({ date: "2026-10-30", classes: [wod("Rikke L.")], openGym: false })).toEqual(
      { _tag: "coached", coach: "Rikke L." },
    );
    expect(dayCoaching({ date: "2026-10-31", classes: [], openGym: true })).toEqual({
      _tag: "solo",
    });
    expect(dayCoaching({ date: "2026-11-01", classes: [], openGym: false })).toEqual({
      _tag: "solo",
    });
  });

  it("leaves it open for several classes, or a class that names no coach", () => {
    const day = { date: "2026-10-15", openGym: false };
    expect(dayCoaching({ ...day, classes: [wod("Sarah L."), wod("Rikke L.", "18:30")] })).toBe(
      undefined,
    );
    expect(dayCoaching({ ...day, classes: [wod(null)] })).toBeUndefined();
  });
});
