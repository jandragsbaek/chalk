import * as Schema from "effect/Schema";

import {
  BenchmarkId,
  IsoDate,
  MovementId,
  TrimmedNonEmptyString,
  WorkoutId,
} from "./baseSchemas.ts";
import { BlockFormat, BlockParams, Quantity } from "./sessionImport.ts";

/**
 * Saved sessions compared part by part. A repeat has the same blocks, formats, movements and
 * numbers, or names the same benchmark; a similar part scores at least `SIMILAR_AT`. A part of
 * one movement only reports repeats: its look-alikes are that lift's history.
 */

/** A block's format and parameters, as the sheet heads it ("AMRAP 15 min"). */
export const BlockHeadline = Schema.Struct({
  format: Schema.NullOr(BlockFormat),
  params: BlockParams,
}).annotate({ identifier: "BlockHeadline" });
export type BlockHeadline = typeof BlockHeadline.Type;

/** The heaviest lift set a part wrote. */
export const PartTopSet = Schema.Struct({
  movementId: MovementId,
  reps: Schema.Int,
  loadKg: Schema.Finite,
});
export type PartTopSet = typeof PartTopSet.Type;

/** A saved part, enough to name it and set its result beside another's. */
export const PartRef = Schema.Struct({
  /** The `workout_parts` id. */
  id: TrimmedNonEmptyString,
  workoutId: WorkoutId,
  workoutName: Schema.String,
  performedOn: IsoDate,
  sessionNumber: Schema.NullOr(Schema.Int),
  position: Schema.Int,
  title: Schema.String,
  benchmarkId: Schema.optionalKey(BenchmarkId),
  /** The first block with a format other than rest; `null` when none has one. */
  headline: Schema.NullOr(BlockHeadline),
  /** Programmed movements, each once, in order; alternatives left out. */
  movementIds: Schema.Array(MovementId),
  /** Its blocks' scores; for a session of one part, the session's score. Empty without one. */
  result: Schema.String,
  top: Schema.NullOr(PartTopSet),
}).annotate({ identifier: "PartRef" });
export type PartRef = typeof PartRef.Type;

/** What a similar part does differently, read from the part toward the other one. */
export const PartDifference = Schema.TaggedUnion({
  /** A paired block has another format or other parameters (AMRAP 15 here, AMRAP 12 there). */
  format: { here: BlockHeadline, there: BlockHeadline },
  /** A variation of the same core movement (power clean here, squat clean there). */
  swapped: { here: MovementId, there: MovementId },
  /** Programmed here, not there. */
  extra: { movementId: MovementId },
  /** Programmed there, not here. */
  missing: { movementId: MovementId },
  /** The same movement with other numbers; one entry per set (written line). */
  numbers: {
    movementId: MovementId,
    here: Schema.Array(Schema.Array(Quantity)),
    there: Schema.Array(Schema.Array(Quantity)),
  },
}).annotate({ identifier: "PartDifference" });
export type PartDifference = typeof PartDifference.Type;

export const MatchKind = Schema.Literals(["repeat", "similar"]);
export type MatchKind = typeof MatchKind.Type;

export const PartMatch = Schema.Struct({
  /** The other part's id. */
  other: TrimmedNonEmptyString,
  kind: MatchKind,
  /** 0 to 1; 1 for a repeat. */
  score: Schema.Finite,
  /** Empty for a repeat. */
  differences: Schema.Array(PartDifference),
}).annotate({ identifier: "PartMatch" });
export type PartMatch = typeof PartMatch.Type;

export const PartEchoes = Schema.Struct({
  part: TrimmedNonEmptyString,
  /** Repeats first, then the closest; nearest in time on a tie. At most `MAX_MATCHES`. */
  matches: Schema.Array(PartMatch),
  /** Every match, shown or not. */
  total: Schema.Int,
  /** The latest part from an earlier day this one repeats, shown or not. */
  earlierRepeat: Schema.NullOr(TrimmedNonEmptyString),
}).annotate({ identifier: "PartEchoes" });
export type PartEchoes = typeof PartEchoes.Type;

