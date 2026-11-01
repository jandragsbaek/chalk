import { describe, expect, it } from "@effect/vitest";

import type { MovementId } from "./baseSchemas.ts";
import { describeDifference } from "./similarityWords.ts";

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
