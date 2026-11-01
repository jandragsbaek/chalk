import { describe, expect, it } from "@effect/vitest";

import { MovementId } from "../baseSchemas.ts";
import type { CatalogMovement } from "../sessionImport.ts";
import { scalingOptions, scalingUsage } from "./scalings.ts";

const movement = (id: string, extra: Partial<CatalogMovement> = {}): CatalogMovement => ({
  id: MovementId.make(id),
  name: id,
  category: "gymnastics",
  aliases: [],
  ...extra,
});

const ids = (options: ReadonlyArray<CatalogMovement>) => options.map((option) => option.id);

describe("scalingOptions", () => {
  it("offers its own scalings, then its core's, then the easier rungs of its sheet row", () => {
    const catalog = [
      movement("pull-up", { levelFamily: "pull-ups", scalings: [MovementId.make("band-pull-up")] }),
      movement("chest-to-bar-pull-up", {
        levelFamily: "pull-ups",
        variationOf: MovementId.make("pull-up"),
        scalings: [MovementId.make("pull-up")],
      }),
      movement("band-pull-up"),
      movement("jumping-pull-up", { levelFamily: "pull-ups" }),
      movement("ring-row", { levelFamily: "pull-ups" }),
    ];
    // Pull-up is the Scaled rung, jumping the Fundamentals one, ring rows under the sheet.
    expect(ids(scalingOptions(MovementId.make("chest-to-bar-pull-up"), catalog))).toEqual([
      "pull-up",
      "band-pull-up",
      "jumping-pull-up",
      "ring-row",
    ]);
  });

  it("skips itself and movements missing from the catalog", () => {
    const catalog = [
      movement("wall-walk", {
        scalings: [
          MovementId.make("wall-walk"),
          MovementId.make("gone"),
          MovementId.make("walk-out"),
        ],
      }),
      movement("walk-out"),
    ];
    expect(ids(scalingOptions(MovementId.make("wall-walk"), catalog))).toEqual(["walk-out"]);
    expect(scalingOptions(MovementId.make("gone"), catalog)).toEqual([]);
  });
});

describe("scalingUsage", () => {
  const item = (workoutId: string, performedOn: string, variants?: Array<[string, number]>) => ({
    workoutId,
    performedOn,
    movementId: MovementId.make("pull-up"),
    ...(variants === undefined
      ? {}
      : {
          performance: {
            variants: variants.map(([id, reps]) => ({ movementId: MovementId.make(id), reps })),
          },
        }),
  });

  it("counts sessions once, the ones another movement stood in, and its reps", () => {
    const usage = scalingUsage([
      item("w1", "2026-10-01", [["ring-row", 30]]),
      item("w1", "2026-10-01", [["ring-row", 15]]),
      item("w2", "2026-10-08", [
        ["pull-up", 10],
        ["jumping-pull-up", 20],
      ]),
      item("w3", "2026-10-15", [["pull-up", 30]]),
      item("w4", "2026-10-22", [["ring-row", 0]]),
      item("w5", "2026-10-29", [["ring-row", 25]]),
    ]).get(MovementId.make("pull-up"));
    expect(usage).toEqual({
      sessions: 5,
      scaled: 3,
      swaps: [
        { movementId: "ring-row", sessions: 2, reps: 70 },
        { movementId: "jumping-pull-up", sessions: 1, reps: 20 },
      ],
      lastScaledOn: "2026-10-29",
    });
  });
});
