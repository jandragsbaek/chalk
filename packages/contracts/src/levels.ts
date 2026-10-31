import * as Schema from "effect/Schema";

import { MovementId } from "./baseSchemas.ts";
import type { Quantity } from "./sessionImport.ts";

/**
 * Levels per movement family after GymDanmark's FF level sheet (March 2026), plus Chalk's own
 * Elite rung above RX. A family is one row of the sheet; load families grade by kilograms,
 * variant families by the variation done.
 */

export const Level = Schema.Literals(["fundamentals", "scaled", "intermediate", "rx", "elite"]);
export type Level = typeof Level.Type;

/** Easiest first. */
export const LEVELS: ReadonlyArray<Level> = Level.literals;

export const LEVEL_NAMES: Record<Level, string> = {
  fundamentals: "Fundamentals",
  scaled: "Scaled",
  intermediate: "Intermediate",
  rx: "RX",
  elite: "Elite",
};

export const LEVEL_SHORT: Record<Level, string> = {
  fundamentals: "F",
  scaled: "S",
  intermediate: "I",
  rx: "RX",
  elite: "E",
};

export const levelIndex = (level: Level): number => LEVELS.indexOf(level);

/** Which side of a male/female load ("20/12") applies. */
export type Sex = "m" | "f";

/**
 * The athlete's side of every M/F load. A setting from a first-run setup wizard later
 * (docs/roadmap.md); until then the athlete is graded on the male loads.
 */
export const ATHLETE_SEX: Sex = "m";

/** Who wrote a rung: the official sheet, or Chalk (Elite, and anything the sheet leaves open). */
export type StandardSource = "gymdanmark" | "chalk";

export const STANDARD = {
  id: "gymdanmark-ff-2026-03",
  name: "GymDanmark FF 2026",
  url: "https://gymdanmark.dk/wp-content/uploads/2026/03/Oevelses-og-niveauoversigt-i-FF-Open-Age-U19-20-U21-22-M30-34-M35-39-M40-44-M45-49.pdf",
} as const;

export const LevelGroup = Schema.Literals(["barbell", "kb_db", "gymnastics", "functional"]);
export type LevelGroup = typeof LevelGroup.Type;

export const LEVEL_GROUP_NAMES: Record<LevelGroup, string> = {
  barbell: "Barbell",
  kb_db: "KB & DB",
  gymnastics: "Gymnastics",
  functional: "Functional",
};

export const LevelFamilyId = Schema.Literals([
  "bb-deadlift",
  "bb-front-squat",
  "bb-back-squat",
  "bb-overhead-squat",
  "bb-clean",
  "bb-press",
  "bb-thruster",
  "bb-snatch",
  "kb-swing",
  "kb-deadlift",
  "db-deadlift",
  "kb-squat",
  "db-squat",
  "kb-clean",
  "db-clean",
  "kb-press",
  "db-press",
  "kb-thruster",
  "db-thruster",
  "kb-snatch",
  "db-snatch",
  "pull-ups",
  "toes-to-bar",
  "hspu",
  "handstand-walk",
  "skipping-rope",
  "pistols",
  "rope-climbs",
  "box-jumps",
  "wall-balls",
  "push-ups",
  "ghd-sit-ups",
]);
export type LevelFamilyId = typeof LevelFamilyId.Type;

/**
 * What an accessory complements: a movement pattern or a muscle group. A fixed vocabulary, so a
 * coach can ask "what trains the hinge" and get every exercise tagged with it.
 */
export const Complement = Schema.Literals([
  "squat",
  "hinge",
  "single_leg",
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "midline",
  "carry",
  "grip",
  "quads",
  "glutes",
  "hamstrings",
  "adductors",
  "calves",
  "lats",
  "upper_back",
  "chest",
  "shoulders",
  "triceps",
  "biceps",
]);
export type Complement = typeof Complement.Type;

export const COMPLEMENT_NAMES: Record<Complement, string> = {
  squat: "squat",
  hinge: "hinge",
  single_leg: "single leg",
  horizontal_push: "horizontal push",
  vertical_push: "vertical push",
  horizontal_pull: "horizontal pull",
  vertical_pull: "vertical pull",
  midline: "midline",
  carry: "carry",
  grip: "grip",
  quads: "quads",
  glutes: "glutes",
  hamstrings: "hamstrings",
  adductors: "adductors",
  calves: "calves",
  lats: "lats",
  upper_back: "upper back",
  chest: "chest",
  shoulders: "shoulders",
  triceps: "triceps",
  biceps: "biceps",
};

