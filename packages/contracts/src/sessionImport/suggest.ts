import type { Measure, Span, SpanId, SpanOf } from "../sessionImport.ts";
import type { MovementMatcher } from "./movementMatcher.ts";
import {
  findScore,
  isQuantityOnly,
  lineIndexAt,
  maskParentheses,
  parseBlockFormat,
  parseQuantities,
  splitLines,
  type QuantityMatch,
} from "./parse.ts";

/** Loads and percentages are written after their movement; counts before it. */
const TRAILING_MEASURES: ReadonlySet<Measure> = new Set(["load_kg", "percent_1rm"]);

interface Segment {
  readonly start: number;
  readonly end: number;
  /** The segment follows an "or" / "eller": its movement is an alternative. */
  readonly alternative: boolean;
}

const SEPARATOR = /\s+(?:or|eller)\s+|\+|&/giu;

const splitSegments = (text: string, offset: number): ReadonlyArray<Segment> => {
  const segments: Array<Segment> = [];
  let start = 0;
  let alternative = false;
  for (const match of text.matchAll(SEPARATOR)) {
    segments.push({ start: offset + start, end: offset + match.index, alternative });
    alternative = /\p{L}/u.test(match[0]);
    start = match.index + match[0].length;
  }
  segments.push({ start: offset + start, end: offset + text.length, alternative });
  return segments;
};

interface Placed {
  readonly start: number;
  readonly end: number;
}

/** The movement a quantity belongs to among `movements` (all in its segment, in text order). */
const pickOwner = <M extends Placed>(
  quantity: Placed & { readonly measure: Measure },
  movements: ReadonlyArray<M>,
): M | undefined => {
  const before = movements.filter((movement) => movement.end <= quantity.start).at(-1);
  const after = movements.find((movement) => movement.start >= quantity.end);
  return TRAILING_MEASURES.has(quantity.measure) ? (before ?? after) : (after ?? before);
};

const HEADING = /^(\*+)\s+(.*)$/;
const BULLET = /^\s*[-+]\s+/;
const DATE = /(\d{4}-\d{2}-\d{2})/;
const SESSION = /\bsession\s*#?\s*(\d+)/i;
const NOTES_HEADING = /^(?:notes?|noter|results?|resultater)\s*:?$/i;
const CONTAINER_HEADING = /^(?:workouts?|wod|træning)\s*:?$/i;
const FAILED = /\b(?:fail(?:ed)?|miss(?:ed)?|no[\s-]?rep)\b/i;

/**
 * First-pass spans for a pasted session: headings, block formats, movements from the catalog,
 * quantities attached to their movement, and results in the notes. Everything is a suggestion;
 * the athlete corrects it in the editor.
 */
