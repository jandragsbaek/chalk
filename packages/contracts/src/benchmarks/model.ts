import * as Schema from "effect/Schema";

import type { BenchmarkId, IsoDate, MovementId } from "../baseSchemas.ts";
import type { Kg } from "../levels.ts";
import type { BlockFormat, BlockParams, Quantity } from "../sessionImport.ts";

/**
 * Named workouts: CrossFit's Girls (2003 on, plus the 2021 New Girls), the Hero and tribute
 * workouts, and a few other classics. They are reference data, like the level sheet: versioned
 * with the code, never edited in the database. Sessions point at them by id.
 */
export const BenchmarkCategory = Schema.Literals(["girl", "hero", "notable"]);
export type BenchmarkCategory = typeof BenchmarkCategory.Type;

export const BENCHMARK_CATEGORY_NAMES: Record<BenchmarkCategory, string> = {
  girl: "Girls",
  hero: "Heroes",
  notable: "Classics",
};

/** What the score counts: a time (lower wins), or rounds + reps, reps or a load (higher wins). */
export const BenchmarkScoring = Schema.Literals(["time", "rounds_reps", "reps", "load"]);
export type BenchmarkScoring = typeof BenchmarkScoring.Type;

/** One movement as prescribed, in the shapes the importer writes: quantities for one set. */
export interface BenchmarkItem {
  readonly movementId: MovementId;
  /** Reps, distance, calories, seconds and loads (kg, male with the female split). */
  readonly quantities: ReadonlyArray<Quantity>;
  /** What Chalk has no measure for: "right arm", "to 15 feet", "24/20-inch box". */
  readonly note?: string;
  /** "Row or ski": other movements that count for this one. */
  readonly alternatives?: ReadonlyArray<BenchmarkItem>;
}

/** A format and its movements; a chipper with a "then" has one block per part. */
export interface BenchmarkBlock {
  readonly title: string;
  readonly format: BlockFormat;
  readonly params: BlockParams;
  readonly items: ReadonlyArray<BenchmarkItem>;
  /** Instructions as posted: "Rest 3 minutes between rounds.", "Partition as needed." */
  readonly intents: ReadonlyArray<string>;
}

export interface Benchmark {
  readonly id: BenchmarkId;
  readonly name: string;
  /** Other names a board uses ("Seven" for The Seven); matched like the name. */
  readonly aliases: ReadonlyArray<string>;
  readonly category: BenchmarkCategory;
  readonly scoring: BenchmarkScoring;
  readonly timeCapSeconds?: number;
  /** First posted on CrossFit.com, when the source says. */
  readonly firstPosted?: IsoDate;
  /** Athletes sharing the work (2 for a partner workout); absent when done alone. */
  readonly team?: number;
  /** Weight vest per side of M/F; `optional` when the board says "if you've got one". */
  readonly vest?: { readonly kg: Kg; readonly optional: boolean };
  /** The prescription as CrossFit posted it, units as written (pounds, inches). */
  readonly posted: string;
  readonly blocks: ReadonlyArray<BenchmarkBlock>;
}

/** Where the official prescriptions come from. */
export const BENCHMARK_SOURCES = {
  girl: {
    title: "CrossFit FAQ: the Girls",
    url: "https://www.crossfit.com/faq/wod",
  },
  hero: {
    title: "CrossFit Hero Workouts (revision 20260504R1KW)",
    url: "https://www.crossfit.com/heroes",
  },
  notable: {
    title: "CrossFit.com",
    url: "https://www.crossfit.com",
  },
} as const satisfies Record<BenchmarkCategory, { title: string; url: string }>;
