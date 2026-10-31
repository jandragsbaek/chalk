import { BenchmarkId, MovementId } from "../baseSchemas.ts";
import type { BlockFormat, BlockParams, Quantity } from "../sessionImport.ts";
import type {
  Benchmark,
  BenchmarkBlock,
  BenchmarkCategory,
  BenchmarkItem,
  BenchmarkScoring,
} from "./model.ts";
import type { BenchmarkMovementId } from "./movementIds.ts";

/**
 * Authoring helpers for the benchmark data files. Loads are taken as posted, in pounds, male
 * first (Chalk writes "43/29", CrossFit's sheet writes the female load first), and converted
 * the way a kilo box loads them: barbells to the nearest kilo, dumbbells to 2.5 kg steps,
 * kettlebells, medicine balls and plates to the implement that exists.
 */

const LB = 0.45359237;
const exact = (amount: number) => ({ min: amount, max: amount });

const nearest = (step: number) => (pounds: number) => Math.round((pounds * LB) / step) * step;

const fromTable = (table: Readonly<Record<number, number>>, fallback: (lb: number) => number) => {
  return (pounds: number) => table[pounds] ?? fallback(pounds);
};

const KETTLEBELLS: Readonly<Record<number, number>> = {
  18: 8,
  26: 12,
  35: 16,
  44: 20,
  53: 24,
  62: 28,
  70: 32,
  88: 40,
  106: 48,
};
const MEDICINE_BALLS: Readonly<Record<number, number>> = {
  10: 4,
  12: 5,
  14: 6,
  16: 7,
  20: 9,
  25: 11,
  30: 14,
};
const PLATES: Readonly<Record<number, number>> = { 10: 5, 25: 10, 35: 15, 45: 20, 55: 25 };

const loadOf = (convert: (pounds: number) => number) => (male: number, female?: number) =>
  load(convert(male), female === undefined ? undefined : convert(female));

/** A load in kilograms, male then female. */
export const load = (male: number, female?: number): Quantity => ({
  measure: "load_kg",
  amount: exact(male),
  ...(female === undefined ? {} : { female: exact(female) }),
});

/** Barbell in pounds, to the nearest kilo: 95/65 lb is 43/29 kg. */
export const bb = loadOf(nearest(1));
/** Dumbbells in pounds, to 2.5 kg steps: 50/35 lb is 22.5/15 kg. */
export const db = loadOf(nearest(2.5));
/** Kettlebell in pounds, as the bell that exists: 53/35 lb is 24/16 kg. */
export const kb = loadOf(fromTable(KETTLEBELLS, nearest(4)));
/** Kettlebell in pood: 1.5/1 pood is 24/16 kg. */
export const pood = (male: number, female?: number) =>
  load(male * 16, female === undefined ? undefined : female * 16);
/** Medicine ball in pounds: 20/14 lb is 9/6 kg. */
export const ball = loadOf(fromTable(MEDICINE_BALLS, nearest(1)));
/** Bumper plate in pounds: 45/25 lb is 20/10 kg. */
export const plate = loadOf(fromTable(PLATES, nearest(5)));
/** Sandbags, backpacks, vests and other odd objects in pounds, to the nearest kilo. */
export const object = loadOf(nearest(1));

/** Reps per round; an array is a scheme for this movement alone ("21-15-9"). */
export const reps = (count: number | ReadonlyArray<number>, female?: number): Quantity =>
  typeof count === "number"
    ? {
        measure: "reps",
        amount: exact(count),
        ...(female === undefined ? {} : { female: exact(female) }),
      }
    : {
        measure: "reps",
        amount: exact(count.reduce((sum, value) => sum + value, 0)),
        scheme: count,
      };

export const cal = (male: number, female?: number): Quantity => ({
  measure: "calories",
  amount: exact(male),
  ...(female === undefined ? {} : { female: exact(female) }),
});

export const meters = (male: number, female?: number): Quantity => ({
  measure: "distance_m",
  amount: exact(male),
  ...(female === undefined ? {} : { female: exact(female) }),
});
export const km = (count: number) => meters(count * 1000);
export const miles = (count: number) => meters(Math.round(count * 1609.344));
export const yards = (count: number) => meters(Math.round(count * 0.9144 * 10) / 10);
export const feet = (count: number) => meters(Math.round(count * 0.3048 * 10) / 10);

export const seconds = (count: number): Quantity => ({ measure: "seconds", amount: exact(count) });
export const minutes = (count: number) => seconds(count * 60);

export interface ItemOptions {
  readonly note?: string;
  readonly or?: ReadonlyArray<BenchmarkItem>;
}

const isQuantity = (value: Quantity | ItemOptions): value is Quantity => "measure" in value;

/** One movement: `mv("thruster", reps(21), bb(95, 65))`, options last. */
export const mv = (
  movementId: BenchmarkMovementId,
  ...args: ReadonlyArray<Quantity | ItemOptions>
): BenchmarkItem => {
  const quantities = args.filter(isQuantity);
  const options = args.filter((arg): arg is ItemOptions => !isQuantity(arg));
  const note = options.find((option) => option.note !== undefined)?.note;
  const alternatives = options.flatMap((option) => option.or ?? []);
  return {
    movementId: MovementId.make(movementId),
    quantities,
    ...(note === undefined ? {} : { note }),
    ...(alternatives.length === 0 ? {} : { alternatives }),
  };
};

export interface BlockOptions {
  /** Replaces the title made from the format ("5 rounds, each for time"). */
  readonly title?: string;
  /** Instructions as posted, one sentence each. */
  readonly intents?: ReadonlyArray<string>;
  /** Rest between rounds, when the board prescribes it. */
  readonly restSeconds?: number;
}

