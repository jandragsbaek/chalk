import { REST_DAY_LABELS, type MovementId, type RestDay } from "@chalk/contracts";
import { useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";

import { calendarWeeks, type TrainingDay } from "../../lib/dashboard.ts";
import { toDate } from "../../lib/progress.ts";
import { RestMark } from "./RestMark.tsx";
import { formatWeekday, SectionHead } from "./SectionHead.tsx";

/** 53 weeks: a full year whatever weekday it starts on. */
export const GRID_WEEKS = 53;

const monthFormat = new Intl.DateTimeFormat(undefined, { month: "short" });
const DAY_LABELS: ReadonlyArray<[row: number, label: string]> = [
  [0, "Mon"],
  [2, "Wed"],
  [4, "Fri"],
];

/** Arrow keys walk the grid as it is drawn: a column is a week, a row a weekday. */
const KEY_STEPS: Record<string, number> = {
  ArrowLeft: -7,
  ArrowRight: 7,
  ArrowUp: -1,
  ArrowDown: 1,
};

/**
 * A day's shade: sessions up to 3; "rest" for a day marked as rest with nothing logged (a day
 * still to come too, so planned rest shows); "future" for any other day still to come.
 */
export const heatOf = (
  iso: string,
  todayIso: string,
  day: TrainingDay | undefined,
  rest: RestDay | undefined,
) => {
  const sessions = day?.sessions ?? 0;
  if (sessions === 0 && rest !== undefined) return "rest";
  return iso > todayIso ? "future" : String(Math.min(3, sessions));
};

/**
 * Days trained over the last year, one square per day, shaded by sessions. Pointing at a square,
 * or walking the grid with the arrow keys, reads that day out underneath. Clicking a square (or
 * walking to it) holds it there, so a day with nothing logged can be marked as rest.
 */
export function YearGrid({
  today,
  todayIso,
  days,
  restDays,
  trainedDays,
  names,
  activeDay,
  onActivate,
}: {
  readonly today: Date;
  readonly todayIso: string;
  readonly days: ReadonlyMap<string, TrainingDay>;
  readonly restDays: ReadonlyMap<string, RestDay>;
  readonly trainedDays: number;
  readonly names: ReadonlyMap<MovementId, string>;
  readonly activeDay: string | null;
  readonly onActivate: (iso: string | null) => void;
}) {
  const [held, setHeld] = useState<string | null>(null);
  const weeks = calendarWeeks(today, GRID_WEEKS);
  const flat = weeks.flat();
  const firstIso = flat[0] ?? todayIso;
  const shown = activeDay ?? held ?? todayIso;
  const shownDay = days.get(shown);

  function handlePointerOver(event: PointerEvent<HTMLDivElement>) {
    const iso = (event.target as HTMLElement).dataset.day;
    if (iso && iso <= todayIso) onActivate(iso);
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const iso = (event.target as HTMLElement).dataset.day;
    if (iso && iso <= todayIso) setHeld(iso);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setHeld(null);
      onActivate(null);
      return;
    }
    const from = flat.indexOf(shown);
    const todayIndex = flat.indexOf(todayIso);
    let next: number | undefined;
    if (event.key in KEY_STEPS) next = from + (KEY_STEPS[event.key] ?? 0);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = todayIndex;
    if (next === undefined) return;
    event.preventDefault();
    const iso = flat[Math.max(0, Math.min(todayIndex, next))];
    if (iso) {
      setHeld(iso);
      onActivate(iso);
    }
  }

  const months: Array<{ column: number; label: string }> = [];
  weeks.forEach((week, index) => {
    const first = week.find((iso) => iso.endsWith("-01"));
    if (first) months.push({ column: index, label: monthFormat.format(toDate(first)) });
  });

  return (
    <section aria-labelledby="year-title" className="grid grid-cols-1 gap-3">
      <SectionHead
        id="year-title"
        size="lg"
        title={
          trainedDays === 0
            ? "No days trained yet"
            : `${trainedDays} ${trainedDays === 1 ? "day" : "days"} trained`
        }
        meta={<Legend />}
      />
      <div className="overflow-x-auto pb-1">
        <div
          role="group"
          tabIndex={0}
          aria-label={`Training days from ${formatWeekday(firstIso)} to today. Arrow keys move between days.`}
          aria-describedby="year-readout"
          onPointerOver={handlePointerOver}
          onClick={handleClick}
          onPointerLeave={() => onActivate(null)}
          onKeyDown={handleKeyDown}
          onBlur={() => onActivate(null)}
          className="grid min-w-[44rem] cursor-default gap-0.75 p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          style={{
            gridTemplateColumns: `2rem repeat(${GRID_WEEKS}, minmax(0, 1fr))`,
            gridTemplateRows: "auto",
          }}
        >
          {months.map(({ column, label }) => (
            <span
              key={column}
              aria-hidden
              className="form-label whitespace-nowrap text-muted-foreground"
              style={{ gridColumn: `${column + 2} / span 3`, gridRow: 1 }}
            >
              {label}
            </span>
          ))}
          {/* One label column over all seven rows, so scrolled weeks pass under it evenly. */}
          <span
            aria-hidden
            className="sticky left-0 z-10 grid grid-rows-subgrid bg-background"
            style={{ gridColumn: 1, gridRow: "2 / span 7" }}
          >
            {DAY_LABELS.map(([row, label]) => (
              <span
                key={label}
                className="form-label self-center text-muted-foreground"
                style={{ gridRow: row + 1 }}
              >
                {label}
              </span>
            ))}
          </span>
          {weeks.map((week, column) =>
            week.map((iso, row) => (
              <span
                key={iso}
                data-day={iso}
                data-heat={heatOf(iso, todayIso, days.get(iso), restDays.get(iso))}
                data-active={iso === shown || undefined}
                className="aspect-square"
                style={{ gridColumn: column + 2, gridRow: row + 2 }}
              />
            )),
          )}
        </div>
      </div>
      <div className="flex min-h-8 items-center justify-between gap-4">
        <p id="year-readout" aria-live="polite" className="min-w-0 text-sm">
          <DayReadout
            iso={shown}
            day={shownDay}
            rest={restDays.get(shown)}
            names={names}
            isToday={shown === todayIso}
          />
        </p>
        {(shownDay?.sessions ?? 0) === 0 ? (
          <RestMark iso={shown} rest={restDays.get(shown)} />
        ) : null}
      </div>
    </section>
  );
}