/** Patterns first, then muscles; the order pickers and groupings use. */
export const COMPLEMENT_PATTERNS: ReadonlyArray<Complement> = [
  "squat",
  "hinge",
  "single_leg",
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "midline",
  "carry",
  "grip",
];

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const NonNegative = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));

export const VariantReps = Schema.Struct({ movementId: MovementId, reps: Count });
export type VariantReps = typeof VariantReps.Type;

/**
 * How a programmed movement was actually done, entered after the fact. Present but empty means
 * "as prescribed". `loadKg` is per implement; `variants` splits the reps by variation ("6
 * kipping, 44 jumping"); `unbroken` is the biggest unbroken set of the hardest variation done.
 */
export const Performance = Schema.Struct({
  loadKg: Schema.optionalKey(NonNegative),
  implements: Schema.optionalKey(Schema.Literals([1, 2])),
  variants: Schema.optionalKey(Schema.Array(VariantReps)),
  unbroken: Schema.optionalKey(Count),
}).annotate({ identifier: "Performance" });
export type Performance = typeof Performance.Type;

/** A load as written on the sheet: male / female. */
export interface Kg {
  readonly m: number;
  readonly f: number;
}

/** One way to meet a load rung: at least `kg` per implement, with one or two implements. */
export interface LoadOption {
  readonly kg: Kg;
  /** Two implements ("dual"); single by default. */
  readonly dual?: true;
  /** Only these variations count ("American" swings for RX). */
  readonly movements?: ReadonlyArray<string>;
  /** Shown before the load: "American". */
  readonly prefix?: string;
}

export interface LoadRung {
  readonly options: ReadonlyArray<LoadOption>;
  readonly source: StandardSource;
}

export interface VariantRung {
  /** Variations this rung adds; empty when it asks for nothing new over the rung below. */
  readonly introduces: ReadonlyArray<string>;
  readonly label: string;
  readonly source: StandardSource;
}

interface FamilyBase {
  readonly id: LevelFamilyId;
  readonly name: string;
  readonly group: LevelGroup;
  /** What the sheet says that Chalk cannot see, e.g. a box height it does not record. */
  readonly note?: string;
}

/** A rung missing from `rungs` is not on the sheet ("-"). */
export interface LoadFamily extends FamilyBase {
  readonly kind: "load";
  readonly rungs: Partial<Record<Level, LoadRung>>;
}

export interface VariantFamily extends FamilyBase {
  readonly kind: "variant";
  readonly rungs: Partial<Record<Level, VariantRung>>;
  /** Known scalings under the sheet's lowest rung (ring rows for pull-ups). */
  readonly below: ReadonlyArray<string>;
}

export type LevelFamily = LoadFamily | VariantFamily;

const kg = (m: number, f: number): Kg => ({ m, f });
const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/** Chalk's Elite: about 20 % over RX, rounded to the next plate or implement step. */
const eliteOf = (rx: LoadRung, step: number): LoadRung => ({
  source: "chalk",
  options: rx.options.map((option) => ({
    ...option,
    kg: kg(roundTo(option.kg.m * 1.2, step), roundTo(option.kg.f * 1.2, step)),
  })),
});

const sheet = (...options: ReadonlyArray<LoadOption>): LoadRung => ({
  options,
  source: "gymdanmark",
});
const single = (m: number, f: number): LoadOption => ({ kg: kg(m, f) });
const dual = (m: number, f: number): LoadOption => ({ kg: kg(m, f), dual: true });

const barbell = (
  id: LevelFamilyId,
  name: string,
  loads: Partial<Record<Exclude<Level, "elite">, readonly [number, number]>>,
  note?: string,
): LoadFamily => {
  const rungs: Partial<Record<Level, LoadRung>> = {};
  for (const level of LEVELS) {
    if (level === "elite") continue;
    const load = loads[level];
    if (load) rungs[level] = sheet(single(load[0], load[1]));
  }
  if (rungs.rx) rungs.elite = eliteOf(rungs.rx, 2.5);
  return { kind: "load", id, name, group: "barbell", rungs, ...(note ? { note } : {}) };
};

type KbDbLoads = Partial<Record<Exclude<Level, "elite">, ReadonlyArray<LoadOption>>>;

