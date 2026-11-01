import type { Sex } from "../levels.ts";

/**
 * The athlete's body as the work model needs it: segment lengths and masses. Lengths come from
 * height through Drillis and Contini's proportions (as tabled in Winter, "Biomechanics and Motor
 * Control of Human Movement"), masses from bodyweight through de Leva's (1996) male and female
 * segment fractions. A measured arm or leg length rescales that limb's segments.
 */
export interface BodyInput {
  readonly sex: Sex;
  readonly heightCm: number;
  readonly bodyweightKg: number;
  /** Acromion (tip of the shoulder) to the knuckles of a closed fist, arm hanging straight. */
  readonly armLengthCm?: number | null | undefined;
  /** Inseam: floor to crotch, standing barefoot. */
  readonly legLengthCm?: number | null | undefined;
}

export interface Body {
  readonly sex: Sex;
  readonly massKg: number;
  readonly heightM: number;
  /** Segment lengths, metres. */
  readonly upperArmM: number;
  readonly forearmM: number;
  readonly handM: number;
  readonly thighM: number;
  readonly shankM: number;
  /** Shoulder to hip. */
  readonly trunkM: number;
  /** Heights standing, metres. */
  readonly shoulderHeightM: number;
  readonly hipHeightM: number;
  readonly chinHeightM: number;
  /** Middle of the grip with the arms hanging: a deadlift's lockout. */
  readonly gripHeightM: number;
  /** Middle of the grip with the arms locked overhead. */
  readonly overheadM: number;
  /** Segment masses for both sides together, kg. */
  readonly handsKg: number;
  readonly forearmsKg: number;
  readonly upperArmsKg: number;
  readonly thighsKg: number;
  readonly shanksKg: number;
  readonly feetKg: number;
  /** Head, trunk and arms: what rises when the hips extend. */
  readonly upperBodyKg: number;
}

/** Drillis and Contini, fractions of height. */
const PROPORTIONS = {
  upperArm: 0.186,
  forearm: 0.146,
  hand: 0.108,
  thigh: 0.245,
  shank: 0.246,
  ankle: 0.039,
  shoulder: 0.818,
  hip: 0.53,
  chin: 0.87,
  /** Crotch height: ANSUR II means put it at 0.48 of stature for both sexes. */
  inseam: 0.48,
} as const;

/** de Leva (1996): one segment's share of body mass. */
const MASS_FRACTIONS: Record<
  Sex,
  {
    head: number;
    trunk: number;
    upperArm: number;
    forearm: number;
    hand: number;
    thigh: number;
    shank: number;
    foot: number;
  }
> = {
  m: {
    head: 0.0694,
    trunk: 0.4346,
    upperArm: 0.0271,
    forearm: 0.0162,
    hand: 0.0061,
    thigh: 0.1416,
    shank: 0.0433,
    foot: 0.0137,
  },
  f: {
    head: 0.0668,
    trunk: 0.4257,
    upperArm: 0.0255,
    forearm: 0.0138,
    hand: 0.0056,
    thigh: 0.1478,
    shank: 0.0481,
    foot: 0.0129,
  },
};

/** Plausible adult ranges; outside them a measurement is a typo and the estimate is used. */
const plausible = (value: number | null | undefined, min: number, max: number) =>
  value !== null && value !== undefined && Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined;

export const bodyOf = (input: BodyInput): Body => {
  const height = input.heightCm / 100;
  const p = PROPORTIONS;
  // The knuckles of a fist sit about mid-hand: the same point as a grip on the bar.
  const estimatedArm = (p.upperArm + p.forearm + p.hand / 2) * height;
  const measuredArm = plausible(input.armLengthCm, 35, 110);
  const armScale = measuredArm === undefined ? 1 : measuredArm / 100 / estimatedArm;
  const measuredLeg = plausible(input.legLengthCm, 50, 130);
  const legScale = measuredLeg === undefined ? 1 : measuredLeg / 100 / (p.inseam * height);

  const upperArmM = p.upperArm * height * armScale;
  const forearmM = p.forearm * height * armScale;
  const handM = p.hand * height * armScale;
  const thighM = p.thigh * height * legScale;
  const shankM = p.shank * height * legScale;
  const hipHeightM = (p.thigh + p.shank + p.ankle) * height * legScale;
  // The trunk keeps its share of height; a long leg lifts the shoulder.
  const trunkM = (p.shoulder - p.hip) * height;
  const shoulderHeightM = hipHeightM + trunkM;
  const chinHeightM = shoulderHeightM + (p.chin - p.shoulder) * height;
  const reach = upperArmM + forearmM + handM / 2;

  const f = MASS_FRACTIONS[input.sex];
  const mass = input.bodyweightKg;
  const handsKg = 2 * f.hand * mass;
  const forearmsKg = 2 * f.forearm * mass;
  const upperArmsKg = 2 * f.upperArm * mass;
  return {
    sex: input.sex,
    massKg: mass,
    heightM: height,
    upperArmM,
    forearmM,
    handM,
    thighM,
    shankM,
    trunkM,
    shoulderHeightM,
    hipHeightM,
    chinHeightM,
    gripHeightM: shoulderHeightM - reach,
    overheadM: shoulderHeightM + reach,
    handsKg,
    forearmsKg,
    upperArmsKg,
    thighsKg: 2 * f.thigh * mass,
    shanksKg: 2 * f.shank * mass,
    feetKg: 2 * f.foot * mass,
    upperBodyKg: (f.head + f.trunk) * mass + handsKg + forearmsKg + upperArmsKg,
  };
};
