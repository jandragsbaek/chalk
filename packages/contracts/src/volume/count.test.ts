import { describe, expect, it } from "@effect/vitest";

import { MovementId, WorkoutId } from "../baseSchemas.ts";
import { benchmarkById } from "../benchmarks/index.ts";
import type { Quantity } from "../sessionImport.ts";
import {
  countBenchmark,
  countBlock,
  type Counted,
  type WorkBlock,
  type WorkItem,
} from "./count.ts";
import { isoWeekStart, volumeEntries, volumeWeeks } from "./weeks.ts";

const id = MovementId.make;

const q = (measure: Quantity["measure"], amount: number, female?: number): Quantity => ({
  measure,
  amount: { min: amount, max: amount },
  ...(female === undefined ? {} : { female: { min: female, max: female } }),
});

const item = (movementId: string, ...quantities: ReadonlyArray<Quantity>): WorkItem => ({
  movementId: id(movementId),
  text: movementId,
  sets: [{ quantities }],
  performed: [],
  performance: undefined,
  alternatives: [],
});

const block = (
  format: WorkBlock["format"],
  items: ReadonlyArray<WorkItem>,
  extra: Partial<WorkBlock> = {},
): WorkBlock => ({
  format,
  params: {},
  items,
  scores: [],
  ...extra,
});

const amounts = (counted: ReadonlyArray<Counted>) =>
  counted.map((line) => [line.movementId, line.writtenAs, line.amount, line.unit]);

describe("countBlock", () => {
  it("credits scaled reps to the movement done and keeps the one the board wrote", () => {
    const pullUps: WorkItem = {
      ...item("pull-up", q("reps", 10)),
      performance: {
        variants: [
          { movementId: id("pull-up"), reps: 10 },
          { movementId: id("ring-row"), reps: 40 },
        ],
      },
    };
    const count = countBlock(
      block("for_time", [pullUps], { params: { rounds: { min: 5, max: 5 } } }),
      {
        sex: "m",
      },
    );
    expect(amounts(count.counted)).toEqual([
      ["pull-up", "pull-up", 10, "reps"],
      ["ring-row", "pull-up", 40, "reps"],
    ]);
  });

  it("counts an EMOM station logged round by round as the rounds' sum", () => {
    // "EMOM 16" over four lines: the burpees come up 4 times, 8 + 8 + 7 + 6 of them.
    const burpees: WorkItem = {
      ...item("burpee", q("reps", 12)),
      performance: { perRound: { min: 6, max: 8 }, rounds: [8, 8, 7, 6] },
    };
    const count = countBlock(
      block("emom", [burpees], {
        params: { durationSeconds: 960, intervalSeconds: 60 },
        rotation: 4,
      }),
      { sex: "m" },
    );
    expect(amounts(count.counted)).toEqual([["burpee", "burpee", 29, "reps"]]);
  });

  it("counts a ladder under rounds once, and a load each round as their average", () => {
    // "4 Rounds" over "12-10-8-6": 36 thrusters in all, at 20, 25, 30 and 35 kg.
    const thrusters: WorkItem = {
      ...item("thruster"),
      sets: [],
      performance: { roundLoadsKg: [20, 25, 30, 35] },
    };
    const burpees = item("burpee", q("reps", 12));
    const count = countBlock(
      block("for_time", [thrusters, burpees], {
        params: { rounds: { min: 4, max: 4 }, scheme: [12, 10, 8, 6] },
      }),
      { sex: "m" },
    );
    expect(count.counted.map((line) => [line.movementId, line.amount, line.loadKg])).toEqual([
      ["thruster", 36, 27.5],
      ["burpee", 48, undefined],
    ]);
  });

  it("counts an AMRAP's lifted sets at their own loads, and the partial round across stations", () => {
    // 2+5 of 10 thrusters at 20, 30, then 40 kg, and 10 burpees: 25 thrusters, 20 burpees.
    const thrusters: WorkItem = {
      ...item("thruster", q("reps", 10)),
      performance: { roundLoadsKg: [20, 30, 40] },
      performed: [
        { reps: 10, loadKg: 20 },
        { reps: 10, loadKg: 30 },
        { reps: 5, loadKg: 40 },
      ],
    };
    const count = countBlock(
      block("amrap", [thrusters, item("burpee", q("reps", 10))], { scores: ["2+5"] }),
      { sex: "m" },
    );
    expect(count.counted.map((line) => [line.movementId, line.amount, line.loadKg])).toEqual([
      ["thruster", 10, 20],
      ["thruster", 10, 30],
      ["thruster", 5, 40],
      ["burpee", 20, undefined],
    ]);
  });

  it("credits the 'or' that was done, written as the first option", () => {
    const doubleUnders: WorkItem = {
      ...item("double-under", q("reps", 60)),
      alternatives: [{ ...item("single-under", q("reps", 90)), performance: {} }],
    };
    const count = countBlock(block("for_time", [doubleUnders]), { sex: "m" });
    expect(amounts(count.counted)).toEqual([["single-under", "double-under", 90, "reps"]]);
  });

  it("counts seconds only when asked, and reps over seconds on the same line", () => {
    const hold = item("handstand-hold", q("seconds", 30));
    const burpees = item("burpee", q("seconds", 40), q("reps", 12));
    const emom = block("emom", [hold, burpees], { params: { rounds: { min: 4, max: 4 } } });
    expect(amounts(countBlock(emom, { sex: "m", seconds: true }).counted)).toEqual([
      ["handstand-hold", "handstand-hold", 120, "s"],
      ["burpee", "burpee", 48, "reps"],
    ]);
    const forWork = countBlock(emom, { sex: "m" });
    expect(amounts(forWork.counted)).toEqual([["burpee", "burpee", 48, "reps"]]);
    expect(forWork.leftOut).toMatchObject([{ movementId: "handstand-hold", reason: "No reps." }]);
  });

  it("reads the athlete's side of an M/F split, and a pair of implements as both", () => {
    const row = item("row", q("calories", 12, 10));
    const devil = item("devil-press", q("reps", 10), q("load_kg", 22.5, 15));
    const options = {
      sex: "f",
      pairOf: (movementId: MovementId) => movementId === "devil-press",
    } as const;
    const count = countBlock(block("for_time", [row, devil]), options);
    expect(count.counted.map((line) => [line.amount, line.unit, line.loadKg])).toEqual([
      [10, "cal", undefined],
      [10, "reps", 30],
    ]);
  });
});

