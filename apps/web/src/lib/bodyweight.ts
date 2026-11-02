import type { AthleteBody, BodyweightEntry, IsoDate, Sex } from "@chalk/contracts";

import { localIsoDate } from "./utils.ts";

/** The body fields as typed in the form: text, so a half-typed "72," is not lost. */
export interface BodyDraft {
  readonly sex: Sex;
  readonly heightCm: string;
  readonly armLengthCm: string;
  readonly legLengthCm: string;
}

const lengthText = (cm: number | null) => (cm === null ? "" : String(cm));

export const draftOfBody = (body: AthleteBody): BodyDraft => ({
  sex: body.sex,
  heightCm: lengthText(body.heightCm),
  armLengthCm: lengthText(body.armLengthCm),
  legLengthCm: lengthText(body.legLengthCm),
});

/** A typed number with a comma or point for decimals; blank is `null`, junk is `NaN`. */
export function parseMeasure(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return null;
  return /^\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

/** `iso` moved by `days` calendar days. */
export function shiftDay(iso: IsoDate, days: number): IsoDate {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localIsoDate(date);
}

/** A day's weigh-in, without what else the scale measured. */
type WeighIn = Pick<BodyweightEntry, "performedOn" | "kg">;

/** One weigh-in with how far it moved from the one before. */
export type BodyweightRow<Entry extends WeighIn = WeighIn> = Entry & {
  readonly change: number | undefined;
};

/** Weigh-ins newest first, each with its change from the previous weigh-in. */
export function bodyweightRows<Entry extends WeighIn>(
  entries: ReadonlyArray<Entry>,
): Array<BodyweightRow<Entry>> {
  const ascending = [...entries].sort((a, b) => a.performedOn.localeCompare(b.performedOn));
  return ascending
    .map((entry, index) => {
      const previous = ascending[index - 1];
      return { ...entry, change: previous === undefined ? undefined : entry.kg - previous.kg };
    })
    .reverse();
}

/** A weigh-in carrying the one number a series tracks: bodyweight, body fat or muscle mass. */
export type SeriesPoint<Entry extends { readonly performedOn: IsoDate }> = Entry & {
  readonly value: number;
};

/** The weigh-ins that measured `read`, oldest first, each with that number as its `value`. */
export function seriesOf<Entry extends { readonly performedOn: IsoDate }>(
  entries: ReadonlyArray<Entry>,
  read: (entry: Entry) => number | null,
): Array<SeriesPoint<Entry>> {
  return [...entries]
    .sort((a, b) => a.performedOn.localeCompare(b.performedOn))
    .flatMap((entry) => {
      const value = read(entry);
      return value === null ? [] : [{ ...entry, value }];
    });
}

export interface SeriesTrend<Point> {
  readonly latest: Point;
  /** Latest minus the reading in force `days` before it; absent without a reading that old. */
  readonly change: number | undefined;
  readonly sinceFirst: number | undefined;
}

/** The latest reading and how it moved over the last `days` days and since the first. */
export function seriesTrend<Point extends SeriesPoint<{ readonly performedOn: IsoDate }>>(
  points: ReadonlyArray<Point>,
  days: number,
): SeriesTrend<Point> | undefined {
  const latest = points.at(-1);
  const first = points[0];
  if (latest === undefined || first === undefined) return undefined;
  const cutoff = shiftDay(latest.performedOn, -days);
  const then = points.findLast((point) => point.performedOn <= cutoff);
  return {
    latest,
    change: then === undefined ? undefined : latest.value - then.value,
    sinceFirst: first === latest ? undefined : latest.value - first.value,
  };
}

/** A reading with the mean of every reading in the `days` days up to and including it. */
export type AveragedPoint<Point> = Point & { readonly average: number };

/**
 * Readings oldest first, each with its trailing mean over `days` calendar days: daily scale
 * readings swing a kilo (and a point of body fat) on water alone, the mean shows where they are
 * going. A lone reading in its window is its own mean.
 */
export function trailingAverage<Point extends SeriesPoint<{ readonly performedOn: IsoDate }>>(
  points: ReadonlyArray<Point>,
  days: number,
): Array<AveragedPoint<Point>> {
  let start = 0;
  let sum = 0;
  return points.map((point, index) => {
    sum += point.value;
    const from = shiftDay(point.performedOn, -(days - 1));
    while ((points[start]?.performedOn ?? "") < from) {
      sum -= points[start]?.value ?? 0;
      start += 1;
    }
    return { ...point, average: sum / (index - start + 1) };
  });
}

/** Fat mass, kilograms: the share of the weigh-in its body fat percent names. */
export const fatMassKg = (entry: Pick<BodyweightEntry, "kg" | "bodyFatPct">) =>
  entry.bodyFatPct === null ? null : (entry.kg * entry.bodyFatPct) / 100;
