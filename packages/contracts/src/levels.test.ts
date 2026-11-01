import { describe, expect, it } from "@effect/vitest";

import { MovementId } from "./baseSchemas.ts";
import {
  divisionOf,
  gradeItem,
  gradeLoad,
  gradeVariant,
  LEVEL_FAMILIES,
  levelFamily,
  loadRungLabel,
  majorityLevel,
  nextLevel,
  prescribedReps,
  type GradableMovement,
  type LevelFamilyId,
  type LoadFamily,
  type VariantFamily,
} from "./levels.ts";
import type { Quantity } from "./sessionImport.ts";

const load = (id: LevelFamilyId) => levelFamily(id) as LoadFamily;
const variants = (id: LevelFamilyId) => levelFamily(id) as VariantFamily;

const catalog = (entries: ReadonlyArray<readonly [string, LevelFamilyId]>) =>
  new Map<MovementId, GradableMovement>(
    entries.map(([id, family]) => [
      MovementId.make(id),
      { id: MovementId.make(id), levelFamily: family },
    ]),
  );

const kgSet = (m: number, f?: number): { quantities: ReadonlyArray<Quantity> } => ({
  quantities: [
    {
      measure: "load_kg",
      amount: { min: m, max: m },
      ...(f === undefined ? {} : { female: { min: f, max: f } }),
    },
  ],
});

const repsSet = (reps: number): { quantities: ReadonlyArray<Quantity> } => ({
  quantities: [{ measure: "reps", amount: { min: reps, max: reps } }],
});

describe("the sheet", () => {
  it("has unique family ids and an Elite rung only above an RX rung", () => {
    const ids = LEVEL_FAMILIES.map((family) => family.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const family of LEVEL_FAMILIES)
      if (family.rungs.elite) expect(family.rungs.rx, family.id).toBeDefined();
  });

  it("puts Chalk's Elite about 20 % over RX, rounded to a plate", () => {
    expect(load("bb-clean").rungs.elite?.options[0]?.kg).toEqual({ m: 120, f: 77.5 });
    expect(load("bb-deadlift").rungs.elite?.options[0]?.kg).toEqual({ m: 145, f: 102.5 });
    expect(load("bb-clean").rungs.elite?.source).toBe("chalk");
    expect(load("bb-clean").rungs.rx?.source).toBe("gymdanmark");
  });

  it("prints load rungs the way the ruler shows them", () => {
    expect(loadRungLabel(load("bb-thruster").rungs.scaled!, "m")).toBe("42.5");
    expect(loadRungLabel(load("db-thruster").rungs.intermediate!, "m")).toBe("25 or 2 × 22.5");
    expect(loadRungLabel(load("kb-swing").rungs.rx!, "m")).toBe("American 32");
    expect(loadRungLabel(load("bb-clean").rungs.rx!, "f")).toBe("65");
  });
});

describe("gradeLoad", () => {
  it("meets the highest rung at or under the load and sits between rungs", () => {
    const clean = load("bb-clean");
    expect(gradeLoad(clean, 50, { sex: "m" })).toEqual({ level: "scaled", position: 1 });
    expect(gradeLoad(clean, 60, { sex: "m" })).toEqual({ level: "scaled", position: 1.5 });
    expect(gradeLoad(clean, 100, { sex: "m" }).level).toBe("rx");
  });

  it("is under the sheet below Fundamentals, half a step under it at most", () => {
    const grade = gradeLoad(load("bb-clean"), 20, { sex: "m" });
    expect(grade.level).toBeUndefined();
    expect(grade.position).toBeLessThan(0);
    expect(grade.position).toBeGreaterThanOrEqual(-0.5);
  });

  it("skips rungs the sheet leaves out: a snatch starts at Intermediate", () => {
    const snatch = load("bb-snatch");
    expect(gradeLoad(snatch, 40, { sex: "m" }).level).toBeUndefined();
    expect(gradeLoad(snatch, 40, { sex: "m" }).position).toBeLessThan(2);
    expect(gradeLoad(snatch, 60, { sex: "m" }).level).toBe("intermediate");
  });

  it("takes the higher rung when two share a load (wall balls at 9 kg)", () => {
    expect(gradeLoad(load("wall-balls"), 9, { sex: "m" }).level).toBe("intermediate");
  });

  it("grades two implements against the dual loads", () => {
    const squat = load("db-squat");
    expect(gradeLoad(squat, 22.5, { sex: "m" }).level).toBe("scaled");
    expect(gradeLoad(squat, 22.5, { implements: 2, sex: "m" }).level).toBe("rx");
  });

  it("needs an American swing for RX", () => {
    const swing = load("kb-swing");
    expect(gradeLoad(swing, 32, { movementId: "kettlebell-swing", sex: "m" }).level).toBe(
      "intermediate",
    );
    expect(gradeLoad(swing, 32, { movementId: "american-kettlebell-swing", sex: "m" }).level).toBe(
      "rx",
    );
  });

  it("uses the female side when asked", () => {
    expect(gradeLoad(load("bb-clean"), 35, { sex: "f" }).level).toBe("scaled");
  });
});