export const suggestSpans = (
  text: string,
  matcher: MovementMatcher,
  makeId: () => SpanId,
): ReadonlyArray<Span> => {
  const spans: Array<Span> = [];
  let region: "workout" | "notes" = "workout";
  let lastPartMovement: SpanOf<"movement"> | undefined;
  let lastScoreable: SpanOf<"block"> | undefined;

  const addQuantity = (match: QuantityMatch, attachedTo: SpanId | undefined) => {
    spans.push({
      _tag: "quantity",
      id: makeId(),
      start: match.start,
      end: match.end,
      ...match.quantity,
      ...(attachedTo === undefined ? {} : { attachedTo }),
    });
  };

  const addMovements = (content: string, offset: number) =>
    matcher.find(content, offset).map((match) => {
      const span: SpanOf<"movement"> = {
        _tag: "movement",
        id: makeId(),
        start: match.start,
        end: match.end,
        movementId: match.movementId,
      };
      spans.push(span);
      return span;
    });

  const workoutLine = (content: string, offset: number) => {
    if (/^rest\b/i.test(content) && parseBlockFormat(content) === undefined) return;

    const format = parseBlockFormat(content);
    if (format) {
      const block: SpanOf<"block"> = {
        _tag: "block",
        id: makeId(),
        start: offset,
        end: offset + format.length,
        format: format.format,
        params: format.params,
      };
      spans.push(block);
      if (format.format !== "rest" && format.format !== "strength") lastScoreable = block;
      const rest = content.slice(format.length);
      const skipped = rest.length - rest.trimStart().length;
      content = rest.trimStart();
      offset += format.length + skipped;
      if (content === "") return;
    }

    const station = content.match(/^\d+\)\s*/);
    if (station) {
      offset += station[0].length;
      content = content.slice(station[0].length);
    }

    const masked = maskParentheses(content);
    const movements = addMovements(masked, offset);
    const quantities = parseQuantities(masked, offset, { bareReps: movements.length > 0 });
    const segments = splitSegments(masked, offset);
    const inSegment = (segment: Segment, placed: Placed) =>
      placed.start >= segment.start && placed.end <= segment.end;

    for (const [index, segment] of segments.entries()) {
      const own = movements.filter((movement) => inSegment(segment, movement));
      const primary = segments
        .slice(0, index)
        .flatMap((previous) => movements.filter((movement) => inSegment(previous, movement)))
        .at(-1);
      if (segment.alternative && own[0] && primary) {
        const at = spans.indexOf(own[0]);
        const target = primary.alternativeOf ?? primary.id;
        spans[at] = { ...own[0], alternativeOf: target };
      }
    }

    const quantityOnly = movements.length === 0 && isQuantityOnly(masked, offset, quantities);
    for (const match of quantities) {
      const segment = segments.find((candidate) => inSegment(candidate, match));
      const own = segment ? movements.filter((movement) => inSegment(segment, movement)) : [];
      const owner =
        own.length > 0
          ? pickOwner({ ...match, measure: match.quantity.measure }, own)
          : quantityOnly
            ? lastPartMovement
            : undefined;
      addQuantity(match, owner?.id);
    }

    const primaries = movements.filter((movement) => movement.alternativeOf === undefined);
    if (primaries.length > 0) lastPartMovement = primaries.at(-1);
  };

  const notesLine = (content: string, offset: number) => {
    const masked = maskParentheses(content);
    const score = findScore(masked);
    if (score) {
      spans.push({
        _tag: "score",
        id: makeId(),
        start: offset + score.start,
        end: offset + score.end,
        ...(lastScoreable ? { attachedTo: lastScoreable.id } : {}),
      });
    }

    let lineMovement: SpanOf<"movement"> | undefined;
    for (const sentence of masked.matchAll(/(?:[^.!?]|[.,](?=\d))+[.!?]?/g)) {
      const sentenceOffset = offset + sentence.index;
      if (FAILED.test(sentence[0])) continue;
      const quantities = parseQuantities(sentence[0], sentenceOffset, { bareReps: false }).filter(
        (match) => !score || match.end <= offset + score.start || match.start >= offset + score.end,
      );
      if (!quantities.some((match) => match.quantity.measure === "load_kg")) continue;
      const movements = addMovements(sentence[0], sentenceOffset);
      for (const match of quantities) {
        const owner = pickOwner({ ...match, measure: "load_kg" }, movements) ?? lineMovement;
        addQuantity(match, owner?.id);
      }
      lineMovement = movements.at(-1) ?? lineMovement;
    }
  };

  for (const line of splitLines(text)) {
    const heading = line.text.match(HEADING);
    if (heading) {
      const contentStart = line.start + line.text.indexOf(heading[2]!);
      const content = heading[2]!.trimEnd();
      const date = content.match(DATE);
      const session = content.match(SESSION);
      if (date || session) {
        if (session) {
          const at = contentStart + session.index! + session[0].lastIndexOf(session[1]!);
          spans.push({
            _tag: "session",
            id: makeId(),
            start: at,
            end: at + session[1]!.length,
            number: Number(session[1]),
          });
        }
        if (date) {
          const at = contentStart + date.index!;
          spans.push({ _tag: "date", id: makeId(), start: at, end: at + 10, date: date[1]! });
        }
        continue;
      }
      if (NOTES_HEADING.test(content)) {
        spans.push({
          _tag: "notes",
          id: makeId(),
          start: contentStart,
          end: contentStart + content.length,
        });
        region = "notes";
        continue;
      }
      region = "workout";
      if (CONTAINER_HEADING.test(content) || content === "") continue;
      spans.push({
        _tag: "part",
        id: makeId(),
        start: contentStart,
        end: contentStart + content.length,
      });
      lastPartMovement = undefined;
      continue;
    }

    const bullet = line.text.match(BULLET);
    const leading = bullet ? bullet[0].length : line.text.length - line.text.trimStart().length;
    const content = line.text.slice(leading).trimEnd();
    // "*Byg til en moderat vægt": a coach's comment, not programming.
    if (content === "" || content.startsWith("*") || content.startsWith("#")) continue;

    if (region === "notes") notesLine(content, line.start + leading);
    else workoutLine(content, line.start + leading);
  }

  return spans;
};

/**
 * Where a quantity tagged by hand should attach: a movement on the same line (by the same rule
 * the suggester uses), else the nearest movement above it.
 */
export const suggestAttachment = (
  text: string,
  spans: ReadonlyArray<Span>,
  quantity: Placed & { readonly measure: Measure },
): SpanId | undefined => {
  const lines = splitLines(text);
  const line = lines[lineIndexAt(lines, quantity.start)]!;
  const movements = spans
    .filter((span): span is SpanOf<"movement"> => span._tag === "movement")
    .sort((left, right) => left.start - right.start);
  const sameLine = movements.filter(
    (movement) => movement.start >= line.start && movement.end <= line.end,
  );
  if (sameLine.length > 0) return pickOwner(quantity, sameLine)?.id;
  return movements.filter((movement) => movement.end <= quantity.start).at(-1)?.id;
};
