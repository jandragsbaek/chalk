import type { CatalogMovement, MovementId, SessionEntry } from "@chalk/contracts";

/** The day a register entry was trained. */
export const entryDay = (entry: SessionEntry): string =>
  entry._tag === "workout" ? entry.workout.performedOn : entry.performedOn;

/** The entry's key in the URL: the workout id, or `day-2026-10-29` for a strength day. */
export const entryKey = (entry: SessionEntry): string =>
  entry._tag === "workout" ? entry.workout.id : `day-${entry.performedOn}`;

/** "2026-10" for an IsoDate. */
export const monthOf = (iso: string): string => iso.slice(0, 7);

export interface SessionFilter {
  /** Matches name, score, notes (the session's and its lift sets') and movement names, ignoring case. */
  readonly query: string;
  /** A movement, or a core movement with its variations. */
  readonly movement: MovementId | undefined;
  /** "2026" */
  readonly year: string | undefined;
}

/** The movement and, for a core movement, every variation of it: "Snatch" finds power snatches. */
export function movementFamily(
  movement: MovementId,
  catalog: ReadonlyArray<CatalogMovement>,
): ReadonlySet<MovementId> {
  return new Set([
    movement,
    ...catalog.filter((entry) => entry.variationOf === movement).map((entry) => entry.id),
  ]);
}

export function filterSessions(
  entries: ReadonlyArray<SessionEntry>,
  filter: SessionFilter,
  catalog: ReadonlyArray<CatalogMovement>,
): ReadonlyArray<SessionEntry> {
  const names = new Map(catalog.map((movement) => [movement.id, movement.name]));
  const family =
    filter.movement === undefined ? undefined : movementFamily(filter.movement, catalog);
  const needle = filter.query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (filter.year !== undefined && !entryDay(entry).startsWith(`${filter.year}-`)) return false;
    if (family !== undefined && !entry.movementIds.some((id) => family.has(id))) return false;
    if (needle === "") return true;
    const texts = [
      ...(entry._tag === "workout"
        ? [entry.workout.name, entry.workout.score, entry.workout.notes]
        : []),
      ...entry.movementIds.map((id) => names.get(id) ?? id),
      ...entry.daySets.map((set) => set.notes),
    ];
    return texts.some((text) => text.toLowerCase().includes(needle));
  });
}

export interface MonthGroup {
  /** "2026-10" */
  readonly month: string;
  readonly entries: ReadonlyArray<SessionEntry>;
  /** Every entry that month, filtered or not. */
  readonly total: number;
}

/** Consecutive months of the filtered register, newest first, each with its unfiltered total. */
export function groupByMonth(
  filtered: ReadonlyArray<SessionEntry>,
  all: ReadonlyArray<SessionEntry>,
): ReadonlyArray<MonthGroup> {
  const totals = new Map<string, number>();
  for (const entry of all) {
    const month = monthOf(entryDay(entry));
    totals.set(month, (totals.get(month) ?? 0) + 1);
  }
  const groups: Array<{ month: string; entries: Array<SessionEntry>; total: number }> = [];
  for (const entry of filtered) {
    const month = monthOf(entryDay(entry));
    const last = groups.at(-1);
    if (last?.month === month) last.entries.push(entry);
    else groups.push({ month, entries: [entry], total: totals.get(month) ?? 0 });
  }
  return groups;
}

export interface MovementOption {
  readonly id: MovementId;
  readonly name: string;
  /** Sessions it (or a variation of it) appears in. */
  readonly sessions: number;
}

/**
 * The movements the register can filter by: every movement in the history, plus the core of
 * every variation in it, alphabetical.
 */
export function movementOptions(
  entries: ReadonlyArray<SessionEntry>,
  catalog: ReadonlyArray<CatalogMovement>,
): ReadonlyArray<MovementOption> {
  const byId = new Map(catalog.map((movement) => [movement.id, movement]));
  const counts = new Map<MovementId, number>();
  for (const entry of entries) {
    const seen = new Set<MovementId>();
    for (const id of entry.movementIds) {
      seen.add(id);
      const core = byId.get(id)?.variationOf;
      if (core !== undefined) seen.add(core);
    }
    for (const id of seen) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts]
    .map(([id, sessions]) => ({ id, name: byId.get(id)?.name ?? id, sessions }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

/** Years with any session, newest first. */
export const sessionYears = (entries: ReadonlyArray<SessionEntry>): ReadonlyArray<string> =>
  [...new Set(entries.map((entry) => entryDay(entry).slice(0, 4)))].sort().reverse();
