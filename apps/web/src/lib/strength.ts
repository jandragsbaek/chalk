import type { Movement, MovementCategory, MovementId } from "@chalk/contracts";
import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";

import { movementsAtom } from "../state/strength.ts";

export const MOVEMENT_CATEGORY_LABELS: Record<MovementCategory, string> = {
  barbell: "Barbell",
  dumbbell_kettlebell: "Dumbbell and kettlebell",
  gymnastics: "Gymnastics",
  monostructural: "Monostructural",
  other: "Other",
};

const kgFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export function formatKg(loadKg: number): string {
  return `${kgFormat.format(loadKg)} kg`;
}

/** Movement names by id, empty until the catalog loads; callers fall back to the id. */
export function useMovementNames(): ReadonlyMap<MovementId, string> {
  const result = useAtomValue(movementsAtom);
  const movements: ReadonlyArray<Movement> = AsyncResult.getOrElse(result, () => []);
  return new Map(movements.map((movement) => [movement.id, movement.name]));
}
