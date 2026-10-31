import { AxisBottom, AxisLeft } from "@visx/axis";
import { localPoint } from "@visx/event";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { useParentSize } from "@visx/responsive";
import { scaleLinear, scaleTime } from "@visx/scale";
import { useState } from "react";

import {
  AXIS,
  ChartFrame,
  ChartTooltip,
  DataTable,
  formatMonth,
  formatShortDay,
  kg,
  Legend,
  LegendItem,
  nearestIndex,
  stepIndexOnKey,
  TooltipRow,
} from "./chartKit.tsx";
import {
  MOCK_TODAY,
  rangeStart,
  sessionEstimates,
  setsFor,
  toDate,
  weeklyBest,
  type RangeId,
} from "./strengthData.ts";

const HEIGHT = 260;
const MARGIN = { top: 12, right: 16, bottom: 28, left: 40 };
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Mockup C. The roadmap's weekly view: one mark per training week, the best set's estimate as a
 * dot and the formula spread as its stem. Singles have no stem; sets of 10 have the longest. Weeks that moved your best are orange; the rest recede.
 */
export function WeeklyRange({ movementId, liftName, range }: Props) {
  const { parentRef, width } = useParentSize({ debounceTime: 50 });
  const [active, setActive] = useState<number | null>(null);

  const from = rangeStart(range);
  const to = toDate(MOCK_TODAY);
  const weeks = weeklyBest(sessionEstimates(setsFor(movementId))).filter(
    (week) => week.weekStart.getTime() + WEEK_MS > from.getTime(),
  );
  const prWeeks = weeks.filter((week) => week.pr).length;
  const trainedWeeks = weeks.length;
  const totalWeeks = Math.round((to.getTime() - from.getTime()) / WEEK_MS);

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const xScale = scaleTime({ domain: [from, to], range: [0, innerWidth] });
  const yScale = scaleLinear({
    domain: [
      Math.min(...weeks.map((week) => week.session.estimate.low)) - 2,
      Math.max(...weeks.map((week) => week.session.estimate.high)) + 2,
    ],
    range: [innerHeight, 0],
    nice: true,
  });
  const center = (date: Date) => xScale(new Date(date.getTime() + WEEK_MS / 2));
  const xs = weeks.map((week) => center(week.weekStart));
  const activeWeek = active === null ? undefined : weeks[active];

  function handlePointer(event: React.PointerEvent<SVGRectElement>) {
    const point = localPoint(event);
    if (!point || weeks.length === 0) return;
    setActive(nearestIndex(xs, point.x - MARGIN.left));
  }

  return (
    <ChartFrame
      id="weekly-range"
      title="C · Week by week"
      description="Your best set each week as an estimated 1RM. The stem is the formula spread: none for a single, longest for high-rep sets."
      summary={
        <p className="text-sm text-muted-foreground">
          You trained {trainedWeeks} of the last {totalWeeks} weeks;{" "}
          <span className="font-medium text-foreground">{prWeeks}</span> of them moved your best.
        </p>
      }
      legend={
        <Legend>
          <LegendItem mark="range" color="var(--viz-1)" label="Week that set a new best" />
          <LegendItem mark="range" color="var(--viz-quiet)" label="Other weeks" />
        </Legend>
      }
      table={
        <DataTable
          caption={`${liftName} best set per week`}
          rows={[...weeks].reverse()}
          rowKey={(w) => String(w.weekStart.getTime())}
          columns={[
            { header: "Week of", cell: (w) => formatShortDay(w.weekStart) },
            {
              header: "Best set",
              cell: (w) => `${w.session.best.reps} × ${kg(w.session.best.loadKg)}`,
              numeric: true,
            },
            { header: "e1RM", cell: (w) => kg(w.session.estimate.epley), numeric: true },
            {
              header: "Spread",
              cell: (w) => `${kg(w.session.estimate.low)} to ${kg(w.session.estimate.high)}`,
              numeric: true,
            },
            { header: "", cell: (w) => (w.pr ? "New best" : "") },
          ]}
        />
      }
    >
      <div ref={parentRef} className="relative">
        {width > 0 ? (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`${liftName} best estimated 1RM per week. Use arrow keys to step through weeks.`}
            tabIndex={0}
            onKeyDown={(event) => {
              const next = stepIndexOnKey(event, active, weeks.length);
              if (next !== undefined) {
                event.preventDefault();
                setActive(next);
              }
            }}
            onBlur={() => setActive(null)}
          >
            <Group left={MARGIN.left} top={MARGIN.top}>
              <GridRows scale={yScale} width={innerWidth} stroke="var(--viz-grid)" numTicks={5} />
              {weeks.map((week, index) => {
                const x = center(week.weekStart);
                const { low, high, epley } = week.session.estimate;
                const color = week.pr ? "var(--viz-1)" : "var(--viz-quiet)";
                const isActive = index === active;
                const top = yScale(high);
                const stemHeight = Math.max(4, yScale(low) - top);
                return (
                  <g
                    key={week.weekStart.getTime()}
                    opacity={active === null || isActive ? 1 : 0.55}
                  >
                    <rect
                      x={x - 2}
                      y={top - (stemHeight === 4 ? 2 : 0)}
                      width={4}
                      height={stemHeight}
                      rx={2}
                      fill={color}
                      fillOpacity={0.4}
                    />
                    <circle
                      cx={x}
                      cy={yScale(epley)}
                      r={isActive ? 5.5 : 4}
                      fill={color}
                      stroke="var(--viz-ring)"
                      strokeWidth={2}
                    />
                  </g>
                );
              })}
              <AxisLeft
                scale={yScale}
                numTicks={5}
                hideAxisLine
                hideTicks
                tickLabelProps={{ ...AXIS.tickLabel, textAnchor: "end", dx: -4, dy: "0.32em" }}
              />
              <AxisBottom
                top={innerHeight}
                scale={xScale}
                numTicks={Math.min(12, Math.floor(innerWidth / 56))}
                stroke={AXIS.stroke}
                tickStroke={AXIS.tickStroke}
                tickLength={AXIS.tickLength}
                tickFormat={(date) => formatMonth(date as Date)}
                tickLabelProps={{ ...AXIS.tickLabel, textAnchor: "middle" }}
              />
              <rect
                width={innerWidth}
                height={innerHeight}
                fill="transparent"
                onPointerMove={handlePointer}
                onPointerLeave={() => setActive(null)}
              />
            </Group>
          </svg>
        ) : null}
        {activeWeek ? (
          <ChartTooltip x={MARGIN.left + center(activeWeek.weekStart)} width={width}>
            <span className="text-muted-foreground">
              Week of {formatShortDay(activeWeek.weekStart)}
              {activeWeek.pr ? ", new best" : ""}
            </span>
            <TooltipRow
              color={activeWeek.pr ? "var(--viz-1)" : "var(--viz-quiet)"}
              mark="dot"
              value={kg(activeWeek.session.estimate.epley)}
              label="estimated 1RM"
            />
            <TooltipRow
              value={`${kg(activeWeek.session.estimate.low)} to ${kg(activeWeek.session.estimate.high)}`}
              label="spread"
            />
            <TooltipRow
              value={`${activeWeek.session.best.reps} × ${kg(activeWeek.session.best.loadKg)}`}
              label={`on ${formatShortDay(activeWeek.session.date)}`}
            />
          </ChartTooltip>
        ) : null}
      </div>
    </ChartFrame>
  );
}

interface Props {
  movementId: string;
  liftName: string;
  range: RangeId;
}