const kbdb = (id: LevelFamilyId, name: string, loads: KbDbLoads, step: number): LoadFamily => {
  const rungs: Partial<Record<Level, LoadRung>> = {};
  for (const level of LEVELS) {
    if (level === "elite") continue;
    const options = loads[level];
    if (options) rungs[level] = sheet(...options);
  }
  if (rungs.rx) rungs.elite = eliteOf(rungs.rx, step);
  return { kind: "load", id, name, group: "kb_db", rungs };
};

const variant = (
  label: string,
  introduces: ReadonlyArray<string>,
  source: StandardSource = "gymdanmark",
): VariantRung => ({ label, introduces, source });

const KB_STEP = 4;
const DB_STEP = 2.5;

/** The sheet, family by family. Loads are male / female kg per implement. */
export const LEVEL_FAMILIES: ReadonlyArray<LevelFamily> = [
  barbell("bb-deadlift", "Deadlifts", {
    fundamentals: [60, 40],
    scaled: [80, 55],
    intermediate: [100, 70],
    rx: [120, 85],
  }),
  barbell("bb-front-squat", "Front squats, lunges", {
    fundamentals: [42.5, 30],
    scaled: [50, 35],
    intermediate: [70, 47.5],
    rx: [100, 65],
  }),
  barbell(
    "bb-back-squat",
    "Back squats",
    {
      fundamentals: [52.5, 35],
      scaled: [60, 40],
      intermediate: [80, 52.5],
      rx: [120, 75],
    },
    "From a rack: the squat row plus 10/5 kg, plus 20/10 kg at RX.",
  ),
  barbell("bb-overhead-squat", "Overhead squats", { intermediate: [60, 40], rx: [80, 55] }),
  barbell("bb-clean", "Cleans", {
    fundamentals: [42.5, 30],
    scaled: [50, 35],
    intermediate: [70, 47.5],
    rx: [100, 65],
  }),
  barbell("bb-press", "Presses, push presses, jerks", {
    fundamentals: [42.5, 30],
    scaled: [50, 35],
    intermediate: [70, 47.5],
    rx: [100, 65],
  }),
  barbell("bb-thruster", "Thrusters", {
    fundamentals: [40, 25],
    scaled: [42.5, 30],
    intermediate: [60, 40],
    rx: [85, 55],
  }),
  barbell("bb-snatch", "Snatches", { intermediate: [60, 40], rx: [80, 55] }),

  {
    kind: "load",
    id: "kb-swing",
    name: "Kettlebell swings",
    group: "kb_db",
    note: "A swing not marked American counts as Russian.",
    rungs: {
      fundamentals: sheet({ ...single(20, 12), prefix: "Russian" }),
      scaled: sheet({ ...single(24, 16), prefix: "Russian" }),
      intermediate: sheet(
        { ...single(32, 24), prefix: "Russian" },
        { ...single(24, 16), prefix: "American", movements: ["american-kettlebell-swing"] },
      ),
      rx: sheet({
        ...single(32, 24),
        prefix: "American",
        movements: ["american-kettlebell-swing"],
      }),
      elite: {
        source: "chalk",
        options: [
          { ...single(40, 28), prefix: "American", movements: ["american-kettlebell-swing"] },
        ],
      },
    },
  },
  kbdb(
    "kb-deadlift",
    "KB deadlifts",
    {
      fundamentals: [dual(20, 12)],
      scaled: [dual(24, 16)],
      intermediate: [dual(32, 24)],
      // The sheet says "+32/+24": heavier than Intermediate, so the next bell up.
      rx: [dual(36, 28)],
    },
    KB_STEP,
  ),
  kbdb(
    "db-deadlift",
    "DB deadlifts",
    {
      fundamentals: [dual(20, 12)],
      scaled: [dual(22.5, 15)],
      intermediate: [dual(30, 22.5)],
      // "+30/+22,5": the next dumbbell up.
      rx: [dual(32.5, 25)],
    },
    DB_STEP,
  ),
  kbdb(
    "kb-squat",
    "KB squats, lunges",
    {
      fundamentals: [single(20, 12)],
      scaled: [single(20, 12)],
      intermediate: [single(32, 24), dual(24, 16)],
      rx: [single(32, 24), dual(28, 20)],
    },
    KB_STEP,
  ),
  kbdb(
    "db-squat",
    "DB squats, lunges",
    {
      fundamentals: [single(20, 12.5)],
      scaled: [single(22.5, 15)],
      intermediate: [single(30, 22.5), dual(22.5, 15)],
      rx: [single(30, 22.5), dual(22.5, 15)],
    },
    DB_STEP,
  ),
  kbdb(
    "kb-clean",
    "KB cleans",
    {
      fundamentals: [single(20, 12)],
      scaled: [single(20, 12)],
      intermediate: [single(32, 24), dual(24, 16)],
      rx: [single(32, 24), dual(28, 20)],
    },
    KB_STEP,
  ),
  kbdb(
    "db-clean",
    "DB cleans",
    {
      fundamentals: [single(20, 12.5)],
      scaled: [single(22.5, 15)],
      intermediate: [single(30, 22.5), dual(22.5, 15)],
      rx: [single(30, 22.5), dual(22.5, 15)],
    },
    DB_STEP,
  ),
  kbdb(
    "kb-press",
    "KB presses, jerks",
    {
      fundamentals: [single(20, 12)],
      scaled: [single(20, 12)],
      intermediate: [single(28, 20), dual(24, 16)],
      rx: [single(32, 24), dual(28, 20)],
    },
    KB_STEP,
  ),
  kbdb(
    "db-press",
    "DB presses, jerks",
    {
      fundamentals: [single(20, 12.5)],
      scaled: [single(22.5, 15)],
      intermediate: [single(25, 17.5), dual(22.5, 15)],
      rx: [single(30, 22.5), dual(22.5, 15)],
    },
    DB_STEP,
  ),
  kbdb(
    "kb-thruster",
    "KB thrusters",
    {
      fundamentals: [single(20, 12)],
      scaled: [single(20, 12), dual(16, 12)],
      intermediate: [single(28, 20), dual(24, 16)],
      rx: [single(32, 24), dual(28, 20)],
    },
    KB_STEP,
  ),
  kbdb(
    "db-thruster",
    "DB thrusters",
    {
      fundamentals: [single(20, 12.5)],
      scaled: [single(22.5, 15), dual(17.5, 12.5)],
      intermediate: [single(25, 17.5), dual(22.5, 15)],
      rx: [single(30, 22.5), dual(22.5, 15)],
    },
    DB_STEP,
  ),
  kbdb(
    "kb-snatch",
    "KB snatches",
    {
      fundamentals: [single(20, 12)],
      scaled: [single(20, 12)],
      intermediate: [single(28, 20), dual(24, 16)],
      rx: [single(32, 24), dual(28, 20)],
    },
    KB_STEP,
  ),
  kbdb(
    "db-snatch",
    "DB snatches",
    {
      fundamentals: [single(20, 12.5)],
      scaled: [single(20, 12.5)],
      intermediate: [single(25, 17.5), dual(22.5, 15)],
      rx: [single(30, 22.5), dual(22.5, 15)],
    },
    DB_STEP,
  ),

  {
    kind: "variant",
    id: "pull-ups",
    name: "Pull-ups",
    group: "gymnastics",
    below: ["ring-row"],
    rungs: {
      fundamentals: variant("Jumping", ["jumping-pull-up"]),
      scaled: variant("Pull-up", ["pull-up"]),
      intermediate: variant("C2B · bar MU", ["chest-to-bar-pull-up", "bar-muscle-up"]),
      rx: variant("Ring MU", ["ring-muscle-up"]),
      elite: variant("Strict ring MU", ["strict-ring-muscle-up"], "chalk"),
    },
  },
  {
    kind: "variant",
    id: "toes-to-bar",
    name: "Toes-to-bar",
    group: "gymnastics",
    below: [],
    rungs: {
      fundamentals: variant("Heels above hips", ["hanging-knee-raise"]),
      scaled: variant("Heels above hips", []),
      intermediate: variant("Toes-to-bar", ["toes-to-bar"]),
      rx: variant("Toes-to-bar", []),
      elite: variant("Strict T2B", ["strict-toes-to-bar"], "chalk"),
    },
  },
  {
    kind: "variant",
    id: "hspu",
    name: "Handstand push-ups",
    group: "gymnastics",
    below: ["pike-push-up"],
    rungs: {
      intermediate: variant("HSPU", ["handstand-push-up", "strict-handstand-push-up"]),
      rx: variant("HSPU", []),
    },
  },
  {
    kind: "variant",
    id: "handstand-walk",
    name: "Handstand walks",
    group: "gymnastics",
    below: [],
    rungs: {
      intermediate: variant("Handstand walk", ["handstand-walk"]),
      rx: variant("Handstand walk", []),
    },
  },
  {
    kind: "variant",
    id: "skipping-rope",
    name: "Skipping rope",
    group: "gymnastics",
    below: [],
    rungs: {
      fundamentals: variant("Singles", ["single-under"]),
      scaled: variant("Singles", []),
      intermediate: variant("Double unders", ["double-under", "triple-under"]),
      rx: variant("Double crossovers", ["double-crossover"]),
    },
  },
  {
    kind: "variant",
    id: "pistols",
    name: "Pistols",
    group: "gymnastics",
    below: [],
    rungs: { intermediate: variant("Pistol", ["pistol"]), rx: variant("Pistol", []) },
  },
  {
    kind: "variant",
    id: "rope-climbs",
    name: "Rope climbs",
    group: "gymnastics",
    below: [],
    rungs: {
      scaled: variant("Rope climb", ["rope-climb", "legless-rope-climb"]),
      intermediate: variant("Rope climb", []),
      rx: variant("Rope climb", []),
    },
  },
  {
    kind: "variant",
    id: "box-jumps",
    name: "Box jumps",
    group: "functional",
    below: [],
    note: "Box height is not recorded, so a box jump counts as the 60 cm Scaled box; Intermediate and RX ask for 75 cm.",
    rungs: {
      fundamentals: variant("Step-up", ["box-step-up"]),
      scaled: variant("Box jump 60", ["box-jump"]),
    },
  },
  {
    kind: "load",
    id: "wall-balls",
    name: "Wall ball shots",
    group: "functional",
    rungs: {
      fundamentals: sheet(single(6, 3)),
      scaled: sheet(single(9, 6)),
      intermediate: sheet(single(9, 6)),
      rx: sheet(single(12, 9)),
      // Balls come in whole kilograms.
      elite: { source: "chalk", options: [single(14, 10)] },
    },
  },
  {
    kind: "variant",
    id: "push-ups",
    name: "Push-ups",
    group: "functional",
    below: [],
    note: "On the sheet, women's Scaled push-ups are on the knees.",
    rungs: {
      scaled: variant("Push-up", ["push-up"]),
      intermediate: variant("Push-up", []),
      rx: variant("Push-up", []),
    },
  },
  {
    kind: "variant",
    id: "ghd-sit-ups",
    name: "GHD sit-ups",
    group: "functional",
    below: [],
    rungs: {
      intermediate: variant("GHD sit-up", ["ghd-sit-up"]),
      rx: variant("GHD sit-up", []),
    },
  },
];

