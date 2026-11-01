import {
  deriveSession,
  type LiftSet,
  type Movement,
  type MovementId,
  type SessionPlan,
  type Sex,
  type TrainingBlock,
} from "@chalk/contracts";
import { useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useState } from "react";

import { LatestSessions } from "../components/today/LatestSessions.tsx";
import { MainLifts } from "../components/today/MainLifts.tsx";
import { PlaceTally } from "../components/today/PlaceTally.tsx";
import { RecentRecords } from "../components/today/RecentRecords.tsx";
import { WeekColumn, type DayPlan, type DayProgrammed } from "../components/today/WeekColumn.tsx";
import { GRID_WEEKS, YearGrid } from "../components/today/YearGrid.tsx";
import {
  calendarWeeks,
  consistency,
  latestWorkouts,
  mainLifts,
  recentRecords,
  trainingDays,
} from "../lib/dashboard.ts";
import { liftedOn, sessionEntry, sessionState, shortBlockName } from "../lib/calendar.ts";
import { plannedMovements } from "../lib/plan.ts";
import { placeTally, sessionNumbers } from "../lib/places.ts";
import { useAthleteSex } from "../lib/profile.ts";
import { localIsoDate } from "../lib/utils.ts";
import { benchmarkResultsAtom } from "../state/benchmarks.ts";
import { plansAtom } from "../state/plans.ts";
import { restDaysAtom } from "../state/restDays.ts";
import { blocksAtom } from "../state/training.ts";
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
      title: session.name,
      movements: plannedMovements(session, nameOf, sex),
    };
    byDay.set(plan.plannedOn, [...(byDay.get(plan.plannedOn) ?? []), entry]);
  }
  return byDay;
};

/** Sessions of blocks in the calendar by day, titled with their block; drafts stay off Today. */
const programmedByDay = (
  blocks: ReadonlyArray<TrainingBlock>,
  liftSets: ReadonlyArray<LiftSet>,
  todayIso: string,
): ReadonlyMap<string, ReadonlyArray<DayProgrammed>> => {
  const lifted = liftedOn(liftSets);
  const byDay = new Map<string, Array<DayProgrammed>>();
  for (const block of blocks.filter((candidate) => candidate.status === "scheduled"))
    for (const session of block.sessions) {
      const entry: DayProgrammed = {
        id: session.id,
        title: `${shortBlockName(block.name)} · ${session.title}`,
        state: sessionState(sessionEntry(session, block, lifted), todayIso),
      };
      byDay.set(session.day, [...(byDay.get(session.day) ?? []), entry]);
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
    restDays: useAtomValue(restDaysAtom),
    blocks: useAtomValue(blocksAtom),
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
    onSuccess: ({ value: { workouts, liftSets, movements, results, plans, restDays, blocks } }) => {
      const todayIso = localIsoDate(today);
      const days = trainingDays(workouts, liftSets);
      const restByDay = new Map(restDays.map((rest) => [rest.day, rest]));
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
              restDays={restByDay}
              numbers={numbers}
              sessionNumbers={sessionNumbers(workouts, liftSets)}
              names={names}
              activeDay={activeDay}
              onActivate={setActiveDay}
              plans={plansByDay(plans, (id) => names.get(id), sex)}
              programmed={programmedByDay(blocks, liftSets, todayIso)}
            />
          </aside>
          <div className="grid min-w-0 grid-cols-1 content-start gap-10 px-8 py-8">
            <PlaceTally tally={placeTally(workouts, liftSets)} />
            <YearGrid
              today={today}
              todayIso={todayIso}
              days={days}
              restDays={restByDay}
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
