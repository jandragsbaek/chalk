import { THE_BOX, type LiftSet, type Place, type Workout } from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import { nextMilestone, placeTally } from "./places.ts";

const workout = (id: string, performedOn: string, place: Place = THE_BOX) =>
  ({ id, performedOn, place, createdAt: `${performedOn}T18:00:00Z` }) as Workout;
const set = (performedOn: string, place: Place) =>
  ({ performedOn, place, createdAt: `${performedOn}T07:00:00Z` }) as LiftSet;

describe("placeTally", () => {
  it("counts sessions at the box, at home and away, and the other boxes trained at", () => {
    const tally = placeTally(
      [
        workout("a", "2026-10-01"),
        workout("b", "2026-10-02"),
        workout("c", "2026-10-03", { _tag: "away", name: "CrossFit Nordvest" }),
        workout("d", "2026-10-04", { _tag: "away", name: "Reebok Aarhus" }),
      ],
      // A day of lift sets next to a workout is part of it; on its own it is a session.
      [set("2026-10-01", { _tag: "home" }), set("2026-09-28", { _tag: "home" })],
    );
    expect(tally).toEqual({ box: 2, home: 1, away: 2, awayPlaces: 2, since: "2026-09-28" });
  });

  it("has nothing to count before the first session", () => {
    expect(placeTally([], []).since).toBeUndefined();
  });
});

describe("nextMilestone", () => {
  it("steps through the round numbers, then every fifty", () => {
    expect([3, 10, 24, 60, 100, 183, 200].map(nextMilestone)).toEqual([
      10, 25, 25, 100, 150, 200, 250,
    ]);
  });
});
