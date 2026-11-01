/** Turning Garmin's answers into what Chalk stores: the token file, and one reading per day. */
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

/** One weigh-in as weight-service answers it; only these fields are read. */
const WeightMetric = Schema.Struct({
  calendarDate: OptionalString,
  /** Grams. */
  weight: OptionalNumber,
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

const takenAt = (metric: WeightMetric) =>
  metric.date ?? metric.timestampGMT ?? Number.POSITIVE_INFINITY;

/**
 * The first reading of each day, in kilograms to two decimals with its local "HH:MM". Days are
 * Garmin's calendar days; a reading without a weight, or out of bounds, is skipped.
 */
export const firstReadings = (range: WeightRange): Array<ScaleReading> => {
  const first = new Map<string, WeightMetric>();
  for (const summary of range.dailyWeightSummaries ?? []) {
    const metrics =
      summary.allWeightMetrics ?? (summary.latestWeight ? [summary.latestWeight] : []);
    for (const metric of metrics) {
      const day = metric.calendarDate ?? summary.summaryDate;
      if (day == null || !ISO_DATE.test(day) || metric.weight == null) continue;
      const kg = metric.weight / 1000;
      if (!(kg >= MIN_KG && kg <= MAX_KG)) continue;
      const held = first.get(day);
      if (held === undefined || takenAt(metric) < takenAt(held)) first.set(day, metric);
    }
  }
  return [...first.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([performedOn, metric]) => ({
      performedOn,
      kg: Math.round((metric.weight ?? 0) / 10) / 100,
      measuredAt: metric.date == null ? null : new Date(metric.date).toISOString().slice(11, 16),
    }));
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
