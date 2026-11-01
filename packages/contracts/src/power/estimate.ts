import type { MovementId } from "../baseSchemas.ts";
import type { Benchmark } from "../benchmarks/model.ts";
import { parseBenchmarkScore } from "../benchmarks/index.ts";
import type { Performance } from "../levels.ts";
import type {
  BlockFormat,
  BlockParams,
  CatalogMovement,
  PerformedSet,
  Quantity,
} from "../sessionImport.ts";
import type { DerivedSession } from "../sessionImport/derive.ts";
import type { Body } from "./body.ts";
import { WORK_MODELS, type WorkModel } from "./movements.ts";

/**
 * Work and power of a session, block by block: each movement's reps (or metres, calories) times
 * its work per unit, summed; power is that work over the block's time. Time comes from a for-time
 * score, an AMRAP's or EMOM's length, or rounds × interval. What cannot be counted is listed with
 * the reason, never silently dropped.
 */

/** What one item of a block needs; a derived block's items fit, and so do a benchmark's. */
export interface WorkItem {
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
  readonly rotation?: number;
}

export type WorkUnit = "reps" | "m" | "cal";

export interface ItemWork {
  readonly movementId: MovementId;
  readonly amount: number;
  readonly unit: WorkUnit;
  /** External load, all implements together; `undefined` for bodyweight. */
  readonly loadKg: number | undefined;
  readonly joules: number;
}

export interface LeftOut {
  readonly movementId: MovementId | undefined;
  readonly text: string;
  readonly reason: string;
}

export interface BlockWork {
  readonly joules: number;
  /** The block's time; `undefined` when nothing says how long it took. */
  readonly seconds: number | undefined;
  readonly watts: number | undefined;
  readonly items: ReadonlyArray<ItemWork>;
  readonly leftOut: ReadonlyArray<LeftOut>;
  /** Why the whole block has no number ("AMRAP without a score"). */
  readonly skipped: string | undefined;
}

export interface SessionWork {
  readonly parts: ReadonlyArray<{
    readonly title: string;
    readonly blocks: ReadonlyArray<{ readonly title: string; readonly work: BlockWork }>;
  }>;
  /** Lift sets from the notes: work, no time. */
  readonly notesJoules: number;
  readonly joules: number;
  /** Work in blocks with a time, and that time: the session's average power. */
  readonly timedJoules: number;
  readonly timedSeconds: number;
  readonly watts: number | undefined;
}

export type WorkModelOf = (movementId: MovementId) => WorkModel | undefined;

/** The movement's model, or its core movement's: a hang squat clean without one works as a clean. */
export const workModelsFor =
  (catalog: ReadonlyArray<CatalogMovement>): WorkModelOf =>
  (movementId) => {
    const own = WORK_MODELS[movementId];
    if (own) return own;
    const core = catalog.find((movement) => movement.id === movementId)?.variationOf;
    return core === undefined ? undefined : WORK_MODELS[core];
  };

const mid = (amount: { readonly min: number; readonly max: number }) =>
  (amount.min + amount.max) / 2;

const amountFor = (quantity: Quantity, body: Body) =>
  mid(body.sex === "f" && quantity.female !== undefined ? quantity.female : quantity.amount);

const COUNT_UNITS: Partial<Record<Quantity["measure"], WorkUnit>> = {
  reps: "reps",
  distance_m: "m",
  calories: "cal",
};

interface RoundCount {
  readonly amount: number;
  readonly unit: WorkUnit;
}

