import {
  BENCHMARK_CATEGORY_NAMES,
  BENCHMARKS,
  benchmarkWorkoutKind,
  findBenchmark,
  type Benchmark,
  type BenchmarkCategory,
  type MovementId,
} from "@chalk/contracts";
import {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
} from "@chalk/ui/components/autocomplete.tsx";
import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useState } from "react";

import {
  benchmarkFacts,
  filterBenchmarks,
  historyByBenchmark,
  historyOf,
  movementSummary,
  type BenchmarkHistory,
} from "../lib/benchmarks.ts";
import { catalogLookup } from "../lib/catalog.ts";
import { formatDay } from "../lib/utils.ts";
import { WORKOUT_KIND_LABELS } from "../lib/workoutKinds.ts";
import { benchmarkResultsAtom } from "../state/benchmarks.ts";
import { levelsAtom } from "../state/strength.ts";
import { BenchmarkBoard } from "./BenchmarkBoard.tsx";

interface BenchmarkGroup {
  readonly category: BenchmarkCategory;
  readonly items: ReadonlyArray<Benchmark>;
}

const GROUPS: ReadonlyArray<BenchmarkGroup> = (
  Object.keys(BENCHMARK_CATEGORY_NAMES) as ReadonlyArray<BenchmarkCategory>
).map((category) => ({
  category,
  items: BENCHMARKS.filter((benchmark) => benchmark.category === category),
}));

const NOTHING_DONE: ReadonlySet<string> = new Set();

/**
 * The workout name: free text, with every benchmark offered as you type. The popup lists them
 * by group on the left and prints the one under the pointer or the arrow keys on the right, as
 * its board, so you see what Fran is before you pick it.
 */
export function WorkoutPicker({
  id,
  value,
  onValueChange,
}: {
  readonly id: string;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
}) {
  const [highlighted, setHighlighted] = useState<Benchmark>();
  const levels = useAtomValue(levelsAtom);
  const results = useAtomValue(benchmarkResultsAtom);
  const catalog = catalogLookup(AsyncResult.getOrElse(levels, () => undefined)?.movements ?? []);
  const histories = historyByBenchmark(
    BENCHMARKS,
    AsyncResult.getOrElse(results, () => []),
  );
  const shown = GROUPS.map((group) => ({
    ...group,
    items: filterBenchmarks(group.items, {
      query: value,
      filter: "all",
      done: NOTHING_DONE,
      nameOf: catalog.nameOf,
    }),
  })).filter((group) => group.items.length > 0);
  const previewed = highlighted ?? findBenchmark(value);

  return (
    <Autocomplete
      items={GROUPS}
      filteredItems={shown}
      value={value}
      onValueChange={onValueChange}
      onItemHighlighted={setHighlighted}
      itemToStringValue={(benchmark) => benchmark.name}
      openOnInputClick
      keepHighlight
    >
      <AutocompleteInput
        id={id}
        placeholder="Fran, Back squat, Today's WOD..."
        autoComplete="off"
      />
      <AutocompletePopup>
        <div className="grid sm:h-104 sm:grid-cols-[minmax(11rem,2fr)_3fr]">
          <div className="flex min-h-0 flex-col sm:border-r">
            <AutocompleteList className="max-h-[min(18rem,var(--available-height))] min-h-0 flex-1 sm:max-h-none">
              {(group: BenchmarkGroup) => (
                <AutocompleteGroup key={group.category} items={group.items}>
                  <AutocompleteGroupLabel>
                    {BENCHMARK_CATEGORY_NAMES[group.category]}
                  </AutocompleteGroupLabel>
                  <AutocompleteCollection>
                    {(benchmark: Benchmark) => (
                      <AutocompleteItem key={benchmark.id} value={benchmark}>
                        <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3">
                          <span className="truncate font-semibold">{benchmark.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {WORKOUT_KIND_LABELS[benchmarkWorkoutKind(benchmark)]}
                          </span>
                          <span className="col-span-2 truncate text-xs text-muted-foreground sm:sr-only">
                            {movementSummary(benchmark, catalog.nameOf)}
                          </span>
                        </span>
                      </AutocompleteItem>
                    )}
                  </AutocompleteCollection>
                </AutocompleteGroup>
              )}
            </AutocompleteList>
          </div>
          <div aria-hidden className="hidden min-h-0 overflow-y-auto sm:block">
            {previewed ? (
              <BenchmarkPreview
                benchmark={previewed}
                history={historyOf(histories, previewed.id)}
                nameOf={catalog.nameOf}
              />
            ) : (
              <p className="grid h-full place-items-center px-6 text-center text-sm text-balance text-muted-foreground">
                Point at a workout to read its board: rounds, reps and Rx loads.
              </p>
            )}
          </div>
        </div>
        <div className="hidden items-center gap-3 border-t px-2.5 py-1.5 text-xs text-muted-foreground sm:flex">
          <span className="flex items-center gap-1">
            <kbd data-key>↑</kbd>
            <kbd data-key>↓</kbd>
            browse
          </span>
          <span className="flex items-center gap-1">
            <kbd data-key>↵</kbd>
            pick
          </span>
          <span className="ml-auto">Not listed? Type any name to log your own.</span>
        </div>
      </AutocompletePopup>
    </Autocomplete>
  );
}

/** One benchmark as its page prints it, cut to what helps you pick: facts, board, your best. */
function BenchmarkPreview({
  benchmark,
  history,
  nameOf,
}: {
  readonly benchmark: Benchmark;
  readonly history: BenchmarkHistory;
  readonly nameOf: (id: MovementId) => string;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="grid gap-1.5 px-4 pt-3 pb-2.5">
        <h3 className="protocol-title text-xl">{benchmark.name}</h3>
        <p className="form-label text-muted-foreground">{benchmarkFacts(benchmark).join(" · ")}</p>
      </header>
      <BenchmarkBoard benchmark={benchmark} nameOf={nameOf} />
      <footer className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-2.5 text-sm">
        {history.best ? (
          <>
            <span className="form-label text-muted-foreground">Your best</span>
            <span data-chip data-measure="score" className="px-1.5 font-bold leading-6">
              {history.best.score}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              {formatDay(history.best.performedOn)} ·{" "}
              {history.attempts.length === 1 ? "1 attempt" : `${history.attempts.length} attempts`}
            </span>
          </>
        ) : history.attempts.length > 0 ? (
          <span className="text-muted-foreground">
            {history.attempts.length === 1
              ? "Done once, without a score."
              : `Done ${history.attempts.length} times, without a score.`}
          </span>
        ) : (
          <span className="text-muted-foreground">
            Not done yet. This one sets the mark to beat.
          </span>
        )}
      </footer>
    </div>
  );
}
