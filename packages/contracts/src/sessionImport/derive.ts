import type { BenchmarkId, IsoDate, MovementId } from "../baseSchemas.ts";
import { benchmarkById, type Benchmark, type BenchmarkItem } from "../benchmarks/index.ts";
import { LEVEL_NAMES, type Performance } from "../levels.ts";
import type {
  BlockFormat,
  BlockParams,
  ImportDocument,
  LiftResult,
  PerformedSet,
  Quantity,
  Span,
  SpanId,
  SpanOf,
} from "../sessionImport.ts";
import type { WorkoutKind } from "../workout.ts";
import { lineIndexAt, parseQuantities, splitLines, type Line } from "./parse.ts";

/** Quantities written on one line for one movement: one set of the prescription. */
export interface DerivedSet {
  readonly line: number;
  readonly quantities: ReadonlyArray<Quantity>;
}

export interface DerivedItem {
  readonly spanId: SpanId;
  readonly movementId: MovementId | undefined;
  readonly text: string;
  readonly sets: ReadonlyArray<DerivedSet>;
  /** What was lifted, set by set; empty without a valid result. */
  readonly performed: ReadonlyArray<PerformedSet>;
  /** Every set the result lists, a missed one (0 reps) included; empty without a valid result. */
  readonly listed: ReadonlyArray<PerformedSet>;
  /** How it was done, when the athlete said; `undefined` while it has a problem. */
  readonly performance: Performance | undefined;
  /** How the athlete planned to do it; `undefined` without a plan or while it has a problem. */
  readonly plan: Performance | undefined;
  readonly alternatives: ReadonlyArray<DerivedItem>;
}

/** A coach's instruction for a block, with any intensity it names (RPE, %, load). */
export interface DerivedIntent {
  readonly spanId: SpanId;
  readonly text: string;
  readonly quantities: ReadonlyArray<Quantity>;
}

/** An aside kept with a block ("Inspiration from ..."): shown, never read for numbers. */
export interface DerivedComment {
  readonly spanId: SpanId;
  readonly text: string;
}

export interface DerivedBlock {
  /** Absent for the implicit block holding movements written before any format line. */
  readonly spanId: SpanId | undefined;
  readonly title: string;
  readonly format: BlockFormat | undefined;
  readonly params: BlockParams;
  readonly items: ReadonlyArray<DerivedItem>;
  readonly intents: ReadonlyArray<DerivedIntent>;
  readonly comments: ReadonlyArray<DerivedComment>;
  readonly scores: ReadonlyArray<string>;
  /** Reps × load over the block's performed sets, alternatives included. */
  readonly tonnageKg: number;
}

export interface DerivedPart {
  readonly spanId: SpanId | undefined;
  readonly title: string;
  /** The named workout the part is, from a `benchmark` span in it. */
  readonly benchmarkId: BenchmarkId | undefined;
  readonly rawText: string;
  readonly blocks: ReadonlyArray<DerivedBlock>;
}

/** One logged result from the notes: `count` sets of `reps` at `loadKg`. */
export interface DerivedLiftSet {
  readonly movementSpanId: SpanId;
  readonly movementId: MovementId;
  readonly reps: number;
  readonly loadKg: number;
  readonly count: number;
}

/** What an issue is about: the editor shows one pass/fail lamp per check. */
export type ImportCheck = "date" | "movements" | "numbers";

export interface ImportIssue {
  /** Errors block saving; warnings only point at something that will be left out. */
  readonly severity: "error" | "warning";
  readonly check: ImportCheck;
  readonly message: string;
  readonly spanId?: SpanId;
}

export interface DerivedSession {
  readonly performedOn: IsoDate | undefined;
  readonly sessionNumber: number | undefined;
  readonly name: string;
  readonly kind: WorkoutKind;
  readonly score: string;
  readonly notes: string;
  readonly parts: ReadonlyArray<DerivedPart>;
  readonly liftSets: ReadonlyArray<DerivedLiftSet>;
  /** Reps × load over every performed set and every lift set from the notes. */
  readonly tonnageKg: number;
  readonly issues: ReadonlyArray<ImportIssue>;
}

