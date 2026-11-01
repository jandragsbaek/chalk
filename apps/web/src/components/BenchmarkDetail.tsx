import {
  BENCHMARK_SOURCES,
  estimateBenchmarkWork,
  gradeItem,
  LEVEL_SHORT,
  levelKey,
  levelName,
  workModelsFor,
  type Benchmark,
  type BenchmarkResult,
} from "@chalk/contracts";
import { LevelBadge } from "@chalk/ui/components/level-ruler.tsx";
import { useAtomValue } from "@effect/atom-react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";

import { benchmarkFacts, historyByBenchmark, historyOf, rxDivision } from "../lib/benchmarks.ts";
import { catalogLookup, type CatalogLookup } from "../lib/catalog.ts";
import { bodyOn, formatWatts, useProfile } from "../lib/power.ts";
import { useAthleteSex } from "../lib/profile.ts";
import { formatDay } from "../lib/utils.ts";
import { benchmarkResultsAtom } from "../state/benchmarks.ts";
import { levelsAtom } from "../state/strength.ts";
import { BenchmarkBoard } from "./BenchmarkBoard.tsx";
import { LogWorkoutForm } from "./LogWorkoutForm.tsx";

/** How the Rx prescription grades on GymDanmark's sheet, movement by movement. */
function RxLevels({
  benchmark,
  catalog,
}: {
  readonly benchmark: Benchmark;
  readonly catalog: CatalogLookup;
}) {
  const sex = useAthleteSex();
  const division = rxDivision(benchmark, catalog.gradable, sex);
  const graded = benchmark.blocks
    .flatMap((block) => block.items)
    .flatMap((item) => {
      const grade = gradeItem(
        { movementId: item.movementId, sets: [{ quantities: item.quantities }] },
        catalog.gradable,
        sex,
      );
      return grade?.prescribed === undefined
        ? []
        : [{ movementId: item.movementId, grade: grade.prescribed, family: grade.family.name }];
    })
    .filter(
      (entry, index, all) =>
        all.findIndex((other) => other.movementId === entry.movementId) === index,
    );
  if (division === undefined)
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        Nothing in it is on GymDanmark's sheet.
      </p>
    );
  return (
    <div className="grid gap-2 px-4 py-3 text-sm">
      <p className="flex items-center gap-2">
        <LevelBadge level={levelKey(division.level)}>
          {division.level === undefined ? "Below" : LEVEL_SHORT[division.level]}
        </LevelBadge>
        <span>
          Rx as prescribed is <strong>{levelName(division.level)}</strong>: the lowest level every
          graded movement reaches.
        </span>
      </p>
      <ul className="grid gap-1">
        {graded.map((entry) => (
          <li key={entry.movementId} className="flex items-center justify-between gap-3">
            <span>
              {catalog.nameOf(entry.movementId)}{" "}
              <span className="text-muted-foreground">({entry.family})</span>
            </span>
            <LevelBadge level={levelKey(entry.grade.level)}>
              {entry.grade.level === undefined ? "Below" : LEVEL_SHORT[entry.grade.level]}
            </LevelBadge>
          </li>
        ))}
      </ul>
    </div>
  );
}

const MODELS = workModelsFor([]);

