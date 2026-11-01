import { describe, expect, it } from "@effect/vitest";

import { numberSessions, parsePlace, placedSessions, THE_BOX, type Place } from "./place.ts";

const home: Place = { _tag: "home" };

describe("parsePlace", () => {
  it("reads the box, home and other boxes by name", () => {
    expect(parsePlace("")).toEqual(THE_BOX);
    expect(parsePlace(" the  Box ")).toEqual(THE_BOX);
    expect(parsePlace("HOME")).toEqual(home);
    expect(parsePlace("  CrossFit   Nordvest ")).toEqual({
      _tag: "away",
      name: "CrossFit Nordvest",
    });
  });
});

describe("numberSessions", () => {
  const session = (key: string, performedOn: string, place: Place, createdAt = "1") => ({
    key,
    performedOn,
    createdAt,
    place,
  });

  it("counts each place on its own, oldest first, another box by its name", () => {
    const numbers = numberSessions([
      session("c", "2026-10-03", THE_BOX),
      session("a", "2026-10-01", THE_BOX),
      session("h", "2026-10-02", home),
      session("x", "2026-10-04", { _tag: "away", name: "CrossFit Nordvest" }),
      session("y", "2026-10-05", { _tag: "away", name: "crossfit nordvest" }),
      session("z", "2026-10-05", { _tag: "away", name: "Reebok Aarhus" }),
    ]);
    expect(Object.fromEntries(numbers)).toEqual({ a: 1, h: 1, c: 2, x: 1, y: 2, z: 1 });
  });

  it("orders two sessions on one day by when they were logged", () => {
    const numbers = numberSessions([
      session("late", "2026-10-01", THE_BOX, "2026-10-01T19:00"),
      session("early", "2026-10-01", THE_BOX, "2026-10-01T07:00"),
    ]);
    expect(numbers.get("early")).toBe(1);
    expect(numbers.get("late")).toBe(2);
  });
});

describe("placedSessions", () => {
  it("counts a day of lift sets only without a workout, at its first set's place", () => {
    const sessions = placedSessions(
      [{ id: "w1", performedOn: "2026-10-01", createdAt: "a", place: THE_BOX }],
      [
        { performedOn: "2026-10-01", createdAt: "b", place: THE_BOX },
        { performedOn: "2026-10-02", createdAt: "d", place: THE_BOX },
        { performedOn: "2026-10-02", createdAt: "c", place: home },
      ],
    );
    expect(sessions).toEqual([
      { key: "w1", performedOn: "2026-10-01", createdAt: "a", place: THE_BOX },
      { key: "day-2026-10-02", performedOn: "2026-10-02", createdAt: "c", place: home },
    ]);
  });
});
