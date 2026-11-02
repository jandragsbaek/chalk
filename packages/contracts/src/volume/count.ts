import type { MovementId } from "../baseSchemas.ts";
import type { Benchmark } from "../benchmarks/model.ts";
import { parseBenchmarkScore } from "../benchmarks/index.ts";
import type { Performance, Sex } from "../levels.ts";
import type {
  BlockFormat,
  BlockParams,
  BlockResult,
  PerformedSet,
  Quantity,
} from "../sessionImport.ts";
import { cappedShares } from "../sessionImport/blockResult.ts";
import type { DerivedSession } from "../sessionImport/derive.ts";

/**
 * How much of each movement a block got done: reps, metres, calories or seconds per movement,
 * with the load it was done at. Work and power (`estimateBlockWork`) and the volume grid both
 * count through here, so a session has one count wherever it is read. What cannot be counted is
 * listed with the reason, never silently dropped.
 */

/** What one item of a block needs; a derived block's items fit, and so do a benchmark's. */
export interface WorkItem {
  /** A derived item's span; a capped result names the station it stopped at by it. */
  readonly spanId?: string;
  readonly movementId: MovementId | undefined;
  readonly text: string;
  readonly sets: ReadonlyArray<{ readonly quantities: ReadonlyArray<Quantity> }>;
  readonly performed: ReadonlyArray<PerformedSet>;
  readonly performance: Performance | undefined;
  readonly alternatives: ReadonlyArray<WorkItem>;
}

export interface WorkBlock {
  readonly format: BlockFormat | undefined;
  readonly params: BlockParams;
  readonly items: ReadonlyArray<WorkItem>;
  readonly scores: ReadonlyArray<string>;
  /** The athlete's entered result; the scores carry its text too. */
  readonly result?: BlockResult;
  readonly rotation?: number;
}

/** What one unit of a count is. Seconds are counted only when asked (`CountOptions.seconds`). */
export type CountUnit = "reps" | "m" | "cal" | "s";

/** Some of a movement done in a block. */
export interface Counted {
  /** The movement done: a variation the reps were split into, or the "or" that was picked. */
  readonly movementId: MovementId;
  /** The movement the board wrote on the line, before any scaling or "or". */
  readonly writtenAs: MovementId | undefined;
  readonly amount: number;
  readonly unit: CountUnit;
  /** External load, all implements together; `undefined` for bodyweight. */
  readonly loadKg: number | undefined;
  readonly text: string;
  /** Counted set by set from what was lifted (a result, or a scored block's rounds at a load). */
  readonly lifted: boolean;
}

export interface LeftOut {
  readonly movementId: MovementId | undefined;
  readonly text: string;
  readonly reason: string;
}

export interface BlockCount {
  readonly counted: ReadonlyArray<Counted>;
  readonly leftOut: ReadonlyArray<LeftOut>;
  /** Why the whole block has no count ("AMRAP without a score."). */
  readonly skipped: string | undefined;
}

export interface CountOptions {
  /** The athlete's side of an M/F split. */
  readonly sex: Sex;
  /** Whether a movement is done with two implements by default (devil press). */
  readonly pairOf?: (movementId: MovementId) => boolean;
  /** Count lines written in seconds ("30 s handstand hold"); work and power do not. */
  readonly seconds?: boolean;
}

const mid = (amount: { readonly min: number; readonly max: number }) =>
  (amount.min + amount.max) / 2;

const amountFor = (quantity: Quantity, sex: Sex) =>
  mid(sex === "f" && quantity.female !== undefined ? quantity.female : quantity.amount);

const COUNT_UNITS: Partial<Record<Quantity["measure"], CountUnit>> = {
  reps: "reps",
  distance_m: "m",
  calories: "cal",
};

interface RoundCount {
  readonly amount: number;
  readonly unit: CountUnit;
}

/** The count on one written line: reps, metres or calories first, seconds only without them. */
const lineCount = (quantities: ReadonlyArray<Quantity>, seconds: boolean) =>
  quantities.find((quantity) => COUNT_UNITS[quantity.measure] !== undefined) ??
  (seconds ? quantities.find((quantity) => quantity.measure === "seconds") : undefined);

