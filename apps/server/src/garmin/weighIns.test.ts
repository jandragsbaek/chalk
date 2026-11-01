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
      { performedOn: "2026-10-29", kg: 84.9, measuredAt: null },
      { performedOn: "2026-10-30", kg: 84.3, measuredAt: "06:48" },
    ]);
    expect(firstReadings({})).toEqual([]);
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
