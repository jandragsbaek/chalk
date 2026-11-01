import {
  IsoDate,
  type BlockId,
  type MovementId,
  type ProgrammedSessionId,
  type TrainingMax,
} from "@chalk/contracts";
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
import { Input, Label } from "@chalk/ui/components/field.tsx";
import { Check, X } from "lucide-react";
import * as Schema from "effect/Schema";
import { useId } from "react";

import { numberedLines, sessionState, type CalendarSession } from "../../lib/calendar.ts";
import { formatWeekday } from "../today/SectionHead.tsx";
import { TrainingMaxField } from "./CalendarRail.tsx";
import { LineDose } from "./SessionLines.tsx";

const isIsoDate = Schema.is(IsoDate);

/**
 * One programmed session read in full, in the rail: every line with its dose and how it is
 * done (a lamp when the log shows the lift, a tick box otherwise), the training max the loads
 * come from, and the day, which can be moved here as well as by dragging.
 */
export function SessionDetail({
  entry,
  todayIso,
  names,
  onClose,
  onMove,
  onTick,
  onRemove,
  onSetMax,
}: {
  readonly entry: CalendarSession;
  readonly todayIso: string;
  readonly names: ReadonlyMap<MovementId, string>;
  readonly onClose: () => void;
  readonly onMove: (id: ProgrammedSessionId, day: string) => void;
  readonly onTick: (id: ProgrammedSessionId, line: number, done: boolean) => void;
  readonly onRemove: (id: ProgrammedSessionId) => void;
  readonly onSetMax: (id: BlockId, max: TrainingMax) => void;
}) {
  const id = useId();
  const { session, block, done, logged } = entry;
  const state = sessionState(entry, todayIso);
  const draft = block.status === "draft";
  const maxes = block.trainingMaxes.filter((max) =>
    session.lines.some((line) => line.movementId === max.movementId && line.percent !== undefined),
  );

  return (
    <section aria-labelledby={`${id}-title`} className="grid content-start">
      <div className="flex items-start justify-between gap-2 px-5 pt-5">
        <h2 id={`${id}-title`} className="protocol-title min-w-0 text-2xl text-balance">
          {session.title}
        </h2>
        <Button variant="ghost" size="icon" aria-label="Close the session" onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="mx-5 mt-2 border-b-2 border-foreground" />

      <dl className="grid grid-cols-2 border-b">
        <div className="col-span-2 grid gap-0.5 border-b px-5 py-2">
          <dt className="form-label text-muted-foreground">{draft ? "Draft block" : "Block"}</dt>
          <dd className="text-sm font-semibold">{block.name}</dd>
        </div>
        <div className="grid gap-0.5 border-r px-5 py-2">
          <dt className="form-label text-muted-foreground">Day</dt>
          <dd className="text-sm font-semibold">{formatWeekday(session.day)}</dd>
        </div>
        <div className="grid gap-0.5 px-4 py-2">
          <dt className="form-label text-muted-foreground">Done</dt>
          <dd className="text-sm font-semibold">
            {done.filter(Boolean).length} of {session.lines.length}
            {state === "missed" ? (
              <span className="font-normal text-muted-foreground"> · missed</span>
            ) : null}
          </dd>
        </div>
      </dl>
      {session.note === undefined ? null : (
        <p className="border-b px-5 py-2 text-sm text-muted-foreground">{session.note}</p>
      )}

      <ul aria-label="Lines" className="grid border-b">
        {numberedLines(session).map(({ line, position: index }) => {
          const name =
            line.movementId === undefined ? line.name : (names.get(line.movementId) ?? line.name);
          const fromLog = logged[index] === true;
          return (
            <li key={index} className="grid gap-1 border-b px-5 py-2 last:border-b-0">
              <span className="flex items-start justify-between gap-3">
                <span
                  data-tag={line.movementId === undefined ? undefined : "movement"}
                  data-chip={line.movementId === undefined ? undefined : true}
                  className={
                    line.movementId === undefined
                      ? "text-sm font-semibold"
                      : "px-1.5 text-sm leading-6 font-semibold"
                  }
                >
                  {name}
                </span>
                {fromLog ? (
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="form-label text-muted-foreground">From your log</span>
                    <span data-lamps className="flex p-1">
                      <span data-lamp="good" aria-label="Logged" className="size-3" />
                    </span>
                  </span>
                ) : (
                  <label data-check className="-my-1 -mr-1.5 shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={done[index] === true}
                      disabled={draft}
                      onChange={(event) => onTick(session.id, index, event.target.checked)}
                    />
                    <span data-check-box aria-hidden>
                      <Check />
                    </span>
                    <span className="sr-only">Done: {name}</span>
                  </label>
                )}
              </span>
              <LineDose line={line} maxes={block.trainingMaxes} />
              {line.note === undefined ? null : (
                <span className="text-xs text-muted-foreground">{line.note}</span>
              )}
            </li>
          );
        })}
      </ul>

      {maxes.length > 0 ? (
        <div className="grid gap-1 border-b px-5 py-2.5">
          <span className="form-label text-muted-foreground">Training max</span>
          {maxes.map((max) => (
            <TrainingMaxField
              key={max.movementId}
              max={max}
              name={names.get(max.movementId) ?? max.movementId}
              onSave={(kg) => onSetMax(block.id, { movementId: max.movementId, kg })}
            />
          ))}
          <span className="text-xs text-muted-foreground">
            The percents in all of {block.name} come from it.
          </span>
        </div>
      ) : null}

      <div className="grid gap-3 px-5 py-4">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-day`}>Move to</Label>
          <Input
            id={`${id}-day`}
            type="date"
            value={session.day}
            onChange={(event) => {
              if (isIsoDate(event.target.value) && event.target.value !== session.day)
                onMove(session.id, event.target.value);
            }}
          />
          <span className="text-xs text-muted-foreground">
            Or drag the card to another day. Alt and the arrow keys move it a day at a time.
          </span>
        </div>
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant="ghost-destructive" size="sm" className="w-fit" />}
          >
            Remove this session
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Remove {session.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              It leaves {block.name}; the rest of the block stays where it is. Nothing you logged is
              touched.
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogClose render={<Button variant="outline" />}>Keep it</AlertDialogClose>
              <AlertDialogClose
                render={<Button variant="destructive" />}
                onClick={() => onRemove(session.id)}
              >
                Remove
              </AlertDialogClose>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
