import {
  deriveSession,
  ImportDocument,
  lineNumberOf,
  makeMovementMatcher,
  Span,
  splitLines,
  suggestSpans,
  type CatalogMovement,
  type Line,
} from "@chalk/contracts";
import * as Schema from "effect/Schema";

/**
 * How Chalk reads one document, for an agent fixing the importer: the spans as saved, what the
 * parser suggests for the same text today, where the two differ, and what the spans derive to.
 * The saved spans are the athlete's corrections, so every difference is a parser miss to look at.
 */

/** A span with the text it covers and the line it starts on (1-based), so it reads on its own. */
export const SpanView = Schema.Struct({
  line: Schema.Int,
  text: Schema.String,
  /** For a quantity or score, the span it hangs off; for an alternative, the movement it is an "or" of. */
  of: Schema.optionalKey(Schema.String),
  span: Span,
});
export type SpanView = typeof SpanView.Type;

export const ParserReview = Schema.Struct({
  /** Spans the parser suggests exactly as saved. */
  agreed: Schema.Int,
  /** Same range, but a different tag or reading (movement, quantity, format, attachment). */
  changed: Schema.Array(Schema.Struct({ saved: SpanView, suggested: SpanView })),
  /** Saved spans with no suggestion over the same range: the parser missed or misplaced them. */
  missed: Schema.Array(SpanView),
  /** Suggestions with no saved span over the same range: the athlete removed or moved them. */
  extra: Schema.Array(SpanView),
});
export type ParserReview = typeof ParserReview.Type;

export const IssueView = Schema.Struct({
  severity: Schema.Literals(["error", "warning"]),
  check: Schema.String,
  message: Schema.String,
  line: Schema.optionalKey(Schema.Int),
  text: Schema.optionalKey(Schema.String),
});

export const DocumentInspection = Schema.Struct({
  text: Schema.String,
  performedOn: ImportDocument.fields.performedOn,
  coaching: ImportDocument.fields.coaching,
  classType: ImportDocument.fields.classType,
  debrief: ImportDocument.fields.debrief,
  spans: Schema.Array(SpanView),
  review: ParserReview,
  issues: Schema.Array(IssueView),
  /** `deriveSession`'s output with the server's code: parts, blocks, items, lift sets. */
  derived: Schema.Json,
});
export type DocumentInspection = typeof DocumentInspection.Type;

export const SuggestionInspection = Schema.Struct({
  spans: Schema.Array(SpanView),
  issues: Schema.Array(IssueView),
  derived: Schema.Json,
});
export type SuggestionInspection = typeof SuggestionInspection.Type;

/** Fields the athlete enters in the editor, never the parser: left out when comparing. */
const ENTERED = new Set(["id", "start", "end", "result", "performance", "plan", "separateLoad"]);
const REFERENCES = new Set(["attachedTo", "alternativeOf"]);

