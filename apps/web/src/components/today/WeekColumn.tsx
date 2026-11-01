import type { MovementId } from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Link } from "@tanstack/react-router";
import type * as React from "react";

import { isoWeek, weekDays, type Consistency, type TrainingDay } from "../../lib/dashboard.ts";
import { toDate } from "../../lib/progress.ts";
import { WORKOUT_KIND_LABELS } from "../../lib/workoutKinds.ts";
import { FieldBox } from "../FieldBox.tsx";
import { heatOf } from "./YearGrid.tsx";
import { formatShort } from "./SectionHead.tsx";

const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short" });

/**
 * This week as the athlete's card: one row per day, Monday first, with what was trained; today
 * double-outlined. Under it the consistency numbers and the way to log the next session.
 */
export function WeekColumn({
  today,
  todayIso,
  days,
  numbers,
  names,
  activeDay,
  onActivate,
}: {
  readonly today: Date;
  readonly todayIso: string;
  readonly days: ReadonlyMap<string, TrainingDay>;
  readonly numbers: Consistency;
  readonly names: ReadonlyMap<MovementId, string>;
  readonly activeDay: string | null;
  readonly onActivate: (iso: string | null) => void;
}) {
  const week = weekDays(today);
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
              onPointerEnter={() => onActivate(iso)}
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
                />
              </div>
            </li>
          );
        })}
      </ol>

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

      <div className="px-5 py-5">
        <Button render={<Link to="/log" />} className="w-full">
          Log session
        </Button>
      </div>
    </section>
  );
}

function Unit({ children }: { readonly children: React.ReactNode }) {
  return <span className="ml-1 text-xs font-normal text-muted-foreground">{children}</span>;
}

function DayEntries({
  iso,
  todayIso,
  day,
  names,
  hasHistory,
}: {
  readonly iso: string;
  readonly todayIso: string;
  readonly day: TrainingDay | undefined;
  readonly names: ReadonlyMap<MovementId, string>;
  /** With nothing logged at all, a past day is unknown, not a rest day. */
  readonly hasHistory: boolean;
}) {
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
      <span className="flex flex-wrap gap-1">
        {day.liftMovementIds.map((id) => (
          <span key={id} data-tag="movement" data-chip className="px-1.5 text-sm font-medium">
            {names.get(id) ?? id}
          </span>
        ))}
      </span>
    );
  }
  return day.workouts.map((workout) => (
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
}
