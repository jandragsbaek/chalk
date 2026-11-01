import type { PartRef, SimilarParts } from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import { indexSimilar } from "./similar.ts";

const part = (id: string, workoutId: string, performedOn: string, position = 0): PartRef =>
  ({
    id,
    workoutId,
    workoutName: workoutId,
    performedOn,
    sessionNumber: null,
    position,
    title: `Workout #${position + 1}`,
    headline: null,
    movementIds: [],
    result: "",
    top: null,
  }) as unknown as PartRef;

const repeat = { kind: "repeat", score: 1, differences: [] } as const;

describe("indexSimilar", () => {
  it("names the latest earlier session a session repeats, even one not listed", () => {
    const similar = {
      parts: [
        part("july/0", "july", "2026-07-01"),
        part("sept/0", "sept", "2026-09-01"),
        part("now/1", "now", "2026-10-01", 1),
        part("dec/0", "dec", "2026-12-01"),
      ],
      echoes: [
        {
          part: "now/1",
          total: 3,
          // Only the later repeat is listed; September is beyond the shown matches.
          matches: [{ other: "dec/0", ...repeat }],
          earlierRepeat: "sept/0",
        },
        {
          part: "july/0",
          total: 1,
          matches: [{ other: "now/1", ...repeat }],
          earlierRepeat: null,
        },
      ],
    } as unknown as SimilarParts;
    const index = indexSimilar(similar);
    expect(index.repeatsEarlier("now")?.id).toBe("sept/0");
    expect(index.repeatsEarlier("july")).toBeUndefined();
    expect(
      index.ofWorkout("now").map((group) => group.echoes.map((echo) => echo.other.id)),
    ).toEqual([["dec/0"]]);
  });
});
