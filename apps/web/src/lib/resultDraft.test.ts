import type { DerivedBlock, DerivedItem, Quantity } from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  draftFromResult,
  resultDefaults,
  resultFromDraft,
  switchMode,
  switchUnit,
  type ResultDefaults,
} from "./resultDraft.ts";

const exact = (measure: Quantity["measure"], value: number): Quantity => ({
  measure,
  amount: { min: value, max: value },
});

const item = (lines: ReadonlyArray<ReadonlyArray<Quantity>>): DerivedItem => ({
  spanId: "m",
  movementId: undefined,
  text: "Snatch",
  sets: lines.map((quantities, line) => ({ line, quantities })),
  performed: [],
  listed: [],
  performance: undefined,
  plan: undefined,
  alternatives: [],
});

const every = (rounds: number): DerivedBlock => ({
  spanId: "b",
  title: "Every 90 sec x 6",
  format: "every",
  params: { intervalSeconds: 90, rounds: { min: rounds, max: rounds } },
  items: [],
  intents: [],
  comments: [],
  scores: [],
  tonnageKg: 0,
});

const NONE: ResultDefaults = {
  sets: undefined,
  reps: undefined,
  loadKg: undefined,
  rows: undefined,
};

describe("resultDefaults", () => {
  it("reads sets from the block's rounds and reps from the item", () => {
    expect(resultDefaults(item([[exact("reps", 2)]]), every(6))).toEqual({
      sets: 6,
      reps: 2,
      loadKg: undefined,
      rows: undefined,
    });
    expect(
      resultDefaults(item([[exact("sets", 5), exact("reps", 5), exact("load_kg", 100)]]), every(6)),
    ).toMatchObject({ sets: 5, reps: 5, loadKg: 100 });
  });

  it("makes one row per written line of a build-up", () => {
    const buildUp = item([[exact("reps", 10)], [exact("reps", 5)], [exact("reps", 3)]]);
    expect(resultDefaults(buildUp, undefined)).toMatchObject({ sets: 3, rows: [10, 5, 3] });
  });
});

describe("result drafts", () => {
  it("is no result until every field is filled", () => {
    const draft = switchMode(draftFromResult(undefined, { ...NONE, sets: 6, reps: 2 }), "fixed");
    expect(resultFromDraft(draft)).toBeUndefined();
    expect(resultFromDraft({ ...draft, load: "60,5" })).toEqual({
      _tag: "fixed",
      sets: 6,
      reps: 2,
      loadKg: 60.5,
    });
    expect(resultFromDraft({ ...draft, load: "60", reps: "2.5" })).toBeUndefined();
  });

  it("carries a ramp over to set by set and back", () => {
    const ramp = { _tag: "ramp", sets: 3, reps: 2, startKg: 50, stepKg: 5 } as const;
    const each = switchMode(draftFromResult(ramp, NONE), "each");
    expect(each.rows).toEqual([
      { reps: "2", load: "50" },
      { reps: "2", load: "55" },
      { reps: "2", load: "60" },
    ]);
    expect(resultFromDraft(switchMode(each, "ramp"))).toEqual(ramp);
    expect(resultFromDraft(switchMode(each, "fixed"))).toEqual({
      _tag: "fixed",
      sets: 3,
      reps: 2,
      loadKg: 50,
    });
  });

  it("opens set by set with the prescription's rows, or one row per set", () => {
    const buildUp = draftFromResult(undefined, { ...NONE, sets: 2, rows: [5, 3] });
    expect(switchMode(buildUp, "each").rows).toEqual([
      { reps: "5", load: "" },
      { reps: "3", load: "" },
    ]);
    const plain = draftFromResult(undefined, { ...NONE, sets: 2, reps: 2 });
    expect(switchMode(plain, "each").rows).toEqual([
      { reps: "2", load: "" },
      { reps: "2", load: "" },
    ]);
  });

  it("takes loads typed in pounds as kilograms, to the quarter kilo", () => {
    const draft = draftFromResult(undefined, { ...NONE, sets: 5, reps: 5, loadKg: 102 }, "lb");
    expect(draft.load).toBe("225");
    expect(resultFromDraft({ ...switchMode(draft, "fixed"), load: "135" })).toEqual({
      _tag: "fixed",
      sets: 5,
      reps: 5,
      loadKg: 61.25,
    });
    expect(
      resultFromDraft({ ...switchMode(draft, "ramp"), load: "135", step: "10" }),
    ).toMatchObject({ startKg: 61.25, stepKg: 4.5 });
    const each = switchMode({ ...draft, load: "95" }, "each");
    expect(resultFromDraft({ ...each, rows: [{ reps: "5", load: "95" }] })).toEqual({
      _tag: "each",
      sets: [{ reps: 5, loadKg: 43 }],
    });
  });

  it("converts what is typed when the unit flips, keeping the result", () => {
    const ramp = { _tag: "ramp", sets: 3, reps: 2, startKg: 61.25, stepKg: 4.5 } as const;
    const pounds = switchUnit(draftFromResult(ramp, NONE), "lb");
    expect(pounds).toMatchObject({ load: "135", step: "10" });
    expect(resultFromDraft(pounds)).toEqual(ramp);
    expect(switchUnit({ ...pounds, load: "-" }, "kg").load).toBe("-");
  });
});
