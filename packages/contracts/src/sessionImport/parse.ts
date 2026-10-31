import type { Amount, BlockFormat, BlockParams, Measure, Quantity } from "../sessionImport.ts";

/** Low-level text recognizers shared by the suggester and the editor's "tag selection" actions. */

export interface Line {
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

export const splitLines = (text: string): ReadonlyArray<Line> => {
  const lines: Array<Line> = [];
  let start = 0;
  for (const [index, raw] of text.split("\n").entries()) {
    lines.push({ index, start, end: start + raw.length, text: raw });
    start += raw.length + 1;
  }
  return lines;
};

export const lineIndexAt = (lines: ReadonlyArray<Line>, offset: number): number => {
  let low = 0;
  let high = lines.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (lines[mid]!.start <= offset) low = mid;
    else high = mid - 1;
  }
  return low;
};

/** Parenthesized asides ("(heavy)", "(4 af hver)") hold no prescription; blank them, keep offsets. */
export const maskParentheses = (text: string): string =>
  text.replace(/\([^)]*\)?/g, (aside) => " ".repeat(aside.length));

const toNumber = (raw: string) => Number(raw.replace(",", "."));

const LB_TO_KG = 0.45359237;
const roundKg = (kg: number) => Math.round(kg * 4) / 4;

/** "8-10" → 8..10, "18-15" → 15..18, "21-15-9" → a scheme summing to 45. */
const parseRange = (raw: string): { amount: Amount; scheme?: ReadonlyArray<number> } => {
  const numbers = raw.split(/\s*-\s*/).map(toNumber);
  if (numbers.length > 2) {
    const total = numbers.reduce((sum, value) => sum + value, 0);
    return { amount: { min: total, max: total }, scheme: numbers };
  }
  const [first = 0, second = first] = numbers;
  return { amount: { min: Math.min(first, second), max: Math.max(first, second) } };
};

const scale = (amount: Amount, factor: number, round: (value: number) => number) => ({
  min: round(amount.min * factor),
  max: round(amount.max * factor),
});

export interface QuantityMatch {
  readonly start: number;
  readonly end: number;
  readonly quantity: Quantity;
}

const N = String.raw`\d+(?:[.,]\d+)?`;
const R = String.raw`${N}(?:\s*-\s*${N})*`;

interface Recognizer {
  readonly pattern: RegExp;
  readonly read: (match: RegExpExecArray, text: string) => ReadonlyArray<QuantityMatch> | undefined;
}

const quantityOf = (
  measure: Measure,
  raw: string,
  femaleRaw?: string,
  factor = 1,
  round: (value: number) => number = (value) => value,
): Quantity => {
  const { amount, scheme } = parseRange(raw);
  const female = femaleRaw === undefined ? undefined : parseRange(femaleRaw).amount;
  return {
    measure,
    amount: scale(amount, factor, round),
    ...(female === undefined ? {} : { female: scale(female, factor, round) }),
    ...(scheme === undefined ? {} : { scheme }),
  };
};

const whole = (match: RegExpExecArray, quantity: Quantity): ReadonlyArray<QuantityMatch> => [
  { start: match.index, end: match.index + match[0].length, quantity },
];

const timeFactor = (unit: string) => (/^m/i.test(unit) ? 60 : 1);