/** Every saved part that has a match, and the parts those matches name. */
export const SimilarParts = Schema.Struct({
  parts: Schema.Array(PartRef),
  echoes: Schema.Array(PartEchoes),
}).annotate({ identifier: "SimilarParts" });
export type SimilarParts = typeof SimilarParts.Type;

/** One programmed movement as the comparison reads it; alternatives are left out. */
export interface ShapeItem {
  readonly movementId: MovementId;
  /** Quantities per written line. */
  readonly sets: ReadonlyArray<ReadonlyArray<Quantity>>;
}

export interface ShapeBlock {
  readonly format: BlockFormat | undefined;
  readonly params: BlockParams;
  readonly items: ReadonlyArray<ShapeItem>;
}

export interface PartShape {
  readonly id: string;
  readonly workoutId: string;
  readonly performedOn: string;
  readonly benchmarkId: BenchmarkId | undefined;
  readonly blocks: ReadonlyArray<ShapeBlock>;
}

/** A part at or above this score is similar. */
export const SIMILAR_AT = 0.6;
/** Matches listed per part. */
export const MAX_MATCHES = 5;
/** A variation of the same core counts this much of a same-movement pair. */
const FAMILY_CREDIT = 0.6;
const WEIGHTS = { format: 0.15, params: 0.15, movements: 0.45, numbers: 0.25 };
const TIMED = new Set<BlockFormat | undefined>(["emom", "every", "intervals"]);

const amountKey = (amount: { readonly min: number; readonly max: number } | undefined) =>
  amount === undefined ? "" : `${amount.min}-${amount.max}`;

const quantityKey = (quantity: Quantity) =>
  [
    quantity.measure,
    amountKey(quantity.amount),
    amountKey(quantity.female),
    quantity.scheme?.join("-") ?? "",
    (quantity.tiers ?? [])
      .map((tier) => `${tier.level}=${amountKey(tier.amount)}/${amountKey(tier.female)}`)
      .join("+"),
  ].join(":");

const setsKey = (sets: ReadonlyArray<ReadonlyArray<Quantity>>) =>
  sets.map((set) => set.map(quantityKey).sort().join(",")).join(";");

const paramsKey = (params: BlockParams) =>
  [
    params.durationSeconds ?? "",
    params.intervalSeconds ?? "",
    params.workSeconds ?? "",
    params.restSeconds ?? "",
    amountKey(params.rounds),
    params.scheme?.join("-") ?? "",
  ].join("|");

const formatScore = (here: BlockFormat | undefined, there: BlockFormat | undefined) =>
  here === there ? 1 : TIMED.has(here) && TIMED.has(there) ? 0.5 : 0;

/** Pairs of indexes, best first: each index used once, ties kept in written order. */
function greedyPairs(
  left: number,
  right: number,
  weigh: (i: number, j: number) => number,
  /** Among equal weights, pairs this returns true for go first. */
  prefer: (i: number, j: number) => boolean = () => false,
): ReadonlyArray<readonly [i: number, j: number, weight: number]> {
  const candidates: Array<readonly [number, number, number]> = [];
  for (let i = 0; i < left; i++)
    for (let j = 0; j < right; j++) {
      const weight = weigh(i, j);
      if (weight > 0) candidates.push([i, j, weight]);
    }
  candidates.sort(
    (a, b) =>
      b[2] - a[2] ||
      Number(prefer(b[0], b[1])) - Number(prefer(a[0], a[1])) ||
      Math.abs(a[0] - a[1]) - Math.abs(b[0] - b[1]),
  );
  const usedLeft = new Set<number>();
  const usedRight = new Set<number>();
  const pairs: Array<readonly [number, number, number]> = [];
  for (const [i, j, weight] of candidates) {
    if (usedLeft.has(i) || usedRight.has(j)) continue;
    usedLeft.add(i);
    usedRight.add(j);
    pairs.push([i, j, weight]);
  }
  return pairs;
}

