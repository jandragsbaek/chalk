import { AxisBottom, AxisLeft } from "@visx/axis";
import { curveMonotoneX } from "@visx/curve";
import { localPoint } from "@visx/event";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { useParentSize } from "@visx/responsive";
import { scaleLinear, scaleTime } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import {
  formatClock,
  formatKj,
  formatWatts,
  rollingMedian,
  type SessionPowerRow,
} from "../lib/power.ts";
import { PROGRESS_RANGES, rangeStart, toDate, type ProgressRange } from "../lib/progress.ts";
import { localIsoDate } from "../lib/utils.ts";
import {
  AXIS,
  ChartTooltip,
  DataTable,
  formatDayWithYear,
  formatFullDay,
  formatMonthTick,
  Legend,
  LegendItem,
  monthTicks,
  nearestIndex,
  Segmented,
  stepIndexOnKey,
  TooltipRow,
} from "./chart.tsx";

const HEIGHT = 300;
const MARGIN = { top: 28, right: 76, bottom: 28, left: 48 };
/** Sessions in the trend's median: about two weeks of training. */
const TREND_WINDOW = 8;

type Metric = "power" | "work";

const METRICS: Record<
  Metric,
  {
    label: string;
    valueOf: (row: SessionPowerRow) => number | undefined;
    format: (value: number) => string;
  }
> = {
  power: { label: "Average power", valueOf: (row) => row.watts, format: formatWatts },
  work: { label: "Work", valueOf: (row) => row.joules, format: formatKj },
};

/**
 * Estimated power (or work) per session over time. Each session is a dot, an Rx benchmark a
 * diamond; the line is the median of the last eight, so one hard day does not move it.
 */