function Attempts({ benchmark }: { readonly benchmark: Benchmark }) {
  const results = useAtomValue(benchmarkResultsAtom);
  const profile = useProfile();
  /** Estimated at the Rx prescription; a scaled attempt's loads are not recorded. */
  const wattsOf = (attempt: BenchmarkResult) => {
    if (attempt.rx === false) return undefined;
    const body = bodyOn(profile, attempt.performedOn);
    return body === undefined
      ? undefined
      : estimateBenchmarkWork(benchmark, attempt.score, body, MODELS)?.watts;
  };
  return AsyncResult.match(results, {
    onInitial: () => <p className="px-4 py-3 text-sm text-muted-foreground">Loading attempts...</p>,
    onFailure: () => (
      <p className="px-4 py-3 text-sm text-destructive">
        Could not load your attempts. Is the server running?
      </p>
    ),
    onSuccess: ({ value }) => {
      const history = historyOf(historyByBenchmark([benchmark], value), benchmark.id);
      if (history.attempts.length === 0)
        return (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            Not done yet. Log your first attempt below; it sets the time to beat.
          </p>
        );
      return (
        <ol className="grid">
          {history.attempts.map((attempt) => (
            <li
              key={attempt.workoutId}
              className="flex items-baseline justify-between gap-3 border-b px-4 py-2 text-sm"
            >
              <span>{formatDay(attempt.performedOn)}</span>
              <span className="flex items-baseline gap-2">
                {attempt === history.best ? (
                  <span data-chip data-measure="score" className="px-1.5 text-xs font-bold">
                    Best
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {attempt.imported ? "Imported" : attempt.rx ? "Rx" : "Scaled"}
                </span>
                <span className="font-bold tabular-nums">{attempt.score || "No score"}</span>
                <AttemptWatts watts={wattsOf(attempt)} />
              </span>
            </li>
          ))}
        </ol>
      );
    },
  });
}

function AttemptWatts({ watts }: { readonly watts: number | undefined }) {
  return (
    <span
      className="w-14 text-right text-xs tabular-nums text-muted-foreground"
      title="Estimated power at the Rx prescription"
    >
      {watts === undefined ? "" : formatWatts(watts)}
    </span>
  );
}

/** One benchmark: the board, how its Rx grades, the athlete's attempts, and a form to log one. */
export function BenchmarkDetail({ benchmark }: { readonly benchmark: Benchmark }) {
  const levels = useAtomValue(levelsAtom);
  const catalog = catalogLookup(AsyncResult.getOrElse(levels, () => undefined)?.movements ?? []);
  const source = BENCHMARK_SOURCES[benchmark.category];

  return (
    <main className="grid content-start gap-6 px-6 pb-16 pt-6">
      <Link
        to="/benchmarks"
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All benchmarks
      </Link>
      <header className="grid gap-2">
        <h1 className="protocol-title w-fit border-b-2 border-foreground pb-1.5 text-4xl">
          {benchmark.name}
        </h1>
        <p className="text-sm text-muted-foreground">{benchmarkFacts(benchmark).join(" · ")}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid content-start gap-6">
          <section aria-labelledby="board-title" className="grid gap-2">
            <h2 id="board-title" className="form-label text-muted-foreground">
              The board, kg male/female
            </h2>
            <div className="border bg-card">
              <BenchmarkBoard benchmark={benchmark} nameOf={catalog.nameOf} />
            </div>
          </section>
          <section aria-labelledby="posted-title" className="grid gap-2">
            <h2 id="posted-title" className="form-label text-muted-foreground">
              As posted
            </h2>
            <pre className="max-w-prose whitespace-pre-wrap font-mono text-sm">
              {benchmark.posted}
            </pre>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="w-fit text-xs text-muted-foreground underline decoration-input hover:decoration-foreground"
            >
              {source.title}
            </a>
          </section>
        </div>

        <aside className="grid content-start gap-6">
          <section aria-labelledby="levels-title" className="grid gap-2">
            <h2 id="levels-title" className="form-label text-muted-foreground">
              Rx on GymDanmark's sheet
            </h2>
            <div className="border bg-card">
              <RxLevels benchmark={benchmark} catalog={catalog} />
            </div>
          </section>
          <section aria-labelledby="attempts-title" className="grid gap-2">
            <h2 id="attempts-title" className="form-label text-muted-foreground">
              Your attempts
            </h2>
            <div className="border bg-card">
              <Attempts benchmark={benchmark} />
            </div>
          </section>
          <section aria-labelledby="log-title" className="grid gap-2">
            <h2 id="log-title" className="form-label text-muted-foreground">
              Log an attempt
            </h2>
            <LogWorkoutForm benchmark={benchmark} />
          </section>
        </aside>
      </div>
    </main>
  );
}
