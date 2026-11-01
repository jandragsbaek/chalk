import type { BenchmarkResult, LiftSet, Movement, Workout } from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  benchmarkRecords,
  calendarWeeks,
  consistency,
  isoWeek,
  liftRecords,
  mainLifts,
  trainingDays,
} from "./dashboard.ts";
import { toDate } from "./progress.ts";

let seq = 0;
function lift(performedOn: string, reps: number, loadKg: number, movementId = "back-squat") {
  seq += 1;
  return {
    id: `s${seq}`,
    movementId,
    performedOn,
    reps,
    loadKg,
    notes: "",
    createdAt: `${performedOn}T10:00:${String(seq % 60).padStart(2, "0")}.000Z`,
  } as unknown as LiftSet;
}

function workout(performedOn: string, name = "Metcon") {
  seq += 1;
  return {
    id: `w${seq}`,
    performedOn,
    name,
    kind: "for_time",
    score: "",
    rx: true,
    notes: "",
    createdAt: `${performedOn}T09:00:00.000Z`,
  } as unknown as Workout;
}

// Sunday 1 November 2026, ISO week 44.
const today = toDate("2026-11-01");

describe("trainingDays", () => {
  it("counts a day's workouts, or one session for a day with only lift sets", () => {
    const days = trainingDays(
      [workout("2026-10-26"), workout("2026-10-26"), workout("2026-10-28")],
      [lift("2026-10-28", 5, 100), lift("2026-10-30", 3, 110), lift("2026-10-30", 3, 60, "press")],
    );
    expect(days.get("2026-10-26")?.sessions).toBe(2);
    // Sets beside a workout are part of it.
    expect(days.get("2026-10-28")?.sessions).toBe(1);
    expect(days.get("2026-10-30")).toMatchObject({
      sessions: 1,
      liftMovementIds: ["back-squat", "press"],
    });
  });
});

describe("calendar", () => {
  it("lays out weeks Monday first, ending with this week", () => {
    const weeks = calendarWeeks(today, 53);
    expect(weeks).toHaveLength(53);
    expect(weeks.at(-1)).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
    expect(weeks[0]?.[0]).toBe("2025-10-27");
  });

  it("numbers weeks the ISO way", () => {
    expect(isoWeek(today)).toBe(44);
    expect(isoWeek(toDate("2026-01-01"))).toBe(1);
    expect(isoWeek(toDate("2027-01-01"))).toBe(53);
  });
});

describe("consistency", () => {
  it("keeps the run alive through a week with nothing logged yet", () => {
    // Trained the three weeks before this one, a gap, then two more; nothing this week yet.
    const dates = ["2026-10-19", "2026-10-14", "2026-10-06", "2026-09-17", "2026-09-08"];
    const days = trainingDays(
      dates.map((date) => workout(date)),
      [],
    );
    const numbers = consistency(days, today, 365);
    expect(numbers).toMatchObject({ thisWeek: 0, lastWeek: 1, runWeeks: 3, bestRunWeeks: 3 });
    expect(numbers.last30Days).toBe(3);
    expect(numbers.lastYear).toBe(5);
  });

  it("counts days, not sessions, in a week", () => {
    const days = trainingDays(
      [workout("2026-10-26"), workout("2026-10-26"), workout("2026-10-27")],
      [],
    );
    expect(consistency(days, today, 365)).toMatchObject({ thisWeek: 2, runWeeks: 1 });
  });
});

describe("liftRecords", () => {
  it("reports a set that beats a standing record, never the first set of a lift", () => {
    const records = liftRecords([
      lift("2026-09-01", 5, 100),
      lift("2026-09-08", 5, 105),
      lift("2026-09-15", 5, 100),
    ]);
    expect(records).toEqual([
      expect.objectContaining({ performedOn: "2026-09-08", reps: 5, loadKg: 105, previousKg: 100 }),
    ]);
  });

  it("marks a max implied by a set with more reps", () => {
    const records = liftRecords([lift("2026-09-01", 3, 110), lift("2026-09-08", 4, 112.5)]);
    expect(records).toEqual([
      expect.objectContaining({ reps: 3, implied: true, loadKg: 112.5, previousKg: 110 }),
    ]);
  });
});

describe("benchmarkRecords", () => {
  const attempt = (performedOn: string, score: string) =>
    ({
      benchmarkId: "fran",
      workoutId: "w",
      performedOn,
      score,
      rx: true,
      imported: false,
    }) as unknown as BenchmarkResult;

  it("reports an attempt that beats the earlier best, read the benchmark's way", () => {
    const records = benchmarkRecords([
      attempt("2026-06-01", "5:10"),
      attempt("2026-07-01", "5:40"),
      attempt("2026-08-01", "4:52"),
    ]);
    expect(records).toEqual([
      expect.objectContaining({ performedOn: "2026-08-01", score: "4:52", previousScore: "5:10" }),
    ]);
  });
});

describe("mainLifts", () => {
  const movements = [
    { id: "back-squat", name: "Back squat", category: "barbell" },
    { id: "deadlift", name: "Deadlift", category: "barbell" },
    { id: "pull-up", name: "Pull-up", category: "gymnastics" },
  ] as unknown as ReadonlyArray<Movement>;

  it("ranks barbell lifts by days trained and measures the change over the window", () => {
    const lifts = mainLifts(
      movements,
      [
        lift("2026-06-01", 1, 140),
        lift("2026-10-01", 1, 145),
        lift("2026-10-20", 3, 140),
        lift("2026-10-02", 1, 180, "deadlift"),
        lift("2026-10-02", 10, 20, "pull-up"),
      ],
      today,
      { count: 6, windowDays: 84 },
    );
    expect(lifts.map((summary) => summary.name)).toEqual(["Back squat", "Deadlift"]);
    const squat = lifts[0];
    // 3 × 140 (Epley 154) is the best to date; 140 stood when the window opened.
    expect(squat?.e1rm).toBeCloseTo(154);
    expect(squat?.tested).toBe(false);
    expect(squat?.change).toBeCloseTo(14);
    expect(squat?.sessions).toHaveLength(2);
    expect(lifts[1]).toMatchObject({ tested: true, change: undefined });
  });
});