export function PowerTrend({ rows }: { readonly rows: ReadonlyArray<SessionPowerRow> }) {
  const { parentRef, width } = useParentSize({ debounceTime: 50 });
  const navigate = useNavigate();
  const [metric, setMetric] = useState<Metric>("power");
  const [range, setRange] = useState<ProgressRange>("1y");
  const [view, setView] = useState<"chart" | "table">("chart");
  const [active, setActive] = useState<number | null>(null);
  // Fixed at mount, like the strength chart's.
  const [today] = useState(() => toDate(localIsoDate(new Date())));

  const { valueOf, format, label } = METRICS[metric];
  const measured = rows.flatMap((row) => {
    const value = valueOf(row);
    return value === undefined ? [] : [{ row, value, date: toDate(row.performedOn) }];
  });
  const trendAll = rollingMedian(
    measured.map((point) => point.value),
    TREND_WINDOW,
  );
  const from = rangeStart(range, today, measured[0]?.date ?? today);
  const points = measured
    .map((point, index) => ({ ...point, trend: trendAll[index]! }))
    .filter((point) => point.date >= from);
  const current = points.at(-1);
  const first = points[0];

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const values = points.map((point) => point.value);
  const xScale = scaleTime({ domain: [from, today], range: [0, innerWidth] });
  const yScale = scaleLinear({
    domain: [0, Math.max(1, ...values) * 1.05],
    range: [innerHeight, 0],
    nice: true,
  });
  const xs = points.map((point) => xScale(point.date));
  const activePoint = active === null ? undefined : points[active];

  const open = (row: SessionPowerRow) =>
    void navigate({ to: "/workouts", search: { session: row.workoutId } });

  function handlePointer(event: React.PointerEvent<SVGRectElement>) {
    const point = localPoint(event);
    if (!point || points.length === 0) return;
    setActive(nearestIndex(xs, point.x - MARGIN.left));
  }

  return (
    <figure aria-label={label} data-viz className="grid gap-4 rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        {current && first ? (
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div className="grid">
              <span className="text-sm text-muted-foreground">
                {label}, median of the last {TREND_WINDOW} sessions
              </span>
              <span className="text-5xl font-semibold tracking-tight">{format(current.trend)}</span>
            </div>
            <dl className="grid gap-0.5 pb-1.5 text-sm">
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Since {formatDayWithYear(first.date)}</dt>
                <dd className="font-medium">
                  {current.trend >= first.trend ? "+" : "−"}
                  {format(Math.abs(current.trend - first.trend))}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Sessions</dt>
                <dd>{points.length}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="Measure"
            value={metric}
            onChange={setMetric}
            options={[
              { value: "power", label: "Power" },
              { value: "work", label: "Work" },
            ]}
          />
          <Segmented
            label="Range"
            value={range}
            onChange={setRange}
            options={PROGRESS_RANGES.map((option) => ({ value: option.id, label: option.label }))}
          />
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "chart", label: "Chart" },
              { value: "table", label: "Table" },
            ]}
          />
        </div>
      </div>

      {points.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {metric === "power"
            ? "No timed sessions in this range: power needs a for-time score, an AMRAP or an EMOM."
            : "No sessions in this range."}
        </p>
      ) : view === "table" ? (
        <DataTable
          caption={`${label} per session`}
          rows={[...points].reverse()}
          rowKey={(point) => point.row.workoutId}
          columns={[
            { header: "Day", cell: (point) => formatFullDay(point.date) },
            { header: "Session", cell: (point) => point.row.name },
            { header: "Work", cell: (point) => formatKj(point.row.joules), numeric: true },
            {
              header: "Time",
              cell: (point) => (point.row.seconds > 0 ? formatClock(point.row.seconds) : "-"),
              numeric: true,
            },
            {
              header: "Power",
              cell: (point) => (point.row.watts === undefined ? "-" : formatWatts(point.row.watts)),
              numeric: true,
            },
          ]}
        />
      ) : (
        <>
          <div ref={parentRef} className="relative">
            {width > 0 ? (
              <svg
                width={width}
                height={HEIGHT}
                role="img"
                aria-label={`${label} per session over time. Use arrow keys to step through sessions, Enter to open one.`}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && activePoint) {
                    open(activePoint.row);
                    return;
                  }
                  const next = stepIndexOnKey(event, active, points.length);
                  if (next !== undefined) {
                    event.preventDefault();
                    setActive(next);
                  }
                }}
                onBlur={() => setActive(null)}
              >
                <Group left={MARGIN.left} top={MARGIN.top}>
                  <GridRows
                    scale={yScale}
                    width={innerWidth}
                    stroke="var(--viz-grid)"
                    numTicks={5}
                  />
                  {activePoint ? (
                    <line
                      x1={xScale(activePoint.date)}
                      x2={xScale(activePoint.date)}
                      y1={0}
                      y2={innerHeight}
                      stroke="var(--muted-foreground)"
                      strokeOpacity={0.5}
                    />
                  ) : null}
                  {points.map((point, index) => {
                    const cx = xScale(point.date);
                    const cy = yScale(point.value);
                    const isActive = index === active;
                    if (point.row.benchmark) {
                      const size = isActive ? 12 : 9;
                      return (
                        <rect
                          key={point.row.workoutId}
                          x={cx - size / 2}
                          y={cy - size / 2}
                          width={size}
                          height={size}
                          transform={`rotate(45 ${cx} ${cy})`}
                          fill="var(--foreground)"
                          stroke="var(--viz-ring)"
                          strokeWidth={2}
                        />
                      );
                    }
                    return (
                      <circle
                        key={point.row.workoutId}
                        cx={cx}
                        cy={cy}
                        r={isActive ? 6 : 4}
                        fill="var(--viz-quiet)"
                        stroke="var(--viz-ring)"
                        strokeWidth={2}
                      />
                    );
                  })}
                  <LinePath
                    data={points}
                    x={(point) => xScale(point.date)}
                    y={(point) => yScale(point.trend)}
                    curve={curveMonotoneX}
                    stroke="var(--viz-1)"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {current ? (
                    <text
                      x={innerWidth + 8}
                      y={yScale(current.trend)}
                      dy="0.32em"
                      fontSize={12}
                      fontWeight={600}
                      fill="var(--foreground)"
                    >
                      {format(current.trend)}
                    </text>
                  ) : null}
                  <AxisLeft
                    scale={yScale}
                    numTicks={5}
                    hideAxisLine
                    hideTicks
                    tickFormat={(value) =>
                      metric === "power"
                        ? String(Math.round(Number(value)))
                        : String(Math.round(Number(value) / 1000))
                    }
                    tickLabelProps={{ ...AXIS.tickLabel, textAnchor: "end", dx: -4, dy: "0.32em" }}
                  />
                  <text x={-4} y={-16} textAnchor="end" {...AXIS.tickLabel}>
                    {metric === "power" ? "W" : "kJ"}
                  </text>
                  <AxisBottom
                    top={innerHeight}
                    scale={xScale}
                    tickValues={monthTicks(from, today, Math.floor(innerWidth / 56))}
                    stroke={AXIS.stroke}
                    tickStroke={AXIS.tickStroke}
                    tickLength={AXIS.tickLength}
                    tickFormat={(value) => formatMonthTick(value as Date)}
                    tickLabelProps={{ ...AXIS.tickLabel, textAnchor: "middle" }}
                  />
                  <rect
                    width={innerWidth}
                    height={innerHeight}
                    fill="transparent"
                    className="cursor-pointer"
                    onPointerMove={handlePointer}
                    onPointerLeave={() => setActive(null)}
                    onClick={() => (activePoint ? open(activePoint.row) : undefined)}
                  />
                </Group>
              </svg>
            ) : null}
            {activePoint ? (
              <ChartTooltip x={MARGIN.left + xScale(activePoint.date)} width={width}>
                <span className="text-muted-foreground">{formatFullDay(activePoint.date)}</span>
                <span className="font-semibold">{activePoint.row.name}</span>
                {activePoint.row.watts !== undefined ? (
                  <TooltipRow
                    color={activePoint.row.benchmark ? "var(--foreground)" : "var(--viz-quiet)"}
                    mark="dot"
                    value={formatWatts(activePoint.row.watts)}
                    label={
                      activePoint.row.seconds > 0
                        ? `over ${formatClock(activePoint.row.seconds)}`
                        : "average"
                    }
                  />
                ) : null}
                <TooltipRow value={formatKj(activePoint.row.joules)} label="work" />
                <TooltipRow value={format(activePoint.trend)} label="trend" />
              </ChartTooltip>
            ) : null}
          </div>
          <Legend>
            <LegendItem
              mark="line"
              color="var(--viz-1)"
              label={`Median of the last ${TREND_WINDOW}`}
            />
            <LegendItem mark="dot" color="var(--viz-quiet)" label="Session" />
            <LegendItem mark="diamond" color="var(--foreground)" label="Rx benchmark" />
          </Legend>
        </>
      )}
    </figure>
  );
}