const unitOf = (quantity: Quantity): CountUnit => COUNT_UNITS[quantity.measure] ?? "s";

/** One round of the item: its reps (or metres, calories, seconds) over every written line. */
const roundCount = (
  item: WorkItem,
  block: WorkBlock,
  options: CountOptions,
): RoundCount | undefined => {
  const { sex } = options;
  let unit: CountUnit | undefined;
  let amount = 0;
  /** Metres per rep, when reps are written with a length. */
  let length: number | undefined;
  for (const set of item.sets) {
    // "10 shuttle runs 10 m": reps of a written length, so metres.
    const reps = set.quantities.find((quantity) => quantity.measure === "reps");
    const distance = set.quantities.find((quantity) => quantity.measure === "distance_m");
    const count =
      distance !== undefined && reps !== undefined
        ? distance
        : lineCount(set.quantities, options.seconds === true);
    if (count === undefined) continue;
    const countUnit = unitOf(count);
    if (unit !== undefined && unit !== countUnit) continue;
    unit = countUnit;
    const sets = set.quantities.find((quantity) => quantity.measure === "sets");
    const lengths = count === distance && reps !== undefined ? amountFor(reps, sex) : 1;
    if (count === distance && reps !== undefined) length = amountFor(distance, sex);
    amount += amountFor(count, sex) * lengths * (sets === undefined ? 1 : mid(sets.amount));
  }
  // The count each round is in reps; reps of a written length are metres.
  const perRound = item.performance?.perRound;
  if (unit !== undefined && perRound !== undefined)
    return { amount: mid(perRound) * (length ?? 1), unit };
  if (unit !== undefined) return { amount, unit };
  // "21-15-9 thrusters and pull-ups": the block's scheme is every item's reps.
  const scheme = block.params.scheme;
  if (scheme !== undefined && scheme.length > 0)
    return { amount: scheme.reduce((total, reps) => total + reps, 0), unit: "reps" };
  return undefined;
};

/** The item's load, all implements together: the performance's, else the first written. */
export const loadOf = (item: WorkItem, sex: Sex, pair = false): number | undefined => {
  const performance = item.performance;
  const implementsCount = performance?.implements ?? (pair || /\bdual\b/i.test(item.text) ? 2 : 1);
  if (performance?.loadKg !== undefined) return performance.loadKg * implementsCount;
  for (const set of item.sets)
    for (const quantity of set.quantities)
      if (quantity.measure === "load_kg") return amountFor(quantity, sex) * implementsCount;
  return undefined;
};

/** How many times the block's items are done, before any AMRAP partial round. */
const roundsOf = (block: WorkBlock): number | undefined => {
  const { params } = block;
  const rounds = params.rounds === undefined ? undefined : params.rounds.min;
  switch (block.format) {
    case "emom":
    case "every": {
      const intervals =
        rounds ??
        (params.durationSeconds !== undefined && params.intervalSeconds
          ? Math.floor(params.durationSeconds / params.intervalSeconds)
          : undefined);
      if (intervals === undefined) return undefined;
      return block.rotation === undefined ? intervals : intervals / block.rotation;
    }
    default:
      return rounds ?? 1;
  }
};

/** The item done in its block, or an alternative when only that one says how it went. */
const doneItem = (item: WorkItem): WorkItem =>
  item.performance === undefined && item.performed.length === 0
    ? (item.alternatives.find(
        (alternative) => alternative.performance !== undefined || alternative.performed.length > 0,
      ) ?? item)
    : item;

interface Into {
  readonly counted: Array<Counted>;
  readonly leftOut: Array<LeftOut>;
}

