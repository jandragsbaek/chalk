import type { WorkoutKind } from "@chalk/contracts";

export const WORKOUT_KIND_LABELS: Record<WorkoutKind, string> = {
  for_time: "For time",
  amrap: "AMRAP",
  emom: "EMOM",
  strength: "Strength",
  other: "Other",
};
