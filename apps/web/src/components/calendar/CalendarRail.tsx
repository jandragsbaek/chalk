import type { BlockId, MovementId, RestDay, TrainingBlock, TrainingMax } from "@chalk/contracts";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@chalk/ui/components/alert-dialog.tsx";
import { Button } from "@chalk/ui/components/button.tsx";
import { Input } from "@chalk/ui/components/field.tsx";
import { useState } from "react";

import { blockSpan, monthWeeks, type CalendarDay } from "../../lib/calendar.ts";
import type { TrainingDay } from "../../lib/dashboard.ts";
import { toDate } from "../../lib/progress.ts";
import { heatOf } from "../today/YearGrid.tsx";
import { formatShort } from "../today/SectionHead.tsx";
import { kgText } from "./SessionLines.tsx";

const monthFormat = new Intl.DateTimeFormat(undefined, { month: "long" });
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** What the month grids mark on a day still to come. */
export type PlannedMark = "scheduled" | "draft";

/**
 * A month as a grid of days in Today's cell vocabulary: past days shaded by sessions, days with
 * programmed work marked, the board's two weeks on the ruled tint, today double-outlined.
 * Picking a day moves the board to its week.
 */
function MonthGrid({
  year,
  month,
  todayIso,
  trained,
  rest,
  planned,
  window,
  onPick,
}: {
  readonly year: number;
  readonly month: number;
  readonly todayIso: string;
  readonly trained: ReadonlyMap<string, TrainingDay>;
  readonly rest: ReadonlyMap<string, RestDay>;
  readonly planned: ReadonlyMap<string, PlannedMark>;
  readonly window: { readonly from: string; readonly to: string };
  readonly onPick: (iso: string) => void;
}) {
  const weeks = monthWeeks(year, month);
  return (
    <div className="grid gap-1.5">
      <div className="flex items-end justify-between border-b-2 border-foreground pb-1">
        <h3 className="protocol-title text-lg">{monthFormat.format(new Date(year, month, 1))}</h3>
        <span className="form-label text-muted-foreground">{year}</span>
      </div>
      <table className="w-full table-fixed border-separate border-spacing-0.5">
        <thead>
          <tr>
            {WEEKDAYS.map((label) => (
              <th
                key={label}
                scope="col"
                className="form-label font-semibold text-muted-foreground"
              >
                <abbr title={label} className="no-underline">
                  {label.slice(0, 1)}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]?.iso}>
              {week.map(({ iso, inMonth }) =>
                !inMonth ? (
                  <td key={iso} />
                ) : (
                  <td key={iso} className="p-0">
                    <button
                      type="button"
                      data-month-day
                      data-heat={heatOf(iso, todayIso, trained.get(iso), rest.get(iso))}
                      data-planned={planned.get(iso)}
                      data-window={(iso >= window.from && iso <= window.to) || undefined}
                      data-today={iso === todayIso || undefined}
                      aria-label={`${toDate(iso).toDateString()}${planned.has(iso) ? ", programmed work" : ""}`}
                      onClick={() => onPick(iso)}
                      className="relative block h-7 w-full px-1 text-left text-xs leading-4 tabular-nums"
                    >
                      {toDate(iso).getDate()}
                    </button>
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TrainingMaxField({
  max,
  name,
  onSave,
}: {
  readonly max: TrainingMax;
  readonly name: string;
  readonly onSave: (kg: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  if (!editing)
    return (
      <button
        type="button"
        onClick={() => {
          setText(String(max.kg));
          setEditing(true);
        }}
        className="flex w-full items-baseline justify-between gap-2 text-left text-xs hover:text-foreground"
      >
        <span className="text-muted-foreground">TM {name}</span>
        <span className="font-semibold underline decoration-input decoration-dotted underline-offset-2">
          {kgText(max.kg)}
        </span>
      </button>
    );
  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        const kg = Number(text.replace(",", "."));
        if (Number.isFinite(kg) && kg > 0 && kg <= 1000 && kg !== max.kg) onSave(kg);
        setEditing(false);
      }}
    >
      <label className="sr-only" htmlFor={`tm-${max.movementId}`}>
        Training max for {name}, kg
      </label>
      <span className="text-xs text-muted-foreground">TM {name}</span>
      <Input
        id={`tm-${max.movementId}`}
        inputMode="decimal"
        value={text}
        autoFocus
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setEditing(false);
        }}
        className="w-20"
      />
      <Button type="submit" size="sm" variant="outline" className="h-7">
        Set
      </Button>
    </form>
  );
}

/** One block in the rail: its span, how far it has come, its training maxes, and removing it. */
function BlockRow({
  block,
  done,
  names,
  onSetMax,
  onRemove,
  onJump,
}: {
  readonly block: TrainingBlock;
  readonly done: number;
  readonly names: ReadonlyMap<MovementId, string>;
  readonly onSetMax: (id: BlockId, max: TrainingMax) => void;
  readonly onRemove: (id: BlockId) => void;
  readonly onJump: (iso: string) => void;
}) {
  const span = blockSpan(block);
  return (
    <li className="grid gap-1.5 border-b py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <button
          type="button"
          onClick={() => span && onJump(span.from)}
          className="min-w-0 text-left text-sm font-semibold leading-5 hover:underline"
        >
          {block.name}
        </button>
        <span className="form-label shrink-0 text-muted-foreground">
          {done} / {block.sessions.length}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">
        {span === undefined ? "No sessions" : `${formatShort(span.from)} – ${formatShort(span.to)}`}
        {block.source === "coach" ? " · from the coach" : ""}
      </span>
      <div data-block-progress aria-hidden className="h-1.5">
        <span
          className="block h-full"
          style={{ width: `${(done / Math.max(1, block.sessions.length)) * 100}%` }}
        />
      </div>
      {block.trainingMaxes.map((max) => (
        <TrainingMaxField
          key={max.movementId}
          max={max}
          name={names.get(max.movementId) ?? max.movementId}
          onSave={(kg) => onSetMax(block.id, { movementId: max.movementId, kg })}
        />
      ))}
      <AlertDialog>
        <AlertDialogTrigger
          render={<Button variant="ghost-destructive" size="sm" className="-ml-3 h-7 w-fit" />}
        >
          Remove block
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Remove {block.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            All {block.sessions.length} of its sessions leave the calendar, done ones included. Sets
            you logged stay in your log.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Keep it</AlertDialogClose>
            <AlertDialogClose
              render={<Button variant="destructive" />}
              onClick={() => onRemove(block.id)}
            >
              Remove
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

/** The rail at rest: this month and the next, then the blocks in the calendar. */
export function CalendarRail({
  anchor,
  todayIso,
  trained,
  rest,
  planned,
  window,
  blocks,
  doneByBlock,
  names,
  onPick,
  onSetMax,
  onRemoveBlock,
}: {
  readonly anchor: string;
  readonly todayIso: string;
  readonly trained: ReadonlyMap<string, TrainingDay>;
  readonly rest: ReadonlyMap<string, RestDay>;
  readonly planned: ReadonlyMap<string, PlannedMark>;
  readonly window: { readonly from: string; readonly to: string };
  readonly blocks: ReadonlyArray<TrainingBlock>;
  readonly doneByBlock: ReadonlyMap<BlockId, number>;
  readonly names: ReadonlyMap<MovementId, string>;
  readonly onPick: (iso: string) => void;
  readonly onSetMax: (id: BlockId, max: TrainingMax) => void;
  readonly onRemoveBlock: (id: BlockId) => void;
}) {
  const first = toDate(anchor);
  const months = [
    { year: first.getFullYear(), month: first.getMonth() },
    {
      year: first.getMonth() === 11 ? first.getFullYear() + 1 : first.getFullYear(),
      month: (first.getMonth() + 1) % 12,
    },
  ];
  const scheduled = blocks.filter((block) => block.status === "scheduled");
  return (
    <div className="grid content-start gap-6 px-5 py-5">
      {months.map(({ year, month }) => (
        <MonthGrid
          key={`${year}-${month}`}
          year={year}
          month={month}
          todayIso={todayIso}
          trained={trained}
          rest={rest}
          planned={planned}
          window={window}
          onPick={onPick}
        />
      ))}
      <p className="-mt-3 flex flex-wrap gap-x-3 gap-y-1 form-label text-muted-foreground">
        <span className="flex items-center gap-1">
          <span data-legend="scheduled" aria-hidden /> Programmed
        </span>
        <span className="flex items-center gap-1">
          <span data-legend="draft" aria-hidden /> Draft
        </span>
        <span className="flex items-center gap-1">
          <span data-legend="window" aria-hidden /> On the board
        </span>
      </p>
      <section aria-labelledby="blocks-title" className="grid">
        <div className="flex items-end justify-between border-b-2 border-foreground pb-1">
          <h3 id="blocks-title" className="protocol-title text-lg">
            Blocks
          </h3>
          <span className="form-label text-muted-foreground">{scheduled.length} in calendar</span>
        </div>
        {scheduled.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">
            None yet. A block the coach drafts waits under the board until you put it in the
            calendar.
          </p>
        ) : (
          <ul>
            {scheduled.map((block) => (
              <BlockRow
                key={block.id}
                block={block}
                done={doneByBlock.get(block.id) ?? 0}
                names={names}
                onSetMax={onSetMax}
                onRemove={onRemoveBlock}
                onJump={onPick}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Days with programmed work, scheduled winning over draft, for the month grids. */
export function plannedDays(days: ReadonlyArray<CalendarDay>): ReadonlyMap<string, PlannedMark> {
  const marks = new Map<string, PlannedMark>();
  for (const day of days)
    for (const entry of day.sessions)
      if (entry.block.status === "scheduled") marks.set(day.iso, "scheduled");
      else if (!marks.has(day.iso)) marks.set(day.iso, "draft");
  return marks;
}
