import {
  isLoggedLift,
  type LiftSet,
  type ProgrammedSession,
  type RestDay,
  type SessionPlan,
  type TrainingBlock,
  type Workout,
} from "@chalk/contracts";

import { addDays, isoWeek, weekStart } from "./dashboard.ts";
import { toDate } from "./progress.ts";
import { localIsoDate } from "./utils.ts";

/**
 * The calendar reads blocks, logged sessions, box plans and lift sets the client already has,
 * and lays them out by the athlete's local day. Weeks start on Monday, like Today's.
 */

/** A programmed session with the block it belongs to and how much of it is done. */
export interface CalendarSession {
  readonly session: ProgrammedSession;
  readonly block: TrainingBlock;
  /** Per line: ticked, or a lift with sets of its movement logged that day. */
  readonly done: ReadonlyArray<boolean>;
  /** Lines done because the log shows them, not a tick. */
  readonly logged: ReadonlyArray<boolean>;
}

/** Everything one day holds. */
export interface CalendarDay {
  readonly iso: string;
  readonly workouts: ReadonlyArray<Workout>;
  readonly plans: ReadonlyArray<SessionPlan>;
  readonly sessions: ReadonlyArray<CalendarSession>;
  /** The day's rest mark, when the athlete (or the coach) marked it. */
  readonly rest: RestDay | undefined;
}

export type SessionState = "done" | "partial" | "open" | "missed";

/** Done when every line is; missed when its day has passed with nothing done. */
export function sessionState(entry: CalendarSession, todayIso: string): SessionState {
  const count = entry.done.filter(Boolean).length;
  if (count === entry.done.length && count > 0) return "done";
  if (count > 0) return "partial";
  return entry.session.day < todayIso ? "missed" : "open";
}

/** A set of "day|movement" keys: which lifts the log shows on which day. */
export const liftedOn = (liftSets: ReadonlyArray<LiftSet>): ReadonlySet<string> =>
  new Set(liftSets.map((set) => `${set.performedOn}|${set.movementId}`));

/** One session with its block and what of it is done, given the lifts in the log. */
export function sessionEntry(
  session: ProgrammedSession,
  block: TrainingBlock,
  lifted: ReadonlySet<string>,
): CalendarSession {
  const logged = session.lines.map(
    (line) => isLoggedLift(line) && lifted.has(`${session.day}|${line.movementId}`),
  );
  return {
    session,
    block,
    logged,
    done: session.lines.map(
      (_line, index) => logged[index] === true || session.ticked.includes(index),
    ),
  };
}

export function calendarDays(input: {
  readonly from: string;
  readonly to: string;
  readonly blocks: ReadonlyArray<TrainingBlock>;
  readonly workouts: ReadonlyArray<Workout>;
  readonly plans: ReadonlyArray<SessionPlan>;
  readonly liftSets: ReadonlyArray<LiftSet>;
  readonly rest: ReadonlyMap<string, RestDay>;
}): ReadonlyArray<CalendarDay> {
  const lifted = liftedOn(input.liftSets);
  const days: Array<CalendarDay> = [];
  for (let iso = input.from; iso <= input.to; iso = localIsoDate(addDays(toDate(iso), 1))) {
    days.push({
      iso,
      workouts: input.workouts.filter((workout) => workout.performedOn === iso),
      plans: input.plans.filter((plan) => plan.plannedOn === iso),
      rest: input.rest.get(iso),
      sessions: input.blocks.flatMap((block) =>
        block.sessions
          .filter((session) => session.day === iso)
          .map((session) => sessionEntry(session, block, lifted)),
      ),
    });
  }
  return days;
}

/** The seven days of the ISO week `iso` falls in, Monday first. */
export function weekOf(iso: string): ReadonlyArray<string> {
  const monday = weekStart(toDate(iso));
  return Array.from({ length: 7 }, (_, index) => localIsoDate(addDays(monday, index)));
}

export const weekNumber = (iso: string) => isoWeek(toDate(iso));

/** Monday of the week after `iso`'s. */
export const nextMonday = (iso: string) => localIsoDate(addDays(weekStart(toDate(iso)), 7));

/** The block's span, first session to last; undefined for a block with none. */
export function blockSpan(block: TrainingBlock): { from: string; to: string } | undefined {
  const first = block.sessions[0];
  const last = block.sessions.at(-1);
  return first === undefined || last === undefined ? undefined : { from: first.day, to: last.day };
}

/** How a week went, for the Sunday review: sessions done of those programmed, lines ticked. */
export function weekTally(days: ReadonlyArray<CalendarDay>, todayIso: string) {
  const sessions = days.flatMap((day) =>
    day.sessions.filter((entry) => entry.block.status === "scheduled"),
  );
  const states = sessions.map((entry) => sessionState(entry, todayIso));
  return {
    programmed: sessions.length,
    done: states.filter((state) => state === "done").length,
    missed: states.filter((state) => state === "missed").length,
    boxSessions: days.reduce((sum, day) => sum + day.workouts.length, 0),
  };
}

/** The weeks of a month as rows of seven days, Monday first, each saying if it is in the month. */
export function monthWeeks(
  year: number,
  month: number,
): ReadonlyArray<ReadonlyArray<{ readonly iso: string; readonly inMonth: boolean }>> {
  const last = new Date(year, month + 1, 0);
  const weeks: Array<Array<{ iso: string; inMonth: boolean }>> = [];
  for (
    let monday = weekStart(new Date(year, month, 1));
    monday <= last;
    monday = addDays(monday, 7)
  )
    weeks.push(
      Array.from({ length: 7 }, (_, index) => {
        const day = addDays(monday, index);
        return { iso: localIsoDate(day), inMonth: day.getMonth() === month };
      }),
    );
  return weeks;
}

/** Mondays of the weeks the lanes ruler spans: `before` weeks ahead of `iso`'s, `after` past it. */
export function rulerWeeks(iso: string, before: number, after: number): ReadonlyArray<string> {
  const monday = weekStart(toDate(iso));
  return Array.from({ length: before + after + 1 }, (_, index) =>
    localIsoDate(addDays(monday, (index - before) * 7)),
  );
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysFrom(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 864e5);
}

export const shiftDays = (iso: string, days: number) => localIsoDate(addDays(toDate(iso), days));

/** A session's lines with their positions: a line is known by its position, which ticks point at. */
export const numberedLines = (session: ProgrammedSession) =>
  session.lines.map((line, position) => ({ line, position }));

/**
 * A block's name as a narrow column can hold it: the part before its first " · " ("Smolov Jr"
 * for "Smolov Jr · back squat"), or that part's first word when it runs past ten letters
 * ("Shoulder" for "Shoulder prehab").
 */
export const shortBlockName = (name: string) => {
  const head = name.split(" · ")[0] ?? name;
  return head.length <= 10 ? head : (head.split(" ")[0] ?? head);
};
