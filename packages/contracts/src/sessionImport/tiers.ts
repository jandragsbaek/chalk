import { ATHLETE_SEX, LEVELS, type Level, type Sex } from "../levels.ts";
import type { Amount, Quantity, QuantityTier } from "../sessionImport.ts";

/**
 * Targets by level. Some boards write one target per level instead of a range: "18-15/15-12 cal
 * row" asks 18 (male) / 15 (female) of an elite athlete and 15/12 of everyone else. The tiers
 * are hardest first; `amount` and `female` of the quantity span them.
 */

const exact = (value: number): Amount => ({ min: value, max: value });

/** Levels for `count` tiers, hardest first: Elite, RX, Intermediate, ... */
export const tierLevels = (count: number): ReadonlyArray<Level> =>
  LEVELS.toReversed().slice(0, count);

/** The male and female ranges the tiers span, as `amount` and `female`. */
export const tierEnvelope = (
  tiers: ReadonlyArray<QuantityTier>,
): Pick<Quantity, "amount" | "female"> => {
  const span = (amounts: ReadonlyArray<Amount>): Amount => ({
    min: Math.min(...amounts.map((amount) => amount.min)),
    max: Math.max(...amounts.map((amount) => amount.max)),
  });
  const females = tiers.flatMap((tier) => (tier.female === undefined ? [] : [tier.female]));
  return {
    amount: span(tiers.map((tier) => tier.amount)),
    ...(females.length === tiers.length && females.length > 0 ? { female: span(females) } : {}),
  };
};

/** The quantity with these tiers and the range they span; no tiers reads it as a range again. */
export const withTiers = <Q extends Quantity>(
  quantity: Q,
  tiers: ReadonlyArray<QuantityTier> | undefined,
): Q => {
  const { tiers: _old, ...rest } = quantity;
  if (tiers === undefined || tiers.length === 0) return rest as Q;
  const { female: _female, ...unsplit } = rest;
  return { ...unsplit, ...tierEnvelope(tiers), tiers } as Q;
};

/**
 * A range read as two levels' targets: its top for Elite, its bottom for RX. "15-18/12-15 cal"
 * becomes 18/15 at Elite and 15/12 at RX. A single number has nothing to split.
 */
export const tiersFromRange = (quantity: Quantity): ReadonlyArray<QuantityTier> | undefined => {
  if (quantity.scheme !== undefined || quantity.amount.min === quantity.amount.max)
    return undefined;
  const [top, base] = tierLevels(2) as [Level, Level];
  const { amount, female } = quantity;
  return [
    {
      level: top,
      amount: exact(amount.max),
      ...(female === undefined ? {} : { female: exact(female.max) }),
    },
    {
      level: base,
      amount: exact(amount.min),
      ...(female === undefined ? {} : { female: exact(female.min) }),
    },
  ];
};

/**
 * "18-15/15-12": male-female pairs per level, hardest first, when both pairs fall (a woman's
 * target under a man's) and the second level asks no more than the first. Anything else ("8-10/
 * 6-8 reps") is a male and a female range.
 */
export const parseTierPairs = (
  numbers: ReadonlyArray<ReadonlyArray<number>>,
): ReadonlyArray<QuantityTier> | undefined => {
  if (numbers.length < 2) return undefined;
  if (!numbers.every((pair) => pair.length === 2 && pair[0]! > pair[1]!)) return undefined;
  for (let index = 1; index < numbers.length; index++) {
    const [harder, easier] = [numbers[index - 1]!, numbers[index]!];
    if (easier[0]! > harder[0]! || easier[1]! > harder[1]!) return undefined;
  }
  const levels = tierLevels(numbers.length);
  if (levels.length < numbers.length) return undefined;
  return numbers.map((pair, index) => ({
    level: levels[index]!,
    amount: exact(pair[0]!),
    female: exact(pair[1]!),
  }));
};

const targetOf = (tier: QuantityTier, sex: Sex): number =>
  (sex === "f" && tier.female !== undefined ? tier.female : tier.amount).min;

export interface TierReach {
  /** The hardest level every round reached; absent when the worst round met none. */
  readonly met?: Level;
  /** The next level up and what it asks; absent when the hardest was met. */
  readonly next?: { readonly level: Level; readonly target: number };
}

/** Where a count reached each round ("7-8") sits on the tiers, on the athlete's side of M/F. */
export const reachOfTiers = (
  tiers: ReadonlyArray<QuantityTier>,
  perRound: Amount,
  sex: Sex = ATHLETE_SEX,
): TierReach => {
  const metAt = tiers.findIndex((tier) => perRound.min >= targetOf(tier, sex));
  const met = metAt === -1 ? undefined : tiers[metAt];
  const next = metAt === -1 ? tiers.at(-1) : metAt === 0 ? undefined : tiers[metAt - 1];
  return {
    ...(met === undefined ? {} : { met: met.level }),
    ...(next === undefined ? {} : { next: { level: next.level, target: targetOf(next, sex) } }),
  };
};
