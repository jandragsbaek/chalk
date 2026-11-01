import { REST_DAY_LABELS, type ProgrammedSessionId, type RestDayKind } from "@chalk/contracts";
import { useState } from "react";

import {
  numberedLines,
  sessionState,
  shortBlockName,
  weekNumber,
  type CalendarDay,
  type CalendarSession,
} from "../../lib/calendar.ts";
import { toDate } from "../../lib/progress.ts";
import { RestMark } from "../today/RestMark.tsx";
import { formatShort } from "../today/SectionHead.tsx";
import { LineDose } from "./SessionLines.tsx";

const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short" });

/** What a drag carries between the board and the drafts tray. */
export const SESSION_DRAG_TYPE = "application/x-chalk-session";

export interface DragHandlers {
  readonly dragging: ProgrammedSessionId | null;
  readonly onDragStart: (id: ProgrammedSessionId) => void;
  readonly onDragEnd: () => void;
  readonly onDrop: (id: ProgrammedSessionId, day: string) => void;
  /** The session that just landed on a new day; it flashes canary once, like any edited row. */
  readonly landed: ProgrammedSessionId | null;
}

/** "this week", "next week", "last week" or nothing, relative to today's week. */
function relativeWeek(monday: string, todayMonday: string): string | undefined {
  const weeks = Math.round((toDate(monday).getTime() - toDate(todayMonday).getTime()) / 6048e5);
  return weeks === 0
    ? "this week"
    : weeks === 1
      ? "next week"
      : weeks === -1
        ? "last week"
        : undefined;
}

/**
 * Two weeks as one ruled board: the week to review on the left, narrower, the week to plan on
 * the right. Each day is a column of what it holds; a programmed session can be dragged to any
 * other day of either week, and the day it would land on is outlined dashed until it does.
 */
