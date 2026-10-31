import * as Schema from "effect/Schema";

/**
 * The athlete's debrief of a session: what they would tell a coach afterwards. It is entered by
 * hand, not read from the text, and every field is optional; a coach reads what is there.
 * Scales are 1-based integers, so "not answered" is always the absent key, never a zero.
 */

const scale = (maximum: number) => Schema.Int.check(Schema.isBetween({ minimum: 1, maximum }));
const text = (maximum: number) => Schema.String.check(Schema.isMaxLength(maximum));

/** How the session went as a whole: 1 awful, 2 rough, 3 ok, 4 good, 5 great. */
export const Feel = scale(5);
export type Feel = typeof Feel.Type;

/**
 * Session RPE (Foster): how hard the whole session was, 1 very easy to 10 maximal. Times the
 * minutes it gives the session load.
 */
export const SessionRpe = scale(10);
export type SessionRpe = typeof SessionRpe.Type;

/**
 * How hard the athlete could push today: 1 empty, 2 low, 3 normal, 4 high, 5 peak. Read with
 * the RPE: effort under capacity was a choice, capacity under normal was the body.
 */
export const Capacity = scale(5);
export type Capacity = typeof Capacity.Type;

/**
 * What stopped the athlete going faster or heavier. `pain` is a flag: a coach says to see a
 * professional and gives no medical advice. `none` means nothing did (time cap, or the plan).
 */
export const Limiter = Schema.Literals([
  "engine",
  "muscular",
  "strength",
  "skill",
  "grip",
  "mobility",
  "pacing",
  "energy",
  "mind",
  "pain",
  "none",
]);
export type Limiter = typeof Limiter.Type;

export const Debrief = Schema.Struct({
  /** The headline result in the athlete's words: "12+5 rounds", "150 kg single, PR". */
  result: Schema.optionalKey(text(120)),
  feel: Schema.optionalKey(Feel),
  effort: Schema.optionalKey(SessionRpe),
  capacity: Schema.optionalKey(Capacity),
  /** Training minutes, warm-up included; with `effort` it gives the session load. */
  minutes: Schema.optionalKey(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 600 }))),
  limiters: Schema.optionalKey(Schema.Array(Limiter)),
  /** Where and how it hurt, when `pain` is a limiter. */
  pain: Schema.optionalKey(text(200)),
  /** What the athlete would change next time: "Start the rows slower". */
  nextTime: Schema.optionalKey(text(300)),
  /** Anything else for the coach. */
  notes: Schema.optionalKey(text(4000)),
}).annotate({ identifier: "Debrief" });
export type Debrief = typeof Debrief.Type;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * Trims the text fields and drops empty ones, keeps limiters in their listed order, drops `none`
 * when another limiter is set and `pain` text without a `pain` limiter.
 */
export const normalizeDebrief = (debrief: Debrief): Debrief => {
  const next: Mutable<Debrief> = {};
  const trimmed = (value: string | undefined) => {
    const result = value?.trim();
    return result === undefined || result === "" ? undefined : result;
  };
  const result = trimmed(debrief.result);
  if (result !== undefined) next.result = result;
  if (debrief.feel !== undefined) next.feel = debrief.feel;
  if (debrief.effort !== undefined) next.effort = debrief.effort;
  if (debrief.capacity !== undefined) next.capacity = debrief.capacity;
  if (debrief.minutes !== undefined) next.minutes = debrief.minutes;
  const chosen = new Set(debrief.limiters ?? []);
  if (chosen.size > 1) chosen.delete("none");
  const limiters = Limiter.literals.filter((limiter) => chosen.has(limiter));
  if (limiters.length > 0) next.limiters = limiters;
  const pain = trimmed(debrief.pain);
  if (pain !== undefined && chosen.has("pain")) next.pain = pain;
  const nextTime = trimmed(debrief.nextTime);
  if (nextTime !== undefined) next.nextTime = nextTime;
  const notes = trimmed(debrief.notes);
  if (notes !== undefined) next.notes = notes;
  return next;
};

export const isEmptyDebrief = (debrief: Debrief | undefined) =>
  debrief === undefined || Object.keys(normalizeDebrief(debrief)).length === 0;

