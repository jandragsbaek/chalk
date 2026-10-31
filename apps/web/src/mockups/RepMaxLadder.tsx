import { AxisBottom, AxisLeft } from "@visx/axis";
import { curveStepAfter } from "@visx/curve";
import { localPoint } from "@visx/event";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { useParentSize } from "@visx/responsive";
import { scaleLinear, scaleTime } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { useState } from "react";

import { epley } from "../lib/estimate.ts";
import {
  AXIS,
  ChartFrame,
  ChartTooltip,
  DataTable,
  formatFullDay,
  formatMonth,
  kg,
  Legend,
  LegendItem,
  Segmented,
  stepIndexOnKey,
  TooltipRow,
} from "./chartKit.tsx";
import {
  clipSteps,
  MOCK_TODAY,
  rangeStart,
  repMaxHistory,
  setsFor,
  toDate,
  type RangeId,
  type RepMaxStep,
} from "./strengthData.ts";

const HEIGHT = 300;
const MARGIN = { top: 12, right: 112, bottom: 28, left: 40 };
const LABEL_GAP = 15;

const SERIES = [
  { reps: 1, label: "1RM", color: "var(--viz-1)" },
  { reps: 3, label: "3RM", color: "var(--viz-2)" },
  { reps: 5, label: "5RM", color: "var(--viz-3)" },
] as const;

type Mode = "load" | "e1rm";

/** Value of a step series in force on `date`. */
function valueAt(steps: ReadonlyArray<RepMaxStep>, date: Date): RepMaxStep | undefined {
  return steps.filter((step) => step.date <= date).at(-1);
}

/** Spread end labels so they never overlap; leader lines tie each back to its line. */
function placeLabels(ys: ReadonlyArray<number>, min: number, max: number): number[] {
  const order = ys.map((y, index) => ({ y, index })).sort((a, b) => a.y - b.y);
  const placed: number[] = Array.from({ length: ys.length }, () => 0);
  let previous = -Infinity;
  for (const item of order) {
    const y = Math.max(item.y, previous + LABEL_GAP);
    placed[item.index] = y;
    previous = y;
  }
  const overflow = previous - max;
  return overflow > 0 ? placed.map((y) => Math.max(min, y - overflow)) : placed;
}

/**
 * Mockup B. Rep maxes as records that only climb. "Load" shows what was on the bar; "As e1RM"
 * converts each record to an estimated 1RM so the three lines meet on one scale. Where the 3RM or
 * 5RM line sits above the 1RM line, the tested single is behind what the reps say.
 */