/** Rows of the sheet Chalk does not grade, and why. */
export const UNGRADED_ROWS: ReadonlyArray<string> = [
  "Wall walks: the hand distance from the wall is not recorded.",
  "D-ball and sandbag: no such movement in the catalog yet.",
  "Endurance (run, row, bike, ski, burpees): the same at every level.",
];

const FAMILIES_BY_ID = new Map(LEVEL_FAMILIES.map((family) => [family.id, family]));

export const levelFamily = (id: LevelFamilyId): LevelFamily => FAMILIES_BY_ID.get(id)!;

/**
 * Where a grade sits on a family's ruler: rung `i` is at `i` (Fundamentals 0, Elite 4); a load
 * between two rungs sits between them; under the lowest rung goes down to half a step below it.
 */
export interface Grade {
  /** `undefined`: under the sheet's lowest rung. */
  readonly level: Level | undefined;
  readonly position: number;
}

export const definedLevels = (family: LevelFamily): ReadonlyArray<Level> =>
  LEVELS.filter((level) => family.rungs[level] !== undefined);

/** Walks up the sheet: rungs not on it are skipped below the first met one, and end the climb above. */
const climb = (family: LevelFamily, meets: (level: Level) => boolean): Level | undefined => {
  let reached: Level | undefined;
  for (const level of LEVELS) {
    if (family.rungs[level] === undefined) {
      if (reached !== undefined) break;
      continue;
    }
    if (!meets(level)) break;
    reached = level;
  }
  return reached;
};