const RECOGNIZERS: ReadonlyArray<Recognizer> = [
  {
    // "@RPE 8", "RPE 7-8", "@8 RPE". Before the loads, so "@8" is not read as 8 kg.
    pattern: new RegExp(
      String.raw`(?:@\s*)?(?:(?<!\p{L})RPE\s*:?\s*(${R})|(${R})\s*RPE)(?!\p{L})`,
      "giu",
    ),
    read: (match) => whole(match, quantityOf("rpe", (match[1] ?? match[2])!)),
  },
  {
    // "5x5", "3 x 8-10": sets then reps, unless the second number carries a unit.
    pattern: new RegExp(
      String.raw`(?<![\p{L}\d])(\d+)\s*[x×]\s*(${R})(?![\d.,]|\s*(?:kg|lbs?|%|sec|s\b|min|m\b|cal))`,
      "giu",
    ),
    read: (match) => {
      const sets = match[1]!;
      const setsEnd = match.index + match[0].indexOf(sets) + sets.length;
      const repsStart = match.index + match[0].lastIndexOf(match[2]!);
      return [
        { start: match.index, end: setsEnd, quantity: quantityOf("sets", sets) },
        {
          start: repsStart,
          end: match.index + match[0].length,
          quantity: quantityOf("reps", match[2]!),
        },
      ];
    },
  },
  {
    // "@75%", "@70-80%", and the typo "@ 92-95@".
    pattern: new RegExp(
      String.raw`(?:@\s*(${R})\s*[%@]|(${R})\s*%)(?:\s*(?:of|af)\s*(?:(?:din|your)\s*)?1\s*RM)?`,
      "giu",
    ),
    read: (match) => whole(match, quantityOf("percent_1rm", (match[1] ?? match[2])!)),
  },
  {
    // "@40/25", "@60/40 kg", "@95/65 lb": male/female loads.
    pattern: new RegExp(String.raw`@\s*(${R})\s*\/\s*(${R})\s*(kg|kilo|lbs?)?(?!\p{L})`, "giu"),
    read: (match) => {
      const pounds = /^lb/i.test(match[3] ?? "");
      return whole(
        match,
        quantityOf(
          "load_kg",
          match[1]!,
          match[2],
          pounds ? LB_TO_KG : 1,
          pounds ? roundKg : undefined,
        ),
      );
    },
  },
  {
    pattern: new RegExp(String.raw`(${R})(?:\s*\/\s*(${R}))?\s*(kg|kilo|lbs?)(?!\p{L})`, "giu"),
    read: (match) => {
      const pounds = /^lb/i.test(match[3]!);
      return whole(
        match,
        quantityOf(
          "load_kg",
          match[1]!,
          match[2],
          pounds ? LB_TO_KG : 1,
          pounds ? roundKg : undefined,
        ),
      );
    },
  },
  {
    // A bare "@60" is a load in kg.
    pattern: new RegExp(String.raw`@\s*(${R})(?![\d.,%@\/]|\s*(?:\/|kg|lb))`, "gu"),
    read: (match) => whole(match, quantityOf("load_kg", match[1]!)),
  },
  {
    pattern: new RegExp(
      String.raw`(${R})(?:\s*\/\s*(${R}))?\s*(?:kcal|cal(?:orie)?s?)(?!\p{L})`,
      "giu",
    ),
    read: (match) => whole(match, quantityOf("calories", match[1]!, match[2])),
  },
  {
    pattern: new RegExp(
      String.raw`(${R})(?:\s*\/\s*(${R}))?\s*(km|m|meters?|metres?)(?!\p{L})`,
      "giu",
    ),
    read: (match) =>
      whole(
        match,
        quantityOf("distance_m", match[1]!, match[2], match[3]!.toLowerCase() === "km" ? 1000 : 1),
      ),
  },
  {
    // Durations of work. Caps ("max 50 sec") and rests describe the block, not the movement.
    pattern: new RegExp(String.raw`(${R})\s*(sec(?:ond)?s?|s|min(?:ute)?s?)(?!\p{L})`, "giu"),
    read: (match, text) => {
      if (/\b(?:max|cap|rest|pause)\s*$/i.test(text.slice(0, match.index))) return [];
      return whole(match, quantityOf("seconds", match[1]!, undefined, timeFactor(match[2]!)));
    },
  },
  {
    pattern: /(?<![\p{L}\d])(\d+)\s*RM(?!\p{L})/giu,
    read: (match) => whole(match, quantityOf("reps", match[1]!)),
  },
  {
    pattern: new RegExp(String.raw`(${R})\s*reps?(?!\p{L})`, "giu"),
    read: (match) => whole(match, quantityOf("reps", match[1]!)),
  },
  {
    // "150 kg x 3": reps after a load.
    pattern: /(?<![\p{L}\d])[x×]\s*(\d+)(?![\d.,]|\s*(?:kg|lbs?|%))/giu,
    read: (match) => whole(match, quantityOf("reps", match[1]!)),
  },
];

/** Plain counts ("12 Thrusters", "12/10", "21-15-9"); only trusted on a line with a movement. */
const BARE = new RegExp(
  String.raw`(?<![\p{L}\d.,'’\/])(${R})(?:\s*\/\s*(${R}))?(?![\p{L}\d'’.,]|\s*[x×]|\s*\/)`,
  "gu",
);