const formatSeconds = (total: number) => {
  if (total % 60 !== 0) return `${total} sec`;
  return `${total / 60} min`;
};

/** Any format; the helpers below cover the common ones. */
export const block = (
  format: BlockFormat,
  params: BlockParams,
  title: string,
  items: ReadonlyArray<BenchmarkItem>,
  options: BlockOptions = {},
): BenchmarkBlock => ({
  title: options.title ?? title,
  format,
  params:
    options.restSeconds === undefined ? params : { ...params, restSeconds: options.restSeconds },
  items,
  intents: options.intents ?? [],
});

export const forTime = (items: ReadonlyArray<BenchmarkItem>, options?: BlockOptions) =>
  block("for_time", {}, "For time", items, options);

export const rounds = (
  count: number,
  items: ReadonlyArray<BenchmarkItem>,
  options?: BlockOptions,
) => block("for_time", { rounds: exact(count) }, `${count} rounds for time`, items, options);

/** Every movement follows the scheme: 21-15-9 thrusters and pull-ups. */
export const ladder = (
  scheme: ReadonlyArray<number>,
  items: ReadonlyArray<BenchmarkItem>,
  options?: BlockOptions,
) => block("for_time", { scheme }, `${scheme.join("-")} reps for time`, items, options);

export const amrap = (
  durationMinutes: number,
  items: ReadonlyArray<BenchmarkItem>,
  options?: BlockOptions,
) =>
  block(
    "amrap",
    { durationSeconds: durationMinutes * 60 },
    `AMRAP ${durationMinutes} min`,
    items,
    options,
  );

export const emom = (
  durationMinutes: number,
  items: ReadonlyArray<BenchmarkItem>,
  options?: BlockOptions,
) =>
  block(
    "emom",
    { durationSeconds: durationMinutes * 60, intervalSeconds: 60 },
    `EMOM ${durationMinutes} min`,
    items,
    options,
  );

/** "Every 3 minutes for 5 rounds". */
export const every = (
  intervalSeconds: number,
  count: number,
  items: ReadonlyArray<BenchmarkItem>,
  options?: BlockOptions,
) =>
  block(
    "every",
    { intervalSeconds, rounds: exact(count) },
    `Every ${formatSeconds(intervalSeconds)} × ${count}`,
    items,
    options,
  );

/** Work and rest per station or round, as in Fight Gone Bad or a Tabata. */
export const intervals = (
  timing: { readonly workSeconds: number; readonly restSeconds?: number; readonly rounds: number },
  items: ReadonlyArray<BenchmarkItem>,
  options?: BlockOptions,
) =>
  block(
    "intervals",
    {
      workSeconds: timing.workSeconds,
      ...(timing.restSeconds === undefined ? {} : { restSeconds: timing.restSeconds }),
      rounds: exact(timing.rounds),
    },
    `${formatSeconds(timing.workSeconds)} on${
      timing.restSeconds === undefined ? "" : ` / ${formatSeconds(timing.restSeconds)} off`
    } × ${timing.rounds}`,
    items,
    options,
  );

export const rest = (durationSeconds: number) =>
  block("rest", { durationSeconds }, `Rest ${formatSeconds(durationSeconds)}`, []);

/** "Mr. Joshua" → "mr-joshua", "Jack’s Triangle" → "jacks-triangle", "René" → "rene". */
export const benchmarkSlug = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export interface BenchmarkDefinition {
  readonly name: string;
  readonly posted: string;
  readonly blocks: ReadonlyArray<BenchmarkBlock>;
  /** "2003-08-25"; leave out when the source gives no date. */
  readonly firstPosted?: string;
  /** Derived from the blocks when left out: an AMRAP scores rounds + reps, else a time. */
  readonly scoring?: BenchmarkScoring;
  readonly aliases?: ReadonlyArray<string>;
  readonly timeCapMinutes?: number;
  readonly team?: number;
  /** Vest in pounds, male then female. */
  readonly vest?: {
    readonly lb: readonly [male: number, female: number];
    readonly optional: boolean;
  };
}

const scoringOf = (blocks: ReadonlyArray<BenchmarkBlock>): BenchmarkScoring => {
  if (blocks.some((entry) => entry.format === "amrap")) return "rounds_reps";
  if (blocks.some((entry) => entry.format === "for_time")) return "time";
  return "reps";
};

const vestKg = nearest(1);

const define =
  (category: BenchmarkCategory) =>
  (definition: BenchmarkDefinition): Benchmark => ({
    id: BenchmarkId.make(benchmarkSlug(definition.name)),
    name: definition.name,
    aliases: definition.aliases ?? [],
    category,
    scoring: definition.scoring ?? scoringOf(definition.blocks),
    ...(definition.timeCapMinutes === undefined
      ? {}
      : { timeCapSeconds: definition.timeCapMinutes * 60 }),
    ...(definition.firstPosted === undefined ? {} : { firstPosted: definition.firstPosted }),
    ...(definition.team === undefined ? {} : { team: definition.team }),
    ...(definition.vest === undefined
      ? {}
      : {
          vest: {
            kg: { m: vestKg(definition.vest.lb[0]), f: vestKg(definition.vest.lb[1]) },
            optional: definition.vest.optional,
          },
        }),
    posted: definition.posted.trim(),
    blocks: definition.blocks,
  });

export const girl = define("girl");
export const hero = define("hero");
export const notable = define("notable");
