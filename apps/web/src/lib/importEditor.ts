import {
  findBenchmark,
  isEmptyDebrief,
  lineIndexAt,
  normalizeDebrief,
  makeMovementMatcher,
  parseBlockFormat,
  splitLines,
  quantityFromText,
  suggestAttachment,
  type Debrief,
  type ImportDocument,
  type IsoDate,
  type Measure,
  type MovementId,
  type Span,
  type SpanId,
  type SpanOf,
} from "@chalk/contracts";

/** What a click on a highlight does while picking: attach the selected span to the target. */
export type PickMode = "attach" | "alternative";

export interface EditorState {
  readonly text: string;
  readonly spans: ReadonlyArray<Span>;
  readonly performedOn: IsoDate | undefined;
  /** As typed; trimmed and emptied fields dropped only on the way out. */
  readonly debrief: Debrief;
  readonly selectedId: SpanId | undefined;
  readonly picking: PickMode | undefined;
  readonly nextId: number;
}

export type TagChoice =
  | { readonly tag: "movement"; readonly movementId: MovementId | undefined }
  | { readonly tag: "quantity"; readonly measure: Measure }
  | {
      readonly tag:
        | "block"
        | "part"
        | "notes"
        | "intent"
        | "comment"
        | "date"
        | "session"
        | "score"
        | "benchmark";
    };

export type EditorAction =
  | {
      readonly type: "tag";
      readonly start: number;
      readonly end: number;
      readonly choice: TagChoice;
    }
  | { readonly type: "update"; readonly span: Span }
  | { readonly type: "remove"; readonly id: SpanId }
  | { readonly type: "select"; readonly id: SpanId | undefined }
  | { readonly type: "pick"; readonly mode: PickMode | undefined }
  | { readonly type: "target"; readonly id: SpanId }
  | { readonly type: "setDate"; readonly date: IsoDate | undefined }
  | { readonly type: "setDebrief"; readonly debrief: Debrief }
  | { readonly type: "tagPhrase"; readonly phrase: string; readonly movementId: MovementId }
  | { readonly type: "replaceAll"; readonly spans: ReadonlyArray<Span> };

const byStart = (spans: ReadonlyArray<Span>) =>
  [...spans].sort((left, right) => left.start - right.start);

export const initialEditorState = (document: ImportDocument): EditorState => ({
  text: document.text,
  spans: byStart(document.spans),
  performedOn: document.performedOn,
  debrief: document.debrief ?? {},
  selectedId: undefined,
  picking: undefined,
  // Fresh ids never collide with loaded ones ("s12", "e3", ...).
  nextId: document.spans.length + 1,
});

export const toDocument = (state: EditorState): ImportDocument => ({
  text: state.text,
  spans: state.spans,
  ...(state.performedOn === undefined ? {} : { performedOn: state.performedOn }),
  ...(isEmptyDebrief(state.debrief) ? {} : { debrief: normalizeDebrief(state.debrief) }),
});

/** Drops references to removed spans; a replaced movement hands its links to `heir`. */
const relink = (
  spans: ReadonlyArray<Span>,
  removed: ReadonlySet<SpanId>,
  heir: SpanId | undefined,
): ReadonlyArray<Span> =>
  spans.map((span) => {
    if (
      (span._tag === "quantity" || span._tag === "score") &&
      span.attachedTo &&
      removed.has(span.attachedTo)
    ) {
      const { attachedTo: _gone, ...rest } = span;
      return heir === undefined ? rest : { ...rest, attachedTo: heir };
    }
    if (span._tag === "movement" && span.alternativeOf && removed.has(span.alternativeOf)) {
      const { alternativeOf: _gone, ...rest } = span;
      return heir === undefined ? rest : { ...rest, alternativeOf: heir };
    }
    return span;
  });