const bareRecognizer: Recognizer = {
  pattern: BARE,
  read: (match) => whole(match, quantityOf("reps", match[1]!, match[2])),
};

const overlaps = (taken: ReadonlyArray<readonly [number, number]>, start: number, end: number) =>
  taken.some(([from, to]) => start < to && end > from);

export interface ParseQuantitiesOptions {
  /** Count bare numbers as reps. */
  readonly bareReps: boolean;
}

/** Every recognizable quantity in `text`, in text order; offsets are shifted by `offset`. */
export const parseQuantities = (
  text: string,
  offset: number,
  options: ParseQuantitiesOptions,
): ReadonlyArray<QuantityMatch> => {
  const found: Array<QuantityMatch> = [];
  const taken: Array<readonly [number, number]> = [];
  const take = (matches: ReadonlyArray<QuantityMatch>) => {
    for (const match of matches) {
      found.push(match);
      taken.push([match.start, match.end]);
    }
  };
  for (const recognizer of [...RECOGNIZERS, ...(options.bareReps ? [bareRecognizer] : [])]) {
    recognizer.pattern.lastIndex = 0;
    for (const match of text.matchAll(recognizer.pattern)) {
      const start = match.index;
      if (overlaps(taken, start, start + match[0].length)) continue;
      const read = recognizer.read(match as RegExpExecArray, text);
      if (read && read.length > 0) take(read);
    }
  }
  return found
    .map((match) => ({ ...match, start: match.start + offset, end: match.end + offset }))
    .sort((left, right) => left.start - right.start);
};

export interface BlockMatch {
  readonly format: BlockFormat;
  readonly params: BlockParams;
  /** Characters of the line the format phrase covers, from the start. */
  readonly length: number;
}

interface FormatRule {
  readonly pattern: RegExp;
  readonly read: (match: RegExpMatchArray) => Omit<BlockMatch, "length">;
}

const rounds = (from: string | undefined, to?: string): BlockParams =>
  from === undefined
    ? {}
    : { rounds: parseRange(to === undefined ? from : `${from}-${to}`).amount };

const FORMAT_RULES: ReadonlyArray<FormatRule> = [
  {
    pattern: new RegExp(String.raw`^amrap\s*:?\s*(${N})\s*(?:min(?:utes?)?|')?`, "i"),
    read: (match) => ({ format: "amrap", params: { durationSeconds: toNumber(match[1]!) * 60 } }),
  },
  {
    pattern: new RegExp(String.raw`^(${N})\s*(?:min(?:utes?)?|')\s*amrap`, "i"),
    read: (match) => ({ format: "amrap", params: { durationSeconds: toNumber(match[1]!) * 60 } }),
  },
  {
    pattern: new RegExp(String.raw`^emom\s*:?\s*(${N})(?:\s*min(?:utes?)?)?`, "i"),
    read: (match) => ({
      format: "emom",
      params: { durationSeconds: toNumber(match[1]!) * 60, intervalSeconds: 60 },
    }),
  },
  {
    pattern: new RegExp(String.raw`^e(${N})mom(?:\s*(?:x\s*)?(\d+))?`, "i"),
    read: (match) => ({
      format: "every",
      params: { intervalSeconds: toNumber(match[1]!) * 60, ...rounds(match[2]) },
    }),
  },
  {
    pattern: new RegExp(
      String.raw`^every\s+(${N})\s*(sec(?:onds?)?|s|min(?:utes?)?|m)\b(?:\s*[x×]\s*(\d+)(?:\s*-\s*(\d+))?)?`,
      "i",
    ),
    read: (match) => ({
      format: "every",
      params: {
        intervalSeconds: toNumber(match[1]!) * timeFactor(match[2]!),
        ...rounds(match[3], match[4]),
      },
    }),
  },
  {
    // "40 sec på / 20 sec af x 9", "30 sec on/15 sec off x 8".
    pattern: new RegExp(
      String.raw`^(${N})\s*(?:sec|s)\s*(?:på|on)\s*\/?\s*(${N})\s*(?:sec|s)\s*(?:af|off)(?:\s*[x×]\s*(\d+)(?:\s*-\s*(\d+))?)?`,
      "i",
    ),
    read: (match) => ({
      format: "intervals",
      params: {
        workSeconds: toNumber(match[1]!),
        restSeconds: toNumber(match[2]!),
        ...rounds(match[3], match[4]),
      },
    }),
  },
  {
    pattern: /^tabata/i,
    read: () => ({
      format: "intervals",
      params: { workSeconds: 20, restSeconds: 10, rounds: { min: 8, max: 8 } },
    }),
  },
  {
    // "21-15-9", "21-15-9 for time".
    pattern: /^(\d+(?:\s*-\s*\d+){2,})(?:\s*(?:reps?|for time|rft))*\s*$/i,
    read: (match) => ({
      format: "for_time",
      params: { scheme: match[1]!.split(/\s*-\s*/).map(Number) },
    }),
  },
  {
    pattern: /^(\d+)\s*(?:rounds?|runder|rft)(?:\s*(for time|of))?/i,
    read: (match) => ({
      format: /rft|for time/i.test(match[0]) ? "for_time" : "other",
      params: rounds(match[1]),
    }),
  },
  { pattern: /^for time/i, read: () => ({ format: "for_time", params: {} }) },
  {
    pattern: /^(?:max[\s-]*out!?|find (?:a )?(?:heavy|max)\b|build to (?:a )?heavy\b)/i,
    read: () => ({ format: "strength", params: {} }),
  },
  {
    pattern: new RegExp(String.raw`^rest\s+(${N})\s*(sec(?:onds?)?|s|min(?:utes?)?|m)\.?\s*$`, "i"),
    read: (match) => ({
      format: "rest",
      params: { durationSeconds: toNumber(match[1]!) * timeFactor(match[2]!) },
    }),
  },
];