/** `amount` units of the item, split over its variations when the athlete said so. */
const countItem = (
  item: WorkItem,
  writtenAs: MovementId | undefined,
  amount: number,
  unit: CountUnit,
  options: CountOptions,
  into: Into,
) => {
  const variants = item.performance?.variants;
  const total = variants?.reduce((sum, variant) => sum + variant.reps, 0) ?? 0;
  const shares =
    variants !== undefined && total > 0
      ? variants.map((variant) => ({ movementId: variant.movementId, share: variant.reps / total }))
      : item.movementId === undefined
        ? []
        : [{ movementId: item.movementId, share: 1 }];
  if (shares.length === 0) {
    into.leftOut.push({ movementId: undefined, text: item.text, reason: "No movement picked." });
    return;
  }
  for (const { movementId, share } of shares) {
    if (share === 0) continue;
    into.counted.push({
      movementId,
      writtenAs,
      amount: amount * share,
      unit,
      loadKg: loadOf(item, options.sex, options.pairOf?.(movementId) ?? false),
      text: item.text,
      lifted: false,
    });
  }
};

/**
 * Lifted sets: each at its own load. A set's load is one implement's unless the athlete said how
 * many (`implements`, already in the set), so a pair (devil press, "dual") lifts both, as
 * `loadOf` counts it.
 */
const countSets = (
  item: WorkItem,
  writtenAs: MovementId | undefined,
  options: CountOptions,
  into: Into,
) => {
  const movementId = item.movementId;
  if (movementId === undefined) {
    into.leftOut.push({ movementId: undefined, text: item.text, reason: "No movement picked." });
    return;
  }
  const both =
    item.performance?.implements === undefined &&
    ((options.pairOf?.(movementId) ?? false) || /\bdual\b/i.test(item.text));
  for (const set of item.performed)
    into.counted.push({
      movementId,
      writtenAs,
      amount: set.reps,
      unit: "reps",
      loadKg: both ? set.loadKg * 2 : set.loadKg,
      text: item.text,
      lifted: true,
    });
};

const skippedBlock = (reason: string, leftOut: ReadonlyArray<LeftOut> = []): BlockCount => ({
  counted: [],
  leftOut,
  skipped: reason,
});

export const countBlock = (block: WorkBlock, options: CountOptions): BlockCount => {
  const into: Into = { counted: [], leftOut: [] };
  const items = block.items.map((item) => ({ item: doneItem(item), writtenAs: item.movementId }));

  if (block.format === "amrap") {
    const score = block.scores
      .map((text) => parseBenchmarkScore("rounds_reps", text))
      .find((value) => value !== undefined);
    if (score === undefined) return skippedBlock("AMRAP without a score.");
    const rounds = Math.floor(score / 1000);
    let partial = score % 1000;
    for (const { item, writtenAs } of items) {
      const count = roundCount(item, block, options);
      if (count === undefined) {
        into.leftOut.push({ movementId: item.movementId, text: item.text, reason: "No reps." });
        continue;
      }
      const extra = Math.min(partial, count.amount);
      partial -= extra;
      countItem(item, writtenAs, rounds * count.amount + extra, count.unit, options, into);
    }
  } else {
    const rounds = roundsOf(block);
    const result = block.result;
    const shares = result?._tag === "capped" ? cappedShares(block, result, options.sex) : undefined;
    if (result?._tag === "capped" && shares === undefined)
      return skippedBlock("Capped, and where it stopped cannot be counted.");
    for (const [index, { item, writtenAs }] of items.entries()) {
      if (item.performed.length > 0) {
        countSets(item, writtenAs, options, into);
        continue;
      }
      const count = roundCount(item, block, options);
      if (count === undefined || rounds === undefined) {
        into.leftOut.push({
          movementId: item.movementId,
          text: item.text,
          reason: block.format === "strength" ? "No result entered." : "No reps.",
        });
        continue;
      }
      // An item with its own reps in a "21-15-9" block is done once per round of the scheme.
      const schemeRounds =
        block.params.rounds === undefined &&
        block.params.scheme !== undefined &&
        item.sets.some((set) => set.quantities.some((q) => q.measure === "reps"))
          ? block.params.scheme.length
          : 1;
      // Capped: only the share of the station done before the cap.
      const share = shares?.[index] ?? 1;
      if (share === 0) continue;
      countItem(
        item,
        writtenAs,
        rounds * schemeRounds * count.amount * share,
        count.unit,
        options,
        into,
      );
    }
  }

  // Nothing counted at all is no measurement; a zero would read as one.
  if (into.counted.length === 0) return skippedBlock("Nothing it could count.", into.leftOut);
  return { counted: into.counted, leftOut: into.leftOut, skipped: undefined };
};

