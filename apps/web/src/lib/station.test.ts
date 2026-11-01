import { MovementId, type DerivedItem, type SpanOf } from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import { chooseOption, chosenOption } from "./station.ts";

const item = (id: string, extra: Partial<DerivedItem> = {}): DerivedItem => ({
  spanId: id,
  movementId: MovementId.make(id),
  text: id,
  sets: [],
  performed: [],
  listed: [],
  performance: undefined,
  plan: undefined,
  alternatives: [],
  ...extra,
});

const station = (
  primary: Partial<DerivedItem> = {},
  alternative: Partial<DerivedItem> = {},
): DerivedItem =>
  item("double-under", { ...primary, alternatives: [item("single-under", alternative)] });

describe("chosenOption", () => {
  it("picks nothing until an option has a plan", () => {
    expect(chosenOption(station(), "planned")).toBeUndefined();
    expect(chosenOption(station({}, { plan: {} }), "planned")?.spanId).toBe("single-under");
  });

  it("prefers what was done over what was planned", () => {
    const planned = station({ plan: {} }, { performance: {} });
    expect(chosenOption(planned, "planned")?.spanId).toBe("double-under");
    expect(chosenOption(planned, "done")?.spanId).toBe("single-under");
    expect(chosenOption(station({ plan: {} }), "done")?.spanId).toBe("double-under");
  });
});

describe("chooseOption", () => {
  const span = (id: string, extra: Partial<SpanOf<"movement">> = {}): SpanOf<"movement"> => ({
    _tag: "movement",
    id,
    start: 0,
    end: 1,
    ...extra,
  });

  it("gives the chosen option a plan as written and takes the others' away", () => {
    const options = [span("du", { plan: { loadKg: 1 } }), span("su", { alternativeOf: "du" })];
    expect(chooseOption(options, "su", "plan")).toEqual([
      span("du"),
      span("su", { alternativeOf: "du", plan: {} }),
    ]);
  });

  it("keeps the chosen option's own record", () => {
    const options = [span("du", { performance: { unbroken: 30 } }), span("su")];
    expect(chooseOption(options, "du", "performance")).toEqual(options);
  });
});
