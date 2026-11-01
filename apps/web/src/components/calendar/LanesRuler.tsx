import type { TrainingBlock } from "@chalk/contracts";

import {
  blockSpan,
  daysFrom,
  sessionState,
  weekNumber,
  type CalendarSession,
} from "../../lib/calendar.ts";
import { toDate } from "../../lib/progress.ts";

const monthFormat = new Intl.DateTimeFormat(undefined, { month: "short" });

/** Lanes the ruler draws before it says how many more blocks run in its span. */
const MAX_LANES = 4;

const percent = (value: number) => `${value * 100}%`;

/**
 * The season in miniature: twelve weeks as columns, each block a lane from its first session to
 * its last with a tick per session (filled once done), the two weeks on the board bracketed by
 * the selection double outline. Picking a week moves the board there.
 */
export function LanesRuler({
  weeks,
  windowStart,
  todayIso,
  blocks,
  sessionsOf,
  onPick,
}: {
  /** Mondays, oldest first. */
  readonly weeks: ReadonlyArray<string>;
  /** Index into `weeks` of the board's first week. */
  readonly windowStart: number;
  readonly todayIso: string;
  readonly blocks: ReadonlyArray<TrainingBlock>;
  /** Each block's sessions with their done state, for the ticks. */
  readonly sessionsOf: (block: TrainingBlock) => ReadonlyArray<CalendarSession>;
  readonly onPick: (monday: string) => void;
}) {
  const start = weeks[0] ?? todayIso;
  const total = weeks.length * 7;
  const end = weeks.at(-1) ?? todayIso;
  const lanes = blocks.flatMap((block) => {
    const span = blockSpan(block);
    if (span === undefined || span.to < start || daysFrom(end, span.from) >= 7) return [];
    return [{ block, span }];
  });
  const shown = lanes.sort((a, b) => a.span.from.localeCompare(b.span.from)).slice(0, MAX_LANES);
  const todayAt = daysFrom(start, todayIso);

  return (
    <div
      role="group"
      aria-label="Blocks over twelve weeks"
      className="relative grid gap-1 border-b px-3 pt-2 pb-2.5"
    >
      <div className="relative grid grid-cols-12">
        {weeks.map((monday, index) => {
          const date = toDate(monday);
          const newMonth = index === 0 || date.getDate() <= 7;
          return (
            <button
              key={monday}
              type="button"
              data-ruler-week
              data-window={index === windowStart || index === windowStart + 1 || undefined}
              onClick={() => onPick(monday)}
              aria-label={`Show week ${weekNumber(monday)} on the board`}
              className="flex items-baseline gap-1.5 border-l px-1.5 py-0.5 text-left first:border-l-0"
            >
              <span className="form-label text-foreground">W{weekNumber(monday)}</span>
              {newMonth ? (
                <span className="form-label text-muted-foreground">{monthFormat.format(date)}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="relative grid gap-1">
        {shown.length === 0 ? (
          <p className="py-1 text-xs text-muted-foreground">
            No blocks in these weeks. Ask the coach for a cycle or a prehab block.
          </p>
        ) : (
          shown.map(({ block, span }) => {
            const from = Math.max(0, daysFrom(start, span.from));
            const to = Math.min(total - 1, daysFrom(start, span.to));
            return (
              <div key={block.id} className="relative h-6">
                <div
                  data-lane={block.status}
                  className="absolute inset-y-0 flex items-start overflow-visible pt-0.5"
                  style={{ left: percent(from / total), width: percent((to - from + 1) / total) }}
                >
                  <span className="relative z-10 truncate bg-card pr-1 pl-1.5 text-xs font-semibold whitespace-nowrap">
                    {block.status === "draft" ? "Draft · " : ""}
                    {block.name}
                  </span>
                </div>
                {sessionsOf(block).map((entry) => {
                  const at = daysFrom(start, entry.session.day);
                  if (at < 0 || at >= total) return null;
                  return (
                    <span
                      key={entry.session.id}
                      data-lane-tick={sessionState(entry, todayIso)}
                      aria-hidden
                      className="absolute bottom-0 h-1"
                      style={{ left: percent(at / total), width: percent(1 / total) }}
                    />
                  );
                })}
              </div>
            );
          })
        )}
        {lanes.length > shown.length ? (
          <span className="form-label text-muted-foreground">
            +{lanes.length - shown.length} more blocks in these weeks
          </span>
        ) : null}
        {todayAt >= 0 && todayAt < total ? (
          <span
            data-ruler-today
            aria-hidden
            className="absolute inset-y-0 w-0.5"
            style={{ left: percent(todayAt / total) }}
          />
        ) : null}
      </div>

      <span
        data-ruler-window
        aria-hidden
        className="pointer-events-none absolute inset-y-1"
        style={{
          left: `calc(0.75rem + (100% - 1.5rem) * ${windowStart / weeks.length})`,
          width: `calc((100% - 1.5rem) * ${2 / weeks.length})`,
        }}
      />
    </div>
  );
}
