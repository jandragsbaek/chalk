import type { Measure } from "@chalk/contracts";

export const MEASURE_LABELS: Record<Measure, string> = {
  reps: "Reps",
  sets: "Sets",
  calories: "Calories",
  distance_m: "Distance (m)",
  seconds: "Time (sec)",
  load_kg: "Load (kg)",
  percent_1rm: "% of 1RM",
  rpe: "RPE",
};

/** 1950 → "1,950 kg", 52.5 → "52.5 kg". */
export const formatKg = (kg: number) =>
  `${kg.toLocaleString("en-US", { maximumFractionDigits: 2 })} kg`;
