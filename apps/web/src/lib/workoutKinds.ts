import type { WorkoutKind } from "@chalk/contracts";

export const WORKOUT_KIND_LABELS: Record<WorkoutKind, string> = {
  for_time: "For time",
  amrap: "AMRAP",
  emom: "EMOM",
  strength: "Strength",
  other: "Other",
};

export const WORKOUT_KINDS = Object.keys(WORKOUT_KIND_LABELS) as ReadonlyArray<WorkoutKind>;

export const SCORE_PLACEHOLDERS: Record<WorkoutKind, string> = {
  for_time: "4:32",
  amrap: "12+5",
  emom: "Completed all rounds",
  strength: "5x5 @ 100 kg",
  other: "Your result",
};