function DayReadout({
  iso,
  day,
  rest,
  names,
  isToday,
}: {
  readonly iso: string;
  readonly day: TrainingDay | undefined;
  readonly rest: RestDay | undefined;
  readonly names: ReadonlyMap<MovementId, string>;
  readonly isToday: boolean;
}) {
  const label = `${isToday ? "Today, " : ""}${formatWeekday(iso)}`;
  if ((!day || day.sessions === 0) && rest !== undefined)
    return (
      <>
        <span className="font-semibold">{label}</span>
        <span className="text-muted-foreground">{" · "}</span>
        {REST_DAY_LABELS[rest.kind]}
        {rest.source === "coach" ? (
          <span className="text-muted-foreground">, marked by the coach</span>
        ) : null}
      </>
    );
  if (!day || day.sessions === 0)
    return (
      <>
        <span className="font-semibold">{label}</span>
        <span className="text-muted-foreground">
          {" · "}
          {isToday ? "nothing logged yet" : "nothing logged"}
        </span>
      </>
    );
  const what =
    day.workouts.length > 0
      ? day.workouts.map((workout) => workout.name)
      : day.liftMovementIds.map((id) => names.get(id) ?? id);
  return (
    <>
      <span className="font-semibold">{label}</span>
      <span className="text-muted-foreground">
        {" · "}
        {day.sessions} {day.sessions === 1 ? "session" : "sessions"}
        {" · "}
      </span>
      {what.join(", ")}
    </>
  );
}

function Legend() {
  return (
    <span
      className="flex items-center gap-1"
      aria-label="Shade: sessions that day, none to 3 or more; a struck-through square is a rest day"
    >
      <span aria-hidden data-heat="rest" className="size-3" />
      <span aria-hidden className="mr-3 ml-0.5">
        Rest day
      </span>
      <span aria-hidden className="mr-0.5">
        None
      </span>
      {["0", "1", "2", "3"].map((level) => (
        <span key={level} aria-hidden data-heat={level} className="size-3" />
      ))}
      <span aria-hidden className="ml-0.5">
        3+ sessions
      </span>
    </span>
  );
}
