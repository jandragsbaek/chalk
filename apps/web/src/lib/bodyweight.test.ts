import { describe, expect, it } from "vite-plus/test";

import { bodyweightRows, bodyweightTrend, parseMeasure, shiftDay } from "./bodyweight.ts";

const entries = [
  { performedOn: "2026-10-28", kg: 84.6 },
  { performedOn: "2026-09-01", kg: 86 },
  { performedOn: "2026-10-01", kg: 85.4 },
];

describe("parseMeasure", () => {
  it("reads a comma or a point as decimals, blank as no value, and refuses the rest", () => {
    expect(parseMeasure(" 84,6 ")).toBe(84.6);
    expect(parseMeasure("181.5")).toBe(181.5);
    expect(parseMeasure("")).toBeNull();
    expect(parseMeasure("84 kg")).toBeNaN();
  });
});

describe("shiftDay", () => {
  it("moves across month ends", () => {
    expect(shiftDay("2026-10-01", -1)).toBe("2026-09-30");
  });
});

describe("bodyweightRows", () => {
  it("lists weigh-ins newest first with the change from the one before", () => {
    const rows = bodyweightRows(entries);
    expect(rows.map((row) => row.performedOn)).toEqual(["2026-10-28", "2026-10-01", "2026-09-01"]);
    expect(rows[0]?.change).toBeCloseTo(-0.8);
    expect(rows[2]?.change).toBeUndefined();
  });
});

describe("bodyweightTrend", () => {
  it("compares the latest with the reading in force a window before it, and the first", () => {
    const trend = bodyweightTrend(entries, 30);
    expect(trend?.latest).toEqual({ performedOn: "2026-10-28", kg: 84.6 });
    expect(trend?.change).toBeCloseTo(-1.4);
    expect(trend?.sinceFirst).toBeCloseTo(-1.4);
    expect(bodyweightTrend(entries, 90)?.change).toBeUndefined();
  });

  it("is undefined without weigh-ins", () => {
    expect(bodyweightTrend([], 30)).toBeUndefined();
  });
});
