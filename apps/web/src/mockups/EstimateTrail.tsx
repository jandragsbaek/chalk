import { AxisBottom, AxisLeft } from "@visx/axis";
import { curveStepAfter } from "@visx/curve";
import { localPoint } from "@visx/event";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { useParentSize } from "@visx/responsive";
import { scaleLinear, scaleTime } from "@visx/scale";
import { Area, LinePath } from "@visx/shape";
import { useState } from "react";

import {
  AXIS,
  ChartFrame,
  ChartTooltip,
  DataTable,
  formatFullDay,
  formatMonth,
  formatShortDay,
  kg,
  Legend,
  LegendItem,
  nearestIndex,
  signedKg,
  stepIndexOnKey,
  TooltipRow,
} from "./chartKit.tsx";
import {
  bestToDate,
  clipSteps,
  MOCK_TODAY,
  rangeStart,
  sessionEstimates,
  setsFor,
  toDate,
  type RangeId,
} from "./strengthData.ts";

const HEIGHT = 300;
const MARGIN = { top: 12, right: 76, bottom: 28, left: 40 };

/**
 * Mockup A. Every session becomes a dot at its Epley estimate; the orange step line is the best
 * estimate to date, wrapped in the formula spread of the set that holds it. Max attempts are
 * diamonds, so a tested number never hides among estimates.
 */
