import { BodyweightEntry, type Bodyweight, type IsoDate } from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Input } from "@chalk/ui/components/field.tsx";
import { useAtomSet } from "@effect/atom-react";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { localPoint } from "@visx/event";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { useParentSize } from "@visx/responsive";
import { scaleLinear, scaleTime } from "@visx/scale";
import { LinePath } from "@visx/shape";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { Trash2 } from "lucide-react";
import { useId, useState } from "react";

import {
  bodyweightRows,
  bodyweightTrend,
  parseMeasure,
  shiftDay,
  trailingAverage,
} from "../../lib/bodyweight.ts";
import { toDate } from "../../lib/progress.ts";
import { formatDay, localIsoDate } from "../../lib/utils.ts";
import {
  deleteBodyweightAtom,
  logBodyweightAtom,
  PROFILE_REACTIVITY_KEY,
} from "../../state/profile.ts";
import {
  AXIS,
  ChartTooltip,
  formatFullDay,
  formatMonthTick,
  kg,
  Legend,
  LegendItem,
  monthTicks,
  nearestIndex,
  Segmented,
  signedKg,
  stepIndexOnKey,
  TooltipRow,
} from "../chart.tsx";
import { FieldBox } from "../FieldBox.tsx";
import { SectionHead } from "../today/SectionHead.tsx";

const decodeEntry = Schema.decodeUnknownOption(BodyweightEntry);

/** The window the headline change covers. */
const TREND_DAYS = 30;

const DAY_MS = 86_400_000;
const HEIGHT = 200;
const MARGIN = { top: 12, right: 64, bottom: 28, left: 40 };

type Range = "90d" | "1y" | "all";

const RANGES: ReadonlyArray<{ value: Range; label: string; days?: number }> = [
  { value: "90d", label: "90 days", days: 90 },
  { value: "1y", label: "1 year", days: 365 },
  { value: "all", label: "All" },
];

/** Days the line averages over: a week of daily scale readings. */
const AVERAGE_DAYS = 7;

const sourceLabel = (entry: Bodyweight) =>
  entry.source === "garmin"
    ? entry.measuredAt === null
      ? "Scale"
      : `Scale, ${entry.measuredAt}`
    : "Typed";

/**
 * Weigh-ins over the chosen range: the week's mean as the ink line, scale readings as faint
 * marks under it, typed weigh-ins as solid squares; the latest mean labelled.
 */
