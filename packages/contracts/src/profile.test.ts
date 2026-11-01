import { describe, expect, it } from "@effect/vitest";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { AthleteBody, bodyweightOn, EMPTY_ATHLETE_PROFILE } from "./profile.ts";

const decodeBody = Schema.decodeUnknownOption(AthleteBody);

describe("bodyweightOn", () => {
  // Out of order on purpose: the helper does not rely on the store's sort.
  const profile = {
    bodyweights: [
      { performedOn: "2026-10-01", kg: 84 },
      { performedOn: "2026-06-01", kg: 86.5 },
      { performedOn: "2026-08-15", kg: 85.2 },
    ],
  };

  it("reads the latest weigh-in on or before the day", () => {
    expect(bodyweightOn(profile, "2026-08-15")).toBe(85.2);
    expect(bodyweightOn(profile, "2026-09-30")).toBe(85.2);
    expect(bodyweightOn(profile, "2027-01-01")).toBe(84);
  });

  it("falls back to the earliest weigh-in before the first one", () => {
    expect(bodyweightOn(profile, "2025-12-24")).toBe(86.5);
  });

  it("is null without any weigh-in", () => {
    expect(bodyweightOn(EMPTY_ATHLETE_PROFILE, "2026-10-01")).toBeNull();
  });
});

describe("AthleteBody", () => {
  it("takes a sex and nullable lengths in centimetres", () => {
    const body = { sex: "f", heightCm: 168.5, armLengthCm: null, legLengthCm: 78 };
    expect(decodeBody(body)).toEqual(Option.some(body));
  });

  it("refuses lengths that are not a person's", () => {
    expect(Option.isNone(decodeBody({ ...EMPTY_ATHLETE_PROFILE, heightCm: 18 }))).toBe(true);
    expect(Option.isNone(decodeBody({ ...EMPTY_ATHLETE_PROFILE, legLengthCm: 780 }))).toBe(true);
    expect(Option.isNone(decodeBody({ ...EMPTY_ATHLETE_PROFILE, sex: "x" }))).toBe(true);
  });
});
