import type { MovementId } from "../baseSchemas.ts";

/** What the matcher needs from the catalog: a name plus any aliases per movement. */
export interface MatchableMovement {
  readonly id: MovementId;
  readonly name: string;
  readonly aliases: ReadonlyArray<string>;
}

export interface Token {
  readonly text: string;
  readonly key: string;
  readonly start: number;
  readonly end: number;
}

const TOKEN = /[\p{L}\p{N}]+/gu;

/**
 * "Pull-ups" and "pull up" are one key; a trailing plural "s" is dropped ("DUs", "squats"), and
 * the "es" after a hissing end ("snatches", "presses", "boxes").
 */
export const normalizeToken = (token: string): string => {
  const lower = token.toLowerCase();
  if (lower.length >= 5 && /(?:ch|sh|ss|x|z)es$/.test(lower)) return lower.slice(0, -2);
  return lower.length >= 3 && lower.endsWith("s") && !lower.endsWith("ss")
    ? lower.slice(0, -1)
    : lower;
};

export const tokenize = (text: string, offset = 0): ReadonlyArray<Token> =>
  Array.from(text.matchAll(TOKEN), (match) => ({
    text: match[0],
    key: normalizeToken(match[0]),
    start: offset + match.index,
    end: offset + match.index + match[0].length,
  }));

/** Comparable form of a movement phrase; aliases are unique on this key. */
export const normalizeMovementPhrase = (phrase: string): string =>
  tokenize(phrase)
    .map((token) => token.key)
    .join(" ");

export interface MovementMatch {
  readonly movementId: MovementId;
  readonly start: number;
  readonly end: number;
}

export interface MovementMatcher {
  /** Longest catalog phrases first, left to right, never overlapping. */
  readonly find: (text: string, offset?: number) => ReadonlyArray<MovementMatch>;
  /** Exact phrase lookup, for prefilling a picker from highlighted text. */
  readonly lookup: (phrase: string) => MovementId | undefined;
}

export const makeMovementMatcher = (
  movements: ReadonlyArray<MatchableMovement>,
): MovementMatcher => {
  const byKey = new Map<string, MovementId>();
  // Names win over aliases when both claim a phrase.
  for (const movement of movements)
    for (const alias of movement.aliases) {
      const key = normalizeMovementPhrase(alias);
      if (key !== "" && !byKey.has(key)) byKey.set(key, movement.id);
    }
  for (const movement of movements) byKey.set(normalizeMovementPhrase(movement.name), movement.id);

  const longest = Math.max(1, ...Array.from(byKey.keys(), (key) => key.split(" ").length));

  const find = (text: string, offset = 0) => {
    const tokens = tokenize(text, offset);
    const matches: Array<MovementMatch> = [];
    let index = 0;
    while (index < tokens.length) {
      let matched = false;
      for (let length = Math.min(longest, tokens.length - index); length > 0; length--) {
        const window = tokens.slice(index, index + length);
        const movementId = byKey.get(window.map((token) => token.key).join(" "));
        if (movementId === undefined || /^\d+$/.test(window[0]!.key)) continue;
        matches.push({ movementId, start: window[0]!.start, end: window[length - 1]!.end });
        index += length;
        matched = true;
        break;
      }
      if (!matched) index++;
    }
    return matches;
  };

  return { find, lookup: (phrase) => byKey.get(normalizeMovementPhrase(phrase)) };
};
