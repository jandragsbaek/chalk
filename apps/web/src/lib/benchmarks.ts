import {
  benchmarkMovementIds,
  divisionOf,
  gradeItem,
  isBetterScore,
  normalizeBenchmarkName,
  parseBenchmarkScore,
  type Benchmark,
  type BenchmarkCategory,
  type BenchmarkItem,
  type BenchmarkResult,
  type GradableMovement,
  type Level,
  type MovementId,
  type Sex,
} from "@chalk/contracts";

export interface BenchmarkHistory {
  /** Newest first. */
  readonly attempts: ReadonlyArray<BenchmarkResult>;
  /** The best score that reads as one; the earliest wins a tie, since that set the record. */
  readonly best: BenchmarkResult | undefined;
}

const EMPTY: BenchmarkHistory = { attempts: [], best: undefined };

/** Attempts and the record per benchmark id. */
export const historyByBenchmark = (
  benchmarks: ReadonlyArray<Benchmark>,
  results: ReadonlyArray<BenchmarkResult>,
): ReadonlyMap<string, BenchmarkHistory> => {
  const scoringOf = new Map(benchmarks.map((benchmark) => [benchmark.id, benchmark.scoring]));
  const grouped = new Map<string, Array<BenchmarkResult>>();
  for (const result of results) {
    const list = grouped.get(result.benchmarkId) ?? [];
    list.push(result);
    grouped.set(result.benchmarkId, list);
  }
  const histories = new Map<string, BenchmarkHistory>();
  for (const [id, list] of grouped) {
    const attempts = [...list].sort((left, right) =>
      right.performedOn.localeCompare(left.performedOn),
    );
    const scoring = scoringOf.get(id as Benchmark["id"]);
    let best: { result: BenchmarkResult; value: number } | undefined;
    if (scoring !== undefined)
      for (const result of [...attempts].reverse()) {
        const value = parseBenchmarkScore(scoring, result.score);
        if (value === undefined) continue;
        if (best === undefined || isBetterScore(scoring, value, best.value))
          best = { result, value };
      }
    histories.set(id, { attempts, best: best?.result });
  }
  return histories;
};

export const historyOf = (histories: ReadonlyMap<string, BenchmarkHistory>, id: string) =>
  histories.get(id) ?? EMPTY;

export type BenchmarkFilter = BenchmarkCategory | "all" | "done";

export const BENCHMARK_FILTERS: ReadonlyArray<{
  readonly id: BenchmarkFilter;
  readonly label: string;
}> = [
  { id: "all", label: "All" },
  { id: "girl", label: "Girls" },
  { id: "hero", label: "Heroes" },
  { id: "notable", label: "Classics" },
  { id: "done", label: "Done" },
];

/**
 * Benchmarks whose name or alias contains the query, or that use a movement whose name does
 * ("pistol", "rope climb"): exact names first, then names that start with it, then the rest.
 */
export const filterBenchmarks = (
  benchmarks: ReadonlyArray<Benchmark>,
  options: {
    readonly query: string;
    readonly filter: BenchmarkFilter;
    readonly done: ReadonlySet<string>;
    readonly nameOf: (id: MovementId) => string;
  },
): ReadonlyArray<Benchmark> => {
  const query = normalizeBenchmarkName(options.query);
  const rankOf = (benchmark: Benchmark): number | undefined => {
    if (query === "") return 0;
    const names = [benchmark.name, ...benchmark.aliases].map(normalizeBenchmarkName);
    if (names.includes(query)) return 0;
    if (names.some((name) => name.startsWith(query))) return 1;
    if (names.some((name) => name.includes(query))) return 2;
    const usesMovement = benchmarkMovementIds(benchmark).some((id) =>
      normalizeBenchmarkName(options.nameOf(id)).includes(query),
    );
    return usesMovement ? 3 : undefined;
  };
  return benchmarks
    .filter((benchmark) => {
      if (options.filter === "done") return options.done.has(benchmark.id);
      return options.filter === "all" || benchmark.category === options.filter;
    })
    .flatMap((benchmark) => {
      const rank = rankOf(benchmark);
      return rank === undefined ? [] : [{ benchmark, rank }];
    })
    .sort((left, right) => left.rank - right.rank)
    .map(({ benchmark }) => benchmark);
};

/**
 * The GymDanmark division the Rx prescription fits: the lowest rung every graded movement's
 * load or variation reaches. `undefined` when nothing in it is on the sheet.
 */
export const rxDivision = (
  benchmark: Benchmark,
  movements: ReadonlyMap<MovementId, GradableMovement>,
  sex: Sex,
): { readonly level: Level | undefined; readonly graded: number } | undefined =>
  divisionOf(
    benchmark.blocks.flatMap((block) =>
      block.items.map(
        (item) =>
          gradeItem(
            { movementId: item.movementId, sets: [{ quantities: item.quantities }] },
            movements,
            sex,
          )?.prescribed,
      ),
    ),
  );

/** The movements, in order, joined: "Thruster, Pull-up". */
export const movementSummary = (benchmark: Benchmark, nameOf: (id: MovementId) => string) =>
  benchmarkMovementIds(benchmark).map(nameOf).join(", ");

/** Every movement of the benchmark, alternatives included, for grading lookups. */
export const itemsOf = (benchmark: Benchmark): ReadonlyArray<BenchmarkItem> =>
  benchmark.blocks.flatMap((block) =>
    block.items.flatMap((item) => [item, ...(item.alternatives ?? [])]),
  );
