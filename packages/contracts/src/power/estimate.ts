import type { MovementId } from "../baseSchemas.ts";
import type { Benchmark } from "../benchmarks/model.ts";
import { parseBenchmarkScore } from "../benchmarks/index.ts";
import type { BlockRole, CatalogMovement } from "../sessionImport.ts";
import type { DerivedSession } from "../sessionImport/derive.ts";
import {
  benchmarkBlock,
  countBlock,
  type CountUnit,
  type LeftOut,
  type WorkBlock,
  type WorkItem,
} from "../volume/count.ts";
import type { Body } from "./body.ts";
import { WORK_MODELS, type WorkModel } from "./movements.ts";

/**
 * Work and power, block by block: each movement's count (`countBlock`) times its work per unit;
 * power is that work over the block's time (a for-time score, an AMRAP's or EMOM's length). A
 * session's power is over its conditioning blocks only (`blockRole`). What cannot be counted is
 * listed with the reason, never silently dropped.
 */

export type WorkUnit = Exclude<CountUnit, "s">;

export interface ItemWork {
  readonly movementId: MovementId;
  readonly amount: number;
  readonly unit: WorkUnit;
  /** External load, all implements together; `undefined` for bodyweight. */
  readonly loadKg: number | undefined;
  readonly joules: number;
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

export interface SessionBlockWork {
  readonly title: string;
  readonly role: BlockRole;
  readonly work: BlockWork;
}

export interface SessionWork {
  readonly parts: ReadonlyArray<{
    readonly title: string;
    readonly blocks: ReadonlyArray<SessionBlockWork>;
  }>;
  /** Lift sets from the notes: work, no time. */
  readonly notesJoules: number;
  /** Every block's work and the notes': the session's. */
  readonly joules: number;
  /** Work in conditioning blocks with a time, and that time: the session's average power. */
  readonly conditioningJoules: number;
  readonly conditioningSeconds: number;
  readonly watts: number | undefined;
  /** Strength blocks that had a time: left out of power, though they add work. */
  readonly strengthBlocks: number;
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

/**
 * What a block reads as, without the athlete's word: strength for a strength block or one built
 * up set by set (lifts entered, no score for the block), else conditioning. An EMOM of cleans
 * logged load by load is strength; the same EMOM with rows and burpees, or any scored block, is
 * conditioning.
 */
export const readBlockRole = (block: WorkBlock): BlockRole => {
  if (block.format === "strength") return "strength";
  if (block.result !== undefined || block.scores.length > 0) return "conditioning";
  const lifted = (item: WorkItem): boolean =>
    item.performed.length > 0 || item.alternatives.some(lifted);
  return block.items.some(lifted) ? "strength" : "conditioning";
};

/** What a block trained, for power: the athlete's word, else what it reads as. */
export const blockRole = (block: WorkBlock): BlockRole => block.role ?? readBlockRole(block);

const secondsOf = (block: WorkBlock): number | undefined => {
  const { params } = block;
  const rounds = params.rounds === undefined ? undefined : params.rounds.min;
  switch (block.format) {
    case "for_time": {
      // Capped: the block took its cap.
      if (block.result?._tag === "capped") return params.timeCapSeconds;
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
  const count = countBlock(block, {
    sex: body.sex,
    pairOf: (movementId) => modelOf(movementId)?.pair === true,
  });
  if (count.skipped !== undefined && count.counted.length === 0 && count.leftOut.length === 0)
    return skippedBlock(count.skipped, seconds);
  const items: Array<ItemWork> = [];
  const leftOut: Array<LeftOut> = [...count.leftOut];
  // A lifted item is left out once, not once per set.
  const leftLifted = new Set<string>();
  for (const line of count.counted) {
    const { movementId, amount, loadKg } = line;
    const model = modelOf(movementId);
    const leave = (reason: string) => leftOut.push({ movementId, text: line.text, reason });
    if (line.lifted) {
      if (model?.perRep === undefined) {
        const key = `${movementId}\u0000${line.text}`;
        if (!leftLifted.has(key)) leave(model?.none ?? "No work model for this movement yet.");
        leftLifted.add(key);
        continue;
      }
      items.push({
        movementId,
        amount,
        unit: "reps",
        loadKg,
        joules: amount * model.perRep(body, loadKg ?? 0),
      });
      continue;
    }
    if (model === undefined) {
      leave("No work model for this movement yet.");
      continue;
    }
    // Seconds are not counted for work (`countBlock` leaves them out unless asked).
    const unit = line.unit as WorkUnit;
    if (model.none !== undefined) {
      items.push({ movementId, amount, unit, loadKg, joules: 0 });
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
    items.push({ movementId, amount, unit, loadKg, joules: amount * perUnit(body, loadKg ?? 0) });
  }

  // Nothing counted at all is no measurement; a zero would read as one.
  if (items.length === 0) return { ...skippedBlock("Nothing it could count.", seconds), leftOut };
  const joules = totalJoules(items);
  return {
    joules,
    seconds,
    watts: seconds !== undefined && seconds > 0 && joules > 0 ? joules / seconds : undefined,
    items,
    leftOut,
    skipped: undefined,
  };
};

/** Whether a session's block is in its power: conditioning, with a time. */
export const countsForPower = (block: SessionBlockWork): boolean =>
  block.role === "conditioning" && block.work.watts !== undefined;

export const estimateSessionWork = (
  session: DerivedSession,
  body: Body,
  modelOf: WorkModelOf,
): SessionWork => {
  const parts = session.parts.map((part) => ({
    title: part.title,
    blocks: part.blocks
      .filter((block) => block.format !== "rest" && block.items.length > 0)
      .map((block): SessionBlockWork => ({
        title: block.title,
        role: blockRole(block),
        work: estimateBlockWork(block, body, modelOf),
      })),
  }));
  let notesJoules = 0;
  for (const set of session.liftSets) {
    const perRep = modelOf(set.movementId)?.perRep;
    if (perRep) notesJoules += set.count * set.reps * perRep(body, set.loadKg);
  }
  const blocks = parts.flatMap((part) => part.blocks);
  const timed = blocks.filter((block) => block.work.watts !== undefined);
  const powerBlocks = blocks.filter(countsForPower);
  const conditioningJoules = powerBlocks.reduce((total, block) => total + block.work.joules, 0);
  const conditioningSeconds = powerBlocks.reduce(
    (total, block) => total + (block.work.seconds ?? 0),
    0,
  );
  return {
    parts,
    notesJoules,
    joules: blocks.reduce((total, block) => total + block.work.joules, 0) + notesJoules,
    conditioningJoules,
    conditioningSeconds,
    watts: conditioningSeconds > 0 ? conditioningJoules / conditioningSeconds : undefined,
    strengthBlocks: timed.length - powerBlocks.length,
  };
};

export interface BenchmarkWork {
  readonly joules: number;
  readonly seconds: number;
  readonly watts: number;
  readonly leftOut: ReadonlyArray<LeftOut>;
}

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
    estimateBlockWork(benchmarkBlock(block, scores), body, modelOf);
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
