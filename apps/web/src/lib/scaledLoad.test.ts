import { SpanId, type DerivedItem, type Quantity } from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import { boardTonnageOf, isStruck, loadChangeOf, shareOfBoard } from "./scaledLoad.ts";

const load = (male: number, female?: number): Quantity => ({
  measure: "load_kg",
  amount: { min: male, max: male },
  ...(female === undefined ? {} : { female: { min: female, max: female } }),
});

const reps = (count: number): Quantity => ({
  measure: "reps",
  amount: { min: count, max: count },
});

/** "21 Deadlifts (155/105lbs)", done for `rounds` rounds at `doneKg`. */
const deadlift = (
  quantities: ReadonlyArray<Quantity>,
  doneKg: number | undefined,
  performedReps = 21,
): DerivedItem => ({
  spanId: SpanId.make("s1"),
  movementId: undefined,
  text: "Deadlifts",
  sets: [{ line: 15, quantities }],
  performed:
    doneKg === undefined || performedReps === 0 ? [] : [{ reps: performedReps, loadKg: doneKg }],
  listed: [],
  performance: doneKg === undefined ? undefined : { loadKg: doneKg },
  plan: undefined,
  alternatives: [],
});

describe("loadChangeOf", () => {
  it("strikes the board's load on the athlete's side of the split", () => {
    expect(loadChangeOf(deadlift([reps(21), load(70.25, 47.75)], 50), "m")).toEqual({
      boardKg: 70.25,
      doneKg: 50,
    });
    expect(loadChangeOf(deadlift([reps(21), load(70.25, 47.75)], 40), "f")).toEqual({
      boardKg: 47.75,
      doneKg: 40,
    });
  });

  it("changes nothing when the load used is one the board wrote", () => {
    expect(loadChangeOf(deadlift([load(70.25, 47.75)], 70.25), "m")).toBeUndefined();
    expect(loadChangeOf(deadlift([load(70.25, 47.75)], 47.75), "f")).toBeUndefined();
    const range: Quantity = { measure: "load_kg", amount: { min: 60, max: 70 } };
    expect(loadChangeOf(deadlift([range], 65), "m")).toBeUndefined();
  });

  it("changes nothing without a load used or a load written", () => {
    expect(loadChangeOf(deadlift([load(70.25)], undefined), "m")).toBeUndefined();
    expect(loadChangeOf(deadlift([reps(21)], 50), "m")).toBeUndefined();
  });

  it("leaves a level's tier load alone: it says its own load", () => {
    const tiered: Quantity = {
      ...load(40, 60),
      tiers: [{ level: "rx", amount: { min: 60, max: 60 } }],
    };
    expect(loadChangeOf(deadlift([tiered], 50), "m")).toBeUndefined();
  });

  it("strikes only the board loads the load used is not", () => {
    const change = loadChangeOf(deadlift([load(70.25)], 50), "m")!;
    expect(isStruck(load(70.25), change, "m")).toBe(true);
    expect(isStruck(load(50), change, "m")).toBe(false);
    expect(isStruck(reps(21), change, "m")).toBe(false);
  });
});

describe("boardTonnageOf", () => {
  it("counts the same reps at the board's loads", () => {
    // 21 × 70.25 + 15 × 84, against 21 × 50 + 15 × 60 lifted.
    const items = [
      deadlift([reps(21), load(70.25, 47.75)], 50),
      deadlift([reps(15), load(84, 56.75)], 60, 15),
    ];
    expect(boardTonnageOf(items, "m")).toBe(2735.25);
    expect(shareOfBoard(1950, 2735.25)).toBe(71);
  });

  it("is undefined when every load was the board's", () => {
    expect(boardTonnageOf([deadlift([load(70.25)], 70.25)], "m")).toBeUndefined();
    expect(boardTonnageOf([deadlift([load(70.25)], 50, 0)], "m")).toBeUndefined();
  });
});
