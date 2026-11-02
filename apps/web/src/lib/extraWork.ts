import {
  deriveSession,
  scoresMovements,
  splitLines,
  suggestSpans,
  type DerivedBlock,
  type DerivedItem,
  type LiftResult,
  type MovementMatcher,
  type Span,
  type SpanId,
  type SpanOf,
} from "@chalk/contracts";

import type { EditorState } from "./importEditor.ts";
import { resultDefaults } from "./resultDraft.ts";

/** The part extra work goes under: what was done beside the board (a PR attempt, goofing around). */
export const EXTRA_TITLE = "Extra work";

/** Spans of the typed lines the editor keeps: the heading is the extra part's, not theirs. */
const HEADINGS: ReadonlySet<Span["_tag"]> = new Set(["session", "date", "part", "notes"]);

const byStart = (spans: ReadonlyArray<Span>) =>
  [...spans].sort((left, right) => left.start - right.start);

/** Items in order, alternatives after their item, with the block they sit in. */
const itemsOf = (blocks: ReadonlyArray<DerivedBlock>) => {
  const found = new Map<SpanId, { readonly item: DerivedItem; readonly block: DerivedBlock }>();
  const visit = (item: DerivedItem, block: DerivedBlock) => {
    found.set(item.spanId, { item, block });
    for (const alternative of item.alternatives) visit(alternative, block);
  };
  for (const block of blocks) for (const item of block.items) visit(item, block);
  return found;
};

/**
 * What was written is what was done: "Clean and jerk 1x1 @ 100 kg" lifted 1 × 1 at 100 kg. Only
 * a lift with reps and a load; anything else is left for the result form.
 */
const writtenResult = (item: DerivedItem, block: DerivedBlock): LiftResult | undefined => {
  if (scoresMovements(block.format)) return undefined;
  const { sets, reps, loadKg, rows } = resultDefaults(item, block);
  if (rows !== undefined || reps === undefined || reps < 1 || loadKg === undefined || loadKg <= 0)
    return undefined;
  return { _tag: "fixed", sets: sets ?? 1, reps, loadKg };
};

/**
 * Adds lines to the end of the text under an "Extra work" part (the one ending it, else a new one
 * in the paste's stars and bullets), parsed on their own so the notes around them change nothing.
 * A lift with reps and a load gets that as its result. Selects the first new movement.
 */
export const appendExtraWork = (
  state: EditorState,
  typed: string,
  matcher: MovementMatcher,
): EditorState => {
  const written = typed
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-+•]\s+/, ""))
    .filter((line) => line !== "");
  if (written.length === 0) return state;

  const spans = byStart(state.spans);
  const trimmed = state.text.trimEnd();
  const body = spans.some((span) => span.end > trimmed.length) ? state.text : trimmed;
  const lines = splitLines(body);
  const lineOf = (offset: number) => lines.find((line) => offset <= line.end)?.text ?? "";
  const headings = spans.filter((span) => span._tag === "part" || span._tag === "notes");
  const lastHeading = headings.at(-1);
  const lastPart = headings.filter((span) => span._tag === "part").at(-1);
  const reuse =
    lastHeading?._tag === "part" && body.slice(lastHeading.start, lastHeading.end) === EXTRA_TITLE;
  const stars = lastPart === undefined ? "" : (lineOf(lastPart.start).match(/^\*+\s+/)?.[0] ?? "");
  const bullet = lines.some((line) => /^\s*[-+•]\s/.test(line.text)) ? "- " : "";

  let nextId = state.nextId;
  const fresh = (): SpanId => `e${nextId++}`;
  let text = body;
  const added: Array<Span> = [];
  if (!reuse) {
    const lead = body === "" ? "" : "\n\n";
    const start = body.length + lead.length + stars.length;
    text = `${body}${lead}${stars}${EXTRA_TITLE}`;
    added.push({ _tag: "part", id: fresh(), start, end: start + EXTRA_TITLE.length });
  }
  const chunk = written.map((line) => `${bullet}${line}`).join("\n");
  const offset = text.length + 1;
  text = `${text}\n${chunk}`;

  let next = 0;
  const suggested = suggestSpans(chunk, matcher, () => `x${++next}`).filter(
    (span) => !HEADINGS.has(span._tag),
  );
  const ids = new Map(suggested.map((span) => [span.id, fresh()] as const));
  for (const span of suggested) {
    const moved = {
      ...span,
      id: ids.get(span.id)!,
      start: span.start + offset,
      end: span.end + offset,
    };
    if ((moved._tag === "quantity" || moved._tag === "score") && moved.attachedTo !== undefined) {
      const { attachedTo, ...rest } = moved;
      const target = ids.get(attachedTo);
      added.push(target === undefined ? rest : { ...rest, attachedTo: target });
    } else if (moved._tag === "movement" && moved.alternativeOf !== undefined) {
      const { alternativeOf, ...rest } = moved;
      const target = ids.get(alternativeOf);
      added.push(target === undefined ? rest : { ...rest, alternativeOf: target });
    } else added.push(moved);
  }

  const session = deriveSession({ text, spans: [...spans, ...added] }, () => undefined);
  const items = itemsOf(session.parts.flatMap((part) => part.blocks));
  const withResults = added.map((span): Span => {
    if (span._tag !== "movement" || span.alternativeOf !== undefined) return span;
    const found = items.get(span.id);
    const result = found === undefined ? undefined : writtenResult(found.item, found.block);
    return result === undefined ? span : { ...span, result };
  });
  const firstMovement = withResults.find(
    (span): span is SpanOf<"movement"> => span._tag === "movement",
  );

  return {
    ...state,
    text,
    spans: byStart([...spans, ...withResults]),
    selectedId: firstMovement?.id ?? state.selectedId,
    picking: undefined,
    nextId,
  };
};