const optionMet = (
  option: LoadOption,
  loadKg: number,
  implementCount: 1 | 2,
  movementId: string,
  sex: Sex,
) =>
  (option.dual !== true || implementCount === 2) &&
  (option.movements === undefined || option.movements.includes(movementId)) &&
  loadKg >= option.kg[sex];

/** The threshold the ruler draws for a rung: the option that matches the implements, else the first. */
export const rungThreshold = (
  rung: LoadRung,
  implementCount: 1 | 2,
  sex: Sex,
): number | undefined => {
  const plain = rung.options.filter((option) => option.movements === undefined);
  const pool = plain.length > 0 ? plain : rung.options;
  const option =
    pool.find((candidate) => (candidate.dual === true) === (implementCount === 2)) ??
    pool.find((candidate) => candidate.dual !== true) ??
    pool[0];
  return option?.kg[sex];
};

const clampToLevel = (family: LevelFamily, level: Level | undefined, position: number) => {
  if (level === undefined) {
    const first = definedLevels(family)[0];
    const floor = first === undefined ? 0 : levelIndex(first);
    return Math.min(Math.max(position, floor - 0.5), floor - 0.05);
  }
  return Math.min(Math.max(position, levelIndex(level)), levelIndex(level) + 0.95);
};

/** A load on a load family's ruler: the level it meets and where it sits between rungs. */
export const gradeLoad = (
  family: LoadFamily,
  loadKg: number,
  options: { readonly implements?: 1 | 2; readonly movementId?: string; readonly sex?: Sex } = {},
): Grade => {
  const implementCount = options.implements ?? 1;
  const sex = options.sex ?? ATHLETE_SEX;
  const movementId = options.movementId ?? "";
  const level = climb(family, (at) =>
    family.rungs[at]!.options.some((option) =>
      optionMet(option, loadKg, implementCount, movementId, sex),
    ),
  );
  const stops = definedLevels(family).flatMap((at) => {
    const threshold = rungThreshold(family.rungs[at]!, implementCount, sex);
    return threshold === undefined ? [] : [{ index: levelIndex(at), kg: threshold }];
  });
  let position = 0;
  const lower = stops.findLast((stop) => stop.kg <= loadKg);
  const upper = stops.find((stop) => stop.kg > loadKg);
  if (lower === undefined) {
    const first = stops[0];
    position = first === undefined ? 0 : first.index - 0.5 * Math.min(1, 1 - loadKg / first.kg);
  } else if (upper === undefined) {
    const previous = stops.findLast((stop) => stop.kg < lower.kg);
    const span = previous === undefined ? lower.kg * 0.25 : lower.kg - previous.kg;
    position = lower.index + Math.min(0.45, ((loadKg - lower.kg) / span) * 0.5);
  } else {
    position =
      lower.index + ((loadKg - lower.kg) / (upper.kg - lower.kg)) * (upper.index - lower.index);
  }
  return { level, position: clampToLevel(family, level, position) };
};

