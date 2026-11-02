/** Turning Garmin's answers into what Chalk stores: the token file, and one reading per day. */
import {
  BODY_FAT_PCT_MAX,
  BODY_FAT_PCT_MIN,
  MUSCLE_MASS_KG_MAX,
  MUSCLE_MASS_KG_MIN,
} from "@chalk/contracts";
import * as Schema from "effect/Schema";

import type { ScaleReading } from "../profile/ProfileStore.ts";

/** What `pnpm garmin:login` prints (python-garminconnect's token file). */
export interface GarminTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly clientId: string;
}

/** The pasted token file; undefined when it is not one. The access token may be stale. */
export const parseTokenFile = (text: string): GarminTokens | undefined => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  const field = (key: string) => {
    const entry: unknown = (value as Record<string, unknown>)[key];
    return typeof entry === "string" && entry.trim() !== "" ? entry.trim() : undefined;
  };
  const refreshToken = field("di_refresh_token");
  const clientId = field("di_client_id");
  if (refreshToken === undefined || clientId === undefined) return undefined;
  return { accessToken: field("di_token") ?? "", refreshToken, clientId };
};

/** A JWT's claims; undefined when it is not one. */
export const jwtClaims = (token: string): Record<string, unknown> | undefined => {
  const payload = token.split(".")[1];
  if (payload === undefined) return undefined;
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof claims === "object" && claims !== null
      ? (claims as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
};

const OptionalNumber = Schema.optional(Schema.NullOr(Schema.Number));
const OptionalString = Schema.optional(Schema.NullOr(Schema.String));

/**
 * One weigh-in as weight-service answers it; only these fields are read. A reading the scale
 * took without composition (shoes on, a guest) carries 0, not null, in `bodyFat` and
 * `muscleMass` (checked against a live reply 2026-11-02: 9 of 211 Index readings).
 */
const WeightMetric = Schema.Struct({
  calendarDate: OptionalString,
  /** Grams. */
  weight: OptionalNumber,
  /** Percent of the weight. */
  bodyFat: OptionalNumber,
  /** Skeletal muscle, grams. */
  muscleMass: OptionalNumber,
  /** The local wall clock as epoch milliseconds (Garmin's "local as if UTC"). */
  date: OptionalNumber,
  timestampGMT: OptionalNumber,
});
type WeightMetric = typeof WeightMetric.Type;

/** `GET /weight-service/weight/range/{from}/{to}?includeAll=true`. */
export const WeightRange = Schema.Struct({
  dailyWeightSummaries: Schema.optional(
    Schema.NullOr(
      Schema.Array(
        Schema.Struct({
          summaryDate: OptionalString,
          allWeightMetrics: Schema.optional(Schema.NullOr(Schema.Array(WeightMetric))),
          latestWeight: Schema.optional(Schema.NullOr(WeightMetric)),
        }),
      ),
    ),
  ),
});
export type WeightRange = typeof WeightRange.Type;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Outside this the reading is not a person on the scale (Chalk's bodyweight bounds). */
const MIN_KG = 25;
const MAX_KG = 300;
/** Chalk's body fat and muscle mass bounds; outside them (Garmin's 0 included) is no reading. */
const BODY_FAT_PCT = [BODY_FAT_PCT_MIN, BODY_FAT_PCT_MAX] as const;
const MUSCLE_KG = [MUSCLE_MASS_KG_MIN, MUSCLE_MASS_KG_MAX] as const;

const takenAt = (metric: WeightMetric) =>
  metric.date ?? metric.timestampGMT ?? Number.POSITIVE_INFINITY;

const within = (value: number | null | undefined, [min, max]: readonly [number, number]) =>
  value != null && value >= min && value <= max ? value : null;

/** Body fat and muscle mass from one reading, both or neither; Garmin's 0 is no reading. */
const compositionOf = (metric: WeightMetric) => {
  const bodyFatPct = within(metric.bodyFat, BODY_FAT_PCT);
  const muscleMassKg = within(
    metric.muscleMass == null ? null : metric.muscleMass / 1000,
    MUSCLE_KG,
  );
  return bodyFatPct === null || muscleMassKg === null
    ? undefined
    : {
        bodyFatPct: Math.round(bodyFatPct * 10) / 10,
        muscleMassKg: Math.round(muscleMassKg * 100) / 100,
      };
};

/**
 * One reading per day, oldest day first: the weight in kilograms to two decimals and the local
 * "HH:MM" of the day's first reading, and body fat and muscle mass from the day's first reading
 * that has them (a reading in shoes measures no composition; a later barefoot one does). Days
 * are Garmin's calendar days; a reading without a weight, or out of bounds, is skipped.
 */
export const firstReadings = (range: WeightRange): Array<ScaleReading> => {
  const byDay = new Map<string, Array<WeightMetric>>();
  for (const summary of range.dailyWeightSummaries ?? []) {
    const metrics =
      summary.allWeightMetrics ?? (summary.latestWeight ? [summary.latestWeight] : []);
    for (const metric of metrics) {
      const day = metric.calendarDate ?? summary.summaryDate;
      if (day == null || !ISO_DATE.test(day) || metric.weight == null) continue;
      const kg = metric.weight / 1000;
      if (!(kg >= MIN_KG && kg <= MAX_KG)) continue;
      byDay.set(day, [...(byDay.get(day) ?? []), metric]);
    }
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([performedOn, metrics]) => {
      const ordered = metrics.toSorted((a, b) => takenAt(a) - takenAt(b));
      const first = ordered[0]!;
      const composition = ordered.map(compositionOf).find((found) => found !== undefined);
      return {
        performedOn,
        kg: Math.round((first.weight ?? 0) / 10) / 100,
        measuredAt: first.date == null ? null : new Date(first.date).toISOString().slice(11, 16),
        bodyFatPct: composition?.bodyFatPct ?? null,
        muscleMassKg: composition?.muscleMassKg ?? null,
      };
    });
};

/** `date` moved by whole days, both IsoDate. */
export const shiftDate = (date: string, days: number): string => {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
};

/** `from`..`to` (inclusive) cut into windows of at most `days` days, oldest first. */
export const windows = (
  from: string,
  to: string,
  days: number,
): Array<{ readonly from: string; readonly to: string }> => {
  const out: Array<{ from: string; to: string }> = [];
  for (let start = from; start <= to; start = shiftDate(start, days)) {
    const end = shiftDate(start, days - 1);
    out.push({ from: start, to: end < to ? end : to });
  }
  return out;
};
