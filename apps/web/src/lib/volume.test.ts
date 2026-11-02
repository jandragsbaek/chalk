import {
  MovementId,
  WorkoutId,
  type CatalogMovement,
  type VolumeEntry,
  type VolumeWeek,
} from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import { cellSources, formatTonnage, volumeColumns, volumeGrid } from "./volume.ts";

const id = MovementId.make;

const CATALOG: ReadonlyArray<CatalogMovement> = [
  { id: id("pull-up"), name: "Pull-up", category: "gymnastics", aliases: [] },
  { id: id("ring-row"), name: "Ring row", category: "gymnastics", aliases: [] },
  { id: id("thruster"), name: "Thruster", category: "barbell", aliases: [] },
  { id: id("row"), name: "Row", category: "monostructural", aliases: [], measure: "distance_m" },
];

const entry = (
  performedOn: string,
  movementId: string,
  amounts: Partial<VolumeEntry>,
  writtenAs = movementId,
  workoutId: string | null = `w-${performedOn}`,
): VolumeEntry => ({
  workoutId: workoutId === null ? null : WorkoutId.make(workoutId),
  performedOn,
  movementId: id(movementId),
  writtenAs: id(writtenAs),
  reps: 0,
  metres: 0,
  calories: 0,
  seconds: 0,
  tonnageKg: 0,
  ...amounts,
});

// Monday Oct 26, 2026 is W44; "today" is the Sunday after.
const TODAY = new Date(2026, 10, 1);

const WEEKS: ReadonlyArray<VolumeWeek> = [
  {
    weekStart: "2026-10-19",
    entries: [
      entry("2026-10-20", "pull-up", { reps: 30 }),
      entry("2026-10-20", "row", { metres: 2000 }),
    ],
    leftOut: [],
  },
  {
    weekStart: "2026-10-26",
    entries: [
      entry("2026-10-26", "thruster", { reps: 45, tonnageKg: 1935 }),
      entry("2026-10-26", "pull-up", { reps: 15 }),
      entry("2026-10-26", "ring-row", { reps: 30 }, "pull-up"),
      entry("2026-10-29", "row", { calories: 40 }),
      entry("2026-10-31", "thruster", { reps: 10, tonnageKg: 400 }, "thruster", null),
    ],
    leftOut: [],
  },
];

describe("volumeColumns", () => {
  it("ends on this week, oldest first, with the year on the first column and each new year", () => {
    const columns = volumeColumns(WEEKS, "12", TODAY);
    expect(columns).toHaveLength(12);
    expect(columns.at(-1)).toMatchObject({ weekStart: "2026-10-26", week: 44, current: true });
    expect(columns[0]).toMatchObject({ weekStart: "2026-08-10", week: 33, year: 2026 });
    expect(columns[1]?.year).toBeUndefined();
    const winter = volumeColumns([], "12", new Date(2027, 0, 6));
    expect(winter.filter((column) => column.year !== undefined).map((c) => c.year)).toEqual([
      2026, 2027,
    ]);
  });

  it("reaches back to the first week with anything for All", () => {
    expect(volumeColumns(WEEKS, "all", TODAY).map((column) => column.weekStart)).toEqual([
      "2026-10-19",
      "2026-10-26",
    ]);
  });
});

describe("volumeGrid", () => {
  const columns = volumeColumns(WEEKS, "all", TODAY);

  it("credits what was done, in each movement's own unit, shaded against its best week", () => {
    const grid = volumeGrid(WEEKS, CATALOG, { view: "volume", basis: "done", columns });
    expect(grid.groups.map((group) => [group.label, group.rows.map((row) => row.name)])).toEqual([
      ["Barbell", ["Thruster"]],
      ["Gymnastics", ["Pull-up", "Ring row"]],
      ["Monostructural", ["Row"]],
    ]);
    const pullUp = grid.groups[1]!.rows[0]!;
    expect(pullUp.cells.map((cell) => [cell.text, cell.heat])).toEqual([
      ["30", 4],
      ["15", 2],
    ]);
    // Row reads in metres; a week only in calories prints them, a week with both marks the rest.
    const row = grid.groups[2]!.rows[0]!;
    expect(row.unit).toBe("m");
    expect(row.cells.map((cell) => [cell.text, cell.more, cell.heat])).toEqual([
      ["2,000", false, 4],
      ["40 cal", false, 0],
    ]);
    expect(row.totalText).toBe("2,000 m · 40 cal");
    // Each workout once, and a day of strength sets on their own.
    expect(grid.sessions).toEqual([1, 3]);
  });

  it("credits the board's movement as written", () => {
    const grid = volumeGrid(WEEKS, CATALOG, { view: "volume", basis: "written", columns });
    const gymnastics = grid.groups.find((group) => group.category === "gymnastics")!;
    expect(gymnastics.rows.map((row) => [row.name, row.cells.map((cell) => cell.text)])).toEqual([
      ["Pull-up", ["30", "45"]],
    ]);
  });

  it("lists only what was lifted with a load in tonnage", () => {
    const grid = volumeGrid(WEEKS, CATALOG, { view: "tonnage", basis: "done", columns });
    expect(grid.groups.flatMap((group) => group.rows.map((row) => row.name))).toEqual(["Thruster"]);
    expect(grid.groups[0]!.rows[0]!.cells[1]!.text).toBe("2,335");
    expect(grid.groups[0]!.rows[0]!.totalText).toBe("2.3 t");
  });
});

describe("volumeGrid sessions", () => {
  it("counts a session that only left lines out", () => {
    const weeks: ReadonlyArray<VolumeWeek> = [
      {
        weekStart: "2026-10-26",
        entries: [],
        leftOut: [
          {
            workoutId: WorkoutId.make("w1"),
            performedOn: "2026-10-27",
            text: "AMRAP 15",
            reason: "AMRAP without a score.",
          },
        ],
      },
    ];
    const columns = volumeColumns(weeks, "all", TODAY);
    expect(volumeGrid(weeks, CATALOG, { view: "volume", basis: "done", columns }).sessions).toEqual(
      [1],
    );
  });
});

describe("cellSources", () => {
  it("names the other side of a swap", () => {
    const week = WEEKS[1];
    expect(cellSources(week, id("ring-row"), "done")).toEqual([
      {
        workoutId: "w-2026-10-26",
        performedOn: "2026-10-26",
        amounts: expect.objectContaining({ reps: 30 }),
        swappedWith: "pull-up",
      },
    ]);
    expect(cellSources(week, id("pull-up"), "written").map((source) => source.swappedWith)).toEqual(
      [undefined, "ring-row"],
    );
  });
});

describe("formatTonnage", () => {
  it("prints tonnes from a tonne up, kilograms under", () => {
    expect(formatTonnage(14_820)).toBe("14.8 t");
    expect(formatTonnage(640)).toBe("640 kg");
  });
});