/** The rung a variation enters the sheet at, or `undefined` when the family does not know it. */
const introducedAt = (family: VariantFamily, movementId: string): Level | undefined =>
  LEVELS.find((level) => family.rungs[level]?.introduces.includes(movementId));

export const knowsVariant = (family: VariantFamily, movementId: string) =>
  introducedAt(family, movementId) !== undefined || family.below.includes(movementId);

/**
 * A variation on a variant family's ruler. It meets the rung it enters at and every rung above
 * that asks for nothing new: toes-to-bar enter at Intermediate and also meet RX.
 */
export const gradeVariant = (family: VariantFamily, movementId: string): Grade | undefined => {
  const entry = introducedAt(family, movementId);
  if (entry === undefined) {
    if (!family.below.includes(movementId)) return undefined;
    return { level: undefined, position: clampToLevel(family, undefined, -1) };
  }
  const level = climb(family, (at) => {
    const rung = family.rungs[at]!;
    return levelIndex(at) <= levelIndex(entry) || rung.introduces.length === 0;
  });
  return { level, position: level === undefined ? 0 : levelIndex(level) };
};

/** Reps at or above each rung, for the "88 % jumping, 12 % kipping" split. */
export interface LevelShare {
  readonly level: Level | undefined;
  readonly reps: number;
}

/**
 * The level most reps reached: the highest rung where reps at or above it are more than half.
 * Every rep counts once, at the level of the variation it was done as.
 */
export const majorityLevel = (shares: ReadonlyArray<LevelShare>): Level | undefined => {
  const total = shares.reduce((sum, share) => sum + share.reps, 0);
  if (total === 0) return undefined;
  for (const level of [...LEVELS].reverse()) {
    const atOrAbove = shares
      .filter((share) => share.level !== undefined && levelIndex(share.level) >= levelIndex(level))
      .reduce((sum, share) => sum + share.reps, 0);
    if (atOrAbove * 2 > total) return level;
  }
  return undefined;
};

/** Reps summed per level, easiest first, below-the-sheet first of all. */
export const sumShares = (shares: ReadonlyArray<LevelShare>): ReadonlyArray<LevelShare> => {
  const order = [undefined, ...LEVELS];
  return order
    .map((level) => ({
      level,
      reps: shares
        .filter((share) => share.level === level)
        .reduce((sum, share) => sum + share.reps, 0),
    }))
    .filter((share) => share.reps > 0);
};

