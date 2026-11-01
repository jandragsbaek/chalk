import {
  describeBlock,
  partLabel,
  type DerivedSession,
  type PartMatch,
  type PartRef,
  type PlanSimilarity,
  type SimilarParts,
} from "@chalk/contracts";

/** A match with the part it names. */
export interface Echo {
  readonly match: PartMatch;
  readonly other: PartRef;
}

/** One part of a session, or of a plan, and what it echoes. */
export interface PartEchoGroup {
  readonly key: string;
  /** "Workout #2 · AMRAP 15 min". */
  readonly label: string;
  /** The day the part was done, or is planned for: other sessions read as then or later. */
  readonly performedOn: string;
  /** The saved part, with its own result; absent for a planned part. */
  readonly part: PartRef | undefined;
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
  for (const echo of similar.echoes) {
    const part = refs.get(echo.part);
    if (part === undefined) continue;
    const entry: PartEchoGroup = {
      key: part.id,
      label: partLabel(part),
      performedOn: part.performedOn,
      part,
      echoes: echoesOf(echo.matches, refs),
      total: echo.total,
    };
    const list = byWorkout.get(part.workoutId);
    if (list) list.push(entry);
    else byWorkout.set(part.workoutId, [entry]);
    const earlier = echo.earlierRepeat === null ? undefined : refs.get(echo.earlierRepeat);
    const latest = earlierByWorkout.get(part.workoutId);
    if (earlier && (latest === undefined || earlier.performedOn > latest.performedOn))
      earlierByWorkout.set(part.workoutId, earlier);
  }
  for (const list of byWorkout.values())
    list.sort((left, right) => (left.part?.position ?? 0) - (right.part?.position ?? 0));

  return {
    ofWorkout: (workoutId) => byWorkout.get(workoutId) ?? [],
    repeatsEarlier: (workoutId) => earlierByWorkout.get(workoutId),
  };
}

const echoesOf = (
  matches: ReadonlyArray<PartMatch>,
  refs: ReadonlyMap<string, PartRef>,
): ReadonlyArray<Echo> =>
  matches.flatMap((match) => {
    const other = refs.get(match.other);
    return other === undefined ? [] : [{ match, other }];
  });

/** A plan's parts with matches, in plan order, read from the day it is planned for. */
export function planEchoGroups(
  similar: PlanSimilarity,
  session: DerivedSession,
  plannedOn: string,
): ReadonlyArray<PartEchoGroup> {
  const refs = new Map(similar.parts.map((part) => [part.id, part]));
  return similar.echoes
    .toSorted((left, right) => left.position - right.position)
    .flatMap((echo) => {
      const part = session.parts[echo.position];
      if (part === undefined) return [];
      const headline = part.blocks.find(
        (block) => block.format !== undefined && block.format !== "rest",
      );
      return [
        {
          key: `plan:${echo.position}`,
          label:
            headline === undefined
              ? part.title
              : `${part.title} · ${describeBlock(headline.format, headline.params)}`,
          performedOn: plannedOn,
          part: undefined,
          echoes: echoesOf(echo.matches, refs),
          total: echo.total,
        },
      ];
    });
}