/** Movement names by id; `undefined` means the id is not in the catalog. */
export type MovementNames = (id: MovementId) => string | undefined;

interface MutableBlock {
  spanId: SpanId | undefined;
  title: string;
  format: BlockFormat | undefined;
  params: BlockParams;
  items: Array<SpanOf<"movement">>;
  intents: Array<SpanOf<"intent">>;
  comments: Array<SpanOf<"comment">>;
}

interface MutablePart {
  spanId: SpanId | undefined;
  title: string;
  start: number;
  blocks: Array<MutableBlock>;
  benchmark: SpanOf<"benchmark"> | undefined;
}

const isTag =
  <Tag extends Span["_tag"]>(tag: Tag) =>
  (span: Span): span is SpanOf<Tag> =>
    span._tag === tag;

const MEASURE_LABELS: Record<Quantity["measure"], string> = {
  reps: "reps",
  sets: "sets",
  calories: "cal",
  distance_m: "m",
  seconds: "sec",
  load_kg: "kg",
  percent_1rm: "%",
  rpe: "RPE",
};

export const formatAmount = (amount: { min: number; max: number }) =>
  amount.min === amount.max ? `${amount.min}` : `${amount.min}-${amount.max}`;

/** "12/10 cal", "21-15-9 reps", "@40/25 kg", "70-80 %", "RPE 8", "Elite 18/15 · RX 15/12 cal". */
export const formatQuantity = (quantity: Quantity): string => {
  if (quantity.tiers !== undefined && quantity.tiers.length > 0) {
    const tiers = quantity.tiers
      .map(
        (tier) =>
          `${LEVEL_NAMES[tier.level]} ${formatAmount(tier.amount)}${tier.female ? `/${formatAmount(tier.female)}` : ""}`,
      )
      .join(" · ");
    return `${tiers} ${MEASURE_LABELS[quantity.measure]}`;
  }
  const value = quantity.scheme ? quantity.scheme.join("-") : formatAmount(quantity.amount);
  const female = quantity.female ? `/${formatAmount(quantity.female)}` : "";
  if (quantity.measure === "rpe") return `RPE ${value}${female}`;
  const single = quantity.measure === "reps" && !quantity.female && quantity.amount.max === 1;
  return `${value}${female} ${single ? "rep" : MEASURE_LABELS[quantity.measure]}`;
};

/** Sets or reps a result can hold; also bounds how far a result expands. */
const MAX_COUNT = 100;
const MAX_LOAD_KG = 1000;

const roundKg = (kg: number) => Math.round(kg * 100) / 100;

/**
 * Every set a result lists, in order, a missed one (0 reps) included: a ramp of 6 from 50 by 2.5
 * ends at 62.5.
 */
export const resultSets = (result: LiftResult): ReadonlyArray<PerformedSet> => {
  if (result._tag === "each") return result.sets.slice(0, MAX_COUNT);
  const count = Math.max(0, Math.min(MAX_COUNT, Math.floor(result.sets)));
  return Array.from({ length: count }, (_, index) => ({
    reps: result.reps,
    loadKg:
      result._tag === "fixed" ? result.loadKg : roundKg(result.startKg + index * result.stepKg),
  }));
};

/** The sets a result stands for: what was lifted, missed sets left out. */
export const performedSets = (result: LiftResult): ReadonlyArray<PerformedSet> =>
  resultSets(result).filter((set) => set.reps > 0);

/** Total kilograms moved: reps × load, summed. */
export const tonnageOf = (
  sets: ReadonlyArray<{ readonly reps: number; readonly loadKg: number }>,
) => roundKg(sets.reduce((total, set) => total + set.reps * set.loadKg, 0));

/** "6 × 2 @ 60 kg", "2 reps @ 50 · 52.5 · 55 kg", "10 @ 20 kg · 5 @ 40 kg". */
export const formatPerformed = (sets: ReadonlyArray<PerformedSet>): string => {
  const [first] = sets;
  if (!first) return "";
  const sameReps = sets.every((set) => set.reps === first.reps);
  if (sameReps && sets.every((set) => set.loadKg === first.loadKg))
    return `${sets.length} × ${first.reps} @ ${first.loadKg} kg`;
  if (sameReps)
    return `${first.reps} ${first.reps === 1 ? "rep" : "reps"} @ ${sets.map((set) => set.loadKg).join(" · ")} kg`;
  return sets.map((set) => `${set.reps} @ ${set.loadKg} kg`).join(" · ");
};

