import { cn } from "@chalk/ui/lib/utils.ts";
import { curveStepAfter } from "@visx/curve";
import { localPoint } from "@visx/event";
import { useParentSize } from "@visx/responsive";
import { scaleLinear, scaleTime } from "@visx/scale";
import { AreaClosed, LinePath } from "@visx/shape";
import { useState } from "react";

import {
  ChartFrame,
  DataTable,
  formatFullDay,
  formatMonthYear,
  kg,
  signedKg,
} from "./chartKit.tsx";
import {
  bestToDate,
  type BestPoint,
  clipSteps,
  MOCK_LIFTS,
  MOCK_TODAY,
  rangeStart,
  sessionEstimates,
  setsFor,
  toDate,
  type RangeId,
} from "./strengthData.ts";

const PANEL_HEIGHT = 72;

interface LiftTrail {
  readonly id: string;
  readonly name: string;
  readonly trail: BestPoint[];
}

function valueAt(trail: ReadonlyArray<BestPoint>, date: Date): BestPoint | undefined {
  return trail.filter((point) => point.date <= date).at(-1);
}

/**
 * Mockup D. Every lift's best estimate to date, side by side. Scrub any panel and all of them
 * read out the same day, so "where was everything in March" is one gesture. Pick a panel to load
 * that lift into A to C.
 */
export function AllLifts({ range, selected, onSelect }: Props) {
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const from = rangeStart(range);
  const to = toDate(MOCK_TODAY);
  const lifts: LiftTrail[] = MOCK_LIFTS.map((lift) => ({
    ...lift,
    trail: clipSteps(bestToDate(sessionEstimates(setsFor(lift.id))), from, to),
  }));

  return (
    <ChartFrame
      id="all-lifts"
      title="D · All lifts"
      description="Best estimated 1RM to date for every lift. Each panel is scaled to its own range, so compare shapes, not heights. Hover to read every lift on the same day."
      table={
        <DataTable
          caption="Best estimated 1RM per lift"
          rows={lifts}
          rowKey={(lift) => lift.id}
          columns={[
            { header: "Lift", cell: (lift) => lift.name },
            { header: "Start", cell: (lift) => kg(lift.trail[0]?.e1rm ?? 0), numeric: true },
            { header: "Now", cell: (lift) => kg(lift.trail.at(-1)?.e1rm ?? 0), numeric: true },
            {
              header: "Change",
              cell: (lift) => signedKg((lift.trail.at(-1)?.e1rm ?? 0) - (lift.trail[0]?.e1rm ?? 0)),
              numeric: true,
            },
          ]}
        />
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {lifts.map((lift) => (
          <LiftPanel
            key={lift.id}
            lift={lift}
            from={from}
            to={to}
            hoverDate={hoverDate}
            onHover={setHoverDate}
            selected={lift.id === selected}
            onSelect={() => onSelect(lift.id)}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {hoverDate ? `Showing ${formatFullDay(hoverDate)}` : `${formatFullDay(from)} to today`}
        </span>
        <span>Select a lift to load it above</span>
      </div>
    </ChartFrame>
  );
}

function LiftPanel({
  lift,
  from,
  to,
  hoverDate,
  onHover,
  selected,
  onSelect,
}: {
  lift: LiftTrail;
  from: Date;
  to: Date;
  hoverDate: Date | null;
  onHover: (date: Date | null) => void;
  selected: boolean;
  onSelect: () => void;
}) {
  const { parentRef, width } = useParentSize({ debounceTime: 50 });
  const first = lift.trail[0];
  const last = lift.trail.at(-1);
  const shown = hoverDate ? valueAt(lift.trail, hoverDate) : last;
  const change = shown && first ? shown.e1rm - first.e1rm : 0;
  const percent = first && first.e1rm > 0 ? (change / first.e1rm) * 100 : 0;

  const xScale = scaleTime({ domain: [from, to], range: [0, width] });
  const values = lift.trail.map((point) => point.e1rm);
  const yScale = scaleLinear({
    // A flat range still needs height; pad it so the line sits mid-panel instead of collapsing.
    domain:
      Math.max(...values) > Math.min(...values)
        ? [Math.min(...values), Math.max(...values)]
        : [Math.min(...values) - 1, Math.max(...values) + 1],
    range: [PANEL_HEIGHT - 6, 6],
  });

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "grid cursor-pointer gap-2 rounded-md border bg-card p-3 text-left outline-none transition-colors hover:border-input focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-primary/50 bg-primary/5 hover:border-primary/60",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{lift.name}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {Math.abs(change) < 0.05
            ? "No change"
            : `${signedKg(change)} · ${percent >= 0 ? "+" : "−"}${Math.abs(percent).toFixed(1)}%`}
        </span>
      </div>
      <span className="text-2xl font-semibold tracking-tight">{shown ? kg(shown.e1rm) : "-"}</span>
      <div ref={parentRef} className="relative h-[72px]">
        {width > 0 ? (
          <svg
            width={width}
            height={PANEL_HEIGHT}
            aria-hidden="true"
            className="overflow-visible"
            onPointerMove={(event) => {
              const point = localPoint(event);
              if (point) onHover(xScale.invert(Math.max(0, Math.min(width, point.x))));
            }}
            onPointerLeave={() => onHover(null)}
          >
            <AreaClosed
              data={lift.trail}
              x={(point) => xScale(point.date)}
              y={(point) => yScale(point.e1rm)}
              yScale={yScale}
              curve={curveStepAfter}
              fill="var(--viz-1)"
              fillOpacity={0.1}
            />
            <LinePath
              data={lift.trail}
              x={(point) => xScale(point.date)}
              y={(point) => yScale(point.e1rm)}
              curve={curveStepAfter}
              stroke="var(--viz-1)"
              strokeWidth={2}
              strokeLinejoin="round"
            />
            <line x1={0} x2={width} y1={PANEL_HEIGHT} y2={PANEL_HEIGHT} stroke="var(--viz-axis)" />
            {hoverDate && shown ? (
              <>
                <line
                  x1={xScale(hoverDate)}
                  x2={xScale(hoverDate)}
                  y1={0}
                  y2={PANEL_HEIGHT}
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.5}
                />
                <circle
                  cx={xScale(hoverDate)}
                  cy={yScale(shown.e1rm)}
                  r={4}
                  fill="var(--viz-1)"
                  stroke="var(--viz-ring)"
                  strokeWidth={2}
                />
              </>
            ) : last ? (
              <circle
                cx={width}
                cy={yScale(last.e1rm)}
                r={4}
                fill="var(--viz-1)"
                stroke="var(--viz-ring)"
                strokeWidth={2}
              />
            ) : null}
          </svg>
        ) : null}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatMonthYear(from)}</span>
        <span>{formatMonthYear(to)}</span>
      </div>
    </button>
  );
}

interface Props {
  range: RangeId;
  selected: string;
  onSelect: (movementId: string) => void;
}
