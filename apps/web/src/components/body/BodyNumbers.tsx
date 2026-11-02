import type { Bodyweight } from "@chalk/contracts";
import type * as React from "react";

import { fatMassKg, seriesTrend, trailingAverage, type SeriesPoint } from "../../lib/bodyweight.ts";
import { formatDay } from "../../lib/utils.ts";
import { kg, pct, signedKg, signedPoints } from "../chart.tsx";
import { formatShort } from "../today/SectionHead.tsx";
import { AVERAGE_DAYS, sourceLabel } from "./TrendChart.tsx";

/** The window each headline change covers. */
export const TREND_DAYS = 30;

/**
 * How far the week's mean moved over the last `TREND_DAYS` days: a single scale reading swings a
 * point of body fat on water alone, so the change compares means, not readings.
 */
const meanChange = (points: ReadonlyArray<SeriesPoint<Bodyweight>>) =>
  seriesTrend(
    trailingAverage(points, AVERAGE_DAYS).map((point) => ({ ...point, value: point.average })),
    TREND_DAYS,
  )?.change;

function Change({
  value,
  format,
}: {
  readonly value: number | undefined;
  readonly format: (value: number) => string;
}) {
  return value === undefined ? (
    <span className="text-xs text-muted-foreground">Not {TREND_DAYS} days of readings yet</span>
  ) : (
    <span className="text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">{format(value)}</span> in {TREND_DAYS} days,
      weekly mean
    </span>
  );
}

/**
 * A formatted reading ("42.3 kg") in display caps, its unit set smaller and in lower case after
 * the number so "kg" never prints as "KG".
 */
function Reading({ text, size }: { readonly text: string; readonly size: "lg" | "md" }) {
  const [number, unit] = text.split("\u00a0");
  return (
    <span className="flex items-baseline gap-1.5">
      <span
        className={
          size === "lg"
            ? "protocol-title text-6xl tabular-nums"
            : "protocol-title text-4xl tabular-nums"
        }
      >
        {number}
      </span>
      {unit === undefined ? null : (
        <span
          className={
            size === "lg"
              ? "text-2xl font-semibold text-muted-foreground font-stretch-semi-condensed"
              : "text-lg font-semibold text-muted-foreground font-stretch-semi-condensed"
          }
        >
          {unit}
        </span>
      )}
    </span>
  );
}

/** A headline box: label in the corner, the number in display caps, one line under it. */
function Headline({
  label,
  value,
  under,
  closing,
}: {
  readonly label: string;
  readonly value: string | undefined;
  readonly under: React.ReactNode;
  /** The last headline: ruled off from the supporting numbers in ink. */
  readonly closing?: boolean;
}) {
  return (
    <div
      className={
        closing
          ? "grid min-w-64 content-start gap-1 border-r-2 border-r-foreground px-4 pt-2.5 pb-3"
          : "grid min-w-64 content-start gap-1 border-r px-4 pt-2.5 pb-3"
      }
    >
      <dt className="form-label">{label}</dt>
      <dd className="grid gap-1.5">
        {value === undefined ? (
          <span data-empty aria-label="Not measured yet" className="my-6" />
        ) : (
          <Reading text={value} size="lg" />
        )}
        {under}
      </dd>
    </div>
  );
}

/** A supporting box: label, the number in smaller display caps, one line under it. */
function Support({
  label,
  value,
  under,
  wide,
}: {
  readonly label: string;
  readonly value: string | undefined;
  readonly under: React.ReactNode;
  readonly wide?: boolean;
}) {
  return (
    <div
      className={
        wide
          ? "grid flex-1 content-start gap-1 px-4 pt-2.5 pb-3"
          : "grid min-w-40 content-start gap-1 border-r px-4 pt-2.5 pb-3"
      }
    >
      <dt className="form-label text-muted-foreground">{label}</dt>
      <dd className="grid gap-1.5">
        <span className="flex h-14 items-end">
          {value === undefined ? (
            <span data-empty aria-label="Not measured yet" className="mb-3" />
          ) : (
            <Reading text={value} size="md" />
          )}
        </span>
        {under}
      </dd>
    </div>
  );
}

/**
 * The numbers that say where the body is going, printed as one strip of protocol field boxes:
 * body fat and muscle mass lead in display caps, ruled off in ink; then the fat mass they imply,
 * bodyweight, and the day and source of the latest composition reading.
 */
export function BodyNumbers({
  entries,
  fat,
  muscle,
  weight,
}: {
  readonly entries: ReadonlyArray<Bodyweight>;
  readonly fat: ReadonlyArray<SeriesPoint<Bodyweight>>;
  readonly muscle: ReadonlyArray<SeriesPoint<Bodyweight>>;
  readonly weight: ReadonlyArray<SeriesPoint<Bodyweight>>;
}) {
  // A scale measures both at once; a typed weigh-in may give only one, so each number is its
  // own latest reading, dated when it is older than the latest reading of either.
  const measured = entries.findLast(
    (entry) => entry.bodyFatPct !== null || entry.muscleMassKg !== null,
  );
  const latestFat = fat.at(-1);
  const latestMuscle = muscle.at(-1);
  const latestWeight = weight.at(-1);
  const fatMass = latestFat === undefined ? null : fatMassKg(latestFat);
  const olderDay = (point: SeriesPoint<Bodyweight> | undefined) =>
    point === undefined || point.performedOn === measured?.performedOn ? null : (
      <span className="text-xs text-muted-foreground">From {formatDay(point.performedOn)}</span>
    );

  return (
    <dl aria-label="Body, latest" className="flex border bg-card">
      <Headline
        label="Body fat"
        value={latestFat === undefined ? undefined : pct(latestFat.value)}
        under={
          latestFat === undefined ? null : (
            <>
              <Change value={meanChange(fat)} format={signedPoints} />
              {olderDay(latestFat)}
            </>
          )
        }
      />
      <Headline
        closing
        label="Muscle mass"
        value={latestMuscle === undefined ? undefined : kg(latestMuscle.value)}
        under={
          latestMuscle === undefined ? null : (
            <>
              <Change value={meanChange(muscle)} format={signedKg} />
              {olderDay(latestMuscle)}
            </>
          )
        }
      />
      <Support
        label="Fat mass, derived"
        value={fatMass === null ? undefined : kg(fatMass)}
        under={
          fatMass === null ? null : (
            <span className="text-xs text-muted-foreground">Bodyweight × body fat</span>
          )
        }
      />
      <Support
        label="Bodyweight"
        value={latestWeight === undefined ? undefined : kg(latestWeight.value)}
        under={
          latestWeight === undefined ? null : (
            <span className="text-xs text-muted-foreground">
              {latestWeight.performedOn === measured?.performedOn
                ? "Same weigh-in"
                : formatDay(latestWeight.performedOn)}
            </span>
          )
        }
      />
      <Support
        wide
        label="Measured"
        value={measured === undefined ? undefined : formatShort(measured.performedOn)}
        under={
          measured === undefined ? null : (
            <span className="text-xs text-muted-foreground">
              {formatDay(measured.performedOn)} · {sourceLabel(measured)}
            </span>
          )
        }
      />
    </dl>
  );
}