export function EstimateTrail({ movementId, liftName, range }: Props) {
  const { parentRef, width } = useParentSize({ debounceTime: 50 });
  const [active, setActive] = useState<number | null>(null);

  const from = rangeStart(range);
  const to = toDate(MOCK_TODAY);
  const allSessions = sessionEstimates(setsFor(movementId));
  const sessions = allSessions.filter((session) => session.date >= from);
  const best = bestToDate(allSessions);
  const trail = clipSteps(best, from, to);
  const current = trail.at(-1);
  const atStart = trail[0];
  const lastAttempt = allSessions.filter((session) => session.best.attempt).at(-1);

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const lows = [...sessions.map((s) => s.estimate.epley), ...trail.map((p) => p.low)];
  const highs = [...sessions.map((s) => s.estimate.epley), ...trail.map((p) => p.high)];
  const xScale = scaleTime({ domain: [from, to], range: [0, innerWidth] });
  const yScale = scaleLinear({
    domain: [Math.min(...lows) - 2, Math.max(...highs) + 2],
    range: [innerHeight, 0],
    nice: true,
  });
  const xs = sessions.map((session) => xScale(session.date));
  const activeSession = active === null ? undefined : sessions[active];
  const bestIds = new Set(best.map((point) => point.source.id));

  function handlePointer(event: React.PointerEvent<SVGRectElement>) {
    const point = localPoint(event);
    if (!point || sessions.length === 0) return;
    setActive(nearestIndex(xs, point.x - MARGIN.left));
  }

  return (
    <ChartFrame
      id="estimate-trail"
      title="A · Estimate trail"
      description="Every session as an estimated 1RM. The line is your best estimate so far; the band is how far the three formulas disagree for the set behind it."
      summary={
        current && atStart ? (
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div className="grid">
              <span className="text-sm text-muted-foreground">{liftName}, estimated 1RM</span>
              <span className="text-5xl font-semibold tracking-tight">{kg(current.e1rm)}</span>
            </div>
            <dl className="grid gap-0.5 pb-1.5 text-sm">
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Since {formatShortDay(from)}</dt>
                <dd className="font-medium">{signedKg(current.e1rm - atStart.e1rm)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Comes from</dt>
                <dd>
                  {current.source.attempt
                    ? `a tested single on ${formatShortDay(toDate(current.source.performedOn))}`
                    : `${current.source.reps} × ${kg(current.source.loadKg)}, spread ${kg(current.low)} to ${kg(current.high)}`}
                </dd>
              </div>
              {lastAttempt && !current.source.attempt ? (
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Last tested</dt>
                  <dd>
                    {kg(lastAttempt.best.loadKg)} on {formatShortDay(lastAttempt.date)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null
      }
      legend={
        <Legend>
          <LegendItem mark="line" color="var(--viz-1)" label="Best estimate to date" />
          <LegendItem mark="band" color="var(--viz-1)" label="Formula spread" />
          <LegendItem mark="dot" color="var(--viz-1)" label="Session that set a new best" />
          <LegendItem mark="dot" color="var(--viz-quiet)" label="Other sessions" />
          <LegendItem mark="diamond" color="var(--foreground)" label="Max attempt (single)" />
        </Legend>
      }
      table={
        <DataTable
          caption={`${liftName} sessions with estimated 1RM`}
          rows={[...sessions].reverse()}
          rowKey={(s) => s.performedOn}
          columns={[
            { header: "Day", cell: (s) => formatFullDay(s.date) },
            {
              header: "Best set",
              cell: (s) => `${s.best.reps} × ${kg(s.best.loadKg)}`,
              numeric: true,
            },
            { header: "e1RM", cell: (s) => kg(s.estimate.epley), numeric: true },
            {
              header: "Spread",
              cell: (s) => `${kg(s.estimate.low)} to ${kg(s.estimate.high)}`,
              numeric: true,
            },
            {
              header: "",
              cell: (s) =>
                s.best.attempt ? "Max attempt" : bestIds.has(s.best.id) ? "New best" : "",
            },
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
            aria-label={`${liftName} estimated 1RM over time. Use arrow keys to step through sessions.`}
            tabIndex={0}
            onKeyDown={(event) => {
              const next = stepIndexOnKey(event, active, sessions.length);
              if (next !== undefined) {
                event.preventDefault();
                setActive(next);
              }
            }}
            onBlur={() => setActive(null)}
          >
            <Group left={MARGIN.left} top={MARGIN.top}>
              <GridRows scale={yScale} width={innerWidth} stroke="var(--viz-grid)" numTicks={5} />
              <Area
                data={trail}
                x={(p) => xScale(p.date)}
                y0={(p) => yScale(p.low)}
                y1={(p) => yScale(p.high)}
                curve={curveStepAfter}
                fill="var(--viz-1)"
                fillOpacity={0.12}
              />
              <LinePath
                data={trail}
                x={(p) => xScale(p.date)}
                y={(p) => yScale(p.e1rm)}
                curve={curveStepAfter}
                stroke="var(--viz-1)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {activeSession ? (
                <line
                  x1={xScale(activeSession.date)}
                  x2={xScale(activeSession.date)}
                  y1={0}
                  y2={innerHeight}
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.5}
                />
              ) : null}
              {sessions.map((session, index) => {
                const cx = xScale(session.date);
                const cy = yScale(session.estimate.epley);
                const isActive = index === active;
                if (session.best.attempt) {
                  const size = isActive ? 12 : 9;
                  return (
                    <rect
                      key={session.performedOn}
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
                    key={session.performedOn}
                    cx={cx}
                    cy={cy}
                    r={isActive ? 6 : 4}
                    fill={bestIds.has(session.best.id) ? "var(--viz-1)" : "var(--viz-quiet)"}
                    stroke="var(--viz-ring)"
                    strokeWidth={2}
                  />
                );
              })}
              {current ? (
                <text
                  x={innerWidth + 8}
                  y={yScale(current.e1rm)}
                  dy="0.32em"
                  fontSize={12}
                  fontWeight={600}
                  fill="var(--foreground)"
                >
                  {kg(current.e1rm)}
                </text>
              ) : null}
              <AxisLeft
                scale={yScale}
                numTicks={5}
                hideAxisLine
                hideTicks
                tickFormat={(value) => `${value}`}
                tickLabelProps={{ ...AXIS.tickLabel, textAnchor: "end", dx: -4, dy: "0.32em" }}
              />
              <AxisBottom
                top={innerHeight}
                scale={xScale}
                numTicks={Math.min(12, Math.floor(innerWidth / 56))}
                stroke={AXIS.stroke}
                tickStroke={AXIS.tickStroke}
                tickLength={AXIS.tickLength}
                tickFormat={(value) => formatMonth(value as Date)}
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
        {activeSession ? (
          <ChartTooltip x={MARGIN.left + xScale(activeSession.date)} width={width}>
            <span className="text-muted-foreground">{formatFullDay(activeSession.date)}</span>
            <TooltipRow
              color={activeSession.best.attempt ? "var(--foreground)" : "var(--viz-1)"}
              mark="dot"
              value={kg(activeSession.estimate.epley)}
              label={activeSession.best.attempt ? "tested single" : "estimated 1RM"}
            />
            {activeSession.best.reps > 1 ? (
              <TooltipRow
                value={`${kg(activeSession.estimate.low)} to ${kg(activeSession.estimate.high)}`}
                label="spread"
              />
            ) : null}
            <TooltipRow
              value={`${activeSession.best.reps} × ${kg(activeSession.best.loadKg)}`}
              label={`best of ${activeSession.sets.length} ${activeSession.sets.length === 1 ? "set" : "sets"}`}
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
