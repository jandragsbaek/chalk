import {
  deriveSession,
  type Movement,
  type MovementId,
  type SessionPlan,
  type Sex,
} from "@chalk/contracts";
import { useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useState } from "react";

import { LatestSessions } from "../components/today/LatestSessions.tsx";
import { MainLifts } from "../components/today/MainLifts.tsx";
import { RecentRecords } from "../components/today/RecentRecords.tsx";
import { WeekColumn, type DayPlan } from "../components/today/WeekColumn.tsx";
import { GRID_WEEKS, YearGrid } from "../components/today/YearGrid.tsx";
import {
  calendarWeeks,
  consistency,
  latestWorkouts,
  mainLifts,
  recentRecords,
  trainingDays,
} from "../lib/dashboard.ts";
import { plannedMovements, planTitle } from "../lib/plan.ts";
import { useAthleteSex } from "../lib/profile.ts";
import { localIsoDate } from "../lib/utils.ts";
import { benchmarkResultsAtom } from "../state/benchmarks.ts";
import { plansAtom } from "../state/plans.ts";
import { liftSetsAtom, movementsAtom } from "../state/strength.ts";
import { workoutsAtom } from "../state/workouts.ts";

export const Route = createFileRoute("/")({ component: TodayPage });

/** Plans by the day they are for, each with its movements and planned scaling. */
const plansByDay = (
  plans: ReadonlyArray<SessionPlan>,
  nameOf: (id: MovementId) => string | undefined,
  sex: Sex,
): ReadonlyMap<string, ReadonlyArray<DayPlan>> => {
  const byDay = new Map<string, Array<DayPlan>>();
  for (const plan of plans) {
    const session = deriveSession(plan.document, nameOf);
    const entry: DayPlan = {
      id: plan.id,
      plannedOn: plan.plannedOn,
      session,
      title: planTitle(session, nameOf),
      movements: plannedMovements(session, nameOf, sex),
    };
    byDay.set(plan.plannedOn, [...(byDay.get(plan.plannedOn) ?? []), entry]);
  }
  return byDay;
};

/** The window the main lifts' change and trace cover. */
const LIFT_WINDOW_DAYS = 84;

function TodayPage() {
  const result = AsyncResult.all({
    workouts: useAtomValue(workoutsAtom),
    liftSets: useAtomValue(liftSetsAtom),
    movements: useAtomValue(movementsAtom),
    results: useAtomValue(benchmarkResultsAtom),
    plans: useAtomValue(plansAtom),
  });
  const sex = useAthleteSex();
  const [today] = useState(() => new Date());
  const [activeDay, setActiveDay] = useState<string | null>(null);

  return AsyncResult.match(result, {
    onInitial: () => <TodaySkeleton />,
    onFailure: () => (
      <main className="mx-auto w-full max-w-2xl px-4 pt-8">
        <p className="border border-destructive bg-card px-4 py-3 text-sm text-destructive">
          Could not load your training. Is the server running?
        </p>
      </main>
    ),
    onSuccess: ({ value: { workouts, liftSets, movements, results, plans } }) => {
      const todayIso = localIsoDate(today);
      const days = trainingDays(workouts, liftSets);
      const since = calendarWeeks(today, GRID_WEEKS)[0]?.[0] ?? todayIso;
      const numbers = consistency(days, today, since);
      const names = new Map<MovementId, string>(
        movements.map((movement: Movement) => [movement.id, movement.name]),
      );
      return (
        <main className="grid grid-cols-1 lg:min-h-[calc(100dvh-3rem)] lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="border-b bg-card lg:border-r lg:border-b-0">
            <WeekColumn
              today={today}
              todayIso={todayIso}
              days={days}
              numbers={numbers}
              names={names}
              activeDay={activeDay}
              onActivate={setActiveDay}
              plans={plansByDay(plans, (id) => names.get(id), sex)}
            />
          </aside>
          <div className="grid min-w-0 grid-cols-1 content-start gap-10 px-8 py-8">
            <YearGrid
              today={today}
              todayIso={todayIso}
              days={days}
              trainedDays={numbers.lastYear}
              names={names}
              activeDay={activeDay}
              onActivate={setActiveDay}
            />
            <div className="grid grid-cols-1 gap-10 xl:grid-cols-2 xl:gap-8">
              <RecentRecords records={recentRecords(liftSets, results, 6)} names={names} />
              <MainLifts
                lifts={mainLifts(movements, liftSets, today, {
                  count: 6,
                  windowDays: LIFT_WINDOW_DAYS,
                })}
                today={today}
                windowDays={LIFT_WINDOW_DAYS}
              />
            </div>
            <LatestSessions workouts={latestWorkouts(workouts, 6)} />
          </div>
        </main>
      );
    },
  });
}

/** The page's shape in dashed boxes while the data loads, so nothing jumps when it lands. */
function TodaySkeleton() {
  return (
    <main
      aria-busy
      aria-label="Loading your training"
      className="grid grid-cols-1 lg:min-h-[calc(100dvh-3rem)] lg:grid-cols-[20rem_minmax(0,1fr)]"
    >
      <aside className="border-b bg-card p-5 lg:border-r lg:border-b-0">
        <div className="h-96 border border-dashed border-input" />
      </aside>
      <div className="grid content-start gap-10 px-8 py-8">
        <div className="h-52 border border-dashed border-input" />
        <div className="grid gap-8 xl:grid-cols-2">
          <div className="h-64 border border-dashed border-input" />
          <div className="h-64 border border-dashed border-input" />
        </div>
      </div>
    </main>
  );
}
