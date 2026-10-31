/**
 * SYNTHETIC strength history for the chart mockups. Deterministic (seeded), so screenshots are
 * stable. Nothing here reaches the server; delete with the mockups.
 */
import { estimateOneRepMax, type OneRepMaxEstimate } from "../lib/estimate.ts";

export interface MockSet {
  readonly id: string;
  readonly movementId: string;
  readonly performedOn: string;
  readonly reps: number;
  readonly loadKg: number;
  /** A single taken as a max attempt (roadmap phase 2 "attempt" marker). */
  readonly attempt: boolean;
}

export interface MockLift {
  readonly id: string;
  readonly name: string;
}

interface LiftModel extends MockLift {
  readonly base: number;
  readonly gain: number;
  readonly olympic: boolean;
}

const MODELS: ReadonlyArray<LiftModel> = [
  { id: "back-squat", name: "Back squat", base: 125, gain: 0.14, olympic: false },
  { id: "deadlift", name: "Deadlift", base: 160, gain: 0.1, olympic: false },
  { id: "front-squat", name: "Front squat", base: 105, gain: 0.12, olympic: false },
  { id: "strict-press", name: "Strict press", base: 55, gain: 0.09, olympic: false },
  { id: "clean", name: "Clean", base: 92.5, gain: 0.08, olympic: true },
  { id: "snatch", name: "Snatch", base: 70, gain: 0.07, olympic: true },
];

export const MOCK_LIFTS: ReadonlyArray<MockLift> = MODELS.map(({ id, name }) => ({ id, name }));

