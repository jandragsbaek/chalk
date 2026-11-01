import {
  placePhrase,
  sessionPhrase,
  sessionTypeOf,
  type MovementId,
  type PartRef,
  type SessionEntry,
  type Workout,
} from "@chalk/contracts";
import { Badge } from "@chalk/ui/components/badge.tsx";
import { Button } from "@chalk/ui/components/button.tsx";
import { Input, NativeSelect } from "@chalk/ui/components/field.tsx";
import { Link } from "@tanstack/react-router";
import { Repeat2, X } from "lucide-react";
import type * as React from "react";

import {
  entryDay,
  entryKey,
  type MonthGroup,
  type MovementOption,
  type SessionFilter,
} from "../../lib/sessions.ts";
import { entryPlace, placeCode } from "../../lib/places.ts";
import { WORKOUT_KIND_LABELS } from "../../lib/workoutKinds.ts";
import { monthSectionId } from "./SessionRail.tsx";

const longMonth = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" });

const asDate = (iso: string) => new Date(`${iso}T00:00:00`);

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const shortDay = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

/** "WOD class with Rikke L." when its type is known; else its format, then any coach. */
const workoutLead = (workout: Workout) => {
  const phrase = sessionPhrase(workout);
  if (sessionTypeOf(workout) !== undefined) return phrase;
  const kind = WORKOUT_KIND_LABELS[workout.kind];
  return phrase === undefined ? kind : `${kind} · ${phrase}`;
};

function Row({
  entry,
  selected,
  nameOf,
  repeats,
}: {
  readonly entry: SessionEntry;
  readonly selected: boolean;
  readonly nameOf: (id: MovementId) => string;
  /** The latest earlier session one of its parts repeats. */
  readonly repeats: PartRef | undefined;
}) {
  const day = entryDay(entry);
  const place = entryPlace(entry);
  const movements = entry.movementIds.map(nameOf).join(", ");
  const setCount =
    entry._tag === "workout" ? entry.liftSetCount + entry.daySets.length : entry.daySets.length;
  return (
    <li>
      <Link
        to="/workouts"
        search={(previous) => ({ ...previous, session: entryKey(entry) })}
        replace
        data-session-row={entryKey(entry)}
        aria-current={selected ? "true" : undefined}
        className={
          selected
            ? "grid min-h-12 scroll-mt-12 grid-cols-[2.75rem_2.5rem_minmax(0,1fr)_auto] items-center gap-x-2 border-b bg-muted px-4 py-1.5 outline-3 outline-double -outline-offset-4 outline-foreground"
            : "grid min-h-12 scroll-mt-12 grid-cols-[2.75rem_2.5rem_minmax(0,1fr)_auto] items-center gap-x-2 border-b px-4 py-1.5 transition-colors duration-150 hover:bg-muted"
        }
      >
        <time dateTime={day} className="grid leading-tight">
          <span className="form-label text-muted-foreground">{weekday.format(asDate(day))}</span>
          <span className="font-semibold tabular-nums font-stretch-semi-condensed">
            {day.slice(8)}
          </span>
        </time>
        <span
          className="grid leading-tight text-muted-foreground"
          title={`Session ${entry.number} ${placePhrase(place)}`}
        >
          <span className="text-xs font-semibold tabular-nums text-foreground">{entry.number}</span>
          <span className="form-label">{placeCode(place)}</span>
        </span>
        <span className="grid min-w-0">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-semibold">
              {entry._tag === "workout" ? entry.workout.name : "Strength day"}
            </span>
            {repeats ? (
              <span
                className="flex shrink-0 items-center text-muted-foreground"
                title={`Repeats ${repeats.title} from ${shortDay.format(asDate(repeats.performedOn))}`}
              >
                <Repeat2 aria-hidden className="size-3.5" />
                <span className="sr-only">
                  Repeats {repeats.title} from {shortDay.format(asDate(repeats.performedOn))}
                </span>
              </span>
            ) : null}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {entry._tag === "workout" ? workoutLead(entry.workout) : "Lift sets"}
            {movements === "" ? "" : ` · ${movements}`}
          </span>
        </span>
        <span className="justify-self-end">
          {entry._tag === "workout" && entry.workout.score !== "" ? (
            <span
              data-tag="score"
              data-chip
              className="block max-w-28 truncate px-1.5 text-sm font-semibold"
            >
              {entry.workout.score}
            </span>
          ) : setCount > 0 ? (
            <Badge variant="muted">{plural(setCount, "set", "sets")}</Badge>
          ) : (
            <span data-empty aria-label="No score" />
          )}
        </span>
      </Link>
    </li>
  );
}

