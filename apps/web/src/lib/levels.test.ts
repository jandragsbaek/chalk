import type { CatalogMovement, LevelItem, LiftSet, Quantity } from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import { summarizeAccessories, summarizeFamilies, verdictOf, windowStart } from "./levels.ts";

const movement = (
  id: string,
  levelFamily?: CatalogMovement["levelFamily"],
  extra: Partial<CatalogMovement> = {},
) =>
  ({
    id,
    name: id,
    category: "gymnastics",
    aliases: [],
    ...(levelFamily === undefined ? {} : { levelFamily }),
    ...extra,
  }) as CatalogMovement;

const MOVEMENTS = [
  movement("pull-up", "pull-ups"),
  movement("jumping-pull-up", "pull-ups"),
  movement("power-clean", "bb-clean"),
  movement("gorilla-row", undefined, {
    accessory: true,
    complements: ["horizontal_pull", "lats"],
    supports: ["pull-ups"],
  }),
  movement("snatch-pull", undefined, {
    accessory: true,
    complements: ["hinge", "upper_back"],
    supports: ["bb-snatch"],
  }),
];

const kg = (m: number): Quantity => ({ measure: "load_kg", amount: { min: m, max: m } });
const reps = (count: number): Quantity => ({ measure: "reps", amount: { min: count, max: count } });

const item = (
  workoutId: string,
  performedOn: string,
  movementId: string,
  quantities: ReadonlyArray<Quantity>,
  extra: Partial<LevelItem> = {},
) =>
  ({
    workoutId,
    performedOn,
    movementId,
    alternative: false,
    sets: [{ quantities }],
    ...extra,
  }) as LevelItem;

const liftSet = (performedOn: string, movementId: string, setReps: number, loadKg: number) =>
  ({
    id: `${movementId}-${performedOn}`,
    movementId,
    performedOn,
    reps: setReps,
    loadKg,
  }) as LiftSet;

describe("windowStart", () => {
  it("counts back whole days, and has no start for all time", () => {
    expect(windowStart("90d", new Date(2026, 9, 31))).toBe("2026-08-02");
    expect(windowStart("all", new Date(2026, 9, 31))).toBeUndefined();
  });
});

describe("summarizeFamilies", () => {
  const items = [
    item("w1", "2026-10-01", "pull-up", [reps(10)], {
      performance: {
        variants: [
          { movementId: "jumping-pull-up" as never, reps: 44 },
          { movementId: "pull-up" as never, reps: 6 },
        ],
        unbroken: 2,
      },
    }),
    item("w2", "2026-10-20", "power-clean", [reps(6), kg(60)], { performance: { loadKg: 50 } }),
    item("w3", "2026-10-25", "power-clean", [reps(6), kg(70)], { performance: { loadKg: 45 } }),
    item("w0", "2025-01-01", "power-clean", [kg(100)], { performance: {} }),
  ];
  const summaries = summarizeFamilies(
    MOVEMENTS,
    items,
    [liftSet("2026-10-10", "power-clean", 1, 95)],
    "2026-08-02",
  );

  it("takes the level most pull-up reps reached, and the hardest variation as what you can do", () => {
    const pullUps = summaries.get("pull-ups")!;
    expect(pullUps.performed?.level).toBe("fundamentals");
    expect(pullUps.shares).toEqual([
      { level: "fundamentals", reps: 44 },
      { level: "scaled", reps: 6 },
    ]);
    expect(pullUps.capability).toMatchObject({ level: "scaled", unbroken: 2 });
    expect(verdictOf(pullUps, (id) => id).heading).toBe("Volume");
  });

  it("takes the heaviest load in the window and the estimated 1RM as the ceiling", () => {
    const cleans = summaries.get("bb-clean")!;
    expect(cleans.sessions).toBe(2);
    expect(cleans.performed).toMatchObject({ level: "scaled", loadKg: 50 });
    expect(cleans.capability?.estimateKg).toBe(95);
    expect(cleans.programmed?.from).toBe(1.5);
    expect(cleans.programmed?.to).toBe(2);
    const verdict = verdictOf(cleans, (id) => id);
    expect(verdict.heading).toBe("+20 kg");
    expect(verdict.detail).toContain("74 % of your estimated 1RM");
  });

  it("says when nothing was done in the window", () => {
    expect(verdictOf(summaries.get("hspu")!, (id) => id)).toMatchObject({
      heading: "No workouts",
      quiet: true,
    });
  });
});

describe("summarizeAccessories", () => {
  it("lists accessories trained in the window with their load from first to latest", () => {
    const [gorilla, ...rest] = summarizeAccessories(
      MOVEMENTS,
      [
        item("w1", "2026-09-01", "gorilla-row", [kg(20)], { performance: { implements: 2 } }),
        item("w2", "2026-10-01", "gorilla-row", [kg(24)], { performance: { implements: 2 } }),
      ],
      [],
      undefined,
    );
    expect(gorilla).toMatchObject({
      group: "horizontal_pull",
      sessions: 2,
      firstKg: 20,
      latestKg: 24,
      dual: true,
    });
    // Snatch pulls are tagged but never done: no row.
    expect(rest).toEqual([]);
  });
});
