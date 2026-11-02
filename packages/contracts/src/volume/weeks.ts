import type { IsoDate, MovementId, WorkoutId } from "../baseSchemas.ts";
import type { Counted, LeftOut } from "./count.ts";
import type { VolumeEntry, VolumeLeftOut, VolumeWeek } from "./model.ts";

/** The Monday of `day`'s ISO week: "2026-11-01" (a Sunday) → "2026-10-26". */
export const isoWeekStart = (day: IsoDate): IsoDate => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
};

const UNIT_FIELDS = { reps: "reps", m: "metres", cal: "calories", s: "seconds" } as const;

type Totals = { -readonly [K in "reps" | "metres" | "calories" | "seconds" | "tonnageKg"]: number };

/**
 * A session's counted lines as one entry per movement done and movement written, every unit
 * summed on its own. Tonnage is reps × external load; a line without a load adds none.
 */
export const volumeEntries = (
  workoutId: WorkoutId | null,
  performedOn: IsoDate,
  counted: ReadonlyArray<Counted>,
): ReadonlyArray<VolumeEntry> => {
  const byKey = new Map<string, { movementId: MovementId; writtenAs: MovementId } & Totals>();
  for (const line of counted) {
    if (line.amount <= 0) continue;
    const writtenAs = line.writtenAs ?? line.movementId;
    const key = `${line.movementId} ${writtenAs}`;
    const totals = byKey.get(key) ?? {
      movementId: line.movementId,
      writtenAs,
      reps: 0,
      metres: 0,
      calories: 0,
      seconds: 0,
      tonnageKg: 0,
    };
    totals[UNIT_FIELDS[line.unit]] += line.amount;
    if (line.unit === "reps" && line.loadKg !== undefined)
      totals.tonnageKg += line.amount * line.loadKg;
    byKey.set(key, totals);
  }
  return Array.from(byKey.values(), (totals) => ({ workoutId, performedOn, ...totals }));
};

export const volumeLeftOut = (
  workoutId: WorkoutId,
  performedOn: IsoDate,
  leftOut: ReadonlyArray<LeftOut>,
): ReadonlyArray<VolumeLeftOut> =>
  leftOut.map((line) => ({
    workoutId,
    performedOn,
    ...(line.movementId === undefined ? {} : { movementId: line.movementId }),
    text: line.text,
    reason: line.reason,
  }));

/** Entries and left-out lines by ISO week, oldest week first; weeks with nothing are absent. */
export const volumeWeeks = (
  entries: ReadonlyArray<VolumeEntry>,
  leftOut: ReadonlyArray<VolumeLeftOut>,
): ReadonlyArray<VolumeWeek> => {
  const weeks = new Map<IsoDate, { entries: Array<VolumeEntry>; leftOut: Array<VolumeLeftOut> }>();
  const weekOf = (day: IsoDate) => {
    const start = isoWeekStart(day);
    const week = weeks.get(start) ?? { entries: [], leftOut: [] };
    weeks.set(start, week);
    return week;
  };
  for (const entry of entries) weekOf(entry.performedOn).entries.push(entry);
  for (const line of leftOut) weekOf(line.performedOn).leftOut.push(line);
  return [...weeks.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([weekStart, week]) => ({
      weekStart,
      entries: week.entries.sort((left, right) =>
        left.performedOn.localeCompare(right.performedOn),
      ),
      leftOut: week.leftOut,
    }));
};
