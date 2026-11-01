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

/** One weigh-in with how far it moved from the one before. */
export interface BodyweightRow extends BodyweightEntry {
  readonly change: number | undefined;
}

/** Weigh-ins newest first, each with its change from the previous weigh-in. */
export function bodyweightRows(entries: ReadonlyArray<BodyweightEntry>): Array<BodyweightRow> {
  const ascending = [...entries].sort((a, b) => a.performedOn.localeCompare(b.performedOn));
  return ascending
    .map((entry, index) => {
      const previous = ascending[index - 1];
      return { ...entry, change: previous === undefined ? undefined : entry.kg - previous.kg };
    })
    .reverse();
}

export interface BodyweightTrend {
  readonly latest: BodyweightEntry;
  /** Latest minus the reading in force `days` before it; absent without a weigh-in that old. */
  readonly change: number | undefined;
  readonly sinceFirst: number | undefined;
}

/** The latest weigh-in and how it moved over the last `days` days and since the first. */
export function bodyweightTrend(
  entries: ReadonlyArray<BodyweightEntry>,
  days: number,
): BodyweightTrend | undefined {
  const ascending = [...entries].sort((a, b) => a.performedOn.localeCompare(b.performedOn));
  const latest = ascending.at(-1);
  const first = ascending[0];
  if (latest === undefined || first === undefined) return undefined;
  const cutoff = shiftDay(latest.performedOn, -days);
  const then = ascending.findLast((entry) => entry.performedOn <= cutoff);
  return {
    latest,
    change: then === undefined ? undefined : latest.kg - then.kg,
    sinceFirst: first === latest ? undefined : latest.kg - first.kg,
  };
}
