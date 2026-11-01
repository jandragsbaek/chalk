import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString } from "./baseSchemas.ts";

/**
 * Where a session was trained: the athlete's own box, at home, or away at another box (named).
 * Everything logged before places existed was at the box.
 */
export const Place = Schema.TaggedUnion({
  box: {},
  home: {},
  away: { name: TrimmedNonEmptyString },
});
export type Place = typeof Place.Type;

export const THE_BOX: Place = { _tag: "box" };

/** What the athlete types for the box and for home, and what lists show for them. */
export const BOX_LABEL = "The box";
export const HOME_LABEL = "Home";

/** "The box", "Home" or the other box's name. */
export const describePlace = (place: Place): string =>
  place._tag === "box" ? BOX_LABEL : place._tag === "home" ? HOME_LABEL : place.name;

/** For a line about the session: "at the box", "at home", "at CrossFit Nordvest". */
export const placePhrase = (place: Place): string =>
  place._tag === "box" ? "at the box" : place._tag === "home" ? "at home" : `at ${place.name}`;

/**
 * Typed text as a place: blank or "The box" (or "box") is the box, "Home" is home, anything else
 * another box by that name. Case and spacing do not matter.
 */
export const parsePlace = (text: string): Place => {
  const name = text.trim().replace(/\s+/g, " ");
  const key = name.toLowerCase();
  if (key === "" || key === "box" || key === BOX_LABEL.toLowerCase()) return THE_BOX;
  if (key === HOME_LABEL.toLowerCase()) return { _tag: "home" };
  return { _tag: "away", name };
};

/** Two places are the same place: another box by its name, ignoring case. */
export const placeKey = (place: Place): string =>
  place._tag === "away" ? `away:${place.name.toLowerCase()}` : place._tag;

/** A training session as numbering reads it. */
export interface PlacedSession {
  /** The register's key: a workout id, or `day-2026-10-29` for a strength day. */
  readonly key: string;
  readonly performedOn: string;
  /** Orders sessions within a day. */
  readonly createdAt: string;
  readonly place: Place;
}

/**
 * Each session's number at its place, counted in Chalk's log: the first session at the box is 1,
 * the 179th is 179; home and every other box count from 1 on their own. Sessions count in the
 * order they were trained, and in the order they were logged within a day.
 */
export function numberSessions(sessions: Iterable<PlacedSession>): ReadonlyMap<string, number> {
  const ordered = [...sessions].sort(
    (left, right) =>
      left.performedOn.localeCompare(right.performedOn) ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.key.localeCompare(right.key),
  );
  const counts = new Map<string, number>();
  const numbers = new Map<string, number>();
  for (const session of ordered) {
    const place = placeKey(session.place);
    const next = (counts.get(place) ?? 0) + 1;
    counts.set(place, next);
    numbers.set(session.key, next);
  }
  return numbers;
}

/** The register's key for a day of lift sets logged without a workout. */
export const strengthDayKey = (performedOn: string): string => `day-${performedOn}`;

/**
 * Every training session, as the register counts them: each workout, and each day of lift sets
 * logged by hand with no workout that day, at the place of its first set.
 */
export function placedSessions(
  workouts: ReadonlyArray<{
    readonly id: string;
    readonly performedOn: string;
    readonly createdAt: string;
    readonly place: Place;
  }>,
  liftSets: ReadonlyArray<{
    readonly performedOn: string;
    readonly createdAt: string;
    readonly place: Place;
  }>,
): ReadonlyArray<PlacedSession> {
  const workoutDays = new Set(workouts.map((workout) => workout.performedOn));
  const firstSet = new Map<string, { readonly createdAt: string; readonly place: Place }>();
  for (const set of liftSets) {
    if (workoutDays.has(set.performedOn)) continue;
    const first = firstSet.get(set.performedOn);
    if (first === undefined || set.createdAt < first.createdAt) firstSet.set(set.performedOn, set);
  }
  return [
    ...workouts.map(({ id, performedOn, createdAt, place }) => ({
      key: id,
      performedOn,
      createdAt,
      place,
    })),
    ...[...firstSet].map(([performedOn, { createdAt, place }]) => ({
      key: strengthDayKey(performedOn),
      performedOn,
      createdAt,
      place,
    })),
  ];
}
