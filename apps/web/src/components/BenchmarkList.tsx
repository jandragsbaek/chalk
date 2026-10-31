import {
  BENCHMARK_CATEGORY_NAMES,
  BENCHMARKS,
  LEVEL_SHORT,
  levelKey,
  levelName,
  type Benchmark,
} from "@chalk/contracts";
import { Input } from "@chalk/ui/components/field.tsx";
import { LevelBadge } from "@chalk/ui/components/level-ruler.tsx";
import { useAtomValue } from "@effect/atom-react";
import { Link } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";

import {
  BENCHMARK_FILTERS,
  filterBenchmarks,
  historyByBenchmark,
  historyOf,
  movementSummary,
  rxDivision,
  type BenchmarkFilter,
  type BenchmarkHistory,
} from "../lib/benchmarks.ts";
import { catalogLookup, type CatalogLookup } from "../lib/catalog.ts";
import { formatDay } from "../lib/utils.ts";
import { benchmarkResultsAtom } from "../state/benchmarks.ts";
import { levelsAtom } from "../state/strength.ts";

function DivisionBadge({
  benchmark,
  catalog,
}: {
  readonly benchmark: Benchmark;
  readonly catalog: CatalogLookup;
}) {
  const division = rxDivision(benchmark, catalog.gradable);
  if (division === undefined)
    return <span className="text-xs text-muted-foreground">Not graded</span>;
  return (
    <LevelBadge
      level={levelKey(division.level)}
      title={`Rx as prescribed is ${levelName(division.level)} on GymDanmark's sheet (${division.graded} graded)`}
    >
      {division.level === undefined ? "Below" : LEVEL_SHORT[division.level]}
    </LevelBadge>
  );
}

function BenchmarkRow({
  benchmark,
  history,
  catalog,
}: {
  readonly benchmark: Benchmark;
  readonly history: BenchmarkHistory;
  readonly catalog: CatalogLookup;
}) {
  const first = benchmark.blocks.find((block) => block.format !== "rest");
  return (
    <li>
      <Link
        to="/benchmarks/$benchmarkId"
        params={{ benchmarkId: benchmark.id }}
        data-benchmark-row
        className="hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <span className="grid gap-0.5">
          <span className="font-bold">{benchmark.name}</span>
          <span className="form-label text-muted-foreground">
            {BENCHMARK_CATEGORY_NAMES[benchmark.category]}
            {benchmark.team ? ` · team of ${benchmark.team}` : ""}
          </span>
        </span>
        <span className="grid min-w-0 gap-0.5 text-sm">
          <span className="font-semibold">
            {first?.title}
            {benchmark.blocks.length > 1 ? ` + ${benchmark.blocks.length - 1} more` : ""}
          </span>
          <span className="truncate text-muted-foreground">
            {movementSummary(benchmark, catalog.nameOf)}
          </span>
        </span>
        <span>
          <DivisionBadge benchmark={benchmark} catalog={catalog} />
        </span>
        <span className="grid justify-items-end gap-0.5 text-right">
          {history.best ? (
            <>
              <span className="font-bold tabular-nums">{history.best.score}</span>
              <span className="text-xs text-muted-foreground">
                {formatDay(history.best.performedOn)} ·{" "}
                {history.attempts.length === 1
                  ? "1 attempt"
                  : `${history.attempts.length} attempts`}
              </span>
            </>
          ) : history.attempts.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {history.attempts.length} without a score
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Not done</span>
          )}
        </span>
      </Link>
    </li>
  );
}

/**
 * Every named workout: the Girls, the Heroes and the classics, searchable by name or movement,
 * each with its Rx level on GymDanmark's sheet and the athlete's best.
 */
export function BenchmarkList({
  query,
  filter,
  onSearch,
}: {
  readonly query: string;
  readonly filter: BenchmarkFilter;
  readonly onSearch: (search: { readonly q: string; readonly filter: BenchmarkFilter }) => void;
}) {
  const levels = useAtomValue(levelsAtom);
  const results = useAtomValue(benchmarkResultsAtom);
  const catalog = catalogLookup(AsyncResult.getOrElse(levels, () => undefined)?.movements ?? []);
  const histories = historyByBenchmark(
    BENCHMARKS,
    AsyncResult.getOrElse(results, () => []),
  );
  const done = new Set(histories.keys());
  const shown = filterBenchmarks(BENCHMARKS, { query, filter, done, nameOf: catalog.nameOf });

  return (
    <main className="grid content-start">
      <header className="flex flex-wrap items-end justify-between gap-4 px-6 pb-4 pt-8">
        <div className="grid gap-2">
          <h1 className="protocol-title border-b-2 border-foreground pb-1.5 text-4xl">
            Benchmarks
          </h1>
          <p className="text-sm text-muted-foreground">
            {BENCHMARKS.length} named workouts, {done.size} done.
          </p>
        </div>
        <label className="grid w-full max-w-sm gap-1">
          <span className="form-label text-muted-foreground">Name or movement</span>
          <Input
            type="search"
            placeholder="Fran, Murph, rope climb..."
            autoComplete="off"
            value={query}
            onChange={(event) => onSearch({ q: event.target.value, filter })}
          />
        </label>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-x-6 border-y bg-card px-6">
        <div role="tablist" aria-label="Benchmark groups" className="flex flex-wrap">
          {BENCHMARK_FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={filter === option.id}
              data-level-tab
              onClick={() => onSearch({ q: query, filter: option.id })}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="py-2 text-xs text-muted-foreground">
          {shown.length === BENCHMARKS.length ? "All shown" : `${shown.length} shown`}
        </span>
      </div>

      {AsyncResult.isFailure(results) ? (
        <p className="px-6 py-3 text-sm text-destructive">
          Could not load your results. Is the server running?
        </p>
      ) : null}

      {shown.length === 0 ? (
        <p className="px-6 py-10 text-sm text-muted-foreground">
          {filter === "done" && done.size === 0
            ? "No benchmark logged yet. Pick one and log it from its page."
            : "Nothing matches. Try a shorter name or a movement."}
        </p>
      ) : (
        <ul aria-label="Benchmarks">
          <li aria-hidden data-benchmark-row data-head className="form-label text-muted-foreground">
            <span>Workout</span>
            <span>Format and movements</span>
            <span>Rx level</span>
            <span className="text-right">Your best</span>
          </li>
          {shown.map((benchmark) => (
            <BenchmarkRow
              key={benchmark.id}
              benchmark={benchmark}
              history={historyOf(histories, benchmark.id)}
              catalog={catalog}
            />
          ))}
        </ul>
      )}

      <footer className="px-6 pb-16 pt-6 text-xs text-muted-foreground">
        Prescriptions from CrossFit's list of the Girls and its Hero Workouts (May 2026), loads in
        kilograms as a kilo box loads them. Rx level: the lowest rung on GymDanmark's sheet that
        every graded movement of the Rx prescription reaches.
      </footer>
    </main>
  );
}