export function Board({
  weeks,
  todayIso,
  todayMonday,
  selected,
  onSelect,
  drag,
}: {
  readonly weeks: readonly [ReadonlyArray<CalendarDay>, ReadonlyArray<CalendarDay>];
  readonly todayIso: string;
  readonly todayMonday: string;
  readonly selected: ProgrammedSessionId | undefined;
  readonly onSelect: (id: ProgrammedSessionId | undefined) => void;
  readonly drag: DragHandlers;
}) {
  const [over, setOver] = useState<string | null>(null);
  return (
    <div className="grid min-h-0 grid-cols-[5fr_7fr] border-b">
      {weeks.map((days, index) => {
        const monday = days[0]?.iso ?? todayIso;
        const sunday = days[6]?.iso ?? todayIso;
        const relative = relativeWeek(monday, todayMonday);
        return (
          <section
            key={monday}
            aria-label={`Week ${weekNumber(monday)}`}
            className={
              index === 0
                ? "grid min-h-0 grid-rows-[auto_minmax(0,1fr)]"
                : "grid min-h-0 grid-rows-[auto_minmax(0,1fr)] border-l-2 border-foreground"
            }
          >
            <header className="flex items-end justify-between gap-3 border-b-2 border-foreground px-3 pt-3 pb-1.5">
              <h2 className="protocol-title text-xl">Week {weekNumber(monday)}</h2>
              <span className="form-label text-muted-foreground">
                {formatShort(monday)} – {formatShort(sunday)}
                {relative === undefined ? null : ` · ${relative}`}
              </span>
            </header>
            <ol data-cal-scroll className="grid min-h-0 grid-cols-7 overflow-y-auto">
              {days.map((day) => (
                <DayColumn
                  key={day.iso}
                  day={day}
                  todayIso={todayIso}
                  selected={selected}
                  onSelect={onSelect}
                  drag={drag}
                  over={over === day.iso}
                  onOver={setOver}
                  brief={index === 0}
                />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function DayColumn({
  day,
  todayIso,
  selected,
  onSelect,
  drag,
  over,
  onOver,
  brief,
}: {
  readonly day: CalendarDay;
  readonly todayIso: string;
  readonly selected: ProgrammedSessionId | undefined;
  readonly onSelect: (id: ProgrammedSessionId | undefined) => void;
  readonly drag: DragHandlers;
  readonly over: boolean;
  readonly onOver: (iso: string | null) => void;
  /** The review week: cards print their title and lamp, the lines open in the rail. */
  readonly brief: boolean;
}) {
  const date = toDate(day.iso);
  const isToday = day.iso === todayIso;
  const empty = day.workouts.length === 0 && day.plans.length === 0 && day.sessions.length === 0;
  return (
    <li
      data-board-day
      data-today={isToday || undefined}
      data-drop={(over && drag.dragging !== null) || undefined}
      aria-label={date.toDateString()}
      aria-current={isToday ? "date" : undefined}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(SESSION_DRAG_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (!over) onOver(day.iso);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onOver(null);
      }}
      onDrop={(event) => {
        const id = event.dataTransfer.getData(SESSION_DRAG_TYPE);
        onOver(null);
        if (id === "") return;
        event.preventDefault();
        drag.onDrop(id as ProgrammedSessionId, day.iso);
      }}
      className={
        brief
          ? "flex min-w-0 flex-col gap-1.5 border-r px-1 pt-2 pb-6 last:border-r-0"
          : "flex min-w-0 flex-col gap-1.5 border-r px-1.5 pt-2 pb-6 last:border-r-0"
      }
    >
      <div className="flex items-baseline justify-between gap-1 border-b px-0.5 pb-1">
        <span className="form-label text-muted-foreground">{weekdayFormat.format(date)}</span>
        <span className="text-base font-semibold leading-5">{date.getDate()}</span>
      </div>
      {day.rest === undefined ? null : (
        <span
          title={`${REST_DAY_LABELS[day.rest.kind]}, marked by ${day.rest.source === "coach" ? "the coach" : "you"}`}
          className="flex min-w-0 items-center gap-1.5 px-0.5"
        >
          <span data-heat="rest" aria-hidden className="size-3 shrink-0" />
          <span className="form-label">{REST_WORDS[day.rest.kind]}</span>
          {day.rest.source === "coach" ? (
            <span className="sr-only">, marked by the coach</span>
          ) : null}
        </span>
      )}
      {day.workouts.map((workout) => (
        <div
          key={workout.id}
          data-board-card="logged"
          className="grid gap-1 overflow-hidden px-1.5 py-1"
        >
          <span
            title={workout.name}
            className={
              brief
                ? "line-clamp-2 text-xs font-semibold leading-4 font-stretch-condensed 2xl:font-stretch-semi-condensed"
                : "line-clamp-2 min-w-0 text-xs font-semibold leading-4 font-stretch-semi-condensed"
            }
          >
            {workout.name}
          </span>
          <span className="flex flex-wrap items-center justify-between gap-1">
            {workout.score === "" ? (
              <span />
            ) : (
              <span
                data-chip
                data-measure="score"
                className="w-fit px-1 text-xs leading-5 font-semibold"
              >
                {workout.score}
              </span>
            )}
            <Lamp state="good" label="Logged" />
          </span>
        </div>
      ))}
      {day.plans.map((plan) => (
        <div key={plan.id} data-plan-box className="grid gap-0.5 px-1.5 py-1">
          <span className="text-xs font-semibold leading-4 text-balance">{plan.name}</span>
          <span className="form-label text-muted-foreground">Box plan</span>
        </div>
      ))}
      {day.sessions.map((entry) => (
        <SessionCard
          key={entry.session.id}
          entry={entry}
          todayIso={todayIso}
          selected={selected === entry.session.id}
          onSelect={onSelect}
          drag={drag}
          brief={brief}
        />
      ))}
      {empty && day.rest === undefined && day.iso < todayIso ? (
        <span data-empty aria-label="Nothing" className="px-1 pt-1" />
      ) : null}
      {day.workouts.length === 0 ? (
        <span className="mt-auto flex justify-end pt-2">
          <RestMark iso={day.iso} rest={day.rest} />
        </span>
      ) : null}
    </li>
  );
}

/** One referee lamp in its ink housing, sized for a board card. */
function Lamp({ state, label }: { readonly state: "good" | "off"; readonly label: string }) {
  return (
    <span data-lamps data-size="sm" role="img" aria-label={label} className="flex shrink-0 p-px">
      <span data-lamp={state} />
    </span>
  );
}

/** A rest mark in one short word, so the narrowest column prints it whole. */
const REST_WORDS: Record<RestDayKind, string> = {
  rest: "Rest",
  sick: "Sick",
  injured: "Injured",
  travel: "Travel",
};

const STATE_WORDS = {
  done: "Done",
  partial: "Partly done",
  missed: "Missed",
  open: undefined,
} as const;

/** A programmed session on the board: its block and title, its first lines, its lamp. */
export function SessionCard({
  entry,
  todayIso,
  selected,
  onSelect,
  drag,
  showDay = false,
  brief = false,
}: {
  readonly entry: CalendarSession;
  readonly todayIso: string;
  readonly selected: boolean;
  readonly onSelect: (id: ProgrammedSessionId | undefined) => void;
  readonly drag: DragHandlers;
  readonly showDay?: boolean;
  /** Title and lamp only, for the review week and the drafts tray. */
  readonly brief?: boolean;
}) {
  const { session, block } = entry;
  const state = sessionState(entry, todayIso);
  const shown = numberedLines(session).slice(0, brief ? 1 : 2);
  const more = brief && !showDay ? 0 : session.lines.length - shown.length;
  // In a short window a board card prints only its first line, so the plan week fits its height.
  const narrowHidden = brief || showDay ? 0 : Math.max(0, shown.length - 1);
  const words = STATE_WORDS[state];
  const lit = session.day <= todayIso && block.status === "scheduled";
  return (
    <button
      type="button"
      draggable
      data-board-card="session"
      data-draft={block.status === "draft" || undefined}
      data-selected={selected || undefined}
      data-carbon={drag.dragging === session.id || undefined}
      aria-pressed={selected}
      title={`${block.name} · ${session.title}`}
      onClick={() => onSelect(selected ? undefined : session.id)}
      onDragStart={(event) => {
        event.dataTransfer.setData(SESSION_DRAG_TYPE, session.id);
        event.dataTransfer.effectAllowed = "move";
        drag.onDragStart(session.id);
      }}
      onDragEnd={drag.onDragEnd}
      className="relative grid w-full cursor-grab grid-cols-[minmax(0,1fr)] gap-1 overflow-hidden px-1.5 py-1 text-left active:cursor-grabbing"
    >
      {drag.landed === session.id ? <span data-flash aria-hidden /> : null}
      <span className="block min-w-0">
        {block.status === "draft" ? <span className="sr-only">Draft: </span> : null}
        {brief || showDay ? null : (
          <span className="form-label block truncate text-muted-foreground">
            {shortBlockName(block.name)}
          </span>
        )}
        <span
          className={
            brief && !showDay
              ? "line-clamp-2 block text-xs font-semibold leading-4 font-stretch-condensed 2xl:font-stretch-semi-condensed"
              : "line-clamp-2 block text-xs font-semibold leading-4 font-stretch-semi-condensed"
          }
        >
          {showDay ? `${formatShort(session.day)} · ` : ""}
          {session.title}
        </span>
      </span>
      {brief && !showDay
        ? null
        : shown.map(({ line, position }) => (
            <span
              key={position}
              className={
                position === 0
                  ? "grid min-w-0 grid-cols-[minmax(0,1fr)] text-xs leading-4"
                  : "hidden min-w-0 grid-cols-[minmax(0,1fr)] text-xs leading-4 tall:grid"
              }
            >
              <span className="line-clamp-2 text-muted-foreground font-stretch-semi-condensed">
                {line.name}
              </span>
              <LineDose line={line} maxes={block.trainingMaxes} compact />
            </span>
          ))}
      {more + narrowHidden > 0 || words !== undefined || lit ? (
        <span className="flex flex-wrap items-center justify-between gap-1">
          <span className="form-label text-muted-foreground tall:hidden">
            {[more + narrowHidden > 0 ? `+${more + narrowHidden} more` : undefined, words]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span className="form-label hidden text-muted-foreground tall:inline">
            {[more > 0 ? `+${more} more` : undefined, words].filter(Boolean).join(" · ")}
          </span>
          {lit ? (
            <Lamp state={state === "done" ? "good" : "off"} label={words ?? "Not done"} />
          ) : null}
        </span>
      ) : null}
    </button>
  );
}