const makeSpan = (
  state: EditorState,
  id: SpanId,
  start: number,
  end: number,
  choice: TagChoice,
): Span => {
  const text = state.text.slice(start, end);
  switch (choice.tag) {
    case "movement": {
      // "60 Double unders or 90 Single unders": the second is an alternative of the first.
      const lines = splitLines(state.text);
      const line = lines[lineIndexAt(lines, start)]!;
      const previous = byStart(state.spans)
        .filter(
          (span): span is SpanOf<"movement"> =>
            span._tag === "movement" && span.start >= line.start && span.end <= start,
        )
        .at(-1);
      const alternativeOf =
        previous && /\b(?:or|eller)\b/i.test(state.text.slice(previous.end, start))
          ? (previous.alternativeOf ?? previous.id)
          : undefined;
      return {
        _tag: "movement",
        id,
        start,
        end,
        ...(choice.movementId === undefined ? {} : { movementId: choice.movementId }),
        ...(alternativeOf === undefined ? {} : { alternativeOf }),
      };
    }
    case "quantity": {
      const quantity = quantityFromText(text, choice.measure) ?? {
        measure: choice.measure,
        amount: { min: 0, max: 0 },
      };
      const attachedTo = suggestAttachment(
        state.text,
        state.spans.filter((span) => span.end <= start || span.start >= end),
        { start, end, measure: choice.measure },
      );
      return {
        _tag: "quantity",
        id,
        start,
        end,
        ...quantity,
        ...(attachedTo ? { attachedTo } : {}),
      };
    }
    case "block": {
      const format = parseBlockFormat(text.trim());
      return {
        _tag: "block",
        id,
        start,
        end,
        format: format?.format ?? "other",
        params: format?.params ?? {},
      };
    }
    case "date": {
      const date = text.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? state.performedOn ?? "2026-01-01";
      return { _tag: "date", id, start, end, date };
    }
    case "session":
      return { _tag: "session", id, start, end, number: Number(text.match(/\d+/)?.[0] ?? 0) };
    case "score": {
      const lastBlock = byStart(state.spans)
        .filter((span): span is SpanOf<"block"> => span._tag === "block" && span.start < start)
        .at(-1);
      return { _tag: "score", id, start, end, ...(lastBlock ? { attachedTo: lastBlock.id } : {}) };
    }
    case "benchmark": {
      const benchmark = findBenchmark(text);
      return {
        _tag: "benchmark",
        id,
        start,
        end,
        ...(benchmark === undefined ? {} : { benchmarkId: benchmark.id }),
      };
    }
    case "part":
    case "notes":
    case "intent":
    case "comment":
      return { _tag: choice.tag, id, start, end };
  }
};

/** Shrinks `[start, end)` to exclude surrounding whitespace. */
export const trimRange = (text: string, start: number, end: number) => {
  let from = start;
  let to = end;
  while (from < to && /\s/.test(text[from]!)) from++;
  while (to > from && /\s/.test(text[to - 1]!)) to--;
  return { start: from, end: to };
};

/**
 * Intent and comment are whole-line tags: the lines the selection touches, without the leading bullet or
 * comment star and any closing star.
 */
export const lineRange = (text: string, start: number, end: number) => {
  const lines = splitLines(text);
  const first = lines[lineIndexAt(lines, start)]!;
  const last = lines[lineIndexAt(lines, Math.max(start, end - 1))]!;
  const prefix = first.text.match(/^\s*(?:[-+]\s+)?\**/)![0].length;
  let to = last.end;
  while (to > first.start + prefix && /[\s*]/.test(text[to - 1]!)) to--;
  return trimRange(text, first.start + prefix, to);
};

/** Unattached numbers on a new movement's line attach to it when it is their natural owner. */
const claimOrphans = (text: string, spans: ReadonlyArray<Span>, movement: SpanOf<"movement">) => {
  const lines = splitLines(text);
  const line = lineIndexAt(lines, movement.start);
  return spans.map((span) =>
    span._tag === "quantity" &&
    span.attachedTo === undefined &&
    lineIndexAt(lines, span.start) === line &&
    suggestAttachment(text, spans, span) === movement.id
      ? { ...span, attachedTo: movement.id }
      : span,
  );
};

const canTarget = (picked: Span, target: Span, mode: PickMode) => {
  if (picked.id === target.id) return false;
  if (mode === "alternative") return picked._tag === "movement" && target._tag === "movement";
  if (picked._tag === "quantity") return target._tag === "movement";
  if (picked._tag === "score") return target._tag === "block" || target._tag === "benchmark";
  return false;
};

