import * as Schema from "effect/Schema";

import { BenchmarkId, type MovementId } from "../baseSchemas.ts";
import type { WorkoutKind } from "../workout.ts";
import { GIRLS } from "./girls.ts";
import { HEROES } from "./heroes/index.ts";
import type { Benchmark, BenchmarkItem, BenchmarkScoring } from "./model.ts";
import { NOTABLES } from "./notables.ts";

export * from "./model.ts";
export { BENCHMARK_MOVEMENT_IDS, type BenchmarkMovementId } from "./movementIds.ts";
export { benchmarkSlug } from "./dsl.ts";

/** Every named workout Chalk knows: the Girls, the Heroes, then the other classics. */
export const BENCHMARKS: ReadonlyArray<Benchmark> = [...GIRLS, ...HEROES, ...NOTABLES];

const BY_ID = new Map<string, Benchmark>(BENCHMARKS.map((benchmark) => [benchmark.id, benchmark]));

export const benchmarkById = (id: BenchmarkId | string): Benchmark | undefined => BY_ID.get(id);

/** A benchmark id Chalk knows; for payloads, so a log never points at a missing workout. */
export const KnownBenchmarkId = BenchmarkId.check(
  Schema.makeFilter((id) => BY_ID.has(id) || `${id} is not a known benchmark`),
);

/** "Mr. Joshua", "mr joshua" and "MR JOSHUA:" are one name; "Jack’s Triangle" is "jacks triangle". */
export const normalizeBenchmarkName = (name: string): string =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const BY_NAME = new Map<string, Benchmark>(
  BENCHMARKS.flatMap((benchmark) =>
    [benchmark.name, ...benchmark.aliases].map(
      (name) => [normalizeBenchmarkName(name), benchmark] as const,
    ),
  ),
);

/** The benchmark a phrase names exactly (name or alias), ignoring case and punctuation. */
export const findBenchmark = (phrase: string): Benchmark | undefined =>
  BY_NAME.get(normalizeBenchmarkName(phrase));

const itemsOf = (item: BenchmarkItem): ReadonlyArray<BenchmarkItem> => [
  item,
  ...(item.alternatives ?? []).flatMap(itemsOf),
];

/** Each movement a benchmark uses, alternatives included, in order of first use. */
export const benchmarkMovementIds = (benchmark: Benchmark): ReadonlyArray<MovementId> => [
  ...new Set(
    benchmark.blocks.flatMap((block) =>
      block.items.flatMap(itemsOf).map((item) => item.movementId),
    ),
  ),
];

/** The workout kind a logged benchmark gets, for lists that group by kind. */
export const benchmarkWorkoutKind = (benchmark: Benchmark): WorkoutKind => {
  switch (benchmark.scoring) {
    case "time":
      return "for_time";
    case "rounds_reps":
      return "amrap";
    case "load":
      return "strength";
    case "reps":
      return benchmark.blocks.some((block) => block.format === "emom") ? "emom" : "other";
  }
};

export const SCORE_PLACEHOLDERS: Record<BenchmarkScoring, string> = {
  time: "4:32",
  rounds_reps: "12+5",
  reps: "320",
  load: "100 kg",
};

const TIME = /(\d+):(\d{1,2})(?::(\d{1,2}))?/;
const ROUNDS_REPS = /(\d+)\s*(?:\+\s*(\d+)|(?:rounds?|rds?|r)\b\s*(?:\+?\s*(\d+))?)/i;
const NUMBER = /(\d+(?:[.,]\d+)?)/;
const LB = /\d\s*lbs?\b/i;

/**
 * The number a score stands for, to rank attempts: seconds for a time, rounds × 1000 + reps,
 * reps, or kilograms. `undefined` when the text has none ("DNF", empty).
 */
export const parseBenchmarkScore = (
  scoring: BenchmarkScoring,
  text: string,
): number | undefined => {
  switch (scoring) {
    case "time": {
      const match = TIME.exec(text);
      if (!match) return undefined;
      const [first, second, third] = [match[1], match[2], match[3]].map(Number);
      return match[3] === undefined ? first! * 60 + second! : first! * 3600 + second! * 60 + third!;
    }
    case "rounds_reps": {
      const match = ROUNDS_REPS.exec(text);
      if (match) return Number(match[1]) * 1000 + Number(match[2] ?? match[3] ?? 0);
      const bare = NUMBER.exec(text);
      return bare ? Number(bare[1]) * 1000 : undefined;
    }
    case "reps": {
      const match = NUMBER.exec(text);
      return match ? Number(match[1]!.replace(",", ".")) : undefined;
    }
    case "load": {
      const match = NUMBER.exec(text);
      if (!match) return undefined;
      const value = Number(match[1]!.replace(",", "."));
      return LB.test(text) ? Math.round(value * 0.45359237 * 4) / 4 : value;
    }
  }
};

/** True when `candidate` beats `best`: a lower time, or more of anything else. */
export const isBetterScore = (scoring: BenchmarkScoring, candidate: number, best: number) =>
  scoring === "time" ? candidate < best : candidate > best;