/** Why a result cannot be saved, or `undefined` when it can. */
const resultProblem = (result: LiftResult): string | undefined => {
  const sets = result._tag === "each" ? result.sets.length : result.sets;
  if (!Number.isInteger(sets) || sets < 1 || sets > MAX_COUNT)
    return `a result needs 1 to ${MAX_COUNT} sets`;
  const listed = resultSets(result);
  // Set by set, a set can be missed (0 reps); every set of a fixed or ramped result was lifted.
  const fewest = result._tag === "each" ? 0 : 1;
  if (
    listed.some((set) => !Number.isInteger(set.reps) || set.reps < fewest || set.reps > MAX_COUNT)
  )
    return `reps must be ${fewest} to ${MAX_COUNT}`;
  if (!listed.some((set) => set.reps > 0)) return "a result needs at least one set lifted";
  if (listed.some((set) => !(set.loadKg > 0) || set.loadKg > MAX_LOAD_KG))
    return `every load must be above 0 and at most ${MAX_LOAD_KG} kg`;
  return undefined;
};

/** Most reps, sets or kilograms one performance can claim; past this it is a typo. */
const MAX_PERFORMANCE = 1000;
/** Meters are counted per round too ("500 m row"), so the bound is higher than for reps. */
const MAX_PER_ROUND = 10_000;

/** Why a performance cannot be saved, or `undefined` when it can. */
const performanceProblem = (
  performance: Performance,
  nameOf: (id: MovementId) => string | undefined,
): string | undefined => {
  if (performance.loadKg !== undefined && performance.loadKg > MAX_LOAD_KG)
    return `the load must be at most ${MAX_LOAD_KG} kg`;
  for (const entry of performance.variants ?? []) {
    if (nameOf(entry.movementId) === undefined)
      return `"${entry.movementId}" is not in the catalog`;
    if (!Number.isInteger(entry.reps) || entry.reps > MAX_PERFORMANCE)
      return `reps per variation must be 0 to ${MAX_PERFORMANCE}`;
  }
  if (
    performance.unbroken !== undefined &&
    (!Number.isInteger(performance.unbroken) || performance.unbroken > MAX_PERFORMANCE)
  )
    return `the biggest unbroken set must be 0 to ${MAX_PERFORMANCE}`;
  if (performance.perRound !== undefined) {
    const { min, max } = performance.perRound;
    if (min > max) return "the count each round must run from low to high";
    if (max > MAX_PER_ROUND) return `the count each round must be at most ${MAX_PER_ROUND}`;
  }
  return undefined;
};

const kindOf = (parts: ReadonlyArray<DerivedPart>): WorkoutKind => {
  const formats = parts.flatMap((part) => part.blocks.map((block) => block.format));
  const last = parts.at(-1)?.blocks.map((block) => block.format) ?? [];
  for (const kind of ["for_time", "amrap", "emom"] as const) if (last.includes(kind)) return kind;
  return formats.includes("strength") ? "strength" : "other";
};

const stripBullet = (line: string) =>
  line
    .replace(/^\s*[-+]\s+/, "")
    .replace(/^\*+\s+/, "")
    .trim();

/**
 * The session a document stands for. Pure and total: problems become issues, so the editor can
 * show a live preview and the server can refuse to save the same way.
 */
