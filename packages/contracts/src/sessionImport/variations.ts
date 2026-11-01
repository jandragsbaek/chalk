import type { MovementId } from "../baseSchemas.ts";
import type { CatalogMovement } from "../sessionImport.ts";
import { normalizeMovementPhrase, tokenize } from "./movementMatcher.ts";

/** Words the matcher left after a movement on its line: "o. line" in "12 Burpee o. line". */
export interface TrailingWords {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** Words that end the run: the line goes on to another movement, a rest or a condition. */
const STOP = new Set([
  "or",
  "and",
  "then",
  "rest",
  "each",
  "every",
  "per",
  "for",
  "at",
  "with",
  "w",
  "max",
  "unbroken",
  "ub",
  "in",
  "on",
  "until",
]);
/** Characters that end the run: a load, a note, the next movement. */
const BREAK = /[@(,+/;:*=|[\]{}<>]/;
const MAX_WORDS = 4;

/**
 * Up to four words right after a movement mark, before a number, a stop word, a separator, the
 * line's end or another mark. `undefined` when the mark is followed by none.
 */
export const trailingWords = (
  text: string,
  mark: { readonly end: number },
  spans: ReadonlyArray<{ readonly start: number; readonly end: number }>,
): TrailingWords | undefined => {
  const lineEnd = text.indexOf("\n", mark.end);
  const nextMark = Math.min(
    ...spans.filter((span) => span.start >= mark.end).map((span) => span.start),
  );
  const limit = Math.min(lineEnd === -1 ? text.length : lineEnd, nextMark);
  const rest = text.slice(mark.end, limit);
  const broken = rest.search(BREAK);
  const run = broken === -1 ? rest : rest.slice(0, broken);
  let end: number | undefined;
  let words = 0;
  for (const token of tokenize(run, mark.end)) {
    if (/^\d/.test(token.key) || STOP.has(token.key) || words === MAX_WORDS) break;
    words++;
    // "o." keeps its dot: the board's abbreviation is part of the phrase.
    end = text[token.end] === "." ? token.end + 1 : token.end;
  }
  if (end === undefined) return undefined;
  const start = mark.end + (run.length - run.trimStart().length);
  return { start, end, text: text.slice(start, end) };
};

/** Board shorthand read as the word it stands for, when ranking ("o." is "over"). */
const SHORTHAND: Readonly<Record<string, ReadonlyArray<string>>> = {
  o: ["over"],
  ov: ["over"],
  db: ["dumbbell"],
  kb: ["kettlebell"],
  bb: ["barbell"],
  sa: ["single", "arm"],
  lat: ["lateral"],
  bj: ["box", "jump"],
};

/** Words that tell options apart by nothing. */
const FILLER = new Set(["the", "a", "an", "s"]);

const expand = (key: string) => SHORTHAND[key] ?? [key];

export interface VariationOption {
  readonly movement: CatalogMovement;
  /** Words of the movement's name the trailing words matched, to print in bold. */
  readonly matched: ReadonlySet<string>;
  /** How many different trailing words it matched, by name or alias. */
  readonly score: number;
  /** The alias that matched more than the name did ("Lateral burpee over the bar"). */
  readonly via?: string;
}

export interface VariationLadder {
  /** The core movement: the mark's own, or the one it is a variation of. */
  readonly core: CatalogMovement;
  /** The core and its variations, the mark's own movement left out; best match first. */
  readonly options: ReadonlyArray<VariationOption>;
}

/**
 * What a movement mark could be within its family, ranked by the words after it: for "Burpee"
 * then "o. line", Burpee over line first. A word counts when it is, or starts, a word of the
 * option's name or aliases beyond the core's own. Ties keep the catalog's name order.
 * `undefined` for a movement with no family.
 */
export const variationLadder = (
  movementId: MovementId,
  catalog: ReadonlyArray<CatalogMovement>,
  trailing: string | undefined,
): VariationLadder | undefined => {
  const own = catalog.find((movement) => movement.id === movementId);
  if (own === undefined) return undefined;
  const coreId = own.variationOf ?? own.id;
  const core = catalog.find((movement) => movement.id === coreId);
  if (core === undefined) return undefined;
  const family = catalog.filter(
    (movement) =>
      (movement.id === coreId || movement.variationOf === coreId) && movement.id !== movementId,
  );
  if (family.length === 0) return undefined;
  const coreWords = new Set(normalizeMovementPhrase(core.name).split(" "));
  const wanted = (trailing === undefined ? [] : tokenize(trailing))
    .flatMap((token) => expand(token.key))
    .filter((word) => !coreWords.has(word) && !FILLER.has(word));
  const fits = (candidate: string, word: string) =>
    candidate === word || (word.length >= 2 && candidate.startsWith(word));
  const hitsIn = (phrases: ReadonlyArray<string>) => {
    const words = phrases.flatMap((phrase) => normalizeMovementPhrase(phrase).split(" "));
    return new Set(wanted.filter((word) => words.some((candidate) => fits(candidate, word)))).size;
  };
  const scored = family.map((movement): VariationOption => {
    const nameWords = normalizeMovementPhrase(movement.name).split(" ");
    const matched = new Set(
      nameWords.filter((candidate) => wanted.some((word) => fits(candidate, word))),
    );
    const score = hitsIn([movement.name, ...movement.aliases]);
    const byName = hitsIn([movement.name]);
    const via =
      score > byName
        ? movement.aliases.toSorted((left, right) => hitsIn([right]) - hitsIn([left]))[0]
        : undefined;
    return { movement, matched, score, ...(via === undefined ? {} : { via }) };
  });
  const options = scored.toSorted(
    (left, right) =>
      right.score - left.score || left.movement.name.localeCompare(right.movement.name),
  );
  return { core, options };
};
