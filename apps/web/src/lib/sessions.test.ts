import type { CatalogMovement, LiftSet, SessionEntry, Workout } from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import { filterSessions, groupByMonth, movementOptions } from "./sessions.ts";

const catalog = [
  { id: "snatch", name: "Snatch", category: "barbell", aliases: [] },
  {
    id: "power-snatch",
    name: "Power snatch",
    category: "barbell",
    aliases: [],
    variationOf: "snatch",
  },
  { id: "back-squat", name: "Back squat", category: "barbell", aliases: [] },
  { id: "row", name: "Row", category: "monostructural", aliases: [] },
] as unknown as ReadonlyArray<CatalogMovement>;

function workout(
  performedOn: string,
  name: string,
  movementIds: ReadonlyArray<string>,
  notes = "",
): SessionEntry {
  return {
    _tag: "workout",
    workout: { id: name, performedOn, name, kind: "amrap", score: "5+18", rx: false, notes },
    sessionNumber: null,
    imported: false,
    movementIds,
    liftSetCount: 0,
    tonnageKg: 0,
    daySets: [],
  } as unknown as SessionEntry & { workout: Workout };
}

function strengthDay(performedOn: string, movementIds: ReadonlyArray<string>): SessionEntry {
  return {
    _tag: "strengthDay",
    performedOn,
    movementIds,
    daySets: [] as ReadonlyArray<LiftSet>,
  } as unknown as SessionEntry;
}

const entries = [
  workout("2026-10-27", "Fight the clock", ["power-snatch", "row"]),
  strengthDay("2026-10-26", ["back-squat"]),
  workout("2026-09-29", "Isabel", ["snatch"], "Hands tore"),
  workout("2025-12-30", "Rowing intervals", ["row"]),
];

const names = (list: ReadonlyArray<SessionEntry>) =>
  list.map((entry) => (entry._tag === "workout" ? entry.workout.name : entry.performedOn));

describe("filterSessions", () => {
  const none = { query: "", movement: undefined, year: undefined };

  it("finds a core movement through its variations", () => {
    const snatch = filterSessions(entries, { ...none, movement: "snatch" as never }, catalog);
    expect(names(snatch)).toEqual(["Fight the clock", "Isabel"]);
  });

  it("matches text in names, notes and movement names, and narrows to a year", () => {
    expect(names(filterSessions(entries, { ...none, query: "tore" }, catalog))).toEqual(["Isabel"]);
    expect(names(filterSessions(entries, { ...none, query: "back SQUAT" }, catalog))).toEqual([
      "2026-10-26",
    ]);
    expect(
      names(filterSessions(entries, { ...none, query: "row", year: "2025" }, catalog)),
    ).toEqual(["Rowing intervals"]);
  });
});

describe("groupByMonth", () => {
  it("groups the filtered entries by month and keeps each month's full total", () => {
    const filtered = filterSessions(
      entries,
      { query: "", movement: "snatch" as never, year: undefined },
      catalog,
    );
    expect(
      groupByMonth(filtered, entries).map(({ month, entries: list, total }) => ({
        month,
        shown: list.length,
        total,
      })),
    ).toEqual([
      { month: "2026-10", shown: 1, total: 2 },
      { month: "2026-09", shown: 1, total: 1 },
    ]);
  });
});

describe("movementOptions", () => {
  it("offers every movement in the history and the core of each variation, alphabetical", () => {
    expect(movementOptions(entries, catalog)).toEqual([
      { id: "back-squat", name: "Back squat", sessions: 1 },
      { id: "power-snatch", name: "Power snatch", sessions: 1 },
      { id: "row", name: "Row", sessions: 2 },
      { id: "snatch", name: "Snatch", sessions: 2 },
    ]);
  });
});
