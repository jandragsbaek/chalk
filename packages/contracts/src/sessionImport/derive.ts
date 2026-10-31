import type { IsoDate, MovementId } from "../baseSchemas.ts";
import type {
  BlockFormat,
  BlockParams,
  ImportDocument,
  Quantity,
  Span,
  SpanId,
  SpanOf,
} from "../sessionImport.ts";
import type { WorkoutKind } from "../workout.ts";
import { lineIndexAt, splitLines, type Line } from "./parse.ts";

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
  readonly alternatives: ReadonlyArray<DerivedItem>;
}

export interface DerivedBlock {
  /** Absent for the implicit block holding movements written before any format line. */
  readonly spanId: SpanId | undefined;
  readonly title: string;
  readonly format: BlockFormat | undefined;
  readonly params: BlockParams;
  readonly items: ReadonlyArray<DerivedItem>;
  readonly scores: ReadonlyArray<string>;
}

export interface DerivedPart {
  readonly spanId: SpanId | undefined;
  readonly title: string;
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
}

interface MutablePart {
  spanId: SpanId | undefined;
  title: string;
  start: number;
  blocks: Array<MutableBlock>;
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
};

export const formatAmount = (amount: { min: number; max: number }) =>
  amount.min === amount.max ? `${amount.min}` : `${amount.min}-${amount.max}`;

/** "12/10 cal", "21-15-9 reps", "@40/25 kg", "70-80 %". */
export const formatQuantity = (quantity: Quantity): string => {
  const value = quantity.scheme ? quantity.scheme.join("-") : formatAmount(quantity.amount);
  const female = quantity.female ? `/${formatAmount(quantity.female)}` : "";
  const single = quantity.measure === "reps" && !quantity.female && quantity.amount.max === 1;
  return `${value}${female} ${single ? "rep" : MEASURE_LABELS[quantity.measure]}`;
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
    span._tag === "movement"
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
    const implicit: MutablePart = { spanId: undefined, title: "Workout", start: at, blocks: [] };
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
    };
    part.blocks.push(implicit);
    return implicit;
  };

  const alternativesOf = new Map<SpanId, Array<SpanOf<"movement">>>();
  const resultMovements: Array<SpanOf<"movement">> = [];

  for (const span of spans) {
    if (span._tag === "part") {
      parts.push({ spanId: span.id, title: slice(span), start: span.start, blocks: [] });
    } else if (span._tag === "block" && !inNotes(span)) {
      currentPart(span.start).blocks.push({
        spanId: span.id,
        title: slice(span),
        format: span.format,
        params: span.params,
        items: [],
      });
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
      const { measure, amount, female, scheme } = quantity;
      const list = sets.get(line) ?? [];
      list.push({
        measure,
        amount,
        ...(female === undefined ? {} : { female }),
        ...(scheme === undefined ? {} : { scheme }),
      });
      sets.set(line, list);
    }
    return Array.from(sets, ([line, quantities]) => ({ line, quantities }));
  };

  const toItem = (movement: SpanOf<"movement">): DerivedItem => ({
    spanId: movement.id,
    movementId: movement.movementId,
    text: slice(movement),
    sets: setsOf(movement),
    alternatives: (alternativesOf.get(movement.id) ?? []).map(toItem),
  });

  const scoresOf = new Map<SpanId, Array<string>>();
  for (const score of spans.filter(isTag("score"))) {
    const block = score.attachedTo === undefined ? undefined : byId.get(score.attachedTo);
    if (block?._tag !== "block") {
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

  const boundaries = spans
    .filter((span) => span._tag === "part" || span._tag === "notes")
    .map((span) => span.start);
  const rawTextOf = (part: MutablePart) => {
    const line = lines[lineOf(part.start)]!;
    const from = part.spanId === undefined ? line.start : line.end;
    const next = boundaries.find((start) => start > part.start);
    const to = next === undefined ? text.length : lines[lineOf(next)]!.start;
    return text.slice(from, Math.max(from, to)).trim();
  };

  const derivedParts: Array<DerivedPart> = parts.map((part) => {
    let blocks = part.blocks;
    // "Back squat / Max out! / 10 reps @20-30%": the movement comes before its format line.
    const [first, second] = blocks;
    if (first && second && first.spanId === undefined && second.items.length === 0) {
      blocks = [{ ...second, items: first.items }, ...blocks.slice(2)];
    }
    blocks = blocks.filter((block) => block.spanId !== undefined || block.items.length > 0);
    if (blocks.every((block) => block.items.length === 0))
      issues.push({
        severity: "warning",
        check: "movements",
        message: `${part.title} has no movements.`,
        ...(part.spanId === undefined ? {} : { spanId: part.spanId }),
      });
    return {
      spanId: part.spanId,
      title: part.title,
      rawText: rawTextOf(part),
      blocks: blocks.map((block) => ({
        spanId: block.spanId,
        title: block.title,
        format: block.format,
        params: block.params,
        items: block.items.map(toItem),
        scores: block.spanId === undefined ? [] : (scoresOf.get(block.spanId) ?? []),
      })),
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
    issues,
  };
};

export const blockingIssues = (session: DerivedSession) =>
  session.issues.filter((issue) => issue.severity === "error");

/** The line a span starts on, for "line 12" hints. */
export const lineNumberOf = (lines: ReadonlyArray<Line>, offset: number) =>
  lineIndexAt(lines, offset) + 1;
