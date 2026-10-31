import type { BlockFormat, BlockParams, Measure } from "@chalk/contracts";
import { formatAmount } from "@chalk/contracts";

export const BLOCK_FORMAT_LABELS: Record<BlockFormat, string> = {
  amrap: "AMRAP",
  emom: "EMOM",
  every: "Every",
  intervals: "Intervals",
  for_time: "For time",
  strength: "Strength",
  rest: "Rest",
  other: "Other",
};

export const MEASURE_LABELS: Record<Measure, string> = {
  reps: "Reps",
  sets: "Sets",
  calories: "Calories",
  distance_m: "Distance (m)",
  seconds: "Time (sec)",
  load_kg: "Load (kg)",
  percent_1rm: "% of 1RM",
};

/** 90 → "1:30", 120 → "2 min", 40 → "40 s". */
export const formatSeconds = (seconds: number) => {
  if (seconds < 60) return `${seconds} s`;
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/** "AMRAP 15 min", "Every 1:30 × 8", "40 s on / 20 s off × 9", "21-15-9 for time". */
export const describeBlock = (format: BlockFormat | undefined, params: BlockParams): string => {
  if (format === undefined) return "Movements";
  const rounds = params.rounds ? ` × ${formatAmount(params.rounds)}` : "";
  switch (format) {
    case "amrap":
    case "emom":
      return `${BLOCK_FORMAT_LABELS[format]}${params.durationSeconds ? ` ${formatSeconds(params.durationSeconds)}` : ""}`;
    case "every":
      return `Every ${params.intervalSeconds ? formatSeconds(params.intervalSeconds) : "?"}${rounds}`;
    case "intervals":
      return `${formatSeconds(params.workSeconds ?? 0)} on / ${formatSeconds(params.restSeconds ?? 0)} off${rounds}`;
    case "for_time":
      return params.scheme
        ? `${params.scheme.join("-")} for time`
        : params.rounds
          ? `${formatAmount(params.rounds)} rounds for time`
          : "For time";
    case "rest":
      return `Rest${params.durationSeconds ? ` ${formatSeconds(params.durationSeconds)}` : ""}`;
    case "strength":
      return "Strength";
    case "other":
      return params.rounds ? `${formatAmount(params.rounds)} rounds` : "Other";
  }
};