interface Prepared {
  readonly shape: PartShape;
  readonly blocks: ReadonlyArray<
    ShapeBlock & { readonly paramsKey: string; readonly setsKeys: ReadonlyArray<string> }
  >;
  readonly itemCount: number;
  /** Distinct programmed movements. */
  readonly movementCount: number;
  /** Core movements of every item, for skipping parts with nothing in common. */
  readonly cores: ReadonlySet<MovementId>;
}

interface BlockComparison {
  readonly score: number;
  readonly exact: boolean;
  readonly differences: ReadonlyArray<PartDifference>;
}

const headlineOf = (block: ShapeBlock): BlockHeadline => ({
  format: block.format ?? null,
  params: block.params,
});

function compareBlocks(
  here: Prepared["blocks"][number],
  there: Prepared["blocks"][number],
  coreOf: (id: MovementId) => MovementId,
): BlockComparison {
  const format = formatScore(here.format, there.format);
  const sameParams = format === 1 && here.paramsKey === there.paramsKey;
  const params = sameParams ? 1 : format === 1 ? 0.5 : 0;
  const pairs = greedyPairs(
    here.items.length,
    there.items.length,
    (i, j) => {
      const left = here.items[i]!.movementId;
      const right = there.items[j]!.movementId;
      return left === right ? 1 : coreOf(left) === coreOf(right) ? FAMILY_CREDIT : 0;
    },
    (i, j) => here.setsKeys[i] === there.setsKeys[j],
  );
  const differences: Array<PartDifference> = [];
  if (!sameParams)
    differences.push({ _tag: "format", here: headlineOf(here), there: headlineOf(there) });
  let movementWeight = 0;
  let sameNumbers = 0;
  for (const [i, j, weight] of pairs) {
    movementWeight += weight;
    const left = here.items[i]!;
    const right = there.items[j]!;
    if (weight < 1) {
      differences.push({ _tag: "swapped", here: left.movementId, there: right.movementId });
    } else if (here.setsKeys[i] === there.setsKeys[j]) {
      sameNumbers++;
    } else {
      differences.push({
        _tag: "numbers",
        movementId: left.movementId,
        here: left.sets,
        there: right.sets,
      });
    }
  }
  const pairedHere = new Set(pairs.map(([i]) => i));
  const pairedThere = new Set(pairs.map(([, j]) => j));
  here.items.forEach((item, i) => {
    if (!pairedHere.has(i)) differences.push({ _tag: "extra", movementId: item.movementId });
  });
  there.items.forEach((item, j) => {
    if (!pairedThere.has(j)) differences.push({ _tag: "missing", movementId: item.movementId });
  });
  const total = here.items.length + there.items.length;
  const movements = (2 * movementWeight) / total;
  const numbers = sameNumbers / Math.max(here.items.length, there.items.length);
  return {
    score:
      WEIGHTS.format * format +
      WEIGHTS.params * params +
      WEIGHTS.movements * movements +
      WEIGHTS.numbers * numbers,
    exact: differences.length === 0,
    differences,
  };
}

function prepare(shape: PartShape, coreOf: (id: MovementId) => MovementId): Prepared {
  const blocks = shape.blocks
    .filter((block) => block.format !== "rest" && block.items.length > 0)
    .map((block) => ({
      ...block,
      paramsKey: paramsKey(block.params),
      setsKeys: block.items.map((item) => setsKey(item.sets)),
    }));
  return {
    shape,
    blocks,
    itemCount: blocks.reduce((sum, block) => sum + block.items.length, 0),
    movementCount: new Set(blocks.flatMap((block) => block.items.map((item) => item.movementId)))
      .size,
    cores: new Set(blocks.flatMap((block) => block.items.map((item) => coreOf(item.movementId)))),
  };
}