/** Mockups pretend today is the end of the synthetic year. */
export const MOCK_TODAY = "2026-10-31";
const FIRST_MONDAY = new Date("2025-11-03T00:00:00");
const WEEKS = 52;

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedOf(text: string): number {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const roundToPlate = (kg: number) => Math.round(kg / 2.5) * 2.5;

/** Progress curve: steady gains, a sick dip in weeks 20 to 23, a plateau late summer. */
function progress(week: number): number {
  const steady = 1 - Math.exp(-week / 30);
  const dip = week >= 20 && week <= 23 ? -0.05 * Math.sin(((week - 20) / 3) * Math.PI) : 0;
  const plateau = week > 36 && week < 44 ? -0.015 : 0;
  return steady + dip + plateau;
}

const STRENGTH_SCHEME = [5, 5, 3, 3, 1, 10] as const;
const OLYMPIC_SCHEME = [3, 2, 2, 1, 3, 1] as const;

function generate(model: LiftModel): MockSet[] {
  const random = mulberry32(seedOf(model.id));
  const sets: MockSet[] = [];
  const scheme = model.olympic ? OLYMPIC_SCHEME : STRENGTH_SCHEME;
  for (let week = 0; week < WEEKS; week++) {
    if (random() < 0.12) continue; // missed week
    const day = new Date(FIRST_MONDAY);
    day.setDate(day.getDate() + week * 7 + Math.floor(random() * 5));
    const trueMax = model.base * (1 + model.gain * progress(week));
    const reps = scheme[week % scheme.length] ?? 5;
    const attempt = reps === 1 && week % 12 === 4;
    const effort = attempt ? 0.985 + random() * 0.02 : 0.92 + random() * 0.1;
    const repMaxLoad = reps === 1 ? trueMax : trueMax / (1 + reps / 30);
    const top = roundToPlate(repMaxLoad * effort);
    const performedOn = isoDay(day);
    const backoff = roundToPlate(top * 0.9);
    const entries: Array<[reps: number, loadKg: number]> = attempt
      ? [[1, top]]
      : [
          [reps, top],
          [reps, backoff],
          [reps, backoff],
        ];
    entries.forEach(([setReps, loadKg], index) =>
      sets.push({
        id: `${model.id}-${week}-${index}`,
        movementId: model.id,
        performedOn,
        reps: setReps,
        loadKg,
        attempt: attempt && index === 0,
      }),
    );
  }
  return sets;
}

export const MOCK_SETS: ReadonlyArray<MockSet> = MODELS.flatMap(generate);

/** Derived views below are what a real `lifts.progress` RPC would return. */
export interface SessionEstimate {
  readonly date: Date;
  readonly performedOn: string;
  /** The day's set with the highest Epley estimate. */
  readonly best: MockSet;
  readonly estimate: OneRepMaxEstimate;
  readonly sets: ReadonlyArray<MockSet>;
}

export interface BestPoint {
  readonly date: Date;
  readonly e1rm: number;
  readonly low: number;
  readonly high: number;
  readonly source: MockSet;
}

export const toDate = (isoDate: string) => new Date(`${isoDate}T00:00:00`);

/** Every set of a lift. Charts derive from all of them, then clip to the range, so a record set
 * before the range still counts. */
export function setsFor(movementId: string): MockSet[] {
  return MOCK_SETS.filter((set) => set.movementId === movementId);
}

/** Step series clipped to `[from, to]`: the value in force at `from` is carried in, the last
 * value is held to `to`. */
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

export function sessionEstimates(sets: ReadonlyArray<MockSet>): SessionEstimate[] {
  const byDay = new Map<string, MockSet[]>();
  for (const set of sets) {
    const day = byDay.get(set.performedOn);
    if (day) day.push(set);
    else byDay.set(set.performedOn, [set]);
  }
  return [...byDay]
    .map(([performedOn, daySets]) => {
      const scored = daySets.map((set) => ({
        set,
        estimate: estimateOneRepMax(set.loadKg, set.reps),
      }));
      scored.sort((a, b) => b.estimate.epley - a.estimate.epley);
      const top = scored[0]!;
      return {
        date: toDate(performedOn),
        performedOn,
        best: top.set,
        estimate: top.estimate,
        sets: daySets,
      };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
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

export interface RepMaxStep {
  readonly date: Date;
  readonly loadKg: number;
  readonly source: MockSet;
}

/** Heaviest load for at least `reps` reps, as it moved over time (implied maxes included). */
export function repMaxHistory(sets: ReadonlyArray<MockSet>, reps: number): RepMaxStep[] {
  const sorted = [...sets].sort((a, b) => a.performedOn.localeCompare(b.performedOn));
  const steps: RepMaxStep[] = [];
  let best = -Infinity;
  for (const set of sorted) {
    if (set.reps >= reps && set.loadKg > best) {
      best = set.loadKg;
      steps.push({ date: toDate(set.performedOn), loadKg: set.loadKg, source: set });
    }
  }
  return steps;
}

export interface WeekEstimate {
  readonly weekStart: Date;
  readonly session: SessionEstimate;
  /** This week moved the best-to-date e1RM. */
  readonly pr: boolean;
}

function mondayOf(date: Date): Date {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

export function weeklyBest(sessions: ReadonlyArray<SessionEstimate>): WeekEstimate[] {
  const weeks = new Map<number, SessionEstimate>();
  for (const session of sessions) {
    const key = mondayOf(session.date).getTime();
    const current = weeks.get(key);
    if (!current || session.estimate.epley > current.estimate.epley) weeks.set(key, session);
  }
  let best = -Infinity;
  return [...weeks]
    .sort(([a], [b]) => a - b)
    .map(([key, session]) => {
      const pr = session.estimate.epley > best;
      if (pr) best = session.estimate.epley;
      return { weekStart: new Date(key), session, pr };
    });
}

export const RANGES = [
  { id: "3m", label: "3M", months: 3 },
  { id: "6m", label: "6M", months: 6 },
  { id: "1y", label: "1Y", months: 12 },
] as const;
export type RangeId = (typeof RANGES)[number]["id"];

export function rangeStart(range: RangeId): Date {
  const months = RANGES.find((option) => option.id === range)?.months ?? 12;
  const start = toDate(MOCK_TODAY);
  start.setMonth(start.getMonth() - months);
  return start;
}