/** Key-sorted JSON, so two readings compare equal whatever order their fields were built in. */
const stable = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(stable).join(",")}]`
    : typeof value === "object" && value !== null
      ? `{${Object.keys(value)
          .toSorted()
          .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
          .join(",")}}`
      : JSON.stringify(value);

const viewer = (text: string, spans: ReadonlyArray<Span>) => {
  const lines: ReadonlyArray<Line> = splitLines(text);
  const byId = new Map(spans.map((span) => [span.id, span]));
  const covered = (span: Span) => text.slice(span.start, span.end);
  const target = (span: Span) => {
    const id =
      ("attachedTo" in span ? span.attachedTo : undefined) ??
      ("alternativeOf" in span ? span.alternativeOf : undefined);
    return id === undefined ? undefined : byId.get(id);
  };
  const view = (span: Span): SpanView => {
    const of = target(span);
    return {
      line: lineNumberOf(lines, span.start),
      text: covered(span),
      ...(of === undefined
        ? {}
        : { of: `"${covered(of)}" (line ${lineNumberOf(lines, of.start)})` }),
      span,
    };
  };
  /** What the parser decides about a span: its tag and reading, references by range, not id. */
  const reading = (span: Span) =>
    stable(
      Object.fromEntries(
        Object.entries(span)
          .filter(([key]) => !ENTERED.has(key))
          .map(([key, value]) => {
            if (!REFERENCES.has(key) || typeof value !== "string") return [key, value];
            const referenced = byId.get(value);
            return [
              key,
              referenced === undefined ? value : `${referenced.start}-${referenced.end}`,
            ];
          }),
      ),
    );
  return { lines, view, reading };
};

const byStart = (a: Span, b: Span) => a.start - b.start || a.end - b.end;

export const reviewSuggestions = (
  text: string,
  saved: ReadonlyArray<Span>,
  suggested: ReadonlyArray<Span>,
): ParserReview => {
  const savedViewer = viewer(text, saved);
  const suggestedViewer = viewer(text, suggested);
  const range = (span: Span) => `${span.start}-${span.end}`;
  const suggestedAt = new Map(suggested.map((span) => [range(span), span]));
  const savedRanges = new Set(saved.map(range));

  let agreed = 0;
  const changed: Array<ParserReview["changed"][number]> = [];
  const missed: Array<SpanView> = [];
  for (const span of saved.toSorted(byStart)) {
    const guess = suggestedAt.get(range(span));
    if (guess === undefined) missed.push(savedViewer.view(span));
    else if (savedViewer.reading(span) === suggestedViewer.reading(guess)) agreed += 1;
    else changed.push({ saved: savedViewer.view(span), suggested: suggestedViewer.view(guess) });
  }
  const extra = suggested
    .filter((span) => !savedRanges.has(range(span)))
    .toSorted(byStart)
    .map(suggestedViewer.view);
  return { agreed, changed, missed, extra };
};

const freshIds = () => {
  let next = 0;
  return () => `s${++next}`;
};

/** The derivation as plain JSON (no `undefined` fields), with issues reported on their own. */
const derive = (document: ImportDocument, catalog: ReadonlyArray<CatalogMovement>) => {
  const names = new Map(catalog.map((movement) => [movement.id, movement.name]));
  const { issues, ...session } = deriveSession(document, (id) => names.get(id));
  const { lines, view } = viewer(document.text, document.spans);
  const spans = new Map(document.spans.map((span) => [span.id, span]));
  const derived: Schema.Json = JSON.parse(JSON.stringify(session));
  return {
    derived,
    issues: issues.map((issue) => {
      const span = issue.spanId === undefined ? undefined : spans.get(issue.spanId);
      return {
        severity: issue.severity,
        check: issue.check,
        message: issue.message,
        ...(span === undefined
          ? {}
          : { line: lineNumberOf(lines, span.start), text: view(span).text }),
      };
    }),
  };
};

export const inspectDocument = (
  document: ImportDocument,
  catalog: ReadonlyArray<CatalogMovement>,
): DocumentInspection => {
  const { view } = viewer(document.text, document.spans);
  const suggested = suggestSpans(document.text, makeMovementMatcher(catalog), freshIds());
  const { performedOn, coaching, classType, debrief } = document;
  return {
    text: document.text,
    ...(performedOn === undefined ? {} : { performedOn }),
    ...(coaching === undefined ? {} : { coaching }),
    ...(classType === undefined ? {} : { classType }),
    ...(debrief === undefined ? {} : { debrief }),
    spans: document.spans.toSorted(byStart).map(view),
    review: reviewSuggestions(document.text, document.spans, suggested),
    ...derive(document, catalog),
  };
};

export const inspectSuggestion = (
  text: string,
  catalog: ReadonlyArray<CatalogMovement>,
): SuggestionInspection => {
  const spans = suggestSpans(text, makeMovementMatcher(catalog), freshIds());
  const { view } = viewer(text, spans);
  return { spans: spans.map(view), ...derive({ text, spans }, catalog) };
};