/** A format phrase at the start of `text` ("Amrap 15", "Every 90 sec x 8", "Max out!"). */
export const parseBlockFormat = (text: string): BlockMatch | undefined => {
  for (const rule of FORMAT_RULES) {
    const match = text.match(rule.pattern);
    if (match) return { ...rule.read(match), length: match[0].trimEnd().length };
  }
  return undefined;
};

/**
 * The quantity a highlighted phrase stands for, as `measure`. Uses the recognizers when they
 * agree on the measure, else reads the first number(s) of the phrase.
 */
export const quantityFromText = (text: string, measure: Measure): Quantity | undefined => {
  const recognized = parseQuantities(text, 0, { bareReps: true }).find(
    (match) => match.quantity.measure === measure,
  );
  if (recognized) return recognized.quantity;
  const numbers = text.match(new RegExp(`(${R})(?:\\s*\\/\\s*(${R}))?`, "u"));
  if (!numbers) return undefined;
  return quantityOf(measure, numbers[1]!, numbers[2]);
};

const SCORE = new RegExp(
  String.raw`(?:score|result|resultat|time|tid)\s*:?\s*(\d+:\d{2}|\d+\s*\+\s*\d+|\d+\s*(?:rounds?|runder|rds?)(?:\s*\+\s*\d+(?:\s*reps?)?)?)`,
  "i",
);

/** Offsets of a written score ("Score: 12+5", "Time 8:32") inside `text`, if any. */
export const findScore = (text: string): { start: number; end: number } | undefined => {
  const match = SCORE.exec(text);
  if (!match) return undefined;
  const start = match.index + match[0].lastIndexOf(match[1]!);
  return { start, end: start + match[1]!.length };
};

/** Words that are not a movement when left over on a line of numbers. */
const FILLER = new Set(["rep", "reps", "x", "each", "side", "hver", "pr", "per", "and", "og"]);

/** True when nothing but quantities and filler words remain once they are cut out. */
export const isQuantityOnly = (
  text: string,
  offset: number,
  quantities: ReadonlyArray<QuantityMatch>,
): boolean => {
  let rest = text;
  for (const quantity of quantities) {
    const from = quantity.start - offset;
    const to = quantity.end - offset;
    rest = rest.slice(0, from) + " ".repeat(to - from) + rest.slice(to);
  }
  const words = rest.match(/\p{L}+/gu) ?? [];
  return words.every((word) => FILLER.has(word.toLowerCase()));
};
