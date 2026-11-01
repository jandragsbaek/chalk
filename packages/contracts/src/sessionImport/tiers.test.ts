import { describe, expect, it } from "@effect/vitest";

import type { Quantity } from "../sessionImport.ts";
import { formatQuantity } from "./derive.ts";
import { quantityFromText } from "./parse.ts";
import { reachOfTiers, tiersFromRange, withTiers } from "./tiers.ts";

const ROW: Quantity = quantityFromText("18-15/15-12 cal", "calories")!;

describe("targets by level", () => {
  it('reads "18-15/15-12" as male-female pairs per level, spanning the range', () => {
    expect(ROW).toEqual({
      measure: "calories",
      amount: { min: 15, max: 18 },
      female: { min: 12, max: 15 },
      tiers: [
        { level: "elite", amount: { min: 18, max: 18 }, female: { min: 15, max: 15 } },
        { level: "rx", amount: { min: 15, max: 15 }, female: { min: 12, max: 12 } },
      ],
    });
    expect(formatQuantity(ROW)).toBe("Elite 18/15 · RX 15/12 cal");
  });

  it("spans the tiers when one level's female number differs from the next male", () => {
    expect(quantityFromText("20-10/15-8 cal", "calories")).toMatchObject({
      amount: { min: 15, max: 20 },
      female: { min: 8, max: 10 },
    });
    expect(formatQuantity(quantityFromText("18-15/15-12 reps", "reps")!)).toBe(
      "Elite 18/15 · RX 15/12 reps",
    );
  });

  it("keeps rising pairs and loads as male and female ranges", () => {
    expect(quantityFromText("8-10/6-8 reps", "reps")?.tiers).toBeUndefined();
    expect(quantityFromText("@60-50/40-35 kg", "load_kg")?.tiers).toBeUndefined();
  });

  it("splits a range into levels by hand and back, keeping the range", () => {
    const { tiers: _tiers, ...range } = ROW;
    const split = withTiers(range, tiersFromRange(range));
    expect(split).toEqual(ROW);
    expect(withTiers(split, undefined)).toEqual(range);
    expect(tiersFromRange({ measure: "calories", amount: { min: 15, max: 15 } })).toBeUndefined();
  });

  it("places a count reached each round on the athlete's side", () => {
    const tiers = ROW.tiers!;
    expect(reachOfTiers(tiers, { min: 7, max: 8 }, "m")).toEqual({
      next: { level: "rx", target: 15 },
    });
    expect(reachOfTiers(tiers, { min: 15, max: 17 }, "m")).toEqual({
      met: "rx",
      next: { level: "elite", target: 18 },
    });
    expect(reachOfTiers(tiers, { min: 15, max: 15 }, "f")).toEqual({ met: "elite" });
  });
});