/**
 * The register: every session under sticky month heads, newest first, with its filters on top.
 * Rows are links that open the session in the sheet beside it.
 */
export function SessionRegister({
  groups,
  total,
  shown,
  filter,
  movementOptions,
  years,
  selectedKey,
  nameOf,
  repeatsEarlier,
  scrollRef,
  onScroll,
  onScrollByHand,
  onFilter,
}: {
  readonly groups: ReadonlyArray<MonthGroup>;
  readonly total: number;
  readonly shown: number;
  readonly filter: SessionFilter;
  readonly movementOptions: ReadonlyArray<MovementOption>;
  readonly years: ReadonlyArray<string>;
  readonly selectedKey: string | undefined;
  readonly nameOf: (id: MovementId) => string;
  readonly repeatsEarlier: (workoutId: string) => PartRef | undefined;
  readonly scrollRef: React.Ref<HTMLDivElement>;
  readonly onScroll: () => void;
  /** The wheel, a drag or a touch moved the register, not a month tab. */
  readonly onScrollByHand: () => void;
  readonly onFilter: (filter: Partial<SessionFilter>) => void;
}) {
  const filtered =
    filter.query !== "" || filter.movement !== undefined || filter.year !== undefined;

  return (
    <section aria-label="Sessions" className="flex min-h-0 flex-col border-r bg-card">
      <div className="grid gap-2 border-b bg-background px-4 pb-3 pt-5">
        <div className="flex items-end justify-between gap-3 border-b-2 border-foreground pb-2">
          <h1 className="protocol-title text-4xl">Workouts</h1>
          <span className="form-label text-muted-foreground">
            {filtered ? `${shown} of ${total}` : plural(total, "session", "sessions")}
          </span>
        </div>
        <Input
          type="search"
          value={filter.query}
          placeholder="Name, score, notes or movement"
          aria-label="Search sessions"
          className="mt-1"
          onChange={(event) => onFilter({ query: event.target.value })}
        />
        <div className="flex gap-2">
          <NativeSelect
            aria-label="Movement"
            value={filter.movement ?? ""}
            onChange={(event) =>
              onFilter({
                movement:
                  event.target.value === "" ? undefined : (event.target.value as MovementId),
              })
            }
          >
            <option value="">Any movement</option>
            {movementOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} ({option.sessions})
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Year"
            className="w-32 shrink-0"
            value={filter.year ?? ""}
            onChange={(event) =>
              onFilter({ year: event.target.value === "" ? undefined : event.target.value })
            }
          >
            <option value="">All years</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        onWheel={onScrollByHand}
        onPointerDown={onScrollByHand}
        onTouchStart={onScrollByHand}
        data-register-scroll
        className="relative min-h-0 flex-1 overflow-y-auto pb-10"
      >
        {total === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">
            No sessions yet.{" "}
            <Link to="/log" className="underline">
              Log one
            </Link>{" "}
            or{" "}
            <Link to="/import" className="underline">
              import your old log
            </Link>
            ; every training day lands here.
          </p>
        ) : groups.length === 0 ? (
          <div className="grid justify-items-start gap-3 px-4 py-8">
            <p className="text-sm text-muted-foreground">
              No sessions match these filters. Search looks at names, scores, notes and movement
              names.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onFilter({ query: "", movement: undefined, year: undefined })}
            >
              <X />
              Clear filters
            </Button>
          </div>
        ) : (
          groups.map((group) => (
            <section
              key={group.month}
              id={monthSectionId(group.month)}
              data-month={group.month}
              aria-label={longMonth.format(asDate(`${group.month}-01`))}
            >
              <div className="sticky top-0 z-10 flex items-end justify-between gap-3 border-b-2 border-foreground bg-background px-4 pb-1.5 pt-3">
                <h2 className="protocol-title text-xl">
                  {longMonth.format(asDate(`${group.month}-01`))}
                </h2>
                <span className="form-label text-muted-foreground">
                  {filtered
                    ? `${group.entries.length} of ${group.total}`
                    : plural(group.total, "session", "sessions")}
                </span>
              </div>
              <ul>
                {group.entries.map((entry) => (
                  <Row
                    key={entryKey(entry)}
                    entry={entry}
                    selected={entryKey(entry) === selectedKey}
                    nameOf={nameOf}
                    repeats={
                      entry._tag === "workout" ? repeatsEarlier(entry.workout.id) : undefined
                    }
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </section>
  );
}