/** A session's count: every block that is not rest, then the lift sets from the notes. */
export interface SessionCount {
  readonly counted: ReadonlyArray<Counted>;
  readonly leftOut: ReadonlyArray<LeftOut>;
}

export const countSession = (session: DerivedSession, options: CountOptions): SessionCount => {
  const counted: Array<Counted> = [];
  const leftOut: Array<LeftOut> = [];
  for (const part of session.parts)
    for (const block of part.blocks) {
      if (block.format === "rest" || block.items.length === 0) continue;
      const count = countBlock(block, options);
      counted.push(...count.counted);
      leftOut.push(...count.leftOut);
      if (count.skipped !== undefined && count.leftOut.length === 0)
        leftOut.push({ movementId: undefined, text: block.title, reason: count.skipped });
    }
  for (const set of session.liftSets)
    counted.push({
      movementId: set.movementId,
      writtenAs: set.movementId,
      amount: set.count * set.reps,
      unit: "reps",
      loadKg: set.loadKg,
      text: "Notes",
      lifted: true,
    });
  return { counted, leftOut };
};

/** "two dumbbells": the posted load is per implement, and two are lifted. */
const TWO_IMPLEMENTS = /\btwo (?:dumbbells|kettlebells)\b/i;

export const benchmarkItem = (item: Benchmark["blocks"][number]["items"][number]): WorkItem => ({
  movementId: item.movementId,
  text: item.movementId,
  sets: item.quantities.length === 0 ? [] : [{ quantities: item.quantities }],
  performed: [],
  performance:
    item.note !== undefined && TWO_IMPLEMENTS.test(item.note) ? { implements: 2 } : undefined,
  alternatives: (item.alternatives ?? []).map(benchmarkItem),
});

/** A benchmark block as a work block, with the scores to count it by. */
export const benchmarkBlock = (
  block: Benchmark["blocks"][number],
  scores: ReadonlyArray<string>,
): WorkBlock => ({
  format: block.format,
  params: block.params,
  items: block.items.map(benchmarkItem),
  scores,
});

/**
 * One attempt at a benchmark done as prescribed: a time-scored one is every block done once
 * (an AMRAP inside it counted as a for time), a single AMRAP is its score's rounds. Other
 * scorings (reps over several stations) say nothing per movement and count nothing.
 */
export const countBenchmark = (
  benchmark: Benchmark,
  score: string,
  options: CountOptions,
): SessionCount => {
  const blocks = benchmark.blocks.filter((block) => block.format !== "rest");
  const counted: Array<Counted> = [];
  const leftOut: Array<LeftOut> = [];
  const add = (count: BlockCount) => {
    counted.push(...count.counted);
    leftOut.push(...count.leftOut);
  };
  const seconds = benchmark.scoring === "time" ? parseBenchmarkScore("time", score) : undefined;
  if (benchmark.scoring === "time" && (seconds === undefined || seconds <= 0))
    // A DNF or a capped attempt did not do the whole prescription, and the score says no more.
    leftOut.push({
      movementId: undefined,
      text: benchmark.name,
      reason: "Not finished in a time.",
    });
  else if (benchmark.scoring === "time")
    for (const block of blocks)
      add(
        countBlock(
          benchmarkBlock(block.format === "amrap" ? { ...block, format: "for_time" } : block, []),
          options,
        ),
      );
  else if (
    benchmark.scoring === "rounds_reps" &&
    blocks.length === 1 &&
    blocks[0]!.format === "amrap"
  )
    add(countBlock(benchmarkBlock(blocks[0]!, [score]), options));
  else
    leftOut.push({
      movementId: undefined,
      text: benchmark.name,
      reason: "Score not per movement.",
    });
  return { counted, leftOut };
};
