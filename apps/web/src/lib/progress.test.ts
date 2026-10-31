import type { LiftSet } from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import { bestToDate, clipSteps, rangeStart, sessionEstimates, toDate } from "./progress.ts";

function set(id: string, performedOn: string, reps: number, loadKg: number): LiftSet {
  return {
    id,
    movementId: "back-squat",
    performedOn,
    reps,
    loadKg,
    notes: "",
    createdAt: `${performedOn}T10:00:00.000Z`,
  } as unknown as LiftSet;
}

describe("sessionEstimates", () => {
  it("scores each day by its best set's Epley estimate, oldest first", () => {
    const sessions = sessionEstimates([
      set("b", "2026-02-01", 1, 120),
      set("a1", "2026-01-01", 5, 100),
      set("a2", "2026-01-01", 3, 105),
    ]);
    expect(sessions.map((session) => session.performedOn)).toEqual(["2026-01-01", "2026-02-01"]);
    // 5 × 100 (116.7) beats 3 × 105 (115.5).
    expect(sessions[0]?.best.id).toBe("a1");
    expect(sessions[0]?.setCount).toBe(2);
    expect(sessions[1]?.estimate.epley).toBe(120);
  });
});

describe("bestToDate", () => {
  it("only records sessions that beat the best so far", () => {
    const best = bestToDate(
      sessionEstimates([
        set("a", "2026-01-01", 5, 100),
        set("b", "2026-01-08", 5, 95),
        set("c", "2026-01-15", 1, 120),
      ]),
    );
    expect(best.map((point) => point.source.id)).toEqual(["a", "c"]);
  });
});

describe("clipSteps", () => {
  const steps = [
    { date: toDate("2026-01-01"), value: 1 },
    { date: toDate("2026-03-01"), value: 2 },
  ];

  it("carries the value in force at the range start and holds the last value to the end", () => {
    const clipped = clipSteps(steps, toDate("2026-02-01"), toDate("2026-04-01"));
    expect(clipped.map((step) => [step.date.getMonth() + 1, step.value])).toEqual([
      [2, 1],
      [3, 2],
      [4, 2],
    ]);
  });

  it("is empty when nothing happened before the range end", () => {
    expect(clipSteps([], toDate("2026-02-01"), toDate("2026-04-01"))).toEqual([]);
  });
});

describe("rangeStart", () => {
  it("counts months back from today, or starts at the first session for all", () => {
    const today = toDate("2026-10-31");
    expect(rangeStart("3m", today, toDate("2025-01-01")).getMonth()).toBe(6);
    expect(rangeStart("all", today, toDate("2025-01-01"))).toEqual(toDate("2025-01-01"));
  });
});
