import { describe, expect, it } from "vite-plus/test";

import {
  bodyweightRows,
  fatMassKg,
  parseMeasure,
  seriesOf,
  seriesTrend,
  shiftDay,
  trailingAverage,
} from "./bodyweight.ts";

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

describe("seriesOf", () => {
  it("keeps the weigh-ins that measured the number, oldest first, the number as their value", () => {
    const measured = [
      { performedOn: "2026-10-02", kg: 84, bodyFatPct: 21.4 },
      { performedOn: "2026-10-03", kg: 84.2, bodyFatPct: null },
      { performedOn: "2026-10-01", kg: 84.5, bodyFatPct: 21.9 },
    ];
    expect(
      seriesOf(measured, (entry) => entry.bodyFatPct).map((p) => [p.performedOn, p.value]),
    ).toEqual([
      ["2026-10-01", 21.9],
      ["2026-10-02", 21.4],
    ]);
  });
});

describe("seriesTrend", () => {
  const points = seriesOf(entries, (entry) => entry.kg);

  it("compares the latest with the reading in force a window before it, and the first", () => {
    const trend = seriesTrend(points, 30);
    expect(trend?.latest).toEqual({ performedOn: "2026-10-28", kg: 84.6, value: 84.6 });
    expect(trend?.change).toBeCloseTo(-1.4);
    expect(trend?.sinceFirst).toBeCloseTo(-1.4);
    expect(seriesTrend(points, 90)?.change).toBeUndefined();
  });

  it("is undefined without readings", () => {
    expect(seriesTrend([], 30)).toBeUndefined();
  });
});

describe("trailingAverage", () => {
  it("means each reading with the ones in the days before it, a lone one on its own", () => {
    const daily = seriesOf(
      [
        { performedOn: "2026-10-03", kg: 85 },
        { performedOn: "2026-10-01", kg: 84 },
        { performedOn: "2026-10-02", kg: 86 },
        { performedOn: "2026-10-20", kg: 83 },
      ],
      (entry) => entry.kg,
    );
    expect(trailingAverage(daily, 2).map((entry) => [entry.performedOn, entry.average])).toEqual([
      ["2026-10-01", 84],
      ["2026-10-02", 85],
      ["2026-10-03", 85.5],
      ["2026-10-20", 83],
    ]);
  });
});

describe("fatMassKg", () => {
  it("is the body fat share of the weigh-in, none without a body fat reading", () => {
    expect(fatMassKg({ kg: 118, bodyFatPct: 33.6 })).toBeCloseTo(39.65);
    expect(fatMassKg({ kg: 118, bodyFatPct: null })).toBeNull();
  });
});
