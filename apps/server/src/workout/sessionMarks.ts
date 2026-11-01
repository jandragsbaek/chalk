import { ClassType, type SessionMarks } from "@chalk/contracts";
import * as Schema from "effect/Schema";

const isClassType = Schema.is(ClassType);

/**
 * A session's marks as its `workouts` columns: a coach's name, `solo` for alone, and the class
 * it was. Solo wins over a class, as `sessionTypeOf` reads it.
 */
export const sessionColumns = (
  session: SessionMarks,
): {
  readonly coach: string | null;
  readonly solo: 0 | 1;
  readonly classType: ClassType | null;
} => ({
  coach: session.coaching?._tag === "coached" ? session.coaching.coach : null,
  solo: session.coaching?._tag === "solo" ? 1 : 0,
  classType: session.coaching?._tag === "solo" ? null : (session.classType ?? null),
});

/** The columns back; none set is not recorded. */
export const sessionMarksOf = (row: {
  readonly coach: string | null;
  readonly solo: number;
  readonly classType: string | null;
}): SessionMarks => {
  const coaching =
    row.coach !== null && row.coach.trim() !== ""
      ? ({ _tag: "coached", coach: row.coach } as const)
      : row.solo === 1
        ? ({ _tag: "solo" } as const)
        : undefined;
  return {
    ...(coaching === undefined ? {} : { coaching }),
    ...(coaching?._tag !== "solo" && isClassType(row.classType)
      ? { classType: row.classType }
      : {}),
  };
};