/** One round of the item: its reps (or metres, calories) over every written line. */
const roundCount = (item: WorkItem, block: WorkBlock, body: Body): RoundCount | undefined => {
  let unit: WorkUnit | undefined;
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
        : set.quantities.find((quantity) => COUNT_UNITS[quantity.measure] !== undefined);
    if (count === undefined) continue;
    const countUnit = COUNT_UNITS[count.measure]!;
    if (unit !== undefined && unit !== countUnit) continue;
    unit = countUnit;
    const sets = set.quantities.find((quantity) => quantity.measure === "sets");
    const lengths = count === distance && reps !== undefined ? amountFor(reps, body) : 1;
    if (count === distance && reps !== undefined) length = amountFor(distance, body);
    amount += amountFor(count, body) * lengths * (sets === undefined ? 1 : mid(sets.amount));
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

const loadOf = (item: WorkItem, body: Body): number | undefined => {
  const performance = item.performance;
  const implementsCount = performance?.implements ?? (/\bdual\b/i.test(item.text) ? 2 : 1);
  if (performance?.loadKg !== undefined) return performance.loadKg * implementsCount;
  for (const set of item.sets)
    for (const quantity of set.quantities)
      if (quantity.measure === "load_kg") return amountFor(quantity, body) * implementsCount;
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

const secondsOf = (block: WorkBlock): number | undefined => {
  const { params } = block;
  const rounds = params.rounds === undefined ? undefined : params.rounds.min;
  switch (block.format) {
    case "for_time": {
      for (const score of block.scores) {
        const seconds = parseBenchmarkScore("time", score);
        if (seconds !== undefined && seconds > 0) return seconds;
      }
      return undefined;
    }
    case "amrap":
      return params.durationSeconds;
    case "emom":
    case "every":
      return (
        params.durationSeconds ??
        (rounds !== undefined && params.intervalSeconds !== undefined
          ? rounds * params.intervalSeconds
          : undefined)
      );
    case "intervals":
      return rounds !== undefined && params.workSeconds !== undefined
        ? rounds * (params.workSeconds + (params.restSeconds ?? 0))
        : params.durationSeconds;
    default:
      return rounds !== undefined && params.intervalSeconds !== undefined
        ? rounds * params.intervalSeconds
        : undefined;
  }
};

const UNIT_NAMES: Record<WorkUnit, string> = { reps: "reps", m: "metres", cal: "calories" };

const perUnitOf = (model: WorkModel, unit: WorkUnit) =>
  unit === "reps" ? model.perRep : unit === "m" ? model.perMeter : model.perCalorie;

/** The item done in its block, or an alternative when only that one says how it went. */
const doneItem = (item: WorkItem): WorkItem =>
  item.performance === undefined && item.performed.length === 0
    ? (item.alternatives.find(
        (alternative) => alternative.performance !== undefined || alternative.performed.length > 0,
      ) ?? item)
    : item;

interface Counted {
  readonly items: Array<ItemWork>;
  readonly leftOut: Array<LeftOut>;
}

/** `amount` units of the item, split over its variations when the athlete said so. */
const countItem = (
  item: WorkItem,
  amount: number,
  unit: WorkUnit,
  body: Body,
  modelOf: WorkModelOf,
  into: Counted,
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
  const loadKg = loadOf(item, body);
  for (const { movementId, share } of shares) {
    const model = modelOf(movementId);
    const leave = (reason: string) => into.leftOut.push({ movementId, text: item.text, reason });
    if (model === undefined) {
      leave("No work model for this movement yet.");
      continue;
    }
    if (model.none !== undefined) {
      into.items.push({ movementId, amount: amount * share, unit, loadKg, joules: 0 });
      continue;
    }
    const perUnit = perUnitOf(model, unit);
    if (perUnit === undefined) {
      leave(`Counted in ${UNIT_NAMES[unit]}, which this movement has no model for.`);
      continue;
    }
    if (model.loaded && loadKg === undefined) {
      leave("No load to count (a percentage of 1RM is not read yet).");
      continue;
    }
    into.items.push({
      movementId,
      amount: amount * share,
      unit,
      loadKg,
      joules: amount * share * perUnit(body, loadKg ?? 0),
    });
  }
};

/** Lifted sets: each at its own load. */
const countSets = (item: WorkItem, body: Body, modelOf: WorkModelOf, into: Counted) => {
  const movementId = item.movementId;
  const model = movementId === undefined ? undefined : modelOf(movementId);
  if (movementId === undefined || model?.perRep === undefined) {
    into.leftOut.push({
      movementId,
      text: item.text,
      reason: model?.none ?? "No work model for this movement yet.",
    });
    return;
  }
  for (const set of item.performed)
    into.items.push({
      movementId,
      amount: set.reps,
      unit: "reps",
      loadKg: set.loadKg,
      joules: set.reps * model.perRep(body, set.loadKg),
    });
};

const totalJoules = (items: ReadonlyArray<ItemWork>) =>
  items.reduce((total, item) => total + item.joules, 0);

const skippedBlock = (reason: string, seconds: number | undefined): BlockWork => ({
  joules: 0,
  seconds,
  watts: undefined,
  items: [],
  leftOut: [],
  skipped: reason,
});

export const estimateBlockWork = (
  block: WorkBlock,
  body: Body,
  modelOf: WorkModelOf,
): BlockWork => {
  const seconds = secondsOf(block);
  const counted: Counted = { items: [], leftOut: [] };
  const items = block.items.map(doneItem);

  if (block.format === "amrap") {
    const score = block.scores
      .map((text) => parseBenchmarkScore("rounds_reps", text))
      .find((value) => value !== undefined);
    if (score === undefined) return skippedBlock("AMRAP without a score.", seconds);
    const rounds = Math.floor(score / 1000);
    let partial = score % 1000;
    for (const item of items) {
      const count = roundCount(item, block, body);
      if (count === undefined) {
        counted.leftOut.push({ movementId: item.movementId, text: item.text, reason: "No reps." });
        continue;
      }
      const extra = Math.min(partial, count.amount);
      partial -= extra;
      countItem(item, rounds * count.amount + extra, count.unit, body, modelOf, counted);
    }
  } else {
    const rounds = roundsOf(block);
    for (const item of items) {
      if (item.performed.length > 0) {
        countSets(item, body, modelOf, counted);
        continue;
      }
      const count = roundCount(item, block, body);
      if (count === undefined || rounds === undefined) {
        counted.leftOut.push({
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
      countItem(item, rounds * schemeRounds * count.amount, count.unit, body, modelOf, counted);
    }
  }

  // Nothing counted at all is no measurement; a zero would read as one.
  if (counted.items.length === 0)
    return { ...skippedBlock("Nothing it could count.", seconds), leftOut: counted.leftOut };
  const joules = totalJoules(counted.items);
  return {
    joules,
    seconds,
    watts: seconds !== undefined && seconds > 0 && joules > 0 ? joules / seconds : undefined,
    items: counted.items,
    leftOut: counted.leftOut,
    skipped: undefined,
  };
};

export const estimateSessionWork = (
  session: DerivedSession,
  body: Body,
  modelOf: WorkModelOf,
): SessionWork => {
  const parts = session.parts.map((part) => ({
    title: part.title,
    blocks: part.blocks
      .filter((block) => block.format !== "rest" && block.items.length > 0)
      .map((block) => ({ title: block.title, work: estimateBlockWork(block, body, modelOf) })),
  }));
  let notesJoules = 0;
  for (const set of session.liftSets) {
    const perRep = modelOf(set.movementId)?.perRep;
    if (perRep) notesJoules += set.count * set.reps * perRep(body, set.loadKg);
  }
  const blocks = parts.flatMap((part) => part.blocks.map((block) => block.work));
  const timed = blocks.filter((work) => work.watts !== undefined);
  const timedJoules = timed.reduce((total, work) => total + work.joules, 0);
  const timedSeconds = timed.reduce((total, work) => total + (work.seconds ?? 0), 0);
  return {
    parts,
    notesJoules,
    joules: blocks.reduce((total, work) => total + work.joules, 0) + notesJoules,
    timedJoules,
    timedSeconds,
    watts: timedSeconds > 0 ? timedJoules / timedSeconds : undefined,
  };
};

export interface BenchmarkWork {
  readonly joules: number;
  readonly seconds: number;
  readonly watts: number;
  readonly leftOut: ReadonlyArray<LeftOut>;
}

/** "two dumbbells": the posted load is per implement, and two are lifted. */
const TWO_IMPLEMENTS = /\btwo (?:dumbbells|kettlebells)\b/i;

const benchmarkItem = (item: Benchmark["blocks"][number]["items"][number]): WorkItem => ({
  movementId: item.movementId,
  text: item.movementId,
  sets: item.quantities.length === 0 ? [] : [{ quantities: item.quantities }],
  performed: [],
  performance:
    item.note !== undefined && TWO_IMPLEMENTS.test(item.note) ? { implements: 2 } : undefined,
  alternatives: (item.alternatives ?? []).map(benchmarkItem),
});

/**
 * One attempt at a benchmark as prescribed (Rx loads): a time over the whole workout, or an
 * AMRAP's rounds. `undefined` when the score says neither or nothing could be counted.
 */
export const estimateBenchmarkWork = (
  benchmark: Benchmark,
  score: string,
  body: Body,
  modelOf: WorkModelOf,
): BenchmarkWork | undefined => {
  const blocks = benchmark.blocks.filter((block) => block.format !== "rest");
  const asWork = (block: Benchmark["blocks"][number], scores: ReadonlyArray<string>) =>
    estimateBlockWork(
      { format: block.format, params: block.params, items: block.items.map(benchmarkItem), scores },
      body,
      modelOf,
    );
  let joules = 0;
  let seconds: number | undefined;
  const leftOut: Array<LeftOut> = [];
  if (benchmark.scoring === "time") {
    seconds = parseBenchmarkScore("time", score);
    for (const block of blocks) {
      // The time is the whole workout's; count each block's work as prescribed.
      const work = asWork(block.format === "amrap" ? { ...block, format: "for_time" } : block, []);
      joules += work.joules;
      leftOut.push(...work.leftOut);
    }
  } else if (
    benchmark.scoring === "rounds_reps" &&
    blocks.length === 1 &&
    blocks[0]!.format === "amrap"
  ) {
    const work = asWork(blocks[0]!, [score]);
    joules = work.joules;
    seconds = work.seconds;
    leftOut.push(...work.leftOut);
  }
  if (seconds === undefined || seconds <= 0 || joules <= 0) return undefined;
  return { joules, seconds, watts: joules / seconds, leftOut };
};
