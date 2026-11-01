import { describe, expect, it } from "@effect/vitest";

import { classMarks, dayCoaching, type BookingboardClass } from "./bookingboard.ts";
import { parseCoaching, sessionPhrase, withCoaching, withSessionType } from "./coaching.ts";

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

describe("classMarks", () => {
  it("reads WOD and Power classes by name, and leaves other names untyped", () => {
    expect(classMarks(wod("Rikke L."))).toEqual({
      coaching: { _tag: "coached", coach: "Rikke L." },
      classType: "wod",
    });
    expect(classMarks({ ...wod(null), title: "Power" })).toEqual({ classType: "strength" });
    expect(classMarks({ ...wod(null), title: "Gymnastics" })).toEqual({});
  });
});

describe("session type", () => {
  const rikke = { _tag: "coached", coach: "Rikke L." } as const;

  it("makes Solo the coaching, and a class over Solo drops it but keeps a named coach", () => {
    const solo = withSessionType({ classType: "wod", coaching: rikke }, "solo");
    expect(solo).toEqual({ coaching: { _tag: "solo" } });
    expect(withSessionType(solo, "strength")).toEqual({ classType: "strength" });
    expect(withSessionType({ coaching: rikke }, "wod")).toEqual({
      classType: "wod",
      coaching: rikke,
    });
    expect(withSessionType({ classType: "wod", coaching: rikke }, undefined)).toEqual({
      coaching: rikke,
    });
  });

  it("drops the class for Solo coaching, and reads a coach named after Solo as the WOD", () => {
    expect(withCoaching({ classType: "strength" }, { _tag: "solo" })).toEqual({
      coaching: { _tag: "solo" },
    });
    expect(withCoaching({ coaching: { _tag: "solo" } }, rikke)).toEqual({
      classType: "wod",
      coaching: rikke,
    });
    expect(withCoaching({ coaching: { _tag: "solo" } }, rikke, "strength")).toEqual({
      classType: "strength",
      coaching: rikke,
    });
    expect(withCoaching({ classType: "strength" }, rikke)).toEqual({
      classType: "strength",
      coaching: rikke,
    });
  });

  it("phrases the type with its coach, either alone, or neither", () => {
    expect(sessionPhrase({ classType: "wod", coaching: rikke })).toBe("WOD class with Rikke L.");
    expect(sessionPhrase({ classType: "strength" })).toBe("Strength class");
    expect(sessionPhrase({ coaching: { _tag: "solo" } })).toBe("Solo");
    expect(sessionPhrase({ coaching: rikke })).toBe("with Rikke L.");
    expect(sessionPhrase({})).toBeUndefined();
  });
});
