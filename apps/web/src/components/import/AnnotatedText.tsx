import { splitLines, type Span, type SpanId } from "@chalk/contracts";
import type * as React from "react";

import type { PickMode } from "../../lib/importEditor.ts";

export interface TextRange {
  readonly start: number;
  readonly end: number;
}

interface Segment {
  readonly start: number;
  readonly end: number;
  readonly span: Span | undefined;
  /** Words left after this movement mark, which may name a variation of it. */
  readonly tailOf?: SpanId;
}

/** Words left after a movement mark ("o. line" after "Burpee"), by the mark's id. */
export type Tails = ReadonlyMap<SpanId, TextRange>;

/** Splits one line into plain runs, tails and highlights. Spans never overlap. */
const segmentsOf = (
  lineStart: number,
  lineEnd: number,
  spans: ReadonlyArray<Span>,
  tails: Tails,
) => {
  const segments: Array<Segment> = [];
  const plain = (from: number, to: number) => {
    let at = from;
    const inGap = [...tails]
      .filter(([, tail]) => tail.start >= from && tail.end <= to)
      .sort(([, left], [, right]) => left.start - right.start);
    for (const [owner, tail] of inGap) {
      if (tail.start > at) segments.push({ start: at, end: tail.start, span: undefined });
      segments.push({ start: tail.start, end: tail.end, span: undefined, tailOf: owner });
      at = tail.end;
    }
    if (at < to) segments.push({ start: at, end: to, span: undefined });
  };
  let at = lineStart;
  const inLine = spans
    .filter((span) => span.end > lineStart && span.start < lineEnd)
    .sort((left, right) => left.start - right.start);
  for (const span of inLine) {
    const from = Math.max(span.start, lineStart);
    // Overlaps never survive the editor; skip one rather than render text twice.
    if (from < at) continue;
    const to = Math.min(span.end, lineEnd);
    if (from > at) plain(at, from);
    segments.push({ start: from, end: to, span });
    at = to;
  }
  if (at < lineEnd) plain(at, lineEnd);
  return segments;
};

/** Text offset of a DOM selection point inside the document. */
const offsetOf = (node: Node, offset: number): number | undefined => {
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
  const segment = element?.closest<HTMLElement>("[data-offset]");
  if (segment) {
    const start = Number(segment.dataset.offset);
    if (node.nodeType === Node.TEXT_NODE) return start + offset;
    return offset === 0 ? start : start + (segment.textContent?.length ?? 0);
  }
  const line = element?.closest<HTMLElement>("[data-line-start]");
  if (line) {
    const start = Number(line.dataset.lineStart);
    return offset === 0 ? start : start + (line.textContent?.length ?? 0);
  }
  return undefined;
};

const describe = (span: Span) => {
  switch (span._tag) {
    case "quantity":
      return span.attachedTo === undefined ? "Not attached" : undefined;
    case "movement":
      return span.movementId === undefined ? "Pick a movement" : span.movementId;
    default:
      return span._tag;
  }
};

export function AnnotatedText({
  text,
  spans,
  selectedId,
  linked,
  picking,
  onSelectText,
  onClickSpan,
  flaggedLines,
  tails = new Map(),
}: {
  readonly text: string;
  readonly spans: ReadonlyArray<Span>;
  readonly selectedId: SpanId | undefined;
  readonly linked: ReadonlySet<SpanId>;
  readonly picking: PickMode | undefined;
  readonly onSelectText: (range: TextRange | undefined) => void;
  readonly onClickSpan: (id: SpanId) => void;
  /** 1-based line numbers with an issue that blocks saving; the gutter marks them. */
  readonly flaggedLines: ReadonlySet<number>;
  readonly tails?: Tails;
}) {
  function handleMouseUp(event: React.MouseEvent<HTMLDivElement>) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      onSelectText(undefined);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!event.currentTarget.contains(range.commonAncestorContainer)) return;
    const start = offsetOf(range.startContainer, range.startOffset);
    const end = offsetOf(range.endContainer, range.endOffset);
    onSelectText(
      start === undefined || end === undefined || start === end
        ? undefined
        : { start: Math.min(start, end), end: Math.max(start, end) },
    );
  }

  function handleSpanClick(event: React.MouseEvent<HTMLElement>, id: SpanId) {
    // A drag that ends on a highlight is a text selection, not a click.
    if (!(window.getSelection()?.isCollapsed ?? true)) return;
    event.stopPropagation();
    onClickSpan(id);
  }

  return (
    <div
      data-annotated
      data-picking={picking}
      className="py-3 pr-4 font-mono text-base leading-7"
      onMouseUp={handleMouseUp}
    >
      {splitLines(text).map((line, index) => (
        <div
          key={line.start}
          data-line-start={line.start}
          data-flagged={flaggedLines.has(index + 1) ? "" : undefined}
          className="min-h-7 whitespace-pre-wrap break-words"
        >
          {segmentsOf(line.start, line.end, spans, tails).map(({ start, end, span, tailOf }) =>
            tailOf !== undefined ? (
              <span
                key={start}
                data-offset={start}
                data-tail
                data-selected={tailOf === selectedId ? "" : undefined}
                data-linked={linked.has(tailOf) ? "" : undefined}
                title="Words left over: a variation?"
                onClick={(event) => handleSpanClick(event, tailOf)}
              >
                {text.slice(start, end)}
              </span>
            ) : span === undefined ? (
              <span key={start} data-offset={start}>
                {text.slice(start, end)}
              </span>
            ) : (
              <mark
                key={start}
                data-offset={start}
                data-tag={span._tag}
                data-measure={span._tag === "quantity" ? span.measure : undefined}
                data-selected={span.id === selectedId ? "" : undefined}
                data-linked={linked.has(span.id) ? "" : undefined}
                data-open={
                  (span._tag === "quantity" && span.attachedTo === undefined) ||
                  (span._tag === "movement" && span.movementId === undefined)
                    ? ""
                    : undefined
                }
                title={describe(span)}
                onClick={(event) => handleSpanClick(event, span.id)}
              >
                {text.slice(start, end)}
              </mark>
            ),
          )}
        </div>
      ))}
    </div>
  );
}
