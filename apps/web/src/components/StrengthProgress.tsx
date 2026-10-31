import type { LiftSet, MovementId } from "@chalk/contracts";
import { Label, NativeSelect } from "@chalk/ui/components/field.tsx";
import { useAtomValue } from "@effect/atom-react";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { curveStepAfter } from "@visx/curve";
import { localPoint } from "@visx/event";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { useParentSize } from "@visx/responsive";
import { scaleLinear, scaleTime } from "@visx/scale";
import { Area, LinePath } from "@visx/shape";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useState } from "react";

import { MAX_ESTIMATE_REPS } from "../lib/estimate.ts";
import {
  bestToDate,
  clipSteps,
  isEstimable,
  PROGRESS_RANGES,
  rangeStart,
  sessionEstimates,
  toDate,
  type ProgressRange,
} from "../lib/progress.ts";
import { useMovementNames } from "../lib/strength.ts";
import { localIsoDate } from "../lib/utils.ts";
import { liftSetsAtom } from "../state/strength.ts";
import {
  AXIS,
  ChartTooltip,
  DataTable,
  formatFullDay,
  formatMonthTick,
  formatDayWithYear,
  formatShortDay,
  kg,
  Legend,
  LegendItem,
  monthTicks,
  nearestIndex,
  Segmented,
  signedKg,
  stepIndexOnKey,
  TooltipRow,
} from "./chart.tsx";

const HEIGHT = 300;
const MARGIN = { top: 12, right: 76, bottom: 28, left: 40 };

/**
 * Estimated 1RM over time for one lift. Every session is a dot at its best set's Epley estimate;
 * the line is the best estimate to date, wrapped in the formula spread of the set behind it.
 * Singles are diamonds: their load is the 1RM, not an estimate.
 */
