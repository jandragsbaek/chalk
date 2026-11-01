import type { MovementId, PartRef, SimilarParts } from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import { describeDifference, indexSimilar } from "./similar.ts";

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
  it("names the latest earlier session a session repeats, never a later one", () => {
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
          matches: [
            { other: "dec/0", ...repeat },
            { other: "july/0", ...repeat },
            { other: "sept/0", ...repeat },
          ],
        },
        { part: "july/0", total: 1, matches: [{ other: "now/1", ...repeat }] },
      ],
    } as unknown as SimilarParts;
    const index = indexSimilar(similar);
    expect(index.repeatsEarlier("now")?.id).toBe("sept/0");
    expect(index.repeatsEarlier("july")).toBeUndefined();
    expect(
      index.ofWorkout("now").map((group) => group.echoes.map((echo) => echo.other.id)),
    ).toEqual([["dec/0", "july/0", "sept/0"]]);
  });
});

describe("describeDifference", () => {
  const names = new Map<string, string>([
    ["thruster", "Thruster"],
    ["wall-ball", "Wall ball"],
  ]);
  const nameOf = (id: MovementId) => names.get(id) ?? id;
  const thruster = "thruster" as MovementId;

  it("reads the other session's side, said as then or later", () => {
    expect(
      describeDifference(
        {
          _tag: "format",
          here: { format: "amrap", params: { durationSeconds: 720 } },
          there: { format: "amrap", params: { durationSeconds: 900 } },
        },
        nameOf,
        "then",
      ),
    ).toBe("AMRAP 15 min then");
    expect(
      describeDifference(
        {
          _tag: "numbers",
          movementId: thruster,
          here: [[{ measure: "reps", amount: { min: 15, max: 15 } }]],
          there: [[{ measure: "reps", amount: { min: 12, max: 12 } }]],
        },
        nameOf,
        "later",
      ),
    ).toBe("Thruster 12 reps later");
    expect(
      describeDifference(
        { _tag: "missing", movementId: "wall-ball" as MovementId },
        nameOf,
        "then",
      ),
    ).toBe("Wall ball only then");
  });
});