describe("countBenchmark", () => {
  it("counts a time-scored benchmark as prescribed", () => {
    const fran = countBenchmark(benchmarkById("fran")!, "4:10", { sex: "m" });
    expect(amounts(fran.counted)).toEqual([
      ["thruster", "thruster", 45, "reps"],
      ["pull-up", "pull-up", 45, "reps"],
    ]);
    expect(fran.counted[0]?.loadKg).toBe(43);
  });
});

describe("volumeEntries", () => {
  const line = (overrides: Partial<Counted>): Counted => ({
    movementId: id("row"),
    writtenAs: id("row"),
    amount: 0,
    unit: "reps",
    loadKg: undefined,
    text: "",
    lifted: false,
    ...overrides,
  });

  it("sums each unit on its own, tonnage only from loaded reps, and drops nothing counted", () => {
    const workoutId = WorkoutId.make("w1");
    const entries = volumeEntries(workoutId, "2026-10-28", [
      line({ amount: 500, unit: "m" }),
      line({ amount: 20, unit: "cal" }),
      line({ amount: 0, unit: "m" }),
      line({ movementId: id("thruster"), writtenAs: id("thruster"), amount: 21, loadKg: 43 }),
      line({ movementId: id("thruster"), writtenAs: id("thruster"), amount: 15, loadKg: 40 }),
      line({ movementId: id("ring-row"), writtenAs: id("pull-up"), amount: 30 }),
    ]);
    expect(entries).toEqual([
      {
        workoutId,
        performedOn: "2026-10-28",
        movementId: "row",
        writtenAs: "row",
        reps: 0,
        metres: 500,
        calories: 20,
        seconds: 0,
        tonnageKg: 0,
      },
      {
        workoutId,
        performedOn: "2026-10-28",
        movementId: "thruster",
        writtenAs: "thruster",
        reps: 36,
        metres: 0,
        calories: 0,
        seconds: 0,
        tonnageKg: 21 * 43 + 15 * 40,
      },
      {
        workoutId,
        performedOn: "2026-10-28",
        movementId: "ring-row",
        writtenAs: "pull-up",
        reps: 30,
        metres: 0,
        calories: 0,
        seconds: 0,
        tonnageKg: 0,
      },
    ]);
  });
});

describe("weeks", () => {
  it("starts every ISO week on its Monday, across a year's end", () => {
    expect(isoWeekStart("2026-11-01")).toBe("2026-10-26");
    expect(isoWeekStart("2026-10-26")).toBe("2026-10-26");
    expect(isoWeekStart("2027-01-01")).toBe("2026-12-28");
  });

  it("groups entries and left-out lines by week, oldest first", () => {
    const entry = (performedOn: string) => ({
      workoutId: null,
      performedOn,
      movementId: id("back-squat"),
      writtenAs: id("back-squat"),
      reps: 5,
      metres: 0,
      calories: 0,
      seconds: 0,
      tonnageKg: 500,
    });
    const leftOut = {
      workoutId: WorkoutId.make("w1"),
      performedOn: "2026-10-20",
      text: "Swim",
      reason: "No reps.",
    };
    const weeks = volumeWeeks(
      [entry("2026-11-01"), entry("2026-10-21"), entry("2026-10-27")],
      [leftOut],
    );
    expect(
      weeks.map((week) => [
        week.weekStart,
        week.entries.map((e) => e.performedOn),
        week.leftOut.length,
      ]),
    ).toEqual([
      ["2026-10-19", ["2026-10-21"], 1],
      ["2026-10-26", ["2026-10-27", "2026-11-01"], 0],
    ]);
  });
});

describe("lifted sets of a pair", () => {
  it("lift both bells unless the athlete said how many", () => {
    const sets = Array.from({ length: 5 }, () => ({ reps: 10, loadKg: 22.5 }));
    const devil: WorkItem = { ...item("devil-press", q("reps", 10)), performed: sets };
    const options = {
      sex: "m",
      pairOf: (movementId: MovementId) => movementId === "devil-press",
    } as const;
    const tonnage = (lines: ReadonlyArray<Counted>) =>
      lines.reduce((sum, line) => sum + line.amount * (line.loadKg ?? 0), 0);
    expect(tonnage(countBlock(block("for_time", [devil]), options).counted)).toBe(2250);
    // `implements` is already in the set's load.
    const one: WorkItem = { ...devil, performance: { implements: 1 } };
    expect(tonnage(countBlock(block("for_time", [one]), options).counted)).toBe(1125);
  });
});

describe("countBenchmark, unfinished", () => {
  it("counts nothing for a time-scored attempt without a time", () => {
    for (const score of ["DNF", "Capped · 60 reps"]) {
      const fran = countBenchmark(benchmarkById("fran")!, score, { sex: "m" });
      expect(fran.counted).toEqual([]);
      expect(fran.leftOut).toMatchObject([{ text: "Fran", reason: "Not finished in a time." }]);
    }
  });
});
