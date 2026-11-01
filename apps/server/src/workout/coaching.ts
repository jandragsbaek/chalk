import type { Coaching } from "@chalk/contracts";

/** A session's coaching as its `workouts` columns: a coach's name, or `solo` for alone. */
export const coachingColumns = (
  coaching: Coaching | undefined,
): { readonly coach: string | null; readonly solo: 0 | 1 } => ({
  coach: coaching?._tag === "coached" ? coaching.coach : null,
  solo: coaching?._tag === "solo" ? 1 : 0,
});

/** The columns back; neither set is not recorded. */
export const coachingOf = (row: {
  readonly coach: string | null;
  readonly solo: number;
}): Coaching | undefined =>
  row.coach !== null && row.coach.trim() !== ""
    ? { _tag: "coached", coach: row.coach }
    : row.solo === 1
      ? { _tag: "solo" }
      : undefined;
