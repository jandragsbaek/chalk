import type { DerivedSession, MovementId, PlanId } from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Link } from "@tanstack/react-router";
import type * as React from "react";

import { isoWeek, weekDays, type Consistency, type TrainingDay } from "../../lib/dashboard.ts";
import type { PlannedMovement } from "../../lib/plan.ts";
import { toDate } from "../../lib/progress.ts";
import { WORKOUT_KIND_LABELS } from "../../lib/workoutKinds.ts";
import { FieldBox } from "../FieldBox.tsx";
import { SimilarSessionsBrief, usePlanEchoes } from "../sessions/SimilarSessions.tsx";
import { heatOf } from "./YearGrid.tsx";
import { formatShort } from "./SectionHead.tsx";

const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short" });

/** A plan not logged yet, as the week column shows it. */
export interface DayPlan {
  readonly id: PlanId;
  readonly plannedOn: string;
  /** The plan derived, for comparing its parts with saved sessions. */
  readonly session: DerivedSession;
  /** Kind and first movements, or the session's own name (see `planTitle`). */
  readonly title: string;
  readonly movements: ReadonlyArray<PlannedMovement>;
}

/**
 * This week as the athlete's card: one row per day, Monday first, with what was trained and
 * what is planned; today double-outlined. Under it the consistency numbers, today's plan with
 * its scaling, and the way to log the next session.
 */
export function WeekColumn({
  today,
  todayIso,
  days,
  numbers,
  names,
  activeDay,
  onActivate,
  plans,
}: {
  readonly today: Date;
  readonly todayIso: string;
  readonly days: ReadonlyMap<string, TrainingDay>;
  readonly numbers: Consistency;
  readonly names: ReadonlyMap<MovementId, string>;
  readonly activeDay: string | null;
  readonly onActivate: (iso: string | null) => void;
  /** Plans not logged yet, by the day they are planned for. */
  readonly plans: ReadonlyMap<string, ReadonlyArray<DayPlan>>;
}) {
  const week = weekDays(today);
  const todayPlans = plans.get(todayIso) ?? [];
  const first = week[0] ?? todayIso;
  const last = week[6] ?? todayIso;

  return (
    <section aria-labelledby="week-title" className="grid content-start lg:sticky lg:top-12">
      <div className="px-5 pt-6">
        <div className="flex items-end justify-between gap-3 border-b-2 border-foreground pb-2">
          <h1 id="week-title" className="protocol-title text-3xl">
            Week {isoWeek(today)}
          </h1>
          <span className="form-label text-muted-foreground">
            {formatShort(first)} – {formatShort(last)}
          </span>
        </div>
      </div>

      <ol aria-label="This week" className="mt-4 border-t">
        {week.map((iso) => {
          const day = days.get(iso);
          const isToday = iso === todayIso;
          return (
            <li
              key={iso}
              data-day-row
              data-today={isToday || undefined}
              data-active={(activeDay === iso && !isToday) || undefined}
              onPointerEnter={() => onActivate(iso <= todayIso ? iso : null)}
              onPointerLeave={() => onActivate(null)}
              className="grid min-h-12 grid-cols-[3.5rem_minmax(0,1fr)] border-b"
            >
              <div className="grid content-center py-1.5 pr-3 pl-5">
                <span className="form-label text-muted-foreground">
                  {weekdayFormat.format(toDate(iso))}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold leading-4">{toDate(iso).getDate()}</span>
                  <span aria-hidden data-heat={heatOf(iso, todayIso, day)} className="size-2.5" />
                </span>
              </div>
              <div className="grid content-center gap-1 py-1.5 pr-5">
                <DayEntries
                  iso={iso}
                  todayIso={todayIso}
                  day={day}
                  names={names}
                  hasHistory={days.size > 0}
                  plans={plans.get(iso) ?? []}
                />
              </div>
            </li>
          );
        })}
      </ol>

      {todayPlans.map((plan) => (
        <TodayPlan key={plan.id} plan={plan} names={names} />
      ))}

      <dl
        aria-label="Consistency"
        className="grid grid-cols-2 border-b [&>div:nth-child(even)]:border-l [&>div:nth-child(n+3)]:border-t [&>div:nth-child(odd)]:pl-5"
      >
        <FieldBox label="This week">
          {numbers.thisWeek}
          <Unit>{numbers.thisWeek === 1 ? "day" : "days"}</Unit>
        </FieldBox>
        <FieldBox label="Last week">
          {numbers.lastWeek}
          <Unit>{numbers.lastWeek === 1 ? "day" : "days"}</Unit>
        </FieldBox>
        <FieldBox label="Last 30 days">
          {numbers.last30Days}
          <Unit>{numbers.last30Days === 1 ? "day" : "days"}</Unit>
        </FieldBox>
        <FieldBox label="Weeks in a row">
          {numbers.runWeeks}
          {numbers.bestRunWeeks > numbers.runWeeks ? (
            <Unit>best {numbers.bestRunWeeks}</Unit>
          ) : null}
        </FieldBox>
      </dl>

      <div className="grid gap-2 px-5 py-5">
        {todayPlans.length === 0 ? (
          <Button render={<Link to="/plan" />} variant="outline" className="w-full">
            Plan today's session
          </Button>
        ) : null}
        <Button
          render={<Link to="/log" />}
          variant={todayPlans.length === 0 ? "default" : "outline"}
          className="w-full"
        >
          Log session
        </Button>
      </div>
    </section>
  );
}

