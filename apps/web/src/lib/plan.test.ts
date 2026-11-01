import { MovementId } from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import { asPlanned, describePlan, planTitle } from "./plan.ts";

const names: Record<string, string> = {
  "pull-up": "Pull-up",
  "jumping-pull-up": "Jumping pull-up",
};
const nameOf = (id: MovementId) => names[id];

describe("describePlan", () => {
  it("reads an empty plan as the board", () => {
    expect(describePlan({}, nameOf)).toBe("As written");
    expect(describePlan({ unbroken: 10 }, nameOf)).toBe("As written");
  });

  it("names the load per implement, and the reps by variation", () => {
    expect(describePlan({ loadKg: 22.5, implements: 2 }, nameOf)).toBe("2 × 22.5 kg");
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
      ),
    ).toBe("30 kg, 25 Jumping pull-up + 20 Pull-up");
  });
});

describe("planTitle", () => {
  const item = (movementId: string) => ({
    spanId: movementId,
    movementId: MovementId.make(movementId),
    text: movementId,
    sets: [],
    performed: [],
    performance: undefined,
    plan: undefined,
    alternatives: [],
  });
  const session = (sessionNumber: number | undefined, ids: ReadonlyArray<string>) => ({
    performedOn: "2026-11-01",
    sessionNumber,
    name: sessionNumber === undefined ? "Session 2026-11-01" : `Session ${sessionNumber}`,
    kind: "for_time" as const,
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
            format: "for_time" as const,
            params: {},
            items: ids.map(item),
            intents: [],
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

  it("names an unnumbered plan by its kind and first movements", () => {
    expect(planTitle(session(undefined, ["pull-up", "jumping-pull-up", "pull-up"]), nameOf)).toBe(
      "For time · Pull-up, Jumping pull-up",
    );
    expect(
      planTitle(session(undefined, ["pull-up", "jumping-pull-up", "burpee", "row"]), nameOf),
    ).toBe("For time · Pull-up, Jumping pull-up +2");
  });

  it("keeps a numbered session's own name", () => {
    expect(planTitle(session(171, ["pull-up"]), nameOf)).toBe("Session 171");
  });
});

describe("asPlanned", () => {
  const exact = (measure: "sets" | "reps", value: number) => ({
    measure,
    amount: { min: value, max: value },
  });
  const found = (quantities: ReadonlyArray<ReturnType<typeof exact>>) => ({
    item: {
      spanId: "m",
      movementId: MovementId.make("back-squat"),
      text: "Back squat",
      sets: [{ line: 0, quantities }],
      performed: [],
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
});
