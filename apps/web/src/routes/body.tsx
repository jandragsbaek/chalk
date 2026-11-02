import type { Bodyweight, IsoDate } from "@chalk/contracts";
import { useAtomValue } from "@effect/atom-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useId, useState } from "react";

import { BodyNumbers } from "../components/body/BodyNumbers.tsx";
import { AVERAGE_DAYS, TrendChart } from "../components/body/TrendChart.tsx";
import { WeighInForm, WeighInTable } from "../components/body/WeighIns.tsx";
import { kg, Legend, LegendItem, pct, Segmented } from "../components/chart.tsx";
import { SectionHead } from "../components/today/SectionHead.tsx";
import { seriesOf, shiftDay } from "../lib/bodyweight.ts";
import { toDate } from "../lib/progress.ts";
import { localIsoDate } from "../lib/utils.ts";
import { profileAtom } from "../state/profile.ts";

export const Route = createFileRoute("/body")({ component: BodyPage });

const DAY_MS = 86_400_000;

type Range = "90d" | "1y" | "all";

const RANGES: ReadonlyArray<{ value: Range; label: string; days?: number }> = [
  { value: "90d", label: "90 days", days: 90 },
  { value: "1y", label: "1 year", days: 365 },
  { value: "all", label: "All" },
];

/** A chart with its printed caption in the corner, like a box on the form. */
function Figure({
  caption,
  children,
}: {
  readonly caption: string;
  readonly children: React.ReactNode;
}) {
  return (
    <figure className="grid gap-1 bg-card px-2 pt-2 pb-1">
      <figcaption className="form-label px-2 text-muted-foreground">{caption}</figcaption>
      {children}
    </figure>
  );
}

/** Body fat, muscle mass and bodyweight over one shared range, so their days line up. */
function Trends({
  entries,
  today,
}: {
  readonly entries: ReadonlyArray<Bodyweight>;
  readonly today: IsoDate;
}) {
  const id = useId();
  const [range, setRange] = useState<Range>("all");
  const weight = seriesOf(entries, (entry) => entry.kg);
  const fat = seriesOf(entries, (entry) => entry.bodyFatPct);
  const muscle = seriesOf(entries, (entry) => entry.muscleMassKg);
  const firstDay = weight[0]?.performedOn;
  const latestDay = weight.at(-1)?.performedOn;
  if (firstDay === undefined || latestDay === undefined) return null;

  const endDay = today > latestDay ? today : latestDay;
  const spanDays = Math.round((toDate(endDay).getTime() - toDate(firstDay).getTime()) / DAY_MS);
  const rangeDays = RANGES.find((option) => option.value === range)?.days;
  const rangeFrom =
    rangeDays === undefined || spanDays <= rangeDays ? firstDay : shiftDay(endDay, -rangeDays);
  // A fortnight at least, so a first weigh-in does not sit on the axis edge.
  const fortnight = shiftDay(endDay, -14);
  const from = rangeFrom < fortnight ? rangeFrom : fortnight;
  const hasScale = entries.some((entry) => entry.source === "garmin");

  return (
    <section aria-labelledby={`${id}-title`} className="grid content-start gap-3">
      <SectionHead
        id={`${id}-title`}
        title="Trends"
        meta={
          <div className="flex items-center gap-4">
            {hasScale ? (
              <Legend>
                <LegendItem mark="square" color="var(--viz-quiet)" label="Scale reading" />
                <LegendItem
                  mark="line"
                  color="var(--viz-1)"
                  label={`${AVERAGE_DAYS}-day average`}
                />
                <LegendItem mark="square" color="var(--viz-1)" label="Typed" />
              </Legend>
            ) : null}
            {spanDays > 90 ? (
              <Segmented
                label="Range"
                value={range}
                onChange={setRange}
                options={RANGES.filter(
                  (option) => option.days === undefined || option.days < spanDays,
                )}
              />
            ) : null}
          </div>
        }
      />
      {fat.length === 0 && muscle.length === 0 ? (
        <p className="border bg-card px-4 py-4 text-sm text-muted-foreground">
          No body fat or muscle mass yet. A Garmin Index measures both on a barefoot weigh-in (
          <Link to="/settings/connections" className="underline hover:text-foreground">
            Connections
          </Link>
          ), or type them with a weigh-in below.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <Figure caption="Body fat, %">
            <TrendChart
              name="body fat"
              points={fat}
              from={from}
              to={endDay}
              height={240}
              pad={0.5}
              format={pct}
            />
          </Figure>
          <Figure caption="Muscle mass, kg">
            <TrendChart
              name="muscle mass"
              points={muscle}
              from={from}
              to={endDay}
              height={240}
              pad={0.5}
              format={kg}
            />
          </Figure>
        </div>
      )}
      <Figure caption="Bodyweight, kg">
        <TrendChart
          name="bodyweight"
          points={weight}
          from={from}
          to={endDay}
          height={180}
          pad={1}
          format={kg}
        />
      </Figure>
    </section>
  );
}

function Body({ entries }: { readonly entries: ReadonlyArray<Bodyweight> }) {
  const id = useId();
  // Fixed at mount, like the other log forms; a tab left open past midnight keeps yesterday.
  const [today] = useState(() => localIsoDate(new Date()));
  const weight = seriesOf(entries, (entry) => entry.kg);
  const fat = seriesOf(entries, (entry) => entry.bodyFatPct);
  const muscle = seriesOf(entries, (entry) => entry.muscleMassKg);
  const composed = entries.filter(
    (entry) => entry.bodyFatPct !== null || entry.muscleMassKg !== null,
  ).length;

  return (
    <>
      <BodyNumbers entries={entries} fat={fat} muscle={muscle} weight={weight} />
      {entries.length === 0 ? (
        <p className="border bg-card px-4 py-4 text-sm text-muted-foreground">
          No weigh-ins yet. Log one below, or connect a Garmin scale in{" "}
          <Link to="/settings/connections" className="underline hover:text-foreground">
            Connections
          </Link>
          ; its readings bring body fat and muscle mass with them. Work and power read the latest
          weigh-in on or before each session.
        </p>
      ) : (
        <Trends entries={entries} today={today} />
      )}
      <section aria-labelledby={`${id}-log`} className="grid content-start">
        <SectionHead
          id={`${id}-log`}
          title="Weigh-ins"
          meta={`${entries.length === 1 ? "1 weigh-in" : `${entries.length} weigh-ins`} · ${composed} with body fat and muscle`}
        />
        <WeighInForm entries={entries} today={today} />
        {entries.length === 0 ? null : <WeighInTable entries={entries} />}
      </section>
    </>
  );
}

function BodyFromProfile() {
  return AsyncResult.match(useAtomValue(profileAtom), {
    onInitial: () => <p className="text-sm text-muted-foreground">Loading your weigh-ins...</p>,
    onFailure: () => (
      <p className="text-sm text-destructive">
        Could not load your weigh-ins. Is the server running?
      </p>
    ),
    onSuccess: ({ value }) => <Body entries={value.bodyweights} />,
  });
}

/** Body fat, muscle mass and bodyweight: where the body is going, then every weigh-in. */
function BodyPage() {
  return (
    <main className="mx-auto grid w-full max-w-6xl content-start gap-8 px-6 pt-8 pb-16">
      <h1 className="protocol-title justify-self-start border-b-2 border-foreground pb-1.5 text-4xl">
        Body
      </h1>
      <BodyFromProfile />
    </main>
  );
}