function Unit({ children }: { readonly children: React.ReactNode }) {
  return <span className="ml-1 text-xs font-normal text-muted-foreground">{children}</span>;
}

/**
 * Today's plan before the session: each movement with the scaling planned, where it was done
 * before and how it went, and the way to log it.
 */
function TodayPlan({
  plan,
  names,
}: {
  readonly plan: DayPlan;
  readonly names: ReadonlyMap<MovementId, string>;
}) {
  const echoes = usePlanEchoes(plan.session, plan.plannedOn);
  return (
    <section
      aria-label={`Planned today: ${plan.title}`}
      className="grid gap-2.5 border-b px-5 py-4"
    >
      <div className="grid gap-0.5">
        <span className="flex items-baseline justify-between gap-3">
          <h2 className="form-label text-muted-foreground">Planned today</h2>
          <Link
            to="/plan"
            search={{ plan: plan.id }}
            className="text-xs text-muted-foreground underline decoration-input hover:text-foreground hover:decoration-foreground"
          >
            Edit plan
          </Link>
        </span>
        <p className="text-base font-semibold leading-5 text-balance">{plan.title}</p>
      </div>
      {plan.movements.length > 0 ? (
        <ul className="grid gap-0.5 text-sm">
          {plan.movements.map((movement) => (
            <li key={movement.spanId} className="flex min-w-0 items-baseline justify-between gap-3">
              <span className="truncate text-muted-foreground">{movement.name}</span>
              <span
                className={
                  movement.plan === undefined
                    ? "shrink-0 text-muted-foreground"
                    : "min-w-0 truncate text-right font-medium"
                }
              >
                {movement.plan ?? "No plan"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <SimilarSessionsBrief groups={echoes} nameOf={(id) => names.get(id) ?? id} />
      <Button render={<Link to="/import" search={{ plan: plan.id }} />} className="w-full">
        Log it
      </Button>
    </section>
  );
}

function PlanEntry({ plan, past }: { readonly plan: DayPlan; readonly past: boolean }) {
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <Link
        to="/plan"
        search={{ plan: plan.id }}
        className="truncate text-sm font-medium underline decoration-dashed decoration-input hover:decoration-foreground"
      >
        {plan.title}
      </Link>
      <span className="form-label shrink-0 text-muted-foreground">
        {past ? "Not logged" : "Planned"}
      </span>
    </span>
  );
}

function DayEntries({
  iso,
  todayIso,
  day,
  names,
  hasHistory,
  plans,
}: {
  readonly iso: string;
  readonly todayIso: string;
  readonly day: TrainingDay | undefined;
  readonly names: ReadonlyMap<MovementId, string>;
  /** With nothing logged at all, a past day is unknown, not a rest day. */
  readonly hasHistory: boolean;
  /** Plans for this day not logged yet. */
  readonly plans: ReadonlyArray<DayPlan>;
}) {
  const planned = plans.map((plan) => (
    <PlanEntry key={plan.id} plan={plan} past={iso < todayIso} />
  ));
  if ((!day || day.sessions === 0) && planned.length > 0) return planned;
  if (!day || day.sessions === 0) {
    if (iso > todayIso) return <span data-empty aria-label="Not yet" />;
    if (iso < todayIso && !hasHistory) return <span data-empty aria-label="Nothing logged" />;
    return (
      <span className="text-sm text-muted-foreground">
        {iso === todayIso ? "Nothing logged yet" : "Rest"}
      </span>
    );
  }
  if (day.workouts.length === 0) {
    return (
      <>
        <span className="flex flex-wrap gap-1">
          {day.liftMovementIds.map((id) => (
            <span key={id} data-tag="movement" data-chip className="px-1.5 text-sm font-medium">
              {names.get(id) ?? id}
            </span>
          ))}
        </span>
        {planned}
      </>
    );
  }
  const logged = day.workouts.map((workout) => (
    <span key={workout.id} className="flex min-w-0 items-baseline gap-2">
      {workout.benchmarkId ? (
        <Link
          to="/benchmarks/$benchmarkId"
          params={{ benchmarkId: workout.benchmarkId }}
          className="truncate text-sm font-medium underline decoration-input hover:decoration-foreground"
        >
          {workout.name}
        </Link>
      ) : (
        <span className="truncate text-sm font-medium">{workout.name}</span>
      )}
      <span className="form-label shrink-0 text-muted-foreground">
        {WORKOUT_KIND_LABELS[workout.kind]}
      </span>
    </span>
  ));
  return (
    <>
      {logged}
      {planned}
    </>
  );
}
