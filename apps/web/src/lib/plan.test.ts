import { MovementId, quantityFromText, type Quantity } from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import { asPlanned, describePlan, plannedMovements } from "./plan.ts";

const names: Record<string, string> = {
  "pull-up": "Pull-up",
  "jumping-pull-up": "Jumping pull-up",
};
const nameOf = (id: MovementId) => names[id];

describe("describePlan", () => {
  it("reads an empty plan as the board", () => {
    expect(describePlan({}, nameOf, "m")).toBe("As written");
    expect(describePlan({ unbroken: 10 }, nameOf, "m")).toBe("As written");
  });

  it("names the load per implement, and the reps by variation", () => {
    expect(describePlan({ loadKg: 22.5, implements: 2 }, nameOf, "m")).toBe("2 × 22.5 kg");
    expect(
      describePlan(
        {
          loadKg: 30,
          variants: [
            { movementId: MovementId.make("jumping-pull-up"), reps: 25 },
            { movementId: MovementId.make("pull-up"), reps: 20 },
          ],
        },
        nameOf,
        "m",
      ),
    ).toBe("30 kg, 25 Jumping pull-up + 20 Pull-up");
  });

  it("places a count each round on the board's levels", () => {
    const row = (...quantities: ReadonlyArray<Quantity>) => ({
      spanId: "row",
      movementId: MovementId.make("row"),
      text: "cal row",
      sets: [{ line: 0, quantities }],
      performed: [],
      listed: [],
      performance: undefined,
      plan: undefined,
      alternatives: [],
    });
    const tiered = quantityFromText("18-15/15-12 cal", "calories")!;
    expect(describePlan({ perRound: { min: 7, max: 8 } }, nameOf, "m", row(tiered))).toBe(
      "7-8 cal each round, under RX (15)",
    );
    expect(describePlan({ perRound: { min: 16, max: 16 } }, nameOf, "m", row(tiered))).toBe(
      "16 cal each round, RX",
    );
    expect(describePlan({ perRound: { min: 13, max: 13 } }, nameOf, "f", row(tiered))).toBe(
      "13 cal each round, RX",
    );
    const lift = row(quantityFromText("5", "reps")!, quantityFromText("3", "sets")!);
    expect(describePlan({ perRound: { min: 4, max: 4 } }, nameOf, "m", lift)).toBe("4 each round");
  });
});

describe("plannedMovements", () => {
  const option = (id: string, plan?: { loadKg?: number }) => ({
    spanId: id,
    movementId: MovementId.make(id),
    text: id,
    sets: [],
    performed: [],
    listed: [],
    performance: undefined,
    plan,
    alternatives: [],
  });
  const withStation = (
    primary: ReturnType<typeof option>,
    alternative: ReturnType<typeof option>,
  ) => ({
    performedOn: "2026-11-01",
    sessionNumber: undefined,
    name: "",
    kind: "amrap" as const,
    score: "",
    notes: "",
    parts: [
      {
        spanId: undefined,
        title: "",
        benchmarkId: undefined,
        rawText: "",
        blocks: [
          {
            spanId: undefined,
            title: "",
            format: "amrap" as const,
            params: {},
            items: [{ ...primary, alternatives: [alternative] }],
            intents: [],
            comments: [],
            scores: [],
            tonnageKg: 0,
          },
        ],
      },
    ],
    liftSets: [],
    tonnageKg: 0,
    issues: [],
  });

  it("lists a station once, by the option its plan picked", () => {
    expect(
      plannedMovements(withStation(option("pull-up"), option("jumping-pull-up")), nameOf, "m"),
    ).toEqual([{ spanId: "pull-up", name: "Pull-up", plan: undefined }]);
    expect(
      plannedMovements(withStation(option("pull-up"), option("jumping-pull-up", {})), nameOf, "m"),
    ).toEqual([{ spanId: "jumping-pull-up", name: "Jumping pull-up", plan: "As written" }]);
  });
});

describe("asPlanned", () => {
  const exact = (measure: "sets" | "reps", value: number) => ({
    measure,
    amount: { min: value, max: value },
  });
  const found = (quantities: ReadonlyArray<Quantity>) => ({
    item: {
      spanId: "m",
      movementId: MovementId.make("back-squat"),
      text: "Back squat",
      sets: [{ line: 0, quantities }],
      performed: [],
      listed: [],
      performance: undefined,
      plan: undefined,
      alternatives: [],
    },
    block: {
      spanId: undefined,
      title: "",
      format: undefined,
      params: {},
      items: [],
      intents: [],
      comments: [],
      scores: [],
      tonnageKg: 0,
    },
  });
  const span = {
    _tag: "movement" as const,
    id: "m",
    start: 0,
    end: 10,
    movementId: MovementId.make("back-squat"),
    plan: { loadKg: 110 },
  };

  it("takes the plan as done, and its load as the lift when the board gives sets × reps", () => {
    expect(asPlanned(span, found([exact("sets", 5), exact("reps", 3)]))).toEqual({
      ...span,
      performance: { loadKg: 110 },
      result: { _tag: "fixed", sets: 5, reps: 3, loadKg: 110 },
    });
  });

  it("lifts the board's load for a plan as written", () => {
    const board = [
      exact("sets", 5),
      exact("reps", 3),
      { measure: "load_kg" as const, amount: { min: 60, max: 60 } },
    ];
    expect(asPlanned({ ...span, plan: {} }, found(board)).result).toEqual({
      _tag: "fixed",
      sets: 5,
      reps: 3,
      loadKg: 60,
    });
  });

  it("writes no lift for a metcon count, and keeps a result already entered", () => {
    expect(asPlanned(span, found([exact("reps", 40)]))).toEqual({
      ...span,
      performance: { loadKg: 110 },
    });
    const entered = { _tag: "fixed" as const, sets: 5, reps: 3, loadKg: 100 };
    expect(
      asPlanned({ ...span, result: entered }, found([exact("sets", 5), exact("reps", 3)])).result,
    ).toEqual(entered);
  });

  it("writes no lift in a block scored as a whole, whose score says what was lifted", () => {
    const rounds = found([exact("reps", 15)]);
    const scored = {
      ...rounds,
      block: {
        ...rounds.block,
        format: "for_time" as const,
        params: { rounds: { min: 3, max: 3 } },
      },
    };
    expect(asPlanned(span, scored).result).toBeUndefined();
  });
});
