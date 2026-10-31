/**
 * Estimated 1RM. Epley is the headline (docs/domain.md); Brzycki and Lombardi give the spread:
 * none for a single, widest at high reps, not monotonic (Lombardi crosses the others near 5).
 */

export interface OneRepMaxEstimate {
  /** Epley: load × (1 + reps / 30). */
  readonly epley: number;
  /** Lowest of the three formulas. */
  readonly low: number;
  /** Highest of the three formulas. */
  readonly high: number;
}

/** Formulas are fitted for low-to-moderate reps; past this the estimate is noise. */
export const MAX_ESTIMATE_REPS = 12;

export function epley(loadKg: number, reps: number): number {
  return reps === 1 ? loadKg : loadKg * (1 + reps / 30);
}

export function brzycki(loadKg: number, reps: number): number {
  return (loadKg * 36) / (37 - reps);
}

export function lombardi(loadKg: number, reps: number): number {
  return loadKg * reps ** 0.1;
}

export function estimateOneRepMax(loadKg: number, reps: number): OneRepMaxEstimate {
  const values = [epley(loadKg, reps), brzycki(loadKg, reps), lombardi(loadKg, reps)];
  return {
    epley: values[0] ?? loadKg,
    low: Math.min(...values),
    high: Math.max(...values),
  };
}