/** Session RPE times minutes (arbitrary units); undefined unless both are known. */
export const sessionLoad = (debrief: Debrief): number | undefined =>
  debrief.effort === undefined || debrief.minutes === undefined
    ? undefined
    : debrief.effort * debrief.minutes;

export const FEEL_LABELS: Readonly<Record<number, string>> = {
  1: "Awful",
  2: "Rough",
  3: "OK",
  4: "Good",
  5: "Great",
};

export const CAPACITY_LABELS: Readonly<Record<number, string>> = {
  1: "Empty",
  2: "Low",
  3: "Normal",
  4: "High",
  5: "Peak",
};

/** Foster's CR-10 wording for session RPE. */
export const EFFORT_LABELS: Readonly<Record<number, string>> = {
  1: "Very easy",
  2: "Easy",
  3: "Moderate",
  4: "Somewhat hard",
  5: "Hard",
  6: "Hard",
  7: "Very hard",
  8: "Very hard",
  9: "Near max",
  10: "Maximal",
};

/** The wording of a scale answer; the number itself for one outside the scale. */
export const scaleLabel = (labels: Readonly<Record<number, string>>, value: number) =>
  labels[value] ?? String(value);

export const LIMITER_LABELS: Record<Limiter, { readonly label: string; readonly hint: string }> = {
  engine: { label: "Engine", hint: "Lungs, heart rate" },
  muscular: { label: "Muscle endurance", hint: "Local burn" },
  strength: { label: "Strength", hint: "Heavy load" },
  skill: { label: "Skill", hint: "Technique broke" },
  grip: { label: "Grip", hint: "Forearms, hands" },
  mobility: { label: "Mobility", hint: "Positions" },
  pacing: { label: "Pacing", hint: "Too hot or too slow" },
  energy: { label: "Energy", hint: "Sleep, food, stress" },
  mind: { label: "Head", hint: "Focus, motivation" },
  pain: { label: "Pain", hint: "Something hurt" },
  none: { label: "Nothing", hint: "Plan or time cap" },
};

/** Ends typed text with a full stop unless it already ends a sentence. */
const closed = (line: string) => (/[.!?]$/.test(line) ? line : `${line}.`);

const sentence = (parts: ReadonlyArray<string | undefined>) => {
  const kept = parts.filter((part): part is string => part !== undefined);
  return kept.length === 0 ? undefined : `${kept.join(", ")}.`;
};

/**
 * The debrief as a few plain sentences, the way a coach reads it: "Felt good; could push
 * normally. Session RPE 8 (very hard) over 60 min, load 480. ..." Empty for an empty debrief.
 */
export const describeDebrief = (input: Debrief): ReadonlyArray<string> => {
  const debrief = normalizeDebrief(input);
  const load = sessionLoad(debrief);
  const limiters = (debrief.limiters ?? []).filter((limiter) => limiter !== "none");
  return [
    debrief.result === undefined ? undefined : closed(`Result ${debrief.result}`),
    sentence([
      debrief.feel === undefined
        ? undefined
        : `Felt ${scaleLabel(FEEL_LABELS, debrief.feel).toLowerCase()}`,
      debrief.capacity === undefined
        ? undefined
        : `capacity ${scaleLabel(CAPACITY_LABELS, debrief.capacity).toLowerCase()}`,
    ]),
    sentence([
      debrief.effort === undefined
        ? undefined
        : `Session RPE ${debrief.effort} (${scaleLabel(EFFORT_LABELS, debrief.effort).toLowerCase()})`,
      debrief.minutes === undefined ? undefined : `${debrief.minutes} min`,
      load === undefined ? undefined : `load ${load}`,
    ]),
    debrief.limiters?.includes("none") === true
      ? "Nothing limited."
      : limiters.length === 0
        ? undefined
        : `Limited by ${limiters.map((limiter) => LIMITER_LABELS[limiter].label.toLowerCase()).join(", ")}.`,
    debrief.pain === undefined ? undefined : closed(`Pain: ${debrief.pain}`),
    debrief.nextTime === undefined ? undefined : closed(`Next time: ${debrief.nextTime}`),
  ].filter((line): line is string => line !== undefined);
};
