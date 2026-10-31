import { describe, expect, it } from "vite-plus/test";

import { brzycki, epley, estimateOneRepMax, lombardi } from "./estimate.ts";

describe("estimateOneRepMax", () => {
  it("returns the load itself for a single", () => {
    expect(estimateOneRepMax(140, 1)).toEqual({ epley: 140, low: 140, high: 140 });
  });

  it("uses Epley as the headline and the formula extremes as the spread", () => {
    const estimate = estimateOneRepMax(100, 5);
    expect(estimate.epley).toBeCloseTo(116.67, 2);
    expect(estimate.low).toBeCloseTo(Math.min(epley(100, 5), brzycki(100, 5), lombardi(100, 5)));
    expect(estimate.high).toBeCloseTo(Math.max(epley(100, 5), brzycki(100, 5), lombardi(100, 5)));
  });

  it("has the widest spread at high reps, though not monotonically", () => {
    const spread = (reps: number) => {
      const { low, high } = estimateOneRepMax(100, reps);
      return high - low;
    };
    expect(spread(10)).toBeGreaterThan(spread(3));
    // Lombardi crosses Epley and Brzycki near 5 reps.
    expect(spread(5)).toBeLessThan(spread(3));
  });
});
