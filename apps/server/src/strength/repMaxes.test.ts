import { LiftSetId, MovementId, THE_BOX, type LiftSet } from "@chalk/contracts";
import { describe, expect, it } from "@effect/vitest";

import { computeRecords } from "./repMaxes.ts";

const backSquat = MovementId.make("back-squat");
const deadlift = MovementId.make("deadlift");

let nextId = 0;
const set = (
  movementId: MovementId,
  performedOn: string,
  reps: number,
  loadKg: number,
): LiftSet => ({
  id: LiftSetId.make(`set-${++nextId}`),
  movementId,
  performedOn,
  reps,
  loadKg,
  notes: "",
  place: THE_BOX,
  createdAt: `${performedOn}T12:00:00.000Z`,
});

describe("computeRecords", () => {
  it("counts a set toward every rep max up to its rep count", () => {
    const [records] = computeRecords([set(backSquat, "2026-10-01", 5, 100)]);
    expect(records?.repMaxes.map(({ reps, loadKg, fromReps }) => [reps, loadKg, fromReps])).toEqual(
      [
        [1, 100, 5],
        [2, 100, 5],
        [3, 100, 5],
        [5, 100, 5],
      ],
    );
  });

  it("keeps the heaviest qualifying set per target, and the earliest on a tie", () => {
    const [records] = computeRecords([
      set(backSquat, "2026-10-01", 5, 100),
      set(backSquat, "2026-10-08", 3, 110),
      set(backSquat, "2026-10-15", 1, 125),
      set(backSquat, "2026-10-22", 3, 110),
      set(backSquat, "2026-10-29", 10, 80),
    ]);
    expect(
      records?.repMaxes.map(({ reps, loadKg, performedOn }) => [reps, loadKg, performedOn]),
    ).toEqual([
      [1, 125, "2026-10-15"],
      [2, 110, "2026-10-08"],
      [3, 110, "2026-10-08"],
      [5, 100, "2026-10-01"],
      [10, 80, "2026-10-29"],
    ]);
  });

  it("groups by movement, ordered by movement id", () => {
    const records = computeRecords([
      set(deadlift, "2026-10-01", 1, 180),
      set(backSquat, "2026-10-01", 1, 140),
    ]);
    expect(records.map(({ movementId, repMaxes }) => [movementId, repMaxes[0]?.loadKg])).toEqual([
      [backSquat, 140],
      [deadlift, 180],
    ]);
    expect(computeRecords([])).toEqual([]);
  });
});
