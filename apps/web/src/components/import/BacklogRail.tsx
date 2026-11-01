import type { BookingboardAttendance, BookingboardAttendedClass } from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Link } from "@tanstack/react-router";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { CalendarArrowDown, RefreshCw } from "lucide-react";
import { useState } from "react";
import { flushSync } from "react-dom";

import {
  backlogOf,
  nextOpenDay,
  type Backlog,
  type BacklogMonth,
  type ClassDay,
} from "../../lib/backlog.ts";
import {
  ATTENDANCE_REACTIVITY_KEY,
  attendanceAtom,
  bookingboardStatusAtom,
  checkAttendanceAtom,
  skipDayAtom,
} from "../../state/bookingboard.ts";
import { entryDay } from "../../lib/sessions.ts";
import { sessionsAtom } from "../../state/sessions.ts";
import { FieldBox } from "../FieldBox.tsx";
import { formatShort, formatWeekday } from "../today/SectionHead.tsx";

export type BacklogSource =
  | { readonly _tag: "loading" }
  | { readonly _tag: "disconnected" }
  | { readonly _tag: "failed"; readonly message: string }
  | {
      readonly _tag: "ready";
      readonly attendance: BookingboardAttendance;
      readonly backlog: Backlog;
      readonly refreshing: boolean;
    };

const failureText = (cause: Cause.Cause<{ readonly message: string }>) => {
  const failure = Cause.findErrorOption(cause);
  return Option.isSome(failure)
    ? failure.value.message
    : "Could not reach the server. Is it running?";
};

/**
 * The class days from bookingboard against the sessions logged. The copy is read from
 * bookingboard on the server at most every half hour; the match is made here, so a save shows at
 * once.
 */
export function useBacklog(): BacklogSource {
  const status = useAtomValue(bookingboardStatusAtom);
  const attendance = useAtomValue(attendanceAtom);
  const sessions = useAtomValue(sessionsAtom);
  if (!AsyncResult.isSuccess(status)) return { _tag: "loading" };
  if (status.value._tag === "disconnected") return { _tag: "disconnected" };
  if (AsyncResult.isFailure(attendance))
    return { _tag: "failed", message: failureText(attendance.cause) };
  // Without the sessions every class day would read as unlogged, so neither counts as ready.
  if (AsyncResult.isFailure(sessions))
    return { _tag: "failed", message: "Could not load your sessions to match the class days." };
  if (!AsyncResult.isSuccess(attendance) || !AsyncResult.isSuccess(sessions))
    return { _tag: "loading" };
  // Workouts and strength-only days, as the session register has them.
  const sessionsByDay = new Map<string, Array<string>>();
  for (const entry of sessions.value) {
    const day = entryDay(entry);
    const name = entry._tag === "workout" ? entry.workout.name : "Strength day";
    const names = sessionsByDay.get(day);
    if (names) names.push(name);
    else sessionsByDay.set(day, [name]);
  }
  return {
    _tag: "ready",
    attendance: attendance.value,
    backlog: backlogOf(attendance.value, sessionsByDay),
    refreshing: attendance.waiting,
  };
}

type Filter = "open" | "all" | "skipped";

const monthLong = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const monthShort = new Intl.DateTimeFormat(undefined, { month: "short" });
const weekdayShort = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const timeFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const asDate = (iso: string) => new Date(`${iso}T00:00:00`);
const monthSectionId = (month: string) => `backlog-${month}`;

const classLine = (entry: BookingboardAttendedClass) =>
  `${entry.startsAt} ${entry.title.trim()}${entry.coach === null ? "" : ` · ${entry.coach}`}`;

/** "12 min ago" for an ISO instant, coarse on purpose. */
function ago(iso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return timeFormat.format(new Date(iso));
}

/** The pull buttons in the register, in reading order: the arrow keys walk them. */
const rowButtons = (list: HTMLElement) => [
  ...list.querySelectorAll<HTMLButtonElement>("[data-backlog-pull]"),
];

/**
 * The import backlog as a rail: every class day from bookingboard since the first, oldest first,
 * under a head that counts what is left and a month tally that shows where it is. Enter (or a
 * click) on a day pulls it into the paste box; S skips it.
 */
