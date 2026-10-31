import { describe, expect, it } from "@effect/vitest";

import { describeDebrief, isEmptyDebrief, normalizeDebrief, sessionLoad } from "./debrief.ts";

describe("normalizeDebrief", () => {
  it("trims text, drops empty fields and keeps limiters in their listed order", () => {
    expect(
      normalizeDebrief({
        result: "  12+5 ",
        notes: "   ",
        nextTime: "",
        limiters: ["grip", "engine"],
        feel: 4,
      }),
    ).toEqual({ result: "12+5", feel: 4, limiters: ["engine", "grip"] });
  });

  it("drops 'none' next to another limiter, and pain text without the pain limiter", () => {
    expect(normalizeDebrief({ limiters: ["none", "pacing"], pain: "Left knee" })).toEqual({
      limiters: ["pacing"],
    });
    expect(normalizeDebrief({ limiters: ["pain"], pain: " Left knee " })).toEqual({
      limiters: ["pain"],
      pain: "Left knee",
    });
  });

  it("counts a debrief of blanks as empty", () => {
    expect(isEmptyDebrief(undefined)).toBe(true);
    expect(isEmptyDebrief({ result: " ", limiters: [] })).toBe(true);
    expect(isEmptyDebrief({ effort: 7 })).toBe(false);
  });
});

describe("sessionLoad", () => {
  it("is session RPE times minutes, once both are known", () => {
    expect(sessionLoad({ effort: 8, minutes: 60 })).toBe(480);
    expect(sessionLoad({ effort: 8 })).toBeUndefined();
  });
});

describe("describeDebrief", () => {
  it("reads the answers as a coach would", () => {
    expect(
      describeDebrief({
        result: "5+22",
        feel: 4,
        capacity: 3,
        effort: 8,
        minutes: 60,
        limiters: ["engine", "pain"],
        pain: "Left wrist in the front rack",
        nextTime: "Start the rows slower.",
        notes: "Slept six hours.",
      }),
    ).toEqual([
      "Result 5+22.",
      "Felt good, capacity normal.",
      "Session RPE 8 (very hard), 60 min, load 480.",
      "Limited by engine, pain.",
      "Pain: Left wrist in the front rack.",
      "Next time: Start the rows slower.",
    ]);
  });

  it("says nothing limited, and nothing at all for an empty debrief", () => {
    expect(describeDebrief({ limiters: ["none"] })).toEqual(["Nothing limited."]);
    expect(describeDebrief({})).toEqual([]);
  });
});