/** What Chalk needs to know about a movement to grade it. */
export interface GradableMovement {
  readonly id: MovementId;
  readonly levelFamily?: LevelFamilyId | undefined;
}

/** One programmed movement: its prescription lines, what was done, and the heaviest lifted set. */
export interface GradableItem {
  readonly movementId: MovementId | undefined;
  readonly sets: ReadonlyArray<{ readonly quantities: ReadonlyArray<Quantity> }>;
  readonly performance?: Performance | undefined;
  /** Heaviest set of a lift result, in kg. */
  readonly liftedKg?: number | undefined;
}

export interface PerformedGrade extends Grade {
  readonly family: LevelFamily;
  /** Reps per level, for variant families; one share for a load. */
  readonly shares: ReadonlyArray<LevelShare>;
  /** The load graded, for load families. */
  readonly loadKg?: number;
  /** The hardest variation done, with any biggest unbroken set: what the athlete can do. */
  readonly capability?: Grade & { readonly movementId: MovementId; readonly unbroken?: number };
}

export interface ItemGrade {
  readonly family: LevelFamily;
  /** What the whiteboard asked for; absent for a load family without a load written. */
  readonly prescribed: Grade | undefined;
  readonly prescribedLoadKg: number | undefined;
  /** Absent until the athlete says how it was done (or gave a lift result). */
  readonly performed: PerformedGrade | undefined;
}

/** The heaviest load written for the movement, on the athlete's side of an M/F split. */
export const prescribedLoad = (
  sets: GradableItem["sets"],
  sex: Sex = ATHLETE_SEX,
): number | undefined => {
  const loads = sets.flatMap((set) =>
    set.quantities
      .filter((quantity) => quantity.measure === "load_kg")
      .map((quantity) =>
        sex === "f" && quantity.female ? quantity.female.max : quantity.amount.max,
      ),
  );
  return loads.length === 0 ? undefined : Math.max(...loads);
};

/** Total prescribed reps, for an item done "as prescribed" without a split. */
const prescribedReps = (sets: GradableItem["sets"]) =>
  sets.reduce(
    (total, set) =>
      total +
      set.quantities
        .filter((quantity) => quantity.measure === "reps")
        .reduce((sum, quantity) => sum + quantity.amount.max, 0),
    0,
  );

const familyFor = (
  movementId: MovementId | undefined,
  movements: ReadonlyMap<MovementId, GradableMovement>,
) => {
  const id = movementId === undefined ? undefined : movements.get(movementId)?.levelFamily;
  return id === undefined ? undefined : levelFamily(id);
};

/**
 * Grades one programmed movement against the sheet: what the board asked for and, when the
 * athlete recorded it, what they did. `undefined` when the movement belongs to no family.
 */