export const editorReducer = (state: EditorState, action: EditorAction): EditorState => {
  switch (action.type) {
    case "tag": {
      const lineTag = action.choice.tag === "intent" || action.choice.tag === "comment";
      const { start, end } = (lineTag ? lineRange : trimRange)(
        state.text,
        action.start,
        action.end,
      );
      if (start >= end) return state;
      const id = `e${state.nextId}`;
      const overlapped = state.spans.filter((span) => span.start < end && span.end > start);
      const removed = new Set(overlapped.map((span) => span.id));
      // Re-highlighting "Burpee" as "Burpee over rower" keeps the reps that hung off it.
      const heir =
        action.choice.tag === "movement" && overlapped.some((span) => span._tag === "movement")
          ? id
          : undefined;
      const kept = relink(
        state.spans.filter((span) => !removed.has(span.id)),
        removed,
        heir,
      );
      const span = makeSpan({ ...state, spans: kept }, id, start, end, action.choice);
      const withSpan = byStart([...kept, span]);
      return {
        ...state,
        spans: span._tag === "movement" ? claimOrphans(state.text, withSpan, span) : withSpan,
        selectedId: id,
        picking: undefined,
        nextId: state.nextId + 1,
      };
    }
    case "update":
      return {
        ...state,
        spans: state.spans.map((span) => (span.id === action.span.id ? action.span : span)),
      };
    case "remove": {
      const removed = new Set([action.id]);
      return {
        ...state,
        spans: relink(
          state.spans.filter((span) => span.id !== action.id),
          removed,
          undefined,
        ),
        selectedId: state.selectedId === action.id ? undefined : state.selectedId,
        picking: undefined,
      };
    }
    case "select":
      return { ...state, selectedId: action.id, picking: undefined };
    case "pick":
      return { ...state, picking: action.mode };
    case "target": {
      const picked = state.spans.find((span) => span.id === state.selectedId);
      const target = state.spans.find((span) => span.id === action.id);
      if (!picked || !target || !state.picking || !canTarget(picked, target, state.picking))
        return { ...state, selectedId: action.id, picking: undefined };
      const linked: Span =
        picked._tag === "movement"
          ? {
              ...picked,
              alternativeOf:
                target._tag === "movement" ? (target.alternativeOf ?? target.id) : target.id,
            }
          : picked._tag === "quantity" || picked._tag === "score"
            ? { ...picked, attachedTo: target.id }
            : picked;
      return {
        ...state,
        spans: state.spans.map((span) => (span.id === linked.id ? linked : span)),
        picking: undefined,
      };
    }
    case "setDate":
      return { ...state, performedOn: action.date };
    case "setDebrief":
      return { ...state, debrief: action.debrief };
    case "replaceAll":
      return { ...state, spans: byStart(action.spans), selectedId: undefined, picking: undefined };
    case "tagPhrase": {
      // After "Burpee over rower" is learned, upgrade its other occurrences: where a shorter
      // movement sits inside it, or on a line that already carries numbers.
      const lines = splitLines(state.text);
      const lineOf = (offset: number) => lineIndexAt(lines, offset);
      const matcher = makeMovementMatcher([
        { id: action.movementId, name: action.phrase, aliases: [] },
      ]);
      let next = state;
      for (const match of matcher.find(state.text)) {
        const overlapping = next.spans.filter(
          (span) => span.start < match.end && span.end > match.start,
        );
        const done = overlapping.some(
          (span) =>
            span._tag === "movement" &&
            span.start === match.start &&
            span.end === match.end &&
            span.movementId === action.movementId,
        );
        const upgrades =
          overlapping.length > 0 && overlapping.every((span) => span._tag === "movement");
        const numbered =
          overlapping.length === 0 &&
          next.spans.some(
            (span) => span._tag === "quantity" && lineOf(span.start) === lineOf(match.start),
          );
        if (done || !(upgrades || numbered)) continue;
        next = editorReducer(next, {
          type: "tag",
          start: match.start,
          end: match.end,
          choice: { tag: "movement", movementId: action.movementId },
        });
      }
      return { ...next, selectedId: state.selectedId, picking: undefined };
    }
  }
};

/** Ids of a movement and everything hanging off it, for linked highlighting. */
export const linkedIds = (
  spans: ReadonlyArray<Span>,
  id: SpanId | undefined,
): ReadonlySet<SpanId> => {
  if (id === undefined) return new Set();
  const span = spans.find((candidate) => candidate.id === id);
  if (!span) return new Set();
  const owner =
    (span._tag === "quantity" || span._tag === "score") && span.attachedTo
      ? span.attachedTo
      : span.id;
  const ids = new Set([owner]);
  for (const other of spans) {
    if ((other._tag === "quantity" || other._tag === "score") && other.attachedTo === owner)
      ids.add(other.id);
    if (other._tag === "movement" && other.alternativeOf === owner) ids.add(other.id);
  }
  return ids;
};
