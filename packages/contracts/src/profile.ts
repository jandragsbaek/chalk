import * as Schema from "effect/Schema";

import { IsoDate } from "./baseSchemas.ts";
import { Sex } from "./levels.ts";

/**
 * The athlete behind the log: sex (which side of an M/F load applies), height, optional limb
 * lengths, and bodyweight over time with body fat and muscle mass when the scale measured them.
 * Centimetres, kilograms and percent of bodyweight, like every unit in storage.
 */

/** Assumed until the athlete sets it: Chalk grades on the male side of every M/F load. */
export const DEFAULT_SEX: Sex = "m";

/** Standing height, centimetres. */
export const HeightCm = Schema.Finite.check(
  Schema.isGreaterThanOrEqualTo(100),
  Schema.isLessThanOrEqualTo(250),
);

/** A limb segment, centimetres: arm (acromion to knuckles) or inseam (floor to crotch). */
export const LimbLengthCm = Schema.Finite.check(
  Schema.isGreaterThanOrEqualTo(30),
  Schema.isLessThanOrEqualTo(150),
);

/** Bodyweight, kilograms. */
export const BodyweightKg = Schema.Finite.check(
  Schema.isGreaterThanOrEqualTo(25),
  Schema.isLessThanOrEqualTo(300),
);

/** Body fat and muscle mass bounds: outside them a smart scale's number is not a reading. */
export const BODY_FAT_PCT_MIN = 2;
export const BODY_FAT_PCT_MAX = 75;
export const MUSCLE_MASS_KG_MIN = 10;
export const MUSCLE_MASS_KG_MAX = 150;

/** Body fat, percent of bodyweight, from a bioimpedance scale. */
export const BodyFatPct = Schema.Finite.check(
  Schema.isGreaterThanOrEqualTo(BODY_FAT_PCT_MIN),
  Schema.isLessThanOrEqualTo(BODY_FAT_PCT_MAX),
);

/** Skeletal muscle mass, kilograms, from a bioimpedance scale (Garmin's "muscle mass"). */
export const MuscleMassKg = Schema.Finite.check(
  Schema.isGreaterThanOrEqualTo(MUSCLE_MASS_KG_MIN),
  Schema.isLessThanOrEqualTo(MUSCLE_MASS_KG_MAX),
);

/**
 * One weigh-in: the athlete's local day and the scale's reading, with body fat and muscle mass
 * when the scale measured them (a Garmin Index does barefoot; typed ones are optional). One per
 * day.
 */
export const BodyweightEntry = Schema.Struct({
  performedOn: IsoDate,
  kg: BodyweightKg,
  bodyFatPct: Schema.NullOr(BodyFatPct),
  muscleMassKg: Schema.NullOr(MuscleMassKg),
}).annotate({ identifier: "BodyweightEntry" });
export type BodyweightEntry = typeof BodyweightEntry.Type;

/** Where a day's bodyweight came from: typed by the athlete, or read from the Garmin scale. */
export const BodyweightSource = Schema.Literals(["manual", "garmin"]);
export type BodyweightSource = typeof BodyweightSource.Type;

/** A stored weigh-in: the entry, where it came from and, from the scale, its local "HH:MM". */
export const Bodyweight = Schema.Struct({
  ...BodyweightEntry.fields,
  source: BodyweightSource,
  measuredAt: Schema.NullOr(Schema.String),
}).annotate({ identifier: "Bodyweight" });
export type Bodyweight = typeof Bodyweight.Type;

/** What the settings page edits; bodyweight is logged and deleted per day instead. */
export const AthleteBody = Schema.Struct({
  sex: Sex,
  heightCm: Schema.NullOr(HeightCm),
  /** Acromion (bony tip of the shoulder) to the knuckles of a closed fist, arm hanging straight. */
  armLengthCm: Schema.NullOr(LimbLengthCm),
  /** Inseam: floor to crotch, standing barefoot. */
  legLengthCm: Schema.NullOr(LimbLengthCm),
}).annotate({ identifier: "AthleteBody" });
export type AthleteBody = typeof AthleteBody.Type;

/**
 * The whole profile in one read. `bodyweights` is every weigh-in, oldest day first. Before the
 * athlete saves anything it is `sex: "m"`, nulls and no weigh-ins.
 */
export const AthleteProfile = Schema.Struct({
  ...AthleteBody.fields,
  bodyweights: Schema.Array(Bodyweight),
}).annotate({ identifier: "AthleteProfile" });
export type AthleteProfile = typeof AthleteProfile.Type;

export const EMPTY_ATHLETE_PROFILE: AthleteProfile = {
  sex: DEFAULT_SEX,
  heightCm: null,
  armLengthCm: null,
  legLengthCm: null,
  bodyweights: [],
};

/** A day's bodyweight, without what else the scale measured. */
type WeighIn = Pick<BodyweightEntry, "performedOn" | "kg">;

/**
 * Bodyweight on day `date`: the latest weigh-in on or before it, else the earliest weigh-in
 * (a session before the first weigh-in uses the first one). `null` without any weigh-in.
 */
export const bodyweightOn = (
  profile: { readonly bodyweights: ReadonlyArray<WeighIn> },
  date: IsoDate,
): number | null => {
  let before: WeighIn | undefined;
  let earliest: WeighIn | undefined;
  for (const entry of profile.bodyweights) {
    if (earliest === undefined || entry.performedOn < earliest.performedOn) earliest = entry;
    if (
      entry.performedOn <= date &&
      (before === undefined || entry.performedOn > before.performedOn)
    )
      before = entry;
  }
  return (before ?? earliest)?.kg ?? null;
};

export class BodyweightNotFoundError extends Schema.TaggedError<BodyweightNotFoundError>()(
  "BodyweightNotFoundError",
  { performedOn: IsoDate },
  { httpApiStatus: 404 },
) {
  override get message(): string {
    return `No bodyweight logged on ${this.performedOn}.`;
  }
}

/** Server-side storage failed; the cause stays on the server. */
export class ProfileStorageError extends Schema.TaggedError<ProfileStorageError>()(
  "ProfileStorageError",
  { operation: Schema.String },
  { httpApiStatus: 500 },
) {
  override get message(): string {
    return `Could not ${this.operation}.`;
  }
}