describe("gradeVariant", () => {
  it("meets the rung a variation enters at", () => {
    const pullUps = variants("pull-ups");
    expect(gradeVariant(pullUps, "jumping-pull-up")?.level).toBe("fundamentals");
    expect(gradeVariant(pullUps, "pull-up")?.level).toBe("scaled");
    expect(gradeVariant(pullUps, "chest-to-bar-pull-up")?.level).toBe("intermediate");
    expect(gradeVariant(pullUps, "strict-ring-muscle-up")?.level).toBe("elite");
  });

  it("also meets rungs above that ask for nothing new", () => {
    expect(gradeVariant(variants("toes-to-bar"), "toes-to-bar")?.level).toBe("rx");
    expect(gradeVariant(variants("toes-to-bar"), "hanging-knee-raise")?.level).toBe("scaled");
    expect(gradeVariant(variants("skipping-rope"), "double-under")?.level).toBe("intermediate");
  });

  it("puts known scalings under the sheet and ignores strangers", () => {
    expect(gradeVariant(variants("pull-ups"), "ring-row")?.level).toBeUndefined();
    expect(gradeVariant(variants("pull-ups"), "ring-row")?.position).toBe(-0.5);
    expect(gradeVariant(variants("hspu"), "pike-push-up")?.position).toBe(1.5);
    expect(gradeVariant(variants("pull-ups"), "burpee")).toBeUndefined();
  });
});

describe("majorityLevel", () => {
  it("is the highest rung more than half the reps reached", () => {
    expect(
      majorityLevel([
        { level: "fundamentals", reps: 44 },
        { level: "scaled", reps: 6 },
      ]),
    ).toBe("fundamentals");
    expect(
      majorityLevel([
        { level: "fundamentals", reps: 20 },
        { level: "scaled", reps: 30 },
      ]),
    ).toBe("scaled");
    expect(majorityLevel([{ level: undefined, reps: 10 }])).toBeUndefined();
    expect(majorityLevel([])).toBeUndefined();
  });

  it("counts reps above a rung toward it: half C2B, half pull-ups is Scaled", () => {
    expect(
      majorityLevel([
        { level: "fundamentals", reps: 10 },
        { level: "scaled", reps: 20 },
        { level: "intermediate", reps: 20 },
      ]),
    ).toBe("scaled");
  });
});