export const gradeItem = (
  item: GradableItem,
  movements: ReadonlyMap<MovementId, GradableMovement>,
  sex: Sex = ATHLETE_SEX,
): ItemGrade | undefined => {
  const family = familyFor(item.movementId, movements);
  if (family === undefined || item.movementId === undefined) return undefined;
  const movementId = item.movementId;
  const performance = item.performance;
  const implementCount = performance?.implements ?? 1;
  const loadWritten = prescribedLoad(item.sets, sex);

  const prescribed =
    family.kind === "load"
      ? loadWritten === undefined
        ? undefined
        : gradeLoad(family, loadWritten, { implements: implementCount, movementId, sex })
      : gradeVariant(family, movementId);

  const variants =
    performance?.variants && performance.variants.some((entry) => entry.reps > 0)
      ? performance.variants.filter((entry) => entry.reps > 0)
      : undefined;
  const done = performance !== undefined || item.liftedKg !== undefined;
  if (!done) return { family, prescribed, prescribedLoadKg: loadWritten, performed: undefined };

  // A swap to another family (dumbbell thrusters for barbell ones) is graded where it belongs.
  const dominant = variants?.reduce((best, entry) => (entry.reps > best.reps ? entry : best));
  const swapped = dominant === undefined ? undefined : familyFor(dominant.movementId, movements);
  const performedFamily =
    swapped !== undefined && swapped.id !== family.id && family.kind === "load" ? swapped : family;

  let performed: PerformedGrade | undefined;
  if (performedFamily.kind === "load") {
    const loadKg = performance?.loadKg ?? item.liftedKg ?? loadWritten;
    if (loadKg !== undefined) {
      const graded = gradeLoad(performedFamily, loadKg, {
        implements: implementCount,
        movementId: dominant?.movementId ?? movementId,
        sex,
      });
      const reps = variants?.reduce((sum, entry) => sum + entry.reps, 0) ?? 1;
      performed = {
        ...graded,
        family: performedFamily,
        loadKg,
        shares: [{ level: graded.level, reps }],
      };
    }
  } else {
    const entries = variants ?? [{ movementId, reps: Math.max(1, prescribedReps(item.sets)) }];
    const graded = entries.flatMap((entry) => {
      const grade = gradeVariant(performedFamily, entry.movementId);
      return grade === undefined ? [] : [{ ...entry, grade }];
    });
    // A variation the family does not know (burpees for box jumps) counts as below the sheet.
    const unknownReps = entries
      .filter((entry) => gradeVariant(performedFamily, entry.movementId) === undefined)
      .reduce((sum, entry) => sum + entry.reps, 0);
    const shares = sumShares([
      ...graded.map((entry) => ({ level: entry.grade.level, reps: entry.reps })),
      ...(unknownReps > 0 ? [{ level: undefined, reps: unknownReps }] : []),
    ]);
    const level = majorityLevel(shares);
    const hardest = graded.reduce<(typeof graded)[number] | undefined>(
      (best, entry) =>
        best === undefined || entry.grade.position > best.grade.position ? entry : best,
      undefined,
    );
    performed = {
      level,
      position:
        level === undefined ? clampToLevel(performedFamily, undefined, -1) : levelIndex(level),
      family: performedFamily,
      shares,
      ...(hardest === undefined
        ? {}
        : {
            capability: {
              ...hardest.grade,
              movementId: hardest.movementId,
              ...(performance?.unbroken === undefined ? {} : { unbroken: performance.unbroken }),
            },
          }),
    };
  }
  return { family, prescribed, prescribedLoadKg: loadWritten, performed };
};

/**
 * The level a whole session (or block) fits, like a competition division: the lowest level
 * every graded movement reaches. `undefined` when nothing was graded.
 */
export const divisionOf = (
  grades: ReadonlyArray<Grade | undefined>,
): { readonly level: Level | undefined; readonly graded: number } | undefined => {
  const present = grades.filter((grade): grade is Grade => grade !== undefined);
  if (present.length === 0) return undefined;
  const indexes = present.map((grade) =>
    grade.level === undefined ? -1 : levelIndex(grade.level),
  );
  const lowest = Math.min(...indexes);
  return { level: lowest < 0 ? undefined : LEVELS[lowest], graded: present.length };
};

/** "42.5", "Russian 24", "2 × 22.5": how a load rung is printed on the ruler. */
export const loadRungLabel = (rung: LoadRung, sex: Sex = ATHLETE_SEX): string =>
  rung.options
    .map(
      (option) =>
        `${option.prefix ? `${option.prefix} ` : ""}${option.dual ? "2 × " : ""}${option.kg[sex]}`,
    )
    .join(" or ");

export const rungLabel = (family: LevelFamily, level: Level, sex: Sex = ATHLETE_SEX) => {
  if (family.kind === "variant") return family.rungs[level]?.label;
  const rung = family.rungs[level];
  return rung === undefined ? undefined : loadRungLabel(rung, sex);
};

/** The next rung up from `level` that is on the sheet, if any. */
export const nextLevel = (family: LevelFamily, level: Level | undefined): Level | undefined => {
  const from = level === undefined ? -1 : levelIndex(level);
  return definedLevels(family).find((candidate) => levelIndex(candidate) > from);
};

export const isChalkRung = (family: LevelFamily, level: Level) =>
  family.rungs[level]?.source === "chalk";

/** A family's five rungs as the ruler prints them; `label` is absent where the sheet has "-". */
export const familyStops = (family: LevelFamily, sex: Sex = ATHLETE_SEX) =>
  LEVELS.map((level) => ({
    level,
    short: LEVEL_SHORT[level],
    label: rungLabel(family, level, sex),
    chalk: isChalkRung(family, level),
  }));

/** "fundamentals" ... "elite", or "below" under the sheet: the data attribute the UI colours by. */
export const levelKey = (level: Level | undefined): Level | "below" => level ?? "below";

/** "Scaled", or "Under the sheet". */
export const levelName = (level: Level | undefined) =>
  level === undefined ? "Under the sheet" : LEVEL_NAMES[level];
