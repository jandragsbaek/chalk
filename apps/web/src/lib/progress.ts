import {
  estimateOneRepMax,
  MAX_ESTIMATE_REPS,
  type LiftSet,
  type OneRepMaxEstimate,
} from "@chalk/contracts";

/** One training day of a lift, scored by its best set's estimated 1RM. */
export interface SessionEstimate {
  readonly date: Date;
  readonly performedOn: string;
  /** The day's set with the highest Epley estimate. */
  readonly best: LiftSet;
  readonly estimate: OneRepMaxEstimate;
  readonly setCount: number;
}

/** A point on the best-estimate-to-date line. */
export interface BestPoint {
  readonly date: Date;
  readonly e1rm: number;
  readonly low: number;
  readonly high: number;
  readonly source: LiftSet;
}

export const toDate = (isoDate: string) => new Date(`${isoDate}T00:00:00`);

/** Sets the formulas can score; past MAX_ESTIMATE_REPS an estimate is noise. */
export function isEstimable(set: LiftSet): boolean {
  return set.reps <= MAX_ESTIMATE_REPS;
}

/** Sessions of one lift, oldest first. Callers pass the lift's estimable sets. */
export function sessionEstimates(sets: ReadonlyArray<LiftSet>): SessionEstimate[] {
  const byDay = new Map<string, LiftSet[]>();
  for (const set of sets) {
    const day = byDay.get(set.performedOn);
    if (day) day.push(set);
    else byDay.set(set.performedOn, [set]);
  }
  const sessions: SessionEstimate[] = [];
  for (const [performedOn, daySets] of byDay) {
    let best: { set: LiftSet; estimate: OneRepMaxEstimate } | undefined;
    for (const set of daySets) {
      const estimate = estimateOneRepMax(set.loadKg, set.reps);
      if (!best || estimate.epley > best.estimate.epley) best = { set, estimate };
    }
    if (best) {
      sessions.push({
        date: toDate(performedOn),
        performedOn,
        best: best.set,
        estimate: best.estimate,
        setCount: daySets.length,
      });
    }
  }
  return sessions.sort((a, b) => a.performedOn.localeCompare(b.performedOn));
}

/** Best e1RM to date: only rises. One point per session that set a new best. */
export function bestToDate(sessions: ReadonlyArray<SessionEstimate>): BestPoint[] {
  const points: BestPoint[] = [];
  let best = -Infinity;
  for (const session of sessions) {
    if (session.estimate.epley > best) {
      best = session.estimate.epley;
      points.push({
        date: session.date,
        e1rm: session.estimate.epley,
        low: session.estimate.low,
        high: session.estimate.high,
        source: session.best,
      });
    }
  }
  return points;
}

/**
 * A step series clipped to `[from, to]`: the value in force at `from` is carried in and the last
 * value is held to `to`, so a best set before the range still counts.
 */
export function clipSteps<T extends { readonly date: Date }>(
  steps: ReadonlyArray<T>,
  from: Date,
  to: Date,
): T[] {
  const before = steps.filter((step) => step.date < from).at(-1);
  const inside = steps.filter((step) => step.date >= from && step.date <= to);
  const clipped = before ? [{ ...before, date: from }, ...inside] : inside;
  const last = clipped.at(-1);
  return last ? [...clipped, { ...last, date: to }] : clipped;
}

export const PROGRESS_RANGES = [
  { id: "3m", label: "3M", months: 3 },
  { id: "6m", label: "6M", months: 6 },
  { id: "1y", label: "1Y", months: 12 },
  { id: "all", label: "All", months: null },
] as const;
export type ProgressRange = (typeof PROGRESS_RANGES)[number]["id"];

/** Start of the range ending `today`; "all" starts at the first session. */
export function rangeStart(range: ProgressRange, today: Date, firstSession: Date): Date {
  const months = PROGRESS_RANGES.find((option) => option.id === range)?.months ?? null;
  if (months === null) return firstSession < today ? firstSession : today;
  const start = new Date(today);
  start.setMonth(start.getMonth() - months);
  return start;
}
