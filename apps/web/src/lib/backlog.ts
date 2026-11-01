import type { BookingboardAttendance, BookingboardAttendedClass } from "@chalk/contracts";

/** A class day: `open` still to log, `logged` has a session, `skipped` will not be logged. */
export type ClassDayState = "open" | "logged" | "skipped";

export interface ClassDay {
  readonly date: string;
  readonly classes: ReadonlyArray<BookingboardAttendedClass>;
  readonly state: ClassDayState;
  /** Names of the sessions logged that day. */
  readonly sessions: ReadonlyArray<string>;
}

export interface BacklogMonth {
  /** "2026-10". */
  readonly month: string;
  /** Oldest first. */
  readonly days: ReadonlyArray<ClassDay>;
  readonly open: number;
  readonly logged: number;
  readonly skipped: number;
}

export interface Backlog {
  /** Every class day, oldest first. */
  readonly days: ReadonlyArray<ClassDay>;
  /** Every month from the first class to the newest, empty ones too, oldest first. */
  readonly months: ReadonlyArray<BacklogMonth>;
  readonly open: number;
  readonly logged: number;
  readonly skipped: number;
}

const monthOf = (date: string) => date.slice(0, 7);

const nextMonth = (month: string) => {
  const [year, index] = month.split("-").map(Number) as [number, number];
  return index === 12 ? `${year + 1}-01` : `${year}-${String(index + 1).padStart(2, "0")}`;
};

/**
 * The attendance copy against the sessions logged, by day: a class day with any session that day
 * is logged, whichever class it was.
 */
export function backlogOf(
  attendance: BookingboardAttendance,
  sessionsByDay: ReadonlyMap<string, ReadonlyArray<string>>,
): Backlog {
  const classesByDay = new Map<string, Array<BookingboardAttendedClass>>();
  for (const entry of attendance.classes) {
    const day = classesByDay.get(entry.date);
    if (day) day.push(entry);
    else classesByDay.set(entry.date, [entry]);
  }
  const skipped = new Set(attendance.skippedDays);
  const days = [...classesByDay]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, classes]): ClassDay => {
      const sessions = sessionsByDay.get(date) ?? [];
      return {
        date,
        classes,
        sessions,
        state: sessions.length > 0 ? "logged" : skipped.has(date) ? "skipped" : "open",
      };
    });

  const months: Array<BacklogMonth> = [];
  const first = days[0];
  const last = days.at(-1);
  if (first !== undefined && last !== undefined)
    for (let month = monthOf(first.date); month <= monthOf(last.date); month = nextMonth(month)) {
      const inMonth = days.filter((day) => monthOf(day.date) === month);
      months.push({
        month,
        days: inMonth,
        open: inMonth.filter((day) => day.state === "open").length,
        logged: inMonth.filter((day) => day.state === "logged").length,
        skipped: inMonth.filter((day) => day.state === "skipped").length,
      });
    }

  return {
    days,
    months,
    open: days.filter((day) => day.state === "open").length,
    logged: days.filter((day) => day.state === "logged").length,
    skipped: days.filter((day) => day.state === "skipped").length,
  };
}

/**
 * The day to log next, oldest first: the first open day after `after` (a day just saved or
 * skipped, which is passed over even if the backlog has not caught up), else the oldest open day.
 */
export function nextOpenDay(backlog: Backlog, after?: string): ClassDay | undefined {
  const open = backlog.days.filter((day) => day.state === "open" && day.date !== after);
  return (after === undefined ? undefined : open.find((day) => day.date > after)) ?? open[0];
}
