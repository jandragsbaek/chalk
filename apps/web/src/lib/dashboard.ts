import {
  benchmarkById,
  isBetterScore,
  parseBenchmarkScore,
  REP_MAX_TARGETS,
  type BenchmarkResult,
  type LiftSet,
  type Movement,
  type MovementId,
  type Workout,
} from "@chalk/contracts";

import { bestToDate, isEstimable, sessionEstimates, toDate } from "./progress.ts";
import { localIsoDate } from "./utils.ts";

/**
 * The front page reads everything from data the client already has: workouts, lift sets and
 * benchmark attempts. Weeks start on Monday (ISO), and every day is the athlete's local
 * calendar day, as `performedOn` is.
 */

/** One calendar day with what was trained on it. */
export interface TrainingDay {
  readonly iso: string;
  readonly workouts: ReadonlyArray<Workout>;
  /** Movements with lift sets that day, in first-logged order. */
  readonly liftMovementIds: ReadonlyArray<MovementId>;
  /**
   * Sessions that day: its workouts, or one for a day with only lift sets. Lift sets logged next
   * to a workout are taken as part of it, since an imported session writes both.
   */
  readonly sessions: number;
}

export function trainingDays(
  workouts: ReadonlyArray<Workout>,
  liftSets: ReadonlyArray<LiftSet>,
): ReadonlyMap<string, TrainingDay> {
  const workoutsByDay = new Map<string, Workout[]>();
  for (const workout of workouts) {
    const day = workoutsByDay.get(workout.performedOn);
    if (day) day.push(workout);
    else workoutsByDay.set(workout.performedOn, [workout]);
  }
  const liftsByDay = new Map<string, MovementId[]>();
  for (const set of [...liftSets].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const day = liftsByDay.get(set.performedOn);
    if (!day) liftsByDay.set(set.performedOn, [set.movementId]);
    else if (!day.includes(set.movementId)) day.push(set.movementId);
  }
  const days = new Map<string, TrainingDay>();
  for (const iso of new Set([...workoutsByDay.keys(), ...liftsByDay.keys()])) {
    const dayWorkouts = workoutsByDay.get(iso) ?? [];
    const liftMovementIds = liftsByDay.get(iso) ?? [];
    days.set(iso, {
      iso,
      workouts: dayWorkouts,
      liftMovementIds,
      sessions: Math.max(dayWorkouts.length, liftMovementIds.length > 0 ? 1 : 0),
    });
  }
  return days;
}

