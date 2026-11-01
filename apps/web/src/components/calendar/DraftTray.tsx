import type { BlockId, MovementId, ProgrammedSessionId, TrainingBlock } from "@chalk/contracts";
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
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import { blockSpan, weekNumber, type CalendarSession } from "../../lib/calendar.ts";
import { formatShort } from "../today/SectionHead.tsx";
import { SessionCard, type DragHandlers } from "./Board.tsx";
import { kgText } from "./SessionLines.tsx";

/**
 * The shelf under the board: blocks the coach drafted, each with its reasoning and every session
 * it proposes, grouped by week. The board shows the same sessions dashed on their days; a card
 * here can be dragged onto any day there. Putting the block in the calendar makes them solid.
 */
export function DraftTray({
  drafts,
  sessionsOf,
  todayIso,
  names,
  selected,
  onOpen,
  drag,
  onSchedule,
  onDiscard,
  busy,
}: {
  readonly drafts: ReadonlyArray<TrainingBlock>;
  readonly sessionsOf: (block: TrainingBlock) => ReadonlyArray<CalendarSession>;
  readonly todayIso: string;
  readonly names: ReadonlyMap<MovementId, string>;
  readonly selected: ProgrammedSessionId | undefined;
  /** Selects a session and moves the board to its week; undefined clears the selection. */
  readonly onOpen: (id: ProgrammedSessionId | undefined) => void;
  readonly drag: DragHandlers;
  readonly onSchedule: (id: BlockId) => void;
  readonly onDiscard: (id: BlockId) => void;
  readonly busy: boolean;
}) {
  if (drafts.length === 0)
    return (
      <aside
        aria-label="Drafts"
        className="flex items-center justify-between gap-4 border-t bg-card px-4 py-3"
      >
        <p className="text-sm text-muted-foreground">
          No drafts. Ask the coach for a strength cycle or a prehab block; its draft waits here
          until you put it in the calendar.
        </p>
        <Link
          to="/coach"
          className="form-label inline-flex shrink-0 items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          Ask the coach
          <ArrowRight aria-hidden className="size-3" />
        </Link>
      </aside>
    );

  return (
    <aside
      aria-label="Drafts"
      data-cal-scroll
      className="max-h-72 overflow-y-auto border-t-2 border-foreground bg-card"
    >
      {[...drafts]
        .sort((a, b) => (blockSpan(a)?.from ?? "").localeCompare(blockSpan(b)?.from ?? ""))
        .map((block) => (
          <DraftRow
            key={block.id}
            block={block}
            entries={sessionsOf(block)}
            todayIso={todayIso}
            names={names}
            selected={selected}
            onOpen={onOpen}
            drag={drag}
            onSchedule={onSchedule}
            onDiscard={onDiscard}
            busy={busy}
          />
        ))}
    </aside>
  );
}

/**
 * One draft as a row: its name, span and training max, the coach's reason, and the two calls to
 * make on it. Its sessions fold out under it on demand; the board already shows the ones in its
 * two weeks dashed on their days.
 */
function DraftRow({
  block,
  entries,
  todayIso,
  names,
  selected,
  onOpen,
  drag,
  onSchedule,
  onDiscard,
  busy,
}: {
  readonly block: TrainingBlock;
  readonly entries: ReadonlyArray<CalendarSession>;
  readonly todayIso: string;
  readonly names: ReadonlyMap<MovementId, string>;
  readonly selected: ProgrammedSessionId | undefined;
  readonly onOpen: (id: ProgrammedSessionId | undefined) => void;
  readonly drag: DragHandlers;
  readonly onSchedule: (id: BlockId) => void;
  readonly onDiscard: (id: BlockId) => void;
  readonly busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const span = blockSpan(block);
  const weeks = new Map<number, Array<CalendarSession>>();
  for (const entry of entries) {
    const week = weekNumber(entry.session.day);
    weeks.set(week, [...(weeks.get(week) ?? []), entry]);
  }
  const listId = `draft-sessions-${block.id}`;
  return (
    <section aria-labelledby={`draft-${block.id}`} className="border-b last:border-b-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 px-4 py-2.5">
        <div className="grid min-w-0 gap-0.5">
          <div className="flex min-w-0 items-baseline gap-3">
            <h2 id={`draft-${block.id}`} className="protocol-title truncate text-xl">
              {block.name}
            </h2>
            <span className="form-label shrink-0 text-muted-foreground">
              {block.source === "coach" ? "Coach draft" : "Draft"}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {span === undefined ? "" : `${formatShort(span.from)} – ${formatShort(span.to)} · `}
            {block.sessions.length} sessions
            {block.trainingMaxes.length > 0
              ? ` · TM ${block.trainingMaxes
                  .map((max) => `${names.get(max.movementId) ?? max.movementId} ${kgText(max.kg)}`)
                  .join(", ")}`
              : ""}
            {block.goal === "" ? "" : ` · ${block.goal}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen(!open)}
          >
            {open ? <ChevronUp /> : <ChevronDown />}
            {open ? "Hide sessions" : "Sessions"}
          </Button>
          <Button size="sm" disabled={busy} onClick={() => onSchedule(block.id)}>
            Put in calendar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button variant="ghost-destructive" size="sm" disabled={busy} />}
            >
              Discard
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogTitle>Discard {block.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                The draft and its {block.sessions.length} sessions go. The coach can draft it again
                from the conversation.
              </AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogClose render={<Button variant="outline" />}>Keep it</AlertDialogClose>
                <AlertDialogClose
                  render={<Button variant="destructive" />}
                  onClick={() => onDiscard(block.id)}
                >
                  Discard
                </AlertDialogClose>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {open ? (
        <div id={listId} className="grid gap-2 px-4 pb-3">
          {block.goal === "" ? null : (
            <p className="max-w-prose text-sm text-pretty">{block.goal}</p>
          )}
          <ol
            aria-label="Proposed sessions"
            data-cal-scroll
            className="flex min-w-0 gap-3 overflow-x-auto pb-1"
          >
            {[...weeks].map(([week, sessions]) => (
              <li key={week} className="grid shrink-0 grid-rows-[auto_1fr] gap-1.5">
                <span className="form-label border-b pb-0.5 text-muted-foreground">
                  Week {week}
                </span>
                <ul className="flex gap-1.5">
                  {sessions.map((entry) => (
                    <li key={entry.session.id} className="w-36">
                      <SessionCard
                        entry={entry}
                        todayIso={todayIso}
                        selected={selected === entry.session.id}
                        onSelect={onOpen}
                        drag={drag}
                        showDay
                      />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            Drag a session onto a day of the board to move it before you put the block in; the rest
            keep the coach's days.
          </p>
        </div>
      ) : null}
    </section>
  );
}