export function RepMaxLadder({ movementId, liftName, range }: Props) {
  const { parentRef, width } = useParentSize({ debounceTime: 50 });
  const [mode, setMode] = useState<Mode>("load");
  const [activeDay, setActiveDay] = useState<number | null>(null);

  const from = rangeStart(range);
  const to = toDate(MOCK_TODAY);
  const sets = setsFor(movementId);
  const value = (step: RepMaxStep, reps: number) =>
    mode === "load" ? step.loadKg : epley(step.loadKg, reps);
  const series = SERIES.map((entry) => ({
    ...entry,
    steps: clipSteps(repMaxHistory(sets, entry.reps), from, to),
  }));

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const values = series.flatMap((entry) => entry.steps.map((step) => value(step, entry.reps)));
  const xScale = scaleTime({ domain: [from, to], range: [0, innerWidth] });
  const yScale = scaleLinear({
    domain: [Math.min(...values) - 2, Math.max(...values) + 2],
    range: [innerHeight, 0],
    nice: true,
  });

  // Hover snaps to days where any record moved, plus the range edges.
  const days = [
    ...new Set(series.flatMap((entry) => entry.steps.map((step) => step.date.getTime()))),
  ].sort((a, b) => a - b);
  const activeDate = activeDay === null ? undefined : days[activeDay];

  const ends = series.map((entry) => {
    const last = entry.steps.at(-1);
    return last ? yScale(value(last, entry.reps)) : 0;
  });
  const labelYs = placeLabels(ends, 0, innerHeight);

  const oneRm = series[0]?.steps.at(-1);
  const implied = series
    .slice(1)
    .map((entry) => {
      const last = entry.steps.at(-1);
      return last ? { label: entry.label, e1rm: epley(last.loadKg, entry.reps) } : undefined;
    })
    .filter((entry) => entry !== undefined)
    .sort((a, b) => b.e1rm - a.e1rm)[0];
  const gap = oneRm && implied ? implied.e1rm - oneRm.loadKg : 0;

  function handlePointer(event: React.PointerEvent<SVGRectElement>) {
    const point = localPoint(event);
    if (!point || days.length === 0) return;
    const date = xScale.invert(point.x - MARGIN.left).getTime();
    let index = days.findIndex((day) => day > date) - 1;
    if (index < 0) index = date >= (days.at(-1) ?? 0) ? days.length - 1 : 0;
    setActiveDay(index);
  }

  const tableRows = SERIES.flatMap((entry) =>
    repMaxHistory(sets, entry.reps)
      .filter((step) => step.date >= from)
      .map((step) => ({ ...step, label: entry.label, reps: entry.reps })),
  ).sort((a, b) => b.date.getTime() - a.date.getTime() || a.reps - b.reps);

  return (
    <ChartFrame
      id="rep-max-ladder"
      title="B · Rep max ladder"
      description="Your 1RM, 3RM and 5RM records over time. Switch to e1RM to put all three on one scale and see which one is lagging."
      controls={
        <Segmented
          label="Values"
          value={mode}
          onChange={setMode}
          options={[
            { value: "load", label: "Load" },
            { value: "e1rm", label: "As e1RM" },
          ]}
        />
      }
      summary={
        mode === "e1rm" && oneRm && implied ? (
          <p className="text-sm">
            {gap > 0 ? (
              <>
                Your {implied.label} implies{" "}
                <strong className="font-semibold">{kg(implied.e1rm)}</strong>, {kg(gap)} above your
                best single of {kg(oneRm.loadKg)}. A max attempt is due.
              </>
            ) : (
              <>
                Your best single, <strong className="font-semibold">{kg(oneRm.loadKg)}</strong>, is
                at or above what your rep maxes imply. Rep work is the lagging side.
              </>
            )}
          </p>
        ) : null
      }
      legend={
        <Legend>
          {SERIES.map((entry) => (
            <LegendItem key={entry.reps} mark="line" color={entry.color} label={entry.label} />
          ))}
          <LegendItem mark="dot" color="var(--muted-foreground)" label="Set at that rep count" />
          <LegendItem
            mark="hollow"
            color="var(--muted-foreground)"
            label="Implied by a set with more reps"
          />
        </Legend>
      }
      table={
        <DataTable
          caption={`${liftName} rep max records`}
          rows={tableRows}
          rowKey={(row) => `${row.label}-${row.source.id}`}
          columns={[
            { header: "Day", cell: (row) => formatFullDay(row.date) },
            { header: "Record", cell: (row) => row.label },
            {
              header: "Set",
              cell: (row) => `${row.source.reps} × ${kg(row.source.loadKg)}`,
              numeric: true,
            },
            { header: "As e1RM", cell: (row) => kg(epley(row.loadKg, row.reps)), numeric: true },
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
            aria-label={`${liftName} rep max records over time, ${mode === "load" ? "as load" : "as estimated 1RM"}.`}
            tabIndex={0}
            onKeyDown={(event) => {
              const next = stepIndexOnKey(event, activeDay, days.length);
              if (next !== undefined) {
                event.preventDefault();
                setActiveDay(next);
              }
            }}
            onBlur={() => setActiveDay(null)}
          >
            <Group left={MARGIN.left} top={MARGIN.top}>
              <GridRows scale={yScale} width={innerWidth} stroke="var(--viz-grid)" numTicks={5} />
              {activeDate !== undefined ? (
                <line
                  x1={xScale(activeDate)}
                  x2={xScale(activeDate)}
                  y1={0}
                  y2={innerHeight}
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.5}
                />
              ) : null}
              {series.map((entry) => (
                <LinePath
                  key={entry.reps}
                  data={entry.steps}
                  x={(step) => xScale(step.date)}
                  y={(step) => yScale(value(step, entry.reps))}
                  curve={curveStepAfter}
                  stroke={entry.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {series.map((entry) =>
                entry.steps
                  .slice(0, -1)
                  .map((step) =>
                    step.date < from || step.date.getTime() === from.getTime() ? null : (
                      <circle
                        key={`${entry.reps}-${step.source.id}`}
                        cx={xScale(step.date)}
                        cy={yScale(value(step, entry.reps))}
                        r={4}
                        fill={step.source.reps > entry.reps ? "var(--viz-ring)" : entry.color}
                        stroke={step.source.reps > entry.reps ? entry.color : "var(--viz-ring)"}
                        strokeWidth={2}
                      />
                    ),
                  ),
              )}
              {series.map((entry, index) => {
                const last = entry.steps.at(-1);
                const labelY = labelYs[index] ?? 0;
                const endY = ends[index] ?? 0;
                if (!last) return null;
                return (
                  <g key={entry.reps}>
                    {Math.abs(labelY - endY) > 2 ? (
                      <line
                        x1={innerWidth + 2}
                        x2={innerWidth + 8}
                        y1={endY}
                        y2={labelY}
                        stroke="var(--muted-foreground)"
                        strokeOpacity={0.6}
                      />
                    ) : null}
                    <text
                      x={innerWidth + 10}
                      y={labelY}
                      dy="0.32em"
                      fontSize={12}
                      fill="var(--foreground)"
                    >
                      <tspan fontWeight={600}>{kgShort(value(last, entry.reps))}</tspan>
                      <tspan fill="var(--muted-foreground)"> {entry.label}</tspan>
                    </text>
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
                onPointerLeave={() => setActiveDay(null)}
              />
            </Group>
          </svg>
        ) : null}
        {activeDate !== undefined ? (
          <ChartTooltip x={MARGIN.left + xScale(activeDate)} width={width}>
            <span className="text-muted-foreground">{formatFullDay(new Date(activeDate))}</span>
            {series.map((entry) => {
              const step = valueAt(entry.steps, new Date(activeDate));
              if (!step) return null;
              const source = step.source;
              return (
                <TooltipRow
                  key={entry.reps}
                  color={entry.color}
                  value={kg(value(step, entry.reps))}
                  label={`${entry.label}${source.reps > entry.reps ? `, from ${source.reps} × ${kg(source.loadKg)}` : ""}`}
                />
              );
            })}
          </ChartTooltip>
        ) : null}
      </div>
    </ChartFrame>
  );
}

const kgShort = (value: number) => kg(Math.round(value * 2) / 2);

interface Props {
  movementId: string;
  liftName: string;
  range: RangeId;
}
