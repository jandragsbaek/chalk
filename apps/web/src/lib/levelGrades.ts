import {
  divisionOf,
  gradeItem,
  type CatalogMovement,
  type DerivedItem,
  type DerivedSession,
  type Grade,
  type ItemGrade,
  type MovementId,
  type Sex,
  type SpanId,
} from "@chalk/contracts";

/** The heaviest set of an item's lift result, if it has one. */
export const liftedKgOf = (item: DerivedItem) =>
  item.performed.length === 0 ? undefined : Math.max(...item.performed.map((set) => set.loadKg));

/** Which side of an item `performed` grades: what was done, or what the athlete planned. */
export type GradedSide = "done" | "planned";

export const gradeDerivedItem = (
  item: DerivedItem,
  movements: ReadonlyMap<MovementId, CatalogMovement>,
  sex: Sex,
  side: GradedSide = "done",
): ItemGrade | undefined =>
  gradeItem(
    side === "done"
      ? {
          movementId: item.movementId,
          sets: item.sets,
          performance: item.performance,
          liftedKg: liftedKgOf(item),
        }
      : { movementId: item.movementId, sets: item.sets, performance: item.plan },
    movements,
    sex,
  );

export interface SessionGrades {
  readonly byItem: ReadonlyMap<SpanId, ItemGrade>;
  /** The level every programmed movement asked for at least, alternatives aside. */
  readonly programmed: ReturnType<typeof divisionOf>;
  /** The level every movement was done at least; a done alternative stands in for its item. */
  readonly performed: ReturnType<typeof divisionOf>;
  /** Graded movements still without a record of how they were done (or, planning, a plan). */
  readonly unrecorded: number;
}

/**
 * Every item of the session graded against the sheet, and the session's two divisions. While
 * planning, the `planned` side grades each item's plan in place of what was done.
 */
export function gradeSession(
  session: DerivedSession,
  catalog: ReadonlyArray<CatalogMovement>,
  sex: Sex,
  side: GradedSide = "done",
): SessionGrades {
  const movements = new Map(catalog.map((movement) => [movement.id, movement]));
  const byItem = new Map<SpanId, ItemGrade>();
  const visit = (item: DerivedItem) => {
    const grade = gradeDerivedItem(item, movements, sex, side);
    if (grade) byItem.set(item.spanId, grade);
    item.alternatives.forEach(visit);
  };
  const primaries = session.parts.flatMap((part) => part.blocks.flatMap((block) => block.items));
  primaries.forEach(visit);

  const prescribed: Array<Grade | undefined> = [];
  const performed: Array<Grade | undefined> = [];
  let unrecorded = 0;
  for (const item of primaries) {
    const grade = byItem.get(item.spanId);
    if (grade === undefined) continue;
    prescribed.push(grade.prescribed);
    const done =
      grade.performed ??
      item.alternatives
        .map((alternative) => byItem.get(alternative.spanId)?.performed)
        .find((candidate) => candidate !== undefined);
    if (done === undefined) unrecorded++;
    else performed.push(done);
  }
  return {
    byItem,
    programmed: divisionOf(prescribed),
    performed: divisionOf(performed),
    unrecorded,
  };
}
