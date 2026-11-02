import { describe, expect, it } from "@effect/vitest";

import { firstReadings, parseTokenFile, windows } from "./weighIns.ts";

describe("parseTokenFile", () => {
  it("reads python-garminconnect's token file, and nothing else", () => {
    const file = { di_token: "a.b.c", di_refresh_token: " r1 ", di_client_id: "ANDROID_DI" };
    expect(parseTokenFile(JSON.stringify(file))).toEqual({
      accessToken: "a.b.c",
      refreshToken: "r1",
      clientId: "ANDROID_DI",
    });
    expect(parseTokenFile(JSON.stringify({ di_token: "a.b.c" }))).toBeUndefined();
    expect(parseTokenFile("eyJhbGciOi")).toBeUndefined();
    expect(parseTokenFile("null")).toBeUndefined();
  });
});

describe("firstReadings", () => {
  it("keeps each day's earliest weigh-in in kg, skipping ones that are not a person", () => {
    expect(
      firstReadings({
        dailyWeightSummaries: [
          {
            summaryDate: "2026-10-30",
            allWeightMetrics: [
              {
                calendarDate: "2026-10-30",
                weight: 84612.4,
                date: Date.parse("2026-10-30T18:20Z"),
              },
              { calendarDate: "2026-10-30", weight: 84300, date: Date.parse("2026-10-30T06:48Z") },
              { calendarDate: "2026-10-30", weight: null, date: Date.parse("2026-10-30T05:00Z") },
              { calendarDate: "2026-10-30", weight: 4000, date: Date.parse("2026-10-30T05:10Z") },
            ],
          },
          // An answer without the full list still gives its latest weigh-in.
          { summaryDate: "2026-10-29", latestWeight: { weight: 84900, date: null } },
        ],
      }),
    ).toEqual([
      {
        performedOn: "2026-10-29",
        kg: 84.9,
        measuredAt: null,
        bodyFatPct: null,
        muscleMassKg: null,
      },
      {
        performedOn: "2026-10-30",
        kg: 84.3,
        measuredAt: "06:48",
        bodyFatPct: null,
        muscleMassKg: null,
      },
    ]);
    expect(firstReadings({})).toEqual([]);
  });

  // Shapes from a live Index scale reply (2026-11-02): composition rides on each reading, and a
  // reading without it says 0.
  it("reads body fat and muscle mass, taking them from the day's first reading that has them", () => {
    expect(
      firstReadings({
        dailyWeightSummaries: [
          {
            summaryDate: "2026-11-01",
            allWeightMetrics: [
              {
                calendarDate: "2026-11-01",
                weight: 118019,
                bodyFat: 33.6,
                muscleMass: 42310,
                date: Date.parse("2026-11-01T07:37Z"),
              },
            ],
          },
          {
            summaryDate: "2026-10-21",
            allWeightMetrics: [
              // Later in the day, barefoot: the composition the morning reading lacked.
              {
                calendarDate: "2026-10-21",
                weight: 117400,
                bodyFat: 33.14,
                muscleMass: 42012,
                date: Date.parse("2026-10-21T19:05Z"),
              },
              {
                calendarDate: "2026-10-21",
                weight: 116800,
                bodyFat: 0,
                muscleMass: 0,
                date: Date.parse("2026-10-21T06:50Z"),
              },
            ],
          },
          {
            summaryDate: "2026-10-20",
            allWeightMetrics: [
              { calendarDate: "2026-10-20", weight: 117000, bodyFat: 0, muscleMass: 0, date: null },
            ],
          },
        ],
      }),
    ).toEqual([
      {
        performedOn: "2026-10-20",
        kg: 117,
        measuredAt: null,
        bodyFatPct: null,
        muscleMassKg: null,
      },
      {
        performedOn: "2026-10-21",
        kg: 116.8,
        measuredAt: "06:50",
        bodyFatPct: 33.1,
        muscleMassKg: 42.01,
      },
      {
        performedOn: "2026-11-01",
        kg: 118.02,
        measuredAt: "07:37",
        bodyFatPct: 33.6,
        muscleMassKg: 42.31,
      },
    ]);
  });
});

describe("windows", () => {
  it("cuts a range into windows of at most n days, the last one short", () => {
    expect(windows("2026-01-01", "2026-01-10", 4)).toEqual([
      { from: "2026-01-01", to: "2026-01-04" },
      { from: "2026-01-05", to: "2026-01-08" },
      { from: "2026-01-09", to: "2026-01-10" },
    ]);
    expect(windows("2026-01-02", "2026-01-01", 4)).toEqual([]);
  });
});
