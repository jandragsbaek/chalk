import type { Bodyweight, IsoDate } from "@chalk/contracts";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { localPoint } from "@visx/event";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { useParentSize } from "@visx/responsive";
import { scaleLinear, scaleTime } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { useState } from "react";

import { trailingAverage, type SeriesPoint } from "../../lib/bodyweight.ts";
import { toDate } from "../../lib/progress.ts";
import {
  AXIS,
  ChartTooltip,
  formatFullDay,
  formatMonthTick,
  monthTicks,
  nearestIndex,
  stepIndexOnKey,
  TooltipRow,
} from "../chart.tsx";

/** Days the line averages over: a week of daily scale readings. */
export const AVERAGE_DAYS = 7;

const MARGIN = { top: 12, right: 64, bottom: 28, left: 44 };

/** Where a reading came from, as the table and the tooltip print it. */
export const sourceLabel = (entry: Pick<Bodyweight, "source" | "measuredAt">) =>
  entry.source === "garmin"
    ? entry.measuredAt === null
      ? "Scale"
      : `Scale, ${entry.measuredAt}`
    : "Typed";

/**
 * One measure over the page's range: the week's mean as the ink line, scale readings as faint
 * marks under it, typed readings as solid squares; the latest mean labelled at the right. Every
 * chart on the page shares `from` and `to`, so their days line up.
 */
export function TrendChart({
  name,
  points,
  from,
  to,
  height,
  pad,
  format,
}: {
  /** What the chart measures, lower case: "body fat". */
  readonly name: string;
  /** Every reading of the measure, oldest first; the mean runs over readings before `from` too. */
  readonly points: ReadonlyArray<SeriesPoint<Bodyweight>>;
  readonly from: IsoDate;
  readonly to: IsoDate;
  readonly height: number;
  /** Room above and below the readings, in the measure's unit. */
  readonly pad: number;
  readonly format: (value: number) => string;
}) {
  const { parentRef, width } = useParentSize({ debounceTime: 50 });
  const [active, setActive] = useState<number | null>(null);
  const shown = trailingAverage(points, AVERAGE_DAYS)
    .filter((point) => point.performedOn >= from)
    .map((point) => ({ ...point, date: toDate(point.performedOn) }));
  const latest = shown.at(-1);

  const start = toDate(from);
  const end = toDate(to);
  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = height - MARGIN.top - MARGIN.bottom;
  // The first means in a range can carry readings from before it, so both bound the axis.
  const values = shown.flatMap((point) => [point.value, point.average]);
  const xScale = scaleTime({ domain: [start, end], range: [0, innerWidth] });
  const yScale = scaleLinear({
    domain: [Math.min(...values) - pad, Math.max(...values) + pad],
    range: [innerHeight, 0],
    nice: true,
  });
  const xs = shown.map((point) => xScale(point.date));
  const activePoint = active === null ? undefined : shown[active];
  const hasScale = shown.some((point) => point.source === "garmin");

  function handlePointer(event: React.PointerEvent<SVGRectElement>) {
    const point = localPoint(event);
    if (!point) return;
    setActive(nearestIndex(xs, point.x - MARGIN.left));
  }

  return (
    <div ref={parentRef} data-viz className="relative" style={{ height }}>
      {latest === undefined ? (
        <p className="grid h-full place-items-center text-sm text-muted-foreground">
          No {name} reading in this range.
        </p>
      ) : width > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${name[0]?.toUpperCase()}${name.slice(1)} over time, ${shown.length} readings, with a ${AVERAGE_DAYS}-day average, latest ${format(latest.average)}. Use arrow keys to step through them.`}
          tabIndex={0}
          onKeyDown={(event) => {
            const next = stepIndexOnKey(event, active, shown.length);
            if (next !== undefined) {
              event.preventDefault();
              setActive(next);
            }
          }}
          onBlur={() => setActive(null)}
        >
          <Group left={MARGIN.left} top={MARGIN.top}>
            <GridRows scale={yScale} width={innerWidth} stroke="var(--viz-grid)" numTicks={4} />
            {shown.map((point) =>
              point.source === "garmin" ? (
                <rect
                  key={point.performedOn}
                  x={xScale(point.date) - 1.5}
                  y={yScale(point.value) - 1.5}
                  width={3}
                  height={3}
                  fill="var(--viz-quiet)"
                />
              ) : null,
            )}
            <LinePath
              data={shown}
              x={(point) => xScale(point.date)}
              y={(point) => yScale(point.average)}
              stroke="var(--viz-1)"
              strokeWidth={hasScale ? 2 : 1.5}
              strokeLinejoin="round"
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
            {shown.map((point, index) => {
              if (point.source === "garmin" && index !== active) return null;
              const size = index === active ? 9 : 6;
              return (
                <rect
                  key={point.performedOn}
                  x={xScale(point.date) - size / 2}
                  y={yScale(point.value) - size / 2}
                  width={size}
                  height={size}
                  fill="var(--viz-1)"
                  stroke="var(--viz-ring)"
                  strokeWidth={1.5}
                />
              );
            })}
            <text
              x={innerWidth + 8}
              y={yScale(latest.average)}
              dy="0.32em"
              fontSize={12}
              fontWeight={600}
              fill="var(--foreground)"
            >
              {format(latest.average)}
            </text>
            <AxisLeft
              scale={yScale}
              numTicks={4}
              hideAxisLine
              hideTicks
              tickLabelProps={{ ...AXIS.tickLabel, textAnchor: "end", dx: -4, dy: "0.32em" }}
            />
            <AxisBottom
              top={innerHeight}
              scale={xScale}
              tickValues={monthTicks(start, end, Math.floor(innerWidth / 56))}
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
              onPointerMove={handlePointer}
              onPointerLeave={() => setActive(null)}
            />
          </Group>
        </svg>
      ) : null}
      {activePoint ? (
        <ChartTooltip x={MARGIN.left + xScale(activePoint.date)} width={width}>
          <span className="text-muted-foreground">{formatFullDay(activePoint.date)}</span>
          <TooltipRow
            color="var(--viz-1)"
            mark="dot"
            value={format(activePoint.value)}
            label={sourceLabel(activePoint).toLowerCase()}
          />
          <TooltipRow
            color="var(--viz-1)"
            value={format(activePoint.average)}
            label={`${AVERAGE_DAYS}-day average`}
          />
        </ChartTooltip>
      ) : null}
    </div>
  );
}
