import {
  formatQuantity,
  type MovementId,
  type PartDifference,
  type PartEchoes,
  type PartMatch,
  type PartRef,
  type Quantity,
  type SimilarParts,
} from "@chalk/contracts";

import { describeBlock } from "./blockLabels.ts";

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
  }
  for (const list of byWorkout.values())
    list.sort((left, right) => left.part.position - right.part.position);

  return {
    ofWorkout: (workoutId) => byWorkout.get(workoutId) ?? [],
    repeatsEarlier: (workoutId) => {
      let latest: PartRef | undefined;
      for (const { part, echoes } of byWorkout.get(workoutId) ?? [])
        for (const { match, other } of echoes)
          if (
            match.kind === "repeat" &&
            other.performedOn < part.performedOn &&
            (latest === undefined || other.performedOn > latest.performedOn)
          )
            latest = other;
      return latest;
    },
  };
}

/** "AMRAP 15 min", or the part's title when no block has a format. */
export const partLabel = (part: PartRef): string =>
  part.headline === null || part.headline.format === null
    ? part.title
    : `${part.title} · ${describeBlock(part.headline.format, part.headline.params)}`;

const setsText = (sets: ReadonlyArray<ReadonlyArray<Quantity>>) =>
  sets.map((set) => set.map(formatQuantity).join(" ")).join(" · ") || "no numbers";

/**
 * One difference as a short line, read from the open session toward the other one: `when` is
 * "then" for an earlier session, "later" for a later one.
 */
export function describeDifference(
  difference: PartDifference,
  nameOf: (id: MovementId) => string,
  when: "then" | "later",
): string {
  switch (difference._tag) {
    case "format":
      return `${describeBlock(difference.there.format ?? undefined, difference.there.params)} ${when}`;
    case "swapped":
      return `${nameOf(difference.there)} ${when}, ${nameOf(difference.here).toLowerCase()} here`;
    case "extra":
      return `${nameOf(difference.movementId)} only here`;
    case "missing":
      return `${nameOf(difference.movementId)} only ${when}`;
    case "numbers":
      return `${nameOf(difference.movementId)} ${setsText(difference.there)} ${when}`;
  }
}
