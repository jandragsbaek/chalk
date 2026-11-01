import type { Performance, Sex } from "../levels.ts";
import type { BlockFormat, BlockParams, BlockResult, Quantity, SpanId } from "../sessionImport.ts";

/**
 * A block's score as the athlete enters it (`BlockResult`): the shapes each format takes, the
 * text the board would show, and what a capped for-time adds up to.
 */

export type BlockResultKind = BlockResult["_tag"];

export const BLOCK_RESULT_LABELS: Record<BlockResultKind, string> = {
  time: "Time",
  capped: "Capped",
  rounds_reps: "Rounds + reps",
  reps: "Reps",
};

/** The result shapes a format takes, the usual one first; none for strength (lifts) and rest. */
export const resultKindsFor = (format: BlockFormat | undefined): ReadonlyArray<BlockResultKind> => {
  switch (format) {
    case "for_time":
      return ["time", "capped"];
    case "amrap":
      return ["rounds_reps"];
    case "emom":
    case "every":
    case "intervals":
    case "other":
      return ["reps"];
    default:
      return [];
  }
};

/** 754 → "12:34", 3725 → "1:02:05". */
export const formatClock = (seconds: number) => {
  const whole = Math.max(0, Math.round(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = String(whole % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
};

/**
 * A typed time in seconds: "12:34", "1:02:05", "12.34" (a phone's keypad), or whole minutes
 * "12". `undefined` for anything else, seconds past 59 included.
 */
export const parseClock = (text: string): number | undefined => {
  const trimmed = text.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 60;
  const match = /^(\d+)[:.](\d{1,2})(?:[:.](\d{1,2}))?$/.exec(trimmed);
  if (!match) return undefined;
  const parts = [match[1], match[2], match[3]].filter((part) => part !== undefined).map(Number);
  if (parts.slice(1).some((part) => part > 59)) return undefined;
  return parts.length === 3
    ? parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
    : parts[0]! * 60 + parts[1]!;
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** The score as the board writes it: "12:34", "Capped · 113 reps", "5+12", "150 reps". */
export const formatBlockResult = (result: BlockResult): string => {
  switch (result._tag) {
    case "time":
      return formatClock(result.seconds);
    case "capped":
      return `Capped · ${plural(result.total, "rep", "reps")}`;
    case "rounds_reps":
      return `${result.rounds}+${result.reps}`;
    case "reps":
      return plural(result.reps, "rep", "reps");
  }
};

/** What a station needs to be counted: its lines, how it was done, the options it offers. */
export interface ScoredItem {
  /** Absent on a benchmark's own items, which a capped result cannot name. */
  readonly spanId?: SpanId | undefined;
  readonly sets: ReadonlyArray<{ readonly quantities: ReadonlyArray<Quantity> }>;
  readonly performance: Performance | undefined;
  readonly alternatives: ReadonlyArray<ScoredItem>;
}

/** The option a station was done by: an alternative only when it alone says how it went. */
const doneOption = (item: ScoredItem): ScoredItem =>
  item.performance === undefined
    ? (item.alternatives.find((alternative) => alternative.performance !== undefined) ?? item)
    : item;

/** True when `spanId` is the station or one of its options. */
export const isStation = (item: ScoredItem, spanId: SpanId): boolean =>
  item.spanId === spanId || item.alternatives.some((alternative) => isStation(alternative, spanId));

/** Rounds a block runs through: its rounds, else one per number of its scheme, else one. */
export const roundsOfBlock = (params: BlockParams): number =>
  Math.max(1, Math.round(params.rounds?.min ?? params.scheme?.length ?? 1));

const countOf = (quantity: Quantity, sex: Sex | undefined) => {
  const amount = sex === "f" && quantity.female !== undefined ? quantity.female : quantity.amount;
  return Math.round((amount.min + amount.max) / 2);
};

/**
 * What a station asks for in `round` (0-based), counted the way the board scores it (reps,
 * calories or metres as written): the count reached each round when the athlete gave one, else
 * its written count on the athlete's side of an M/F split, else the block's scheme for that
 * round ("21-15-9"). `undefined` when nothing says.
 */
export const stationCount = (
  item: ScoredItem,
  params: BlockParams,
  round: number,
  sex: Sex | undefined,
): number | undefined => {
  const done = doneOption(item);
  const perRound = done.performance?.perRound;
  if (perRound !== undefined) return Math.round((perRound.min + perRound.max) / 2);
  let total: number | undefined;
  for (const set of done.sets) {
    const count =
      set.quantities.find((quantity) => quantity.measure === "reps") ??
      set.quantities.find(
        (quantity) => quantity.measure === "calories" || quantity.measure === "distance_m",
      );
    if (count === undefined) continue;
    if (count.scheme !== undefined && count.scheme.length > 0) {
      total = (total ?? 0) + (count.scheme[round % count.scheme.length] ?? 0);
      continue;
    }
    const sets = set.quantities.find((quantity) => quantity.measure === "sets");
    total = (total ?? 0) + countOf(count, sex) * (sets === undefined ? 1 : countOf(sets, sex));
  }
  if (total !== undefined) return total;
  return params.scheme?.[round];
};

export interface CappedStop {
  readonly round: number;
  readonly at: SpanId;
  readonly reps: number;
}

/**
 * Reps done by the cap: every station of the rounds before `round`, the stations before `at` in
 * it, then `reps` of `at`. `undefined` when `at` is not a station of the block or a station
 * counted in full has no count.
 */
export const cappedTotal = (
  block: { readonly params: BlockParams; readonly items: ReadonlyArray<ScoredItem> },
  stop: CappedStop,
  sex: Sex | undefined,
): number | undefined => {
  const stopAt = block.items.findIndex((item) => isStation(item, stop.at));
  if (stopAt === -1) return undefined;
  let total = 0;
  for (let round = 0; round < stop.round; round++) {
    const last = round === stop.round - 1;
    for (const [index, item] of block.items.entries()) {
      if (last && index === stopAt) return total + stop.reps;
      const count = stationCount(item, block.params, round, sex);
      if (count === undefined) return undefined;
      total += count;
    }
  }
  return undefined;
};

/**
 * How much of each station the cap left done, as a share of what the block asks of it in full
 * (1 done, 0 not reached), in item order; `undefined` like `cappedTotal`.
 */
export const cappedShares = (
  block: { readonly params: BlockParams; readonly items: ReadonlyArray<ScoredItem> },
  stop: CappedStop,
  sex: Sex | undefined,
): ReadonlyArray<number> | undefined => {
  const stopAt = block.items.findIndex((item) => isStation(item, stop.at));
  if (stopAt === -1) return undefined;
  const rounds = roundsOfBlock(block.params);
  const shares: Array<number> = [];
  for (const [index, item] of block.items.entries()) {
    let asked = 0;
    let done = 0;
    for (let round = 0; round < rounds; round++) {
      const count = stationCount(item, block.params, round, sex);
      if (count === undefined) return undefined;
      asked += count;
      const before = round < stop.round - 1 || (round === stop.round - 1 && index < stopAt);
      if (before) done += count;
      else if (round === stop.round - 1 && index === stopAt) done += Math.min(stop.reps, count);
    }
    shares.push(asked === 0 ? 0 : done / asked);
  }
  return shares;
};