export function StrengthProgress() {
  const result = useAtomValue(liftSetsAtom);
  const names = useMovementNames();
  const [picked, setPicked] = useState<MovementId | null>(null);
  const [range, setRange] = useState<ProgressRange>("1y");

  return AsyncResult.match(result, {
    onInitial: () => <p className="text-sm text-muted-foreground">Loading progress...</p>,
    onFailure: () => <p className="text-sm text-destructive">Could not load your progress.</p>,
    onSuccess: ({ value: sets }) => {
      const estimable = sets.filter(isEstimable);
      if (estimable.length === 0) {
        return (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Log a set of {MAX_ESTIMATE_REPS} reps or fewer and your estimated 1RM shows up here.
          </p>
        );
      }
      // Lifts with sets, most recently trained first; the default is the latest one.
      const lastTrained = new Map<MovementId, string>();
      for (const set of estimable) {
        const last = lastTrained.get(set.movementId);
        if (!last || set.performedOn > last) lastTrained.set(set.movementId, set.performedOn);
      }
      const lifts = [...lastTrained]
        .sort(([, a], [, b]) => b.localeCompare(a))
        .map(([id]) => ({ id, name: names.get(id) ?? id }));
      const movementId = picked && lastTrained.has(picked) ? picked : lifts[0]?.id;
      if (!movementId) return null;
      const liftName = names.get(movementId) ?? movementId;

      return (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="progress-lift">Lift</Label>
              <NativeSelect
                id="progress-lift"
                className="w-48"
                value={movementId}
                onChange={(event) => setPicked(event.target.value as MovementId)}
              >
                {lifts.map((lift) => (
                  <option key={lift.id} value={lift.id}>
                    {lift.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Range</span>
              <Segmented
                label="Range"
                size="md"
                value={range}
                onChange={setRange}
                options={PROGRESS_RANGES.map((option) => ({
                  value: option.id,
                  label: option.label,
                }))}
              />
            </div>
          </div>
          <EstimateTrail
            sets={estimable.filter((set) => set.movementId === movementId)}
            skipped={sets.filter((set) => set.movementId === movementId && !isEstimable(set))}
            liftName={liftName}
            range={range}
          />
        </div>
      );
    },
  });
}

function EstimateTrail({
  sets,
  skipped,
  liftName,
  range,
}: {
  sets: ReadonlyArray<LiftSet>;
  skipped: ReadonlyArray<LiftSet>;
  liftName: string;
  range: ProgressRange;
}) {
  const { parentRef, width } = useParentSize({ debounceTime: 50 });
  const [view, setView] = useState<"chart" | "table">("chart");
  const [active, setActive] = useState<number | null>(null);

  const allSessions = sessionEstimates(sets);
  // Fixed at mount, like the log forms' default day; a tab left open past midnight keeps yesterday.
  const [today] = useState(() => toDate(localIsoDate(new Date())));
  const from = rangeStart(range, today, allSessions[0]?.date ?? today);
  const sessions = allSessions.filter((session) => session.date >= from);
  const best = bestToDate(allSessions);
  const trail = clipSteps(best, from, today);
  const current = trail.at(-1);
  const atStart = trail[0];
  const lastSingle = allSessions.filter((session) => session.best.reps === 1).at(-1);
  const bestIds = new Set(best.map((point) => point.source.id));

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const values = [
    ...sessions.map((session) => session.estimate.epley),
    ...trail.flatMap((point) => [point.low, point.high]),
  ];
  const xScale = scaleTime({ domain: [from, today], range: [0, innerWidth] });
  const yScale = scaleLinear({
    domain: [Math.min(...values) - 2, Math.max(...values) + 2],
    range: [innerHeight, 0],
    nice: true,
  });
  const xs = sessions.map((session) => xScale(session.date));
  const activeSession = active === null ? undefined : sessions[active];

  function handlePointer(event: React.PointerEvent<SVGRectElement>) {
    const point = localPoint(event);
    if (!point || sessions.length === 0) return;
    setActive(nearestIndex(xs, point.x - MARGIN.left));
  }

  return (
    <figure
      aria-label={`${liftName} estimated 1RM`}
      data-viz
      className="grid gap-4 rounded-lg border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        {current && atStart ? (
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div className="grid">
              <span className="text-sm text-muted-foreground">{liftName}, estimated 1RM</span>
              <span className="text-5xl font-semibold tracking-tight">{kg(current.e1rm)}</span>
            </div>
            <dl className="grid gap-0.5 pb-1.5 text-sm">
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Since {formatDayWithYear(atStart.date)}</dt>
                <dd className="font-medium">{signedKg(current.e1rm - atStart.e1rm)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">From</dt>
                <dd>
                  {current.source.reps === 1
                    ? `a single on ${formatShortDay(toDate(current.source.performedOn))}`
                    : `${current.source.reps} × ${kg(current.source.loadKg)}, spread ${kg(current.low)} to ${kg(current.high)}`}
                </dd>
              </div>
              {lastSingle && current.source.reps !== 1 ? (
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Last single</dt>
                  <dd>
                    {kg(lastSingle.best.loadKg)} on {formatShortDay(lastSingle.date)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
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

      {values.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sessions up to today.</p>
      ) : view === "table" ? (
        sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions in this range.</p>
        ) : (
          <DataTable
            caption={`${liftName} sessions with estimated 1RM`}
            rows={[...sessions].reverse()}
            rowKey={(session) => session.performedOn}
            columns={[
              { header: "Day", cell: (session) => formatFullDay(session.date) },
              {
                header: "Best set",
                cell: (session) => `${session.best.reps} × ${kg(session.best.loadKg)}`,
                numeric: true,
              },
              { header: "e1RM", cell: (session) => kg(session.estimate.epley), numeric: true },
              {
                header: "Spread",
                cell: (session) =>
                  session.best.reps === 1
                    ? "-"
                    : `${kg(session.estimate.low)} to ${kg(session.estimate.high)}`,
                numeric: true,
              },
              {
                header: "",
                cell: (session) => (bestIds.has(session.best.id) ? "New best" : ""),
              },
            ]}
          />
        )
      ) : (
        <>
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
                  <GridRows
                    scale={yScale}
                    width={innerWidth}
                    stroke="var(--viz-grid)"
                    numTicks={5}
                  />
                  <Area
                    data={trail}
                    x={(point) => xScale(point.date)}
                    y0={(point) => yScale(point.low)}
                    y1={(point) => yScale(point.high)}
                    curve={curveStepAfter}
                    fill="var(--viz-1)"
                    fillOpacity={0.12}
                  />
                  <LinePath
                    data={trail}
                    x={(point) => xScale(point.date)}
                    y={(point) => yScale(point.e1rm)}
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
                    const isBest = bestIds.has(session.best.id);
                    if (session.best.reps === 1) {
                      const size = isActive ? 12 : 9;
                      return (
                        <rect
                          key={session.performedOn}
                          x={cx - size / 2}
                          y={cy - size / 2}
                          width={size}
                          height={size}
                          transform={`rotate(45 ${cx} ${cy})`}
                          fill={isBest ? "var(--viz-1)" : "var(--foreground)"}
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
                        fill={isBest ? "var(--viz-1)" : "var(--viz-quiet)"}
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
                    tickLabelProps={{ ...AXIS.tickLabel, textAnchor: "end", dx: -4, dy: "0.32em" }}
                  />
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
                  color={activeSession.best.reps === 1 ? "var(--foreground)" : "var(--viz-1)"}
                  mark="dot"
                  value={kg(activeSession.estimate.epley)}
                  label={activeSession.best.reps === 1 ? "single" : "estimated 1RM"}
                />
                {activeSession.best.reps > 1 ? (
                  <TooltipRow
                    value={`${kg(activeSession.estimate.low)} to ${kg(activeSession.estimate.high)}`}
                    label="spread"
                  />
                ) : null}
                <TooltipRow
                  value={`${activeSession.best.reps} × ${kg(activeSession.best.loadKg)}`}
                  label={`best of ${activeSession.setCount} ${activeSession.setCount === 1 ? "set" : "sets"}`}
                />
              </ChartTooltip>
            ) : null}
          </div>
          <Legend>
            <LegendItem mark="line" color="var(--viz-1)" label="Best estimate to date" />
            <LegendItem mark="band" color="var(--viz-1)" label="Formula spread" />
            <LegendItem mark="dot" color="var(--viz-1)" label="Session that set a new best" />
            <LegendItem mark="dot" color="var(--viz-quiet)" label="Other sessions" />
            <LegendItem mark="diamond" color="var(--foreground)" label="Single" />
          </Legend>
        </>
      )}
      {skipped.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {skipped.length} {skipped.length === 1 ? "set" : "sets"} over {MAX_ESTIMATE_REPS} reps
          left out: the formulas are unreliable that high.
        </p>
      ) : null}
    </figure>
  );
}