describe("gradeItem", () => {
  const movements = catalog([
    ["pull-up", "pull-ups"],
    ["jumping-pull-up", "pull-ups"],
    ["power-clean", "bb-clean"],
    ["thruster", "bb-thruster"],
    ["dumbbell-thruster", "db-thruster"],
  ]);
  const id = MovementId.make;

  it("grades what the board asked for, before anything was done", () => {
    const grade = gradeItem(
      {
        movementId: id("power-clean"),
        sets: [{ quantities: [...repsSet(6).quantities, ...kgSet(60, 40).quantities] }],
      },
      movements,
      "m",
    );
    expect(grade?.prescribed?.level).toBe("scaled");
    expect(grade?.prescribedLoadKg).toBe(60);
    expect(grade?.performed).toBeUndefined();
  });

  it("reads the female side of an M/F load for a female athlete", () => {
    const grade = gradeItem(
      { movementId: id("power-clean"), sets: [kgSet(60, 40)] },
      movements,
      "f",
    );
    expect(grade?.prescribedLoadKg).toBe(40);
    expect(grade?.prescribed?.level).toBe("scaled");
  });

  it("grades the load used, and an empty performance as prescribed", () => {
    const sets = [kgSet(60, 40)];
    expect(
      gradeItem(
        { movementId: id("power-clean"), sets, performance: { loadKg: 42.5 } },
        movements,
        "m",
      )?.performed?.level,
    ).toBe("fundamentals");
    expect(
      gradeItem({ movementId: id("power-clean"), sets, performance: {} }, movements, "m")?.performed
        ?.loadKg,
    ).toBe(60);
    expect(
      gradeItem({ movementId: id("power-clean"), sets, liftedKg: 72.5 }, movements, "m")?.performed
        ?.level,
    ).toBe("intermediate");
  });

  it("splits reps by variation and keeps the hardest as what the athlete can do", () => {
    const grade = gradeItem(
      {
        movementId: id("pull-up"),
        sets: [repsSet(10)],
        performance: {
          variants: [
            { movementId: id("pull-up"), reps: 6 },
            { movementId: id("jumping-pull-up"), reps: 44 },
          ],
          unbroken: 2,
        },
      },
      movements,
      "m",
    );
    expect(grade?.prescribed?.level).toBe("scaled");
    expect(grade?.performed?.level).toBe("fundamentals");
    expect(grade?.performed?.shares).toEqual([
      { level: "fundamentals", reps: 44 },
      { level: "scaled", reps: 6 },
    ]);
    expect(grade?.performed?.capability).toMatchObject({
      level: "scaled",
      movementId: "pull-up",
      unbroken: 2,
    });
  });

  it("counts an unknown variation as under the sheet", () => {
    const grade = gradeItem(
      {
        movementId: id("pull-up"),
        sets: [repsSet(10)],
        performance: { variants: [{ movementId: id("burpee"), reps: 10 }] },
      },
      movements,
      "m",
    );
    expect(grade?.performed?.level).toBeUndefined();
    expect(grade?.performed?.shares).toEqual([{ level: undefined, reps: 10 }]);
  });

  it("grades a swap to another family where it belongs", () => {
    const grade = gradeItem(
      {
        movementId: id("thruster"),
        sets: [kgSet(43, 30)],
        performance: {
          loadKg: 22.5,
          variants: [{ movementId: id("dumbbell-thruster"), reps: 30 }],
        },
      },
      movements,
      "m",
    );
    expect(grade?.family.id).toBe("bb-thruster");
    expect(grade?.performed?.family.id).toBe("db-thruster");
    expect(grade?.performed?.level).toBe("scaled");
  });

  it("is undefined for a movement on no row of the sheet", () => {
    expect(gradeItem({ movementId: id("burpee"), sets: [] }, movements, "m")).toBeUndefined();
  });
});

describe("divisionOf", () => {
  it("is the lowest level every graded movement reaches", () => {
    expect(
      divisionOf([
        { level: "intermediate", position: 2 },
        { level: "scaled", position: 1 },
        undefined,
      ]),
    ).toEqual({ level: "scaled", graded: 2 });
    expect(divisionOf([{ level: undefined, position: -0.5 }])?.level).toBeUndefined();
    expect(divisionOf([undefined])).toBeUndefined();
  });
});

describe("nextLevel", () => {
  it("is the next rung on the sheet", () => {
    expect(nextLevel(load("bb-snatch"), undefined)).toBe("intermediate");
    expect(nextLevel(load("bb-clean"), "scaled")).toBe("intermediate");
    expect(nextLevel(variants("hspu"), "rx")).toBeUndefined();
  });
});

describe("prescribedReps", () => {
  it("counts every set: 5 x 5 is 25", () => {
    const line = (quantities: ReadonlyArray<Quantity>) => ({ quantities });
    const count = (measure: Quantity["measure"], value: number): Quantity => ({
      measure,
      amount: { min: value, max: value },
    });
    expect(prescribedReps([line([count("sets", 5), count("reps", 5)])])).toBe(25);
    expect(prescribedReps([line([count("reps", 10)]), line([count("reps", 5)])])).toBe(15);
  });
});