function BodyweightChart({
  entries,
  today,
}: {
  readonly entries: ReadonlyArray<Bodyweight>;
  readonly today: IsoDate;
}) {
  const { parentRef, width } = useParentSize({ debounceTime: 50 });
  const [active, setActive] = useState<number | null>(null);
  const [range, setRange] = useState<Range>("all");
  const averaged = trailingAverage(entries, AVERAGE_DAYS);
  const firstDay = averaged[0]?.performedOn;
  const latestDay = averaged.at(-1)?.performedOn;
  if (firstDay === undefined || latestDay === undefined) return null;

  const endDay = today > latestDay ? today : latestDay;
  const spanDays = Math.round((toDate(endDay).getTime() - toDate(firstDay).getTime()) / DAY_MS);
  const rangeDays = RANGES.find((option) => option.value === range)?.days;
  const fromDay =
    rangeDays === undefined || spanDays <= rangeDays ? firstDay : shiftDay(endDay, -rangeDays);
  const points = averaged
    .filter((entry) => entry.performedOn >= fromDay)
    .map((entry) => ({ ...entry, date: toDate(entry.performedOn) }));
  const latest = points.at(-1);
  if (latest === undefined) return null;
  const hasScale = points.some((point) => point.source === "garmin");

  // A fortnight at least, so a first weigh-in does not sit on the axis edge.
  const end = toDate(endDay);
  const start = toDate(fromDay < shiftDay(endDay, -14) ? fromDay : shiftDay(endDay, -14));
  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const values = points.map((point) => point.kg);
  const xScale = scaleTime({ domain: [start, end], range: [0, innerWidth] });
  const yScale = scaleLinear({
    domain: [Math.min(...values) - 1, Math.max(...values) + 1],
    range: [innerHeight, 0],
    nice: true,
  });
  const xs = points.map((point) => xScale(point.date));
  const activePoint = active === null ? undefined : points[active];

  function handlePointer(event: React.PointerEvent<SVGRectElement>) {
    const point = localPoint(event);
    if (!point) return;
    setActive(nearestIndex(xs, point.x - MARGIN.left));
  }

  return (
    <div data-viz className="grid gap-2">
      <div className="flex items-center justify-between gap-4 px-2">
        {hasScale ? (
          <Legend>
            <LegendItem mark="square" color="var(--viz-quiet)" label="Scale reading" />
            <LegendItem mark="line" color="var(--viz-1)" label={`${AVERAGE_DAYS}-day average`} />
            <LegendItem mark="square" color="var(--viz-1)" label="Typed" />
          </Legend>
        ) : (
          <span />
        )}
        {spanDays > 90 ? (
          <Segmented
            label="Range"
            value={range}
            onChange={(value) => {
              setActive(null);
              setRange(value);
            }}
            options={RANGES.filter((option) => option.days === undefined || option.days < spanDays)}
          />
        ) : null}
      </div>
      <div ref={parentRef} className="relative">
        {width > 0 ? (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Bodyweight over time, ${points.length} weigh-ins, with a ${AVERAGE_DAYS}-day average. Use arrow keys to step through them.`}
            tabIndex={0}
            onKeyDown={(event) => {
              const next = stepIndexOnKey(event, active, points.length);
              if (next !== undefined) {
                event.preventDefault();
                setActive(next);
              }
            }}
            onBlur={() => setActive(null)}
          >
            <Group left={MARGIN.left} top={MARGIN.top}>
              <GridRows scale={yScale} width={innerWidth} stroke="var(--viz-grid)" numTicks={4} />
              {points.map((point) =>
                point.source === "garmin" ? (
                  <rect
                    key={point.performedOn}
                    x={xScale(point.date) - 1.5}
                    y={yScale(point.kg) - 1.5}
                    width={3}
                    height={3}
                    fill="var(--viz-quiet)"
                  />
                ) : null,
              )}
              <LinePath
                data={points}
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
              {points.map((point, index) => {
                if (point.source === "garmin" && index !== active) return null;
                const size = index === active ? 9 : 6;
                return (
                  <rect
                    key={point.performedOn}
                    x={xScale(point.date) - size / 2}
                    y={yScale(point.kg) - size / 2}
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
                {kg(latest.average)}
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
              value={kg(activePoint.kg)}
              label={sourceLabel(activePoint).toLowerCase()}
            />
            <TooltipRow
              color="var(--viz-1)"
              value={kg(activePoint.average)}
              label={`${AVERAGE_DAYS}-day average`}
            />
          </ChartTooltip>
        ) : null}
      </div>
    </div>
  );
}

type Status =
  | { readonly type: "idle" }
  | { readonly type: "saving" }
  | { readonly type: "saved"; readonly message: string }
  | { readonly type: "error"; readonly message: string };

/** The day's weigh-in: a date (today unless changed) and the scale's reading. */
function LogBodyweightForm({
  entries,
  today,
}: {
  readonly entries: ReadonlyArray<BodyweightEntry>;
  readonly today: IsoDate;
}) {
  const id = useId();
  const logBodyweight = useAtomSet(logBodyweightAtom, { mode: "promiseExit" });
  const [performedOn, setPerformedOn] = useState(today);
  const [kgText, setKgText] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const replaces = entries.find((entry) => entry.performedOn === performedOn);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entry = decodeEntry({ performedOn, kg: parseMeasure(kgText) });
    if (Option.isNone(entry)) {
      setStatus({ type: "error", message: "Pick a day and a weight from 25 to 300 kg." });
      return;
    }
    setStatus({ type: "saving" });
    const exit = await logBodyweight({
      payload: entry.value,
      reactivityKeys: [PROFILE_REACTIVITY_KEY],
    });
    if (Exit.isFailure(exit)) {
      setStatus({ type: "error", message: "Could not log the weigh-in. Try again." });
      return;
    }
    setKgText("");
    setStatus({
      type: "saved",
      message: `Logged ${kg(entry.value.kg)} on ${formatDay(entry.value.performedOn)}.`,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Log a weigh-in"
      className="grid grid-cols-[10rem_8rem_auto_minmax(0,1fr)] items-end gap-3 border-b bg-card px-4 py-3"
    >
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-day`} className="form-label text-muted-foreground">
          Day
        </label>
        <Input
          id={`${id}-day`}
          type="date"
          max={today}
          value={performedOn}
          onChange={(event) => setPerformedOn(event.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-kg`} className="form-label text-muted-foreground">
          Bodyweight, kg
        </label>
        <Input
          id={`${id}-kg`}
          inputMode="decimal"
          autoComplete="off"
          placeholder={replaces === undefined ? undefined : String(replaces.kg)}
          value={kgText}
          onChange={(event) => setKgText(event.target.value)}
        />
      </div>
      <Button type="submit" disabled={status.type === "saving"}>
        {status.type === "saving" ? "Logging..." : replaces === undefined ? "Log" : "Replace"}
      </Button>
      <p
        role="status"
        className={
          status.type === "error"
            ? "pb-2 text-sm text-destructive"
            : "pb-2 text-sm text-muted-foreground"
        }
      >
        {status.type === "error" || status.type === "saved"
          ? status.message
          : replaces === undefined
            ? null
            : `${kg(replaces.kg)} is logged that day; logging again replaces it.`}
      </p>
    </form>
  );
}

function WeighIns({ entries }: { readonly entries: ReadonlyArray<Bodyweight> }) {
  const deleteBodyweight = useAtomSet(deleteBodyweightAtom, { mode: "promiseExit" });
  const [failed, setFailed] = useState(false);

  async function remove(performedOn: IsoDate) {
    const exit = await deleteBodyweight({
      payload: { performedOn },
      reactivityKeys: [PROFILE_REACTIVITY_KEY],
    });
    setFailed(Exit.isFailure(exit));
  }

  return (
    <div className="grid">
      {failed ? (
        <p className="border-b bg-card px-4 py-2 text-sm text-destructive">
          Could not delete the weigh-in. Try again.
        </p>
      ) : null}
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full bg-card text-sm">
          <caption className="sr-only">Weigh-ins, newest first</caption>
          <thead className="sticky top-0 bg-card">
            <tr className="border-b text-left">
              <th scope="col" className="form-label px-4 py-1.5 text-muted-foreground">
                Day
              </th>
              <th scope="col" className="form-label px-3 py-1.5 text-right text-muted-foreground">
                Bodyweight
              </th>
              <th scope="col" className="form-label px-3 py-1.5 text-right text-muted-foreground">
                Change
              </th>
              <th scope="col" className="form-label px-3 py-1.5 text-left text-muted-foreground">
                Source
              </th>
              <th scope="col" className="w-12">
                <span className="sr-only">Delete</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {bodyweightRows(entries).map((row) => (
              <tr key={row.performedOn} className="border-b">
                <td className="px-4 py-1.5">{formatDay(row.performedOn)}</td>
                <td className="px-3 py-1.5 text-right font-semibold">{kg(row.kg)}</td>
                <td className="px-3 py-1.5 text-right text-muted-foreground">
                  {row.change === undefined ? (
                    <span data-empty aria-label="First weigh-in" />
                  ) : (
                    signedKg(row.change)
                  )}
                </td>
                <td
                  className={
                    row.source === "garmin"
                      ? "form-label px-3 py-1.5 text-muted-foreground"
                      : "form-label px-3 py-1.5"
                  }
                >
                  {sourceLabel(row)}
                </td>
                <td className="px-2 py-0.5 text-right">
                  <Button
                    variant="ghost-destructive"
                    size="icon"
                    aria-label={`Delete ${kg(row.kg)} on ${formatDay(row.performedOn)}`}
                    onClick={() => void remove(row.performedOn)}
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Bodyweight over time: the latest reading and how it moved, a trend of every weigh-in, the
 * day's log and the list. One weigh-in per day.
 */
export function BodyweightLog({ entries }: { readonly entries: ReadonlyArray<Bodyweight> }) {
  const id = useId();
  // Fixed at mount, like the other log forms; a tab left open past midnight keeps yesterday.
  const [today] = useState(() => localIsoDate(new Date()));
  const trend = bodyweightTrend(entries, TREND_DAYS);

  return (
    <section aria-labelledby={`${id}-title`} className="grid content-start">
      <SectionHead
        id={`${id}-title`}
        title="Bodyweight"
        meta={entries.length === 1 ? "1 weigh-in" : `${entries.length} weigh-ins`}
      />
      {trend === undefined ? (
        <p className="border-b bg-card px-4 py-4 text-sm text-muted-foreground">
          No weigh-ins yet. Log one below and its trend shows up here; workouts read the latest
          weigh-in on or before their day.
        </p>
      ) : (
        <>
          <dl className="flex divide-x border-b bg-card">
            <FieldBox label="Latest">{kg(trend.latest.kg)}</FieldBox>
            <FieldBox label="On" wide>
              {formatDay(trend.latest.performedOn)}{" "}
              <span className="text-xs font-medium text-muted-foreground">
                {sourceLabel(trend.latest).toLowerCase()}
              </span>
            </FieldBox>
            <FieldBox label={`${TREND_DAYS} days`}>
              {trend.change === undefined ? (
                <span data-empty aria-label={`No weigh-in ${TREND_DAYS} days before`} />
              ) : (
                signedKg(trend.change)
              )}
            </FieldBox>
            <FieldBox label="Since first">
              {trend.sinceFirst === undefined ? (
                <span data-empty aria-label="Only one weigh-in" />
              ) : (
                signedKg(trend.sinceFirst)
              )}
            </FieldBox>
          </dl>
          <div className="border-b bg-card px-2 py-3">
            <BodyweightChart entries={entries} today={today} />
          </div>
        </>
      )}
      <LogBodyweightForm entries={entries} today={today} />
      {entries.length === 0 ? null : <WeighIns entries={entries} />}
    </section>
  );
}