/** How `here` compares with `there`; `undefined` when it is neither a repeat nor similar. */
function compareParts(
  here: Prepared,
  there: Prepared,
  coreOf: (id: MovementId) => MovementId,
): PartMatch | undefined {
  const other = there.shape.id;
  if (here.shape.benchmarkId !== undefined && here.shape.benchmarkId === there.shape.benchmarkId)
    return { other, kind: "repeat", score: 1, differences: [] };
  if (here.itemCount === 0 || there.itemCount === 0) return undefined;
  if (![...here.cores].some((core) => there.cores.has(core))) return undefined;

  const comparisons = new Map<string, BlockComparison>();
  const pairs = greedyPairs(here.blocks.length, there.blocks.length, (i, j) => {
    const comparison = compareBlocks(here.blocks[i]!, there.blocks[j]!, coreOf);
    comparisons.set(`${i}:${j}`, comparison);
    return comparison.score;
  });
  const exact =
    here.blocks.length === there.blocks.length &&
    pairs.length === here.blocks.length &&
    pairs.every(([i, j]) => comparisons.get(`${i}:${j}`)!.exact);
  if (exact) return { other, kind: "repeat", score: 1, differences: [] };
  if (Math.min(here.movementCount, there.movementCount) < 2) return undefined;

  let weighted = 0;
  const differences: Array<PartDifference> = [];
  for (const [i, j] of pairs) {
    const comparison = comparisons.get(`${i}:${j}`)!;
    weighted += comparison.score * (here.blocks[i]!.items.length + there.blocks[j]!.items.length);
    differences.push(...comparison.differences);
  }
  const pairedHere = new Set(pairs.map(([i]) => i));
  const pairedThere = new Set(pairs.map(([, j]) => j));
  here.blocks.forEach((block, i) => {
    if (!pairedHere.has(i))
      for (const item of block.items)
        differences.push({ _tag: "extra", movementId: item.movementId });
  });
  there.blocks.forEach((block, j) => {
    if (!pairedThere.has(j))
      for (const item of block.items)
        differences.push({ _tag: "missing", movementId: item.movementId });
  });
  const score = weighted / (here.itemCount + there.itemCount);
  if (score < SIMILAR_AT) return undefined;
  return { other, kind: "similar", score: Math.round(score * 100) / 100, differences };
}

const daysBetween = (left: string, right: string) =>
  Math.abs(Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`));

/**
 * Every part's repeats and look-alikes among the other sessions' parts (never its own
 * session's). `coreOf` maps a variation to its core movement and a core to itself.
 */
export function findSimilarParts(
  shapes: ReadonlyArray<PartShape>,
  coreOf: (id: MovementId) => MovementId,
): ReadonlyArray<PartEchoes> {
  const prepared = shapes.map((shape) => prepare(shape, coreOf));
  const byId = new Map(shapes.map((shape) => [shape.id, shape]));
  const echoes: Array<PartEchoes> = [];
  for (const here of prepared) {
    const matches: Array<PartMatch> = [];
    for (const there of prepared) {
      if (there.shape.workoutId === here.shape.workoutId) continue;
      const match = compareParts(here, there, coreOf);
      if (match) matches.push(match);
    }
    if (matches.length === 0) continue;
    const distance = (match: PartMatch) =>
      daysBetween(here.shape.performedOn, byId.get(match.other)!.performedOn);
    matches.sort(
      (left, right) =>
        Number(right.kind === "repeat") - Number(left.kind === "repeat") ||
        right.score - left.score ||
        distance(left) - distance(right),
    );
    const dayOf = (match: PartMatch) => byId.get(match.other)!.performedOn;
    const earlier = matches
      .filter((match) => match.kind === "repeat" && dayOf(match) < here.shape.performedOn)
      .sort((left, right) => dayOf(right).localeCompare(dayOf(left)));
    echoes.push({
      part: here.shape.id,
      matches: matches.slice(0, MAX_MATCHES),
      total: matches.length,
      earlierRepeat: earlier[0]?.other ?? null,
    });
  }
  return echoes;
}
