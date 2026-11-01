import * as Schema from "effect/Schema";

import { IsoDate } from "./baseSchemas.ts";
import { Sex } from "./levels.ts";

/**
 * The athlete behind the log: sex (which side of an M/F load applies), height, optional limb
 * lengths, and bodyweight over time. Centimetres and kilograms, like every unit in storage.
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

/** One weigh-in: the athlete's local day and the scale's reading. One per day. */
export const BodyweightEntry = Schema.Struct({
  performedOn: IsoDate,
  kg: BodyweightKg,
}).annotate({ identifier: "BodyweightEntry" });
export type BodyweightEntry = typeof BodyweightEntry.Type;

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
  bodyweights: Schema.Array(BodyweightEntry),
}).annotate({ identifier: "AthleteProfile" });
export type AthleteProfile = typeof AthleteProfile.Type;

export const EMPTY_ATHLETE_PROFILE: AthleteProfile = {
  sex: DEFAULT_SEX,
  heightCm: null,
  armLengthCm: null,
  legLengthCm: null,
  bodyweights: [],
};

/**
 * Bodyweight on day `date`: the latest weigh-in on or before it, else the earliest weigh-in
 * (a session before the first weigh-in uses the first one). `null` without any weigh-in.
 */
export const bodyweightOn = (
  profile: Pick<AthleteProfile, "bodyweights">,
  date: IsoDate,
): number | null => {
  let before: BodyweightEntry | undefined;
  let earliest: BodyweightEntry | undefined;
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