/** Days from `date`, on the calendar (DST-safe). */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Monday of the week `date` falls in. */
export function weekStart(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

/** ISO 8601 week number. */
export function isoWeek(date: Date): number {
  const thursday = addDays(date, 3 - ((date.getDay() + 6) % 7));
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  return 1 + Math.round((thursday.getTime() - weekStart(firstThursday).getTime()) / 6048e5 - 0.5);
}

/** The week's seven days, Monday first, as IsoDates. */
export function weekDays(date: Date): ReadonlyArray<string> {
  const monday = weekStart(date);
  return Array.from({ length: 7 }, (_, index) => localIsoDate(addDays(monday, index)));
}

/** `count` weeks ending with the week of `today`, oldest first. */
export function calendarWeeks(today: Date, count: number): ReadonlyArray<ReadonlyArray<string>> {
  const monday = weekStart(today);
  return Array.from({ length: count }, (_, index) =>
    weekDays(addDays(monday, (index - count + 1) * 7)),
  );
}

export interface Consistency {
  readonly thisWeek: number;
  readonly lastWeek: number;
  readonly last30Days: number;
  /** Days trained in the grid's year (`yearDays` days ending today). */
  readonly lastYear: number;
  /**
   * Consecutive weeks with at least one training day, ending this week. A week still under way
   * with nothing in it yet does not break the run.
   */
  readonly runWeeks: number;
  readonly bestRunWeeks: number;
}

const countDays = (days: ReadonlyMap<string, TrainingDay>, isos: ReadonlyArray<string>) =>
  isos.filter((iso) => (days.get(iso)?.sessions ?? 0) > 0).length;

export function consistency(
  days: ReadonlyMap<string, TrainingDay>,
  today: Date,
  yearDays: number,
): Consistency {
  const todayIso = localIsoDate(today);
  const thisWeek = countDays(days, weekDays(today));
  const lastWeek = countDays(days, weekDays(addDays(today, -7)));
  const lastN = (n: number) =>
    Array.from({ length: n }, (_, index) => localIsoDate(addDays(today, -index)));

  const trained = [...days.values()].filter((day) => day.sessions > 0 && day.iso <= todayIso);
  const weekKeys = new Set(trained.map((day) => localIsoDate(weekStart(toDate(day.iso)))));
  const weekKey = (date: Date) => localIsoDate(weekStart(date));

  let runWeeks = 0;
  let cursor = thisWeek > 0 ? today : addDays(today, -7);
  while (weekKeys.has(weekKey(cursor))) {
    runWeeks += 1;
    cursor = addDays(cursor, -7);
  }

  let bestRunWeeks = 0;
  let run = 0;
  let previous: Date | undefined;
  for (const key of [...weekKeys].sort()) {
    const monday = toDate(key);
    run = previous && localIsoDate(addDays(previous, 7)) === key ? run + 1 : 1;
    bestRunWeeks = Math.max(bestRunWeeks, run);
    previous = monday;
  }

  return {
    thisWeek,
    lastWeek,
    last30Days: countDays(days, lastN(30)),
    lastYear: countDays(days, lastN(yearDays)),
    runWeeks,
    bestRunWeeks,
  };
}

/** A set that beat an earlier rep max, or a benchmark attempt that beat an earlier best. */
export type PersonalRecord =
  | {
      readonly kind: "lift";
      readonly performedOn: string;
      readonly movementId: MovementId;
      /** The rep max it set: 1, 2, 3, 5 or 10. */
      readonly reps: number;
      readonly loadKg: number;
      /** Set with more reps than `reps`: an implied max, marked `*`. */
      readonly implied: boolean;
      readonly previousKg: number;
    }
  | {
      readonly kind: "benchmark";
      readonly performedOn: string;
      readonly benchmarkId: string;
      readonly name: string;
      readonly score: string;
      readonly previousScore: string;
    };

/**
 * Lift PRs: a set lifting more than the standing record for a tracked rep count (a lift's first
 * set beats nothing). A set beating several reports its own rep count if tracked, else the
 * highest it implies; one PR per lift and day, the biggest gain over the old record.
 */
export function liftRecords(liftSets: ReadonlyArray<LiftSet>): ReadonlyArray<PersonalRecord> {
  const ordered = [...liftSets].sort(
    (a, b) => a.performedOn.localeCompare(b.performedOn) || a.createdAt.localeCompare(b.createdAt),
  );
  const standing = new Map<MovementId, Map<number, number>>();
  const byLiftDay = new Map<string, PersonalRecord & { kind: "lift" }>();
  for (const set of ordered) {
    const records = standing.get(set.movementId) ?? new Map<number, number>();
    standing.set(set.movementId, records);
    const before = new Map(records);
    const beaten = REP_MAX_TARGETS.filter((target) => {
      const record = before.get(target);
      return target <= set.reps && record !== undefined && set.loadKg > record;
    });
    for (const target of REP_MAX_TARGETS) {
      if (target <= set.reps && set.loadKg > (records.get(target) ?? 0))
        records.set(target, set.loadKg);
    }
    const reps = beaten.includes(set.reps as (typeof REP_MAX_TARGETS)[number])
      ? set.reps
      : beaten.at(-1);
    if (reps === undefined) continue;
    const previousKg = before.get(reps) ?? 0;
    const record = {
      kind: "lift" as const,
      performedOn: set.performedOn,
      movementId: set.movementId,
      reps,
      loadKg: set.loadKg,
      implied: reps !== set.reps,
      previousKg,
    };
    const key = `${set.movementId}|${set.performedOn}`;
    const kept = byLiftDay.get(key);
    if (!kept || record.loadKg / record.previousKg > kept.loadKg / kept.previousKg)
      byLiftDay.set(key, record);
  }
  return [...byLiftDay.values()];
}

/** Benchmark PRs: an attempt whose score beats every earlier readable one. */
export function benchmarkRecords(
  results: ReadonlyArray<BenchmarkResult>,
): ReadonlyArray<PersonalRecord> {
  const byBenchmark = new Map<string, BenchmarkResult[]>();
  for (const result of results) {
    const list = byBenchmark.get(result.benchmarkId) ?? [];
    list.push(result);
    byBenchmark.set(result.benchmarkId, list);
  }
  const records: PersonalRecord[] = [];
  for (const [id, attempts] of byBenchmark) {
    const benchmark = benchmarkById(id);
    if (!benchmark) continue;
    let best: { result: BenchmarkResult; value: number } | undefined;
    for (const result of attempts.sort((a, b) => a.performedOn.localeCompare(b.performedOn))) {
      const value = parseBenchmarkScore(benchmark.scoring, result.score);
      if (value === undefined) continue;
      if (best === undefined) best = { result, value };
      else if (isBetterScore(benchmark.scoring, value, best.value)) {
        records.push({
          kind: "benchmark",
          performedOn: result.performedOn,
          benchmarkId: id,
          name: benchmark.name,
          score: result.score,
          previousScore: best.result.score,
        });
        best = { result, value };
      }
    }
  }
  return records;
}

/** Newest PRs first, lifts and benchmarks together. */
export function recentRecords(
  liftSets: ReadonlyArray<LiftSet>,
  results: ReadonlyArray<BenchmarkResult>,
  limit: number,
): ReadonlyArray<PersonalRecord> {
  return [...liftRecords(liftSets), ...benchmarkRecords(results)]
    .sort((a, b) => b.performedOn.localeCompare(a.performedOn))
    .slice(0, limit);
}

/** A main lift's estimated 1RM now, how it moved, and its recent sessions. */
export interface LiftSummary {
  readonly movementId: MovementId;
  readonly name: string;
  /** Best Epley estimate to date, with the formulas' spread. */
  readonly e1rm: number;
  readonly low: number;
  readonly high: number;
  /** The best is a single: tested, not estimated. */
  readonly tested: boolean;
  /** Change of the best to date over the window; `undefined` with nothing before it. */
  readonly change: number | undefined;
  readonly lastTrained: string;
  /** Sessions inside the window, oldest first: each day's best estimate. */
  readonly sessions: ReadonlyArray<{ readonly date: Date; readonly e1rm: number }>;
  /** Best to date through the window, as steps; the first step carries the value in force. */
  readonly best: ReadonlyArray<{ readonly date: Date; readonly e1rm: number }>;
}

/**
 * The barbell lifts trained on the most days in the last year (all time when none were), most
 * trained first, with their estimated 1RM over the `windowDays` ending today.
 */
export function mainLifts(
  movements: ReadonlyArray<Movement>,
  liftSets: ReadonlyArray<LiftSet>,
  today: Date,
  options: { readonly count: number; readonly windowDays: number },
): ReadonlyArray<LiftSummary> {
  const barbell = new Map(
    movements.filter((movement) => movement.category === "barbell").map((m) => [m.id, m.name]),
  );
  const estimable = liftSets.filter((set) => barbell.has(set.movementId) && isEstimable(set));
  const yearAgo = localIsoDate(addDays(today, -365));
  const daysPerLift = (since: string) => {
    const days = new Map<MovementId, Set<string>>();
    for (const set of estimable) {
      if (set.performedOn < since) continue;
      const lift = days.get(set.movementId) ?? new Set<string>();
      lift.add(set.performedOn);
      days.set(set.movementId, lift);
    }
    return days;
  };
  const recent = daysPerLift(yearAgo);
  const ranked = recent.size > 0 ? recent : daysPerLift("");
  const from = addDays(today, -options.windowDays);

  return [...ranked]
    .sort(([, a], [, b]) => b.size - a.size)
    .slice(0, options.count)
    .flatMap(([movementId]) => {
      const sessions = sessionEstimates(estimable.filter((set) => set.movementId === movementId));
      const steps = bestToDate(sessions);
      const current = steps.at(-1);
      const last = sessions.at(-1);
      if (!current || !last) return [];
      const before = steps.filter((step) => step.date < from).at(-1);
      const inside = steps.filter((step) => step.date >= from);
      return [
        {
          movementId,
          name: barbell.get(movementId) ?? movementId,
          e1rm: current.e1rm,
          low: current.low,
          high: current.high,
          tested: current.source.reps === 1,
          change: before ? current.e1rm - before.e1rm : undefined,
          lastTrained: last.performedOn,
          sessions: sessions
            .filter((session) => session.date >= from)
            .map((session) => ({ date: session.date, e1rm: session.estimate.epley })),
          best: [...(before ? [{ date: from, e1rm: before.e1rm }] : []), ...inside],
        },
      ];
    });
}

/** Newest workouts first; a day's later entry above its earlier one. */
export function latestWorkouts(
  workouts: ReadonlyArray<Workout>,
  limit: number,
): ReadonlyArray<Workout> {
  return [...workouts]
    .sort(
      (a, b) =>
        b.performedOn.localeCompare(a.performedOn) || b.createdAt.localeCompare(a.createdAt),
    )
    .slice(0, limit);
}
