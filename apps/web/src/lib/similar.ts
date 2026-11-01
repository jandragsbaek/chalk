import type { PartEchoes, PartMatch, PartRef, SimilarParts } from "@chalk/contracts";

/** A match with the part it names. */
export interface Echo {
  readonly match: PartMatch;
  readonly other: PartRef;
}

/** One part of a session and what it echoes. */
export interface PartEchoGroup {
  readonly part: PartRef;
  readonly echoes: ReadonlyArray<Echo>;
  /** Every match, shown or not. */
  readonly total: number;
}

export interface SimilarIndex {
  /** The session's parts with matches, in session order. */
  readonly ofWorkout: (workoutId: string) => ReadonlyArray<PartEchoGroup>;
  /** The latest earlier session one of this session's parts repeats. */
  readonly repeatsEarlier: (workoutId: string) => PartRef | undefined;
}

export function indexSimilar(similar: SimilarParts): SimilarIndex {
  const refs = new Map(similar.parts.map((part) => [part.id, part]));
  const byWorkout = new Map<string, Array<PartEchoGroup>>();
  const earlierByWorkout = new Map<string, PartRef>();
  const group = (echo: PartEchoes): PartEchoGroup | undefined => {
    const part = refs.get(echo.part);
    if (part === undefined) return undefined;
    const echoes = echo.matches.flatMap((match) => {
      const other = refs.get(match.other);
      return other === undefined ? [] : [{ match, other }];
    });
    return { part, echoes, total: echo.total };
  };
  for (const echo of similar.echoes) {
    const entry = group(echo);
    if (entry === undefined) continue;
    const list = byWorkout.get(entry.part.workoutId);
    if (list) list.push(entry);
    else byWorkout.set(entry.part.workoutId, [entry]);
    const earlier = echo.earlierRepeat === null ? undefined : refs.get(echo.earlierRepeat);
    const latest = earlierByWorkout.get(entry.part.workoutId);
    if (earlier && (latest === undefined || earlier.performedOn > latest.performedOn))
      earlierByWorkout.set(entry.part.workoutId, earlier);
  }
  for (const list of byWorkout.values())
    list.sort((left, right) => left.part.position - right.part.position);

  return {
    ofWorkout: (workoutId) => byWorkout.get(workoutId) ?? [],
    repeatsEarlier: (workoutId) => earlierByWorkout.get(workoutId),
  };
}
