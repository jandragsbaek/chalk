import {
  numberSessions,
  placedSessions,
  placeKey,
  type LiftSet,
  type Place,
  type SessionEntry,
  type Workout,
} from "@chalk/contracts";

/** Where a register entry was trained. */
export const entryPlace = (entry: SessionEntry): Place =>
  entry._tag === "workout" ? entry.workout.place : entry.place;

/** The place as a register stub prints it under the number: "Box", "Home", "Away". */
export const placeCode = (place: Place): string =>
  place._tag === "box" ? "Box" : place._tag === "home" ? "Home" : "Away";

/** Other boxes trained at, most recent first; what the place field offers after the box and home. */
export function knownPlaces(entries: ReadonlyArray<SessionEntry>): ReadonlyArray<string> {
  const seen = new Map<string, string>();
  for (const entry of entries) {
    const place = entryPlace(entry);
    if (place._tag === "away" && !seen.has(placeKey(place))) seen.set(placeKey(place), place.name);
  }
  return [...seen.values()];
}

/**
 * Each session's number at its place, by the register's key (a workout id, or `day-2026-10-29`),
 * from what the front page has: workouts and lift sets.
 */
export const sessionNumbers = (
  workouts: ReadonlyArray<Workout>,
  liftSets: ReadonlyArray<LiftSet>,
): ReadonlyMap<string, number> => numberSessions(placedSessions(workouts, liftSets));

/** The front page's count of sessions by place. */
export interface PlaceTally {
  readonly box: number;
  readonly home: number;
  readonly away: number;
  /** Other boxes trained at. */
  readonly awayPlaces: number;
  /** The first session in the log; undefined before there is one. */
  readonly since: string | undefined;
}

export function placeTally(
  workouts: ReadonlyArray<Workout>,
  liftSets: ReadonlyArray<LiftSet>,
): PlaceTally {
  const sessions = placedSessions(workouts, liftSets);
  const awayPlaces = new Set<string>();
  let box = 0;
  let home = 0;
  let away = 0;
  let since: string | undefined;
  for (const session of sessions) {
    if (since === undefined || session.performedOn < since) since = session.performedOn;
    if (session.place._tag === "box") box++;
    else if (session.place._tag === "home") home++;
    else {
      away++;
      awayPlaces.add(placeKey(session.place));
    }
  }
  return { box, home, away, awayPlaces: awayPlaces.size, since };
}

/** The next round number a count reaches: 10, 25, 50, 100, then every 50. */
export function nextMilestone(count: number): number {
  for (const step of [10, 25, 50, 100]) if (count < step) return step;
  return (Math.floor(count / 50) + 1) * 50;
}