export function BacklogRail({
  source,
  selectedDay,
  onPick,
}: {
  readonly source: BacklogSource;
  readonly selectedDay: string;
  readonly onPick: (date: string) => void;
}) {
  return (
    <aside
      aria-label="Class days from bookingboard"
      className="flex min-h-0 flex-col border-r bg-background"
    >
      {source._tag === "ready" ? (
        <ReadyRail
          attendance={source.attendance}
          backlog={source.backlog}
          refreshing={source.refreshing}
          selectedDay={selectedDay}
          onPick={onPick}
        />
      ) : (
        <>
          <RailTitle />
          <div className="px-4 py-6 text-sm">
            {source._tag === "loading" ? (
              <p className="text-muted-foreground">
                Reading your classes from bookingboard. The first read fetches your whole history,
                once.
              </p>
            ) : source._tag === "disconnected" ? (
              <p className="text-muted-foreground">
                <Link
                  to="/settings/connections"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Connect bookingboard in Settings
                </Link>{" "}
                and every class you checked in to lands here, with the days still to log first.
              </p>
            ) : (
              <p role="alert" className="text-destructive">
                {source.message}
              </p>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

function RailTitle({ meta }: { readonly meta?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 border-b-2 border-foreground px-4 pb-1.5 pt-4">
      <h2 className="protocol-title text-2xl">Class days</h2>
      {meta ? <span className="form-label pb-0.5 text-muted-foreground">{meta}</span> : null}
    </div>
  );
}

type Note = { readonly tone: "muted" | "error"; readonly text: React.ReactNode } | undefined;

function ReadyRail({
  attendance,
  backlog,
  refreshing,
  selectedDay,
  onPick,
}: {
  readonly attendance: BookingboardAttendance;
  readonly backlog: Backlog;
  readonly refreshing: boolean;
  readonly selectedDay: string;
  readonly onPick: (date: string) => void;
}) {
  const check = useAtomSet(checkAttendanceAtom, { mode: "promiseExit" });
  const skip = useAtomSet(skipDayAtom, { mode: "promiseExit" });
  const [filter, setFilter] = useState<Filter>("open");
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<Note>();
  // "Read 12 min ago" counts from the page opening, or from the last check pressed.
  const [now, setNow] = useState(() => Date.now());
  const next = nextOpenDay(backlog);
  const total = backlog.days.length;
  const first = backlog.days[0];

  async function setSkipped(date: string, skipped: boolean) {
    const exit = await skip({
      payload: { date, skipped },
      reactivityKeys: [ATTENDANCE_REACTIVITY_KEY],
    });
    setNote(
      Exit.isFailure(exit)
        ? { tone: "error", text: failureText(exit.cause) }
        : skipped
          ? {
              tone: "muted",
              text: (
                <>
                  Skipped {formatWeekday(date)}.{" "}
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:text-foreground"
                    onClick={() => void setSkipped(date, false)}
                  >
                    Undo
                  </button>
                </>
              ),
            }
          : { tone: "muted", text: `${formatWeekday(date)} is back to log.` },
    );
  }

  async function checkNow() {
    setChecking(true);
    setNote(undefined);
    const exit = await check({
      payload: { check: "now" },
      reactivityKeys: [ATTENDANCE_REACTIVITY_KEY],
    });
    setChecking(false);
    setNow(Date.now());
    if (Exit.isFailure(exit)) setNote({ tone: "error", text: failureText(exit.cause) });
  }

  /** Scrolls the register to a month, showing every day if the filter hides that month. */
  function jumpTo(month: BacklogMonth) {
    const shown =
      filter === "all" ||
      (filter === "open" ? month.open > 0 : month.skipped > 0) ||
      month.days.length === 0;
    if (!shown) flushSync(() => setFilter("all"));
    document.getElementById(monthSectionId(month.month))?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  return (
    <>
      <RailTitle
        meta={
          first === undefined
            ? undefined
            : `Since ${formatShort(first.date)}, ${first.date.slice(0, 4)}`
        }
      />
      <dl className="grid grid-cols-2 divide-x border-b bg-card">
        <FieldBox label="To log">
          {backlog.open === 0 ? <span data-empty aria-label="None" /> : backlog.open}
        </FieldBox>
        <FieldBox label="Logged">
          {backlog.logged} <span className="text-sm text-muted-foreground">of {total}</span>
        </FieldBox>
      </dl>
      <div
        data-block-progress
        role="progressbar"
        aria-label="Class days logged"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={backlog.logged}
        className="h-1.5"
      >
        <span
          className="block h-full"
          style={{ width: `${(backlog.logged / Math.max(1, total)) * 100}%` }}
        />
      </div>

      <div className="grid gap-3 border-b px-4 py-3">
        {next === undefined ? (
          <div className="flex items-center gap-3">
            <span data-lamps aria-hidden className="flex items-center gap-1.5 px-2 py-1.5">
              <span data-lamp="good" />
              <span data-lamp="good" />
              <span data-lamp="good" />
            </span>
            <p className="text-sm">Every class day has its session.</p>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="grid min-w-0 leading-tight">
              <span className="form-label text-muted-foreground">Oldest to log</span>
              <span className="truncate font-semibold">
                {formatWeekday(next.date)}, {next.date.slice(0, 4)}
              </span>
              <span className="truncate text-xs text-muted-foreground tabular-nums">
                {next.classes.map(classLine).join(", ")}
              </span>
            </div>
            <Button type="button" onClick={() => onPick(next.date)}>
              <CalendarArrowDown />
              Pull
            </Button>
          </div>
        )}
        <MonthTally
          months={backlog.months}
          selectedMonth={selectedDay.slice(0, 7)}
          onJump={jumpTo}
        />
      </div>

      <div role="tablist" aria-label="Show" className="flex border-b px-2">
        {(
          [
            ["open", "To log", backlog.open],
            ["all", "All", total],
            ["skipped", "Skipped", backlog.skipped],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            data-rail-tab
            onClick={() => setFilter(value)}
            className="form-label px-2.5 pb-1.5 pt-2"
          >
            {label} <span className="tabular-nums">{count}</span>
          </button>
        ))}
      </div>

      <Register
        backlog={backlog}
        filter={filter}
        selectedDay={selectedDay}
        onPick={onPick}
        onSkip={(date, skipped) => void setSkipped(date, skipped)}
      />

      <div className="grid gap-1.5 border-t bg-background px-4 py-2 text-xs text-muted-foreground">
        {note ? (
          <p
            role={note.tone === "error" ? "alert" : "status"}
            className={note.tone === "error" ? "text-destructive" : undefined}
          >
            {note.text}
          </p>
        ) : null}
        {attendance.checkFailed ? (
          <p role="alert" className="text-destructive">
            {attendance.checkFailed}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <span>
            Read from bookingboard {ago(attendance.checkedAt, now)}; again after half an hour.
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={checking || refreshing}
            onClick={() => void checkNow()}
          >
            <RefreshCw className={checking ? "motion-safe:animate-spin" : undefined} />
            {checking ? "Reading..." : "Check now"}
          </Button>
        </div>
      </div>
    </>
  );
}

/**
 * One column per month, one bar per class day stacked from the bottom: ink logged, a dashed box
 * still to log, a pale box skipped. The picked day's month is bracketed; a column jumps the
 * register there.
 */
function MonthTally({
  months,
  selectedMonth,
  onJump,
}: {
  readonly months: ReadonlyArray<BacklogMonth>;
  readonly selectedMonth: string;
  readonly onJump: (month: BacklogMonth) => void;
}) {
  const tallest = Math.max(1, ...months.map((month) => month.days.length));
  return (
    <div className="grid gap-1">
      <div
        className="grid items-end gap-0.5"
        style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}
      >
        {months.map((month) => {
          const label = monthLong.format(asDate(`${month.month}-01`));
          return (
            <button
              key={month.month}
              type="button"
              data-tally-month
              data-current={month.month === selectedMonth || undefined}
              title={`${label}: ${month.open} to log, ${month.logged} logged${month.skipped > 0 ? `, ${month.skipped} skipped` : ""}`}
              aria-label={`${label}: ${month.open} to log, ${month.logged} logged. Show in the list.`}
              onClick={() => onJump(month)}
              className="flex flex-col-reverse gap-0.5 px-0.5 pb-0.5 pt-1"
              style={{ height: `${tallest * 0.4375 + 0.5}rem` }}
            >
              {month.days.map((day) => (
                <span key={day.date} data-tally={day.state} className="h-1.5 shrink-0" />
              ))}
            </button>
          );
        })}
      </div>
      <div
        aria-hidden
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}
      >
        {months.map((month) => (
          <span
            key={month.month}
            data-current={month.month === selectedMonth || undefined}
            className="form-label grid justify-items-center leading-tight text-muted-foreground data-current:text-foreground"
          >
            {monthShort.format(asDate(`${month.month}-01`)).slice(0, 3)}
            {month.month.endsWith("-01") || month === months[0] ? (
              <span className="tabular-nums">{month.month.slice(2, 4)}</span>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}

function Register({
  backlog,
  filter,
  selectedDay,
  onPick,
  onSkip,
}: {
  readonly backlog: Backlog;
  readonly filter: Filter;
  readonly selectedDay: string;
  readonly onPick: (date: string) => void;
  readonly onSkip: (date: string, skipped: boolean) => void;
}) {
  const shows = (day: ClassDay) =>
    filter === "all" || (filter === "open" ? day.state === "open" : day.state === "skipped");
  const groups = backlog.months
    .map((month) => ({ month, days: month.days.filter(shows) }))
    .filter((group) => group.days.length > 0);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const buttons = rowButtons(event.currentTarget);
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const target =
      event.key === "ArrowDown"
        ? buttons[Math.min(buttons.length - 1, at + 1)]
        : event.key === "ArrowUp"
          ? buttons[Math.max(0, at - 1)]
          : event.key === "Home"
            ? buttons[0]
            : event.key === "End"
              ? buttons.at(-1)
              : undefined;
    if (target !== undefined) {
      event.preventDefault();
      target.focus();
      target.scrollIntoView({ block: "nearest" });
      return;
    }
    const day = buttons[at]?.dataset.backlogPull;
    if (day !== undefined && event.key.toLowerCase() === "s" && !event.shiftKey) {
      event.preventDefault();
      // Focus moves on to the next day, as this one leaves the list.
      (buttons[at + 1] ?? buttons[at - 1])?.focus();
      onSkip(day, true);
    }
  }

  return (
    <div
      data-register-scroll
      onKeyDown={handleKeyDown}
      className="relative min-h-0 flex-1 overflow-y-auto pb-6"
    >
      {groups.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted-foreground">
          {filter === "skipped"
            ? "No skipped days. Skip a class day you will not log (S on a day) and it waits here."
            : "Nothing to log: every class day since the first has its session."}
        </p>
      ) : (
        groups.map(({ month, days }) => (
          <section
            key={month.month}
            id={monthSectionId(month.month)}
            aria-label={monthLong.format(asDate(`${month.month}-01`))}
            className="scroll-mt-0"
          >
            <div className="sticky top-0 z-10 flex items-end justify-between gap-3 border-b-2 border-foreground bg-background px-4 pb-1 pt-3">
              <h3 className="protocol-title text-lg">
                {monthLong.format(asDate(`${month.month}-01`))}
              </h3>
              <span className="form-label text-muted-foreground tabular-nums">
                {month.open === 0
                  ? `${month.logged} logged`
                  : `${month.open} to log · ${month.logged} logged`}
              </span>
            </div>
            <ul>
              {days.map((day) => (
                <DayRow
                  key={day.date}
                  day={day}
                  selected={day.date === selectedDay}
                  onPick={onPick}
                  onSkip={onSkip}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function DayRow({
  day,
  selected,
  onPick,
  onSkip,
}: {
  readonly day: ClassDay;
  readonly selected: boolean;
  readonly onPick: (date: string) => void;
  readonly onSkip: (date: string, skipped: boolean) => void;
}) {
  const stub = (
    <time dateTime={day.date} className="grid leading-tight">
      <span className="form-label text-muted-foreground">
        {weekdayShort.format(asDate(day.date))}
      </span>
      <span className="font-semibold tabular-nums font-stretch-semi-condensed">
        {day.date.slice(8)}
      </span>
    </time>
  );
  const classes = (
    <span className="grid min-w-0 text-sm tabular-nums">
      {day.classes.map((entry) => (
        <span key={entry.classId} className="truncate">
          {classLine(entry)}
        </span>
      ))}
    </span>
  );

  if (day.state === "open")
    return (
      <li
        data-backlog-row
        data-selected={selected || undefined}
        className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center border-b"
      >
        <button
          type="button"
          data-backlog-pull={day.date}
          aria-current={selected ? "true" : undefined}
          aria-keyshortcuts="Enter S"
          aria-label={`Pull ${formatWeekday(day.date)}: ${day.classes.map(classLine).join(", ")}`}
          onClick={() => onPick(day.date)}
          className="grid min-h-12 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-2 py-1.5 pl-4 pr-2 text-left outline-none"
        >
          {stub}
          {classes}
          <span data-open-box aria-hidden className="size-3.5" />
        </button>
        <span data-row-control className="pr-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            tabIndex={-1}
            title="You will not log this day (S)"
            onClick={() => onSkip(day.date, true)}
          >
            Skip
          </Button>
        </span>
      </li>
    );

  return (
    <li
      data-backlog-row
      data-state={day.state}
      className="grid min-h-12 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-2 border-b py-1.5 pl-4 pr-3"
    >
      {stub}
      <span className="grid min-w-0">
        {day.state === "logged" ? (
          <>
            <span className="truncate text-sm font-semibold">{day.sessions.join(", ")}</span>
            <span className="truncate text-xs text-muted-foreground tabular-nums">
              {day.classes.map(classLine).join(", ")}
            </span>
          </>
        ) : (
          classes
        )}
      </span>
      {day.state === "logged" ? (
        <span data-lamps data-size="sm" className="flex items-center px-1.5 py-1">
          <span data-lamp="good" />
          <span className="sr-only">Logged</span>
        </span>
      ) : (
        <Button type="button" variant="ghost" size="sm" onClick={() => onSkip(day.date, false)}>
          Put back
        </Button>
      )}
    </li>
  );
}