export const deriveSession = (document: ImportDocument, nameOf: MovementNames): DerivedSession => {
  const { text } = document;
  const issues: Array<ImportIssue> = [];
  const spans = [...document.spans].sort((left, right) => left.start - right.start);
  const lines = splitLines(text);
  const slice = (span: { start: number; end: number }) => text.slice(span.start, span.end);
  const lineOf = (offset: number) => lineIndexAt(lines, offset);
  const checkOf = (span: Span): ImportCheck =>
    span._tag === "movement" || span._tag === "benchmark"
      ? "movements"
      : span._tag === "date" || span._tag === "session"
        ? "date"
        : "numbers";

  for (const [index, span] of spans.entries()) {
    if (span.start >= span.end || span.end > text.length)
      issues.push({
        severity: "error",
        check: checkOf(span),
        message: "A highlight falls outside the text.",
        spanId: span.id,
      });
    const next = spans[index + 1];
    if (next && next.start < span.end)
      issues.push({
        severity: "error",
        check: checkOf(next),
        message: "Two highlights overlap.",
        spanId: next.id,
      });
  }
  const byId = new Map(spans.map((span) => [span.id, span]));

  const dates = spans.filter(isTag("date"));
  const performedOn = dates[0]?.date ?? document.performedOn;
  if (dates.length > 1)
    issues.push({
      severity: "warning",
      check: "date",
      message: "More than one date; the first is used.",
      spanId: dates[1]!.id,
    });
  if (performedOn === undefined)
    issues.push({
      severity: "error",
      check: "date",
      message: "No date. Highlight it in the text or set it.",
    });
  const sessionNumber = spans.find(isTag("session"))?.number;

  // Notes run from a notes heading to the next part (or the end).
  const notesRanges = spans.filter(isTag("notes")).map((notes) => {
    const nextPart = spans.find((span) => span._tag === "part" && span.start > notes.end);
    return { from: notes.end, to: nextPart?.start ?? text.length };
  });
  const inNotes = (span: Span) =>
    notesRanges.some((range) => span.start >= range.from && span.start < range.to);

  const parts: Array<MutablePart> = [];
  const currentPart = (at: number) => {
    const part = parts.at(-1);
    if (part) return part;
    const implicit: MutablePart = {
      spanId: undefined,
      title: "Workout",
      start: at,
      blocks: [],
      benchmark: undefined,
    };
    parts.push(implicit);
    return implicit;
  };
  const currentBlock = (at: number) => {
    const part = currentPart(at);
    const block = part.blocks.at(-1);
    if (block) return block;
    const implicit: MutableBlock = {
      spanId: undefined,
      title: "",
      format: undefined,
      params: {},
      items: [],
      intents: [],
      comments: [],
    };
    part.blocks.push(implicit);
    return implicit;
  };

  const alternativesOf = new Map<SpanId, Array<SpanOf<"movement">>>();
  const resultMovements: Array<SpanOf<"movement">> = [];
  /** Where a benchmark opened a part of its own; it ends the part before, like a heading. */
  const benchmarkStarts: Array<number> = [];

  for (const span of spans) {
    if (span._tag === "part") {
      parts.push({
        spanId: span.id,
        title: slice(span),
        start: span.start,
        blocks: [],
        benchmark: undefined,
      });
    } else if (span._tag === "benchmark") {
      if (inNotes(span)) {
        issues.push({
          severity: "warning",
          check: "movements",
          message: `Benchmark "${slice(span)}" is in the notes and is left out.`,
          spanId: span.id,
        });
        continue;
      }
      const benchmark =
        span.benchmarkId === undefined ? undefined : benchmarkById(span.benchmarkId);
      if (span.benchmarkId === undefined)
        issues.push({
          severity: "error",
          check: "movements",
          message: `Pick a benchmark for "${slice(span)}".`,
          spanId: span.id,
        });
      else if (benchmark === undefined)
        issues.push({
          severity: "error",
          check: "movements",
          message: `"${span.benchmarkId}" is not a known benchmark.`,
          spanId: span.id,
        });
      // Right under its heading it names that part; after movements it starts the next one.
      const part = parts.at(-1);
      if (
        part !== undefined &&
        part.benchmark === undefined &&
        part.blocks.every((block) => block.items.length === 0)
      )
        part.benchmark = span;
      else {
        benchmarkStarts.push(span.start);
        parts.push({
          spanId: undefined,
          title: benchmark?.name ?? slice(span),
          start: span.start,
          blocks: [],
          benchmark: span,
        });
      }
    } else if (span._tag === "block" && !inNotes(span)) {
      currentPart(span.start).blocks.push({
        spanId: span.id,
        title: slice(span),
        format: span.format,
        params: span.params,
        items: [],
        intents: [],
        comments: [],
      });
    } else if (span._tag === "intent") {
      if (inNotes(span))
        issues.push({
          severity: "warning",
          check: "numbers",
          message: `Intent "${slice(span)}" is in the notes and is left out.`,
          spanId: span.id,
        });
      else currentBlock(span.start).intents.push(span);
    } else if (span._tag === "comment") {
      // In the notes a comment is just more of the notes text, which is kept anyway.
      if (!inNotes(span)) currentBlock(span.start).comments.push(span);
    } else if (span._tag === "movement") {
      if (span.movementId === undefined)
        issues.push({
          severity: "error",
          check: "movements",
          message: `Pick a movement for "${slice(span)}".`,
          spanId: span.id,
        });
      else if (nameOf(span.movementId) === undefined)
        issues.push({
          severity: "error",
          check: "movements",
          message: `"${span.movementId}" is not in the catalog.`,
          spanId: span.id,
        });

      if (inNotes(span)) {
        if (span.result !== undefined || span.performance !== undefined || span.plan !== undefined)
          issues.push({
            severity: "warning",
            check: "numbers",
            message: `What was done on "${slice(span)}" is in the notes and is left out.`,
            spanId: span.id,
          });
        resultMovements.push(span);
        continue;
      }
      const primary = span.alternativeOf === undefined ? undefined : byId.get(span.alternativeOf);
      if (primary?._tag === "movement" && !inNotes(primary)) {
        const list = alternativesOf.get(primary.id) ?? [];
        list.push(span);
        alternativesOf.set(primary.id, list);
        continue;
      }
      if (span.alternativeOf !== undefined)
        issues.push({
          severity: "warning",
          check: "movements",
          message: `"${slice(span)}" is an alternative of a movement that is gone; kept as its own item.`,
          spanId: span.id,
        });
      currentBlock(span.start).items.push(span);
    }
  }

  // Quantities hang off movements; one line of quantities is one set.
  const quantitiesOf = new Map<SpanId, Array<SpanOf<"quantity">>>();
  for (const quantity of spans.filter(isTag("quantity"))) {
    const owner = quantity.attachedTo === undefined ? undefined : byId.get(quantity.attachedTo);
    if (owner?._tag !== "movement") {
      issues.push({
        severity: "warning",
        check: "numbers",
        message: `"${slice(quantity)}" is not attached to a movement and is left out.`,
        spanId: quantity.id,
      });
      continue;
    }
    const list = quantitiesOf.get(owner.id) ?? [];
    list.push(quantity);
    quantitiesOf.set(owner.id, list);
  }

  const setsOf = (movement: SpanOf<"movement">): ReadonlyArray<DerivedSet> => {
    const sets = new Map<number, Array<Quantity>>();
    for (const quantity of quantitiesOf.get(movement.id) ?? []) {
      const line = lineOf(quantity.start);
      const { measure, amount, female, scheme, tiers } = quantity;
      const list = sets.get(line) ?? [];
      list.push({
        measure,
        amount,
        ...(female === undefined ? {} : { female }),
        ...(scheme === undefined ? {} : { scheme }),
        ...(tiers === undefined ? {} : { tiers }),
      });
      sets.set(line, list);
    }
    return Array.from(sets, ([line, quantities]) => ({ line, quantities }));
  };

  const listedOf = (movement: SpanOf<"movement">): ReadonlyArray<PerformedSet> => {
    if (movement.result === undefined) return [];
    const problem = resultProblem(movement.result);
    if (problem === undefined) return resultSets(movement.result);
    const name =
      (movement.movementId === undefined ? undefined : nameOf(movement.movementId)) ??
      slice(movement);
    issues.push({
      severity: "error",
      check: "numbers",
      message: `${name}: ${problem}.`,
      spanId: movement.id,
    });
    return [];
  };

  const checkedPerformance = (
    movement: SpanOf<"movement">,
    performance: Performance | undefined,
    label: string,
  ): Performance | undefined => {
    if (performance === undefined) return undefined;
    const problem = performanceProblem(performance, nameOf);
    if (problem === undefined) return performance;
    const name =
      (movement.movementId === undefined ? undefined : nameOf(movement.movementId)) ??
      slice(movement);
    issues.push({
      severity: "error",
      check: "numbers",
      message: `${name}${label}: ${problem}.`,
      spanId: movement.id,
    });
    return undefined;
  };

  const toItem = (movement: SpanOf<"movement">): DerivedItem => {
    const listed = listedOf(movement);
    return {
      spanId: movement.id,
      movementId: movement.movementId,
      text: slice(movement),
      sets: setsOf(movement),
      performed: listed.filter((set) => set.reps > 0),
      listed,
      performance: checkedPerformance(movement, movement.performance, ""),
      plan: checkedPerformance(movement, movement.plan, " (plan)"),
      alternatives: (alternativesOf.get(movement.id) ?? []).map(toItem),
    };
  };
  const itemTonnage = (item: DerivedItem): number =>
    tonnageOf(item.performed) +
    item.alternatives.reduce((total, alternative) => total + itemTonnage(alternative), 0);

  // A line tag spanning lines reads as one sentence, without bullets or comment stars.
  const lineTagText = (span: SpanOf<"intent"> | SpanOf<"comment">) =>
    slice(span)
      .split("\n")
      .map((line) =>
        stripBullet(line)
          .replace(/^\*+|\*+$/g, "")
          .trim(),
      )
      .filter((line) => line !== "")
      .join(" ");
  const toComment = (comment: SpanOf<"comment">): DerivedComment => ({
    spanId: comment.id,
    text: lineTagText(comment),
  });
  const toIntent = (intent: SpanOf<"intent">): DerivedIntent => {
    const intentText = lineTagText(intent);
    return {
      spanId: intent.id,
      text: intentText,
      quantities: parseQuantities(intentText, 0, { bareReps: false }).map(
        (match) => match.quantity,
      ),
    };
  };

  const scoresOf = new Map<SpanId, Array<string>>();
  for (const score of spans.filter(isTag("score"))) {
    const block = score.attachedTo === undefined ? undefined : byId.get(score.attachedTo);
    if (block?._tag !== "block" && block?._tag !== "benchmark") {
      issues.push({
        severity: "warning",
        check: "numbers",
        message: `Score "${slice(score)}" is not attached to a block and is left out.`,
        spanId: score.id,
      });
      continue;
    }
    scoresOf.set(block.id, [...(scoresOf.get(block.id) ?? []), slice(score)]);
  }

  const boundaries = [
    ...spans
      .filter((span) => span._tag === "part" || span._tag === "notes")
      .map((span) => span.start),
    ...benchmarkStarts,
  ].sort((left, right) => left - right);
  const rawTextOf = (part: MutablePart) => {
    const line = lines[lineOf(part.start)]!;
    const from = part.spanId === undefined ? line.start : line.end;
    const next = boundaries.find((start) => start > part.start);
    const to = next === undefined ? text.length : lines[lineOf(next)]!.start;
    return text.slice(from, Math.max(from, to)).trim();
  };

  /** A benchmark's blocks as derived ones; item and intent ids hang off the benchmark span. */
  const expandBenchmark = (
    benchmark: Benchmark,
    span: SpanOf<"benchmark">,
    intents: ReadonlyArray<DerivedIntent>,
    comments: ReadonlyArray<DerivedComment>,
    scores: ReadonlyArray<string>,
  ): ReadonlyArray<DerivedBlock> => {
    const line = lineOf(span.start);
    const toTemplateItem = (item: BenchmarkItem, key: string): DerivedItem => {
      if (nameOf(item.movementId) === undefined)
        issues.push({
          severity: "error",
          check: "movements",
          message: `${benchmark.name} uses "${item.movementId}", which is not in the catalog.`,
          spanId: span.id,
        });
      return {
        spanId: `${span.id}/${key}`,
        movementId: item.movementId,
        text: nameOf(item.movementId) ?? item.movementId,
        sets: item.quantities.length === 0 ? [] : [{ line, quantities: item.quantities }],
        performed: [],
        listed: [],
        performance: undefined,
        plan: undefined,
        alternatives: (item.alternatives ?? []).map((alternative, index) =>
          toTemplateItem(alternative, `${key}.${index}`),
        ),
      };
    };
    const scoredAt = Math.max(
      0,
      benchmark.blocks.findIndex((block) => block.format !== "rest"),
    );
    return benchmark.blocks.map((block, blockIndex) => ({
      spanId: undefined,
      title: block.title,
      format: block.format,
      params: block.params,
      items: block.items.map((item, itemIndex) =>
        toTemplateItem(item, `${blockIndex}.${itemIndex}`),
      ),
      intents: [
        ...(blockIndex === 0 ? intents : []),
        ...block.intents.map((intentText, index) => ({
          spanId: `${span.id}/${blockIndex}.i${index}`,
          text: intentText,
          quantities: parseQuantities(intentText, 0, { bareReps: false }).map(
            (match) => match.quantity,
          ),
        })),
      ],
      comments: blockIndex === 0 ? comments : [],
      scores: blockIndex === scoredAt ? scores : [],
      tonnageKg: 0,
    }));
  };

  const derivedParts: Array<DerivedPart> = parts.map((part) => {
    let blocks = part.blocks;
    // "Back squat / Max out! / 10 reps @20-30%": the movement comes before its format line.
    const [first, second] = blocks;
    if (first && second && first.spanId === undefined && second.items.length === 0) {
      blocks = [
        {
          ...second,
          items: first.items,
          intents: [...first.intents, ...second.intents],
          comments: [...first.comments, ...second.comments],
        },
        ...blocks.slice(2),
      ];
    }
    blocks = blocks.filter(
      (block) =>
        block.spanId !== undefined ||
        block.items.length > 0 ||
        block.intents.length > 0 ||
        block.comments.length > 0,
    );
    const named = part.benchmark;
    const benchmark =
      named?.benchmarkId === undefined ? undefined : benchmarkById(named.benchmarkId);
    const benchmarkScores = named === undefined ? [] : (scoresOf.get(named.id) ?? []);
    const base = {
      spanId: part.spanId,
      title: part.title,
      benchmarkId: benchmark?.id,
      rawText: rawTextOf(part),
    };
    // Only the name on the board: the part is the benchmark as prescribed.
    if (named && benchmark && blocks.every((block) => block.items.length === 0))
      return {
        ...base,
        blocks: expandBenchmark(
          benchmark,
          named,
          blocks.flatMap((block) => block.intents.map(toIntent)),
          blocks.flatMap((block) => block.comments.map(toComment)),
          benchmarkScores,
        ),
      };
    const scoredAt = Math.max(
      0,
      blocks.findIndex((block) => block.items.length > 0),
    );
    if (named === undefined && blocks.every((block) => block.items.length === 0))
      issues.push({
        severity: "warning",
        check: "movements",
        message: `${part.title} has no movements.`,
        ...(part.spanId === undefined ? {} : { spanId: part.spanId }),
      });
    return {
      ...base,
      blocks: blocks.map((block, index) => {
        const items = block.items.map(toItem);
        return {
          spanId: block.spanId,
          title: block.title,
          format: block.format,
          params: block.params,
          items,
          intents: block.intents.map(toIntent),
          comments: block.comments.map(toComment),
          scores: [
            ...(block.spanId === undefined ? [] : (scoresOf.get(block.spanId) ?? [])),
            ...(index === scoredAt ? benchmarkScores : []),
          ],
          tonnageKg: roundKg(items.reduce((total, item) => total + itemTonnage(item), 0)),
        };
      }),
    };
  });

  const liftSets: Array<DerivedLiftSet> = [];
  for (const movement of resultMovements) {
    if (movement.movementId === undefined) continue;
    const quantities = (quantitiesOf.get(movement.id) ?? []).sort(
      (left, right) => left.start - right.start,
    );
    const name = nameOf(movement.movementId) ?? slice(movement);
    for (const [index, load] of quantities.entries()) {
      if (load.measure !== "load_kg") continue;
      const line = lineOf(load.start);
      const sameLine = (quantity: SpanOf<"quantity">) => lineOf(quantity.start) === line;
      const previousLoad = quantities.slice(0, index).findLastIndex((q) => q.measure === "load_kg");
      const nextLoad = quantities.findIndex((q, at) => at > index && q.measure === "load_kg");
      const before = quantities.slice(previousLoad + 1, index).filter(sameLine);
      const after = quantities
        .slice(index + 1, nextLoad === -1 ? undefined : nextLoad)
        .filter(sameLine);
      const reps =
        before.findLast((q) => q.measure === "reps") ?? after.find((q) => q.measure === "reps");
      const sets = [...before, ...after].find((q) => q.measure === "sets");
      const where = { check: "numbers", spanId: load.id } as const;
      if (load.amount.min !== load.amount.max || load.female) {
        issues.push({
          severity: "error",
          message: `${name} ${slice(load)}: a result needs one load.`,
          ...where,
        });
        continue;
      }
      if (!reps) {
        issues.push({ severity: "error", message: `${name} ${slice(load)} needs reps.`, ...where });
        continue;
      }
      const repCount = reps.amount.min;
      if (
        !Number.isInteger(repCount) ||
        repCount < 1 ||
        repCount > 100 ||
        reps.amount.max !== repCount
      ) {
        issues.push({
          severity: "error",
          message: `${name} ${slice(load)}: reps must be 1 to 100.`,
          ...where,
        });
        continue;
      }
      if (load.amount.min <= 0 || load.amount.min > 1000) {
        issues.push({
          severity: "error",
          message: `${name} ${slice(load)}: load must be 0 to 1000 kg.`,
          ...where,
        });
        continue;
      }
      liftSets.push({
        movementSpanId: movement.id,
        movementId: movement.movementId,
        reps: repCount,
        loadKg: load.amount.min,
        count: Math.max(1, Math.round(sets?.amount.min ?? 1)),
      });
    }
  }

  // A lift logged both as a result and in the notes is counted twice; say so.
  const performedItems = derivedParts
    .flatMap((part) => part.blocks.flatMap((block) => block.items))
    .flatMap(function flatten(item): ReadonlyArray<DerivedItem> {
      return [item, ...item.alternatives.flatMap(flatten)];
    })
    .filter((item) => item.performed.length > 0);
  for (const item of performedItems) {
    const noted = liftSets.find((set) => set.movementId === item.movementId);
    if (noted)
      issues.push({
        severity: "warning",
        check: "numbers",
        message: `${nameOf(noted.movementId) ?? item.text} has a result and lift sets in the notes; both are counted.`,
        spanId: item.spanId,
      });
  }
  const tonnageKg = roundKg(
    derivedParts.reduce(
      (total, part) => total + part.blocks.reduce((sum, block) => sum + block.tonnageKg, 0),
      0,
    ) + liftSets.reduce((total, set) => total + set.count * set.reps * set.loadKg, 0),
  );

  const notes = notesRanges
    .flatMap((range) => text.slice(range.from, range.to).split("\n"))
    .map(stripBullet)
    .filter((line) => line !== "")
    .join("\n");

  if (derivedParts.length === 0 && liftSets.length === 0)
    issues.push({
      severity: "error",
      check: "movements",
      message: "Nothing to import yet: highlight a movement.",
    });

  return {
    performedOn,
    sessionNumber,
    name:
      sessionNumber !== undefined
        ? `Session ${sessionNumber}`
        : performedOn !== undefined
          ? `Session ${performedOn}`
          : "Imported session",
    kind: kindOf(derivedParts),
    score: derivedParts.flatMap((part) => part.blocks.flatMap((block) => block.scores)).join(" · "),
    notes,
    parts: derivedParts,
    liftSets,
    tonnageKg,
    issues,
  };
};

export const blockingIssues = (session: DerivedSession) =>
  session.issues.filter((issue) => issue.severity === "error");

/** The line a span starts on, for "line 12" hints. */
export const lineNumberOf = (lines: ReadonlyArray<Line>, offset: number) =>
  lineIndexAt(lines, offset) + 1;
