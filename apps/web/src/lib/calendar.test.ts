import {
  THE_BOX,
  BlockId,
  LiftSetId,
  MovementId,
  ProgrammedSessionId,
  type LiftSet,
  type TrainingBlock,
} from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import { calendarDays, sessionState, shortBlockName, weekOf, weekTally } from "./calendar.ts";

const squat = MovementId.make("back-squat");

const block = (status: TrainingBlock["status"]): TrainingBlock => ({
  id: BlockId.make(`block-${status}`),
  name: "Smolov Jr",
  goal: "",
  status,
  source: "coach",
  trainingMaxes: [{ movementId: squat, kg: 150 }],
  createdAt: "2026-10-31T10:00:00Z",
  updatedAt: "2026-10-31T10:00:00Z",
  sessions: [
    {
      id: ProgrammedSessionId.make(`${status}-1`),
      blockId: BlockId.make(`block-${status}`),
      day: "2026-10-27",
      title: "Day 1",
      lines: [
        { movementId: squat, name: "Back squat", sets: 6, reps: 6, percent: 70 },
        { name: "Band pull-apart", sets: 3, reps: 20 },
      ],
      ticked: [],
    },
    {
      id: ProgrammedSessionId.make(`${status}-2`),
      blockId: BlockId.make(`block-${status}`),
      day: "2026-10-29",
      title: "Day 2",
      lines: [{ name: "Band pull-apart", sets: 3, reps: 20 }],
      ticked: [0],
    },
    {
      id: ProgrammedSessionId.make(`${status}-3`),
      blockId: BlockId.make(`block-${status}`),
      day: "2026-10-30",
      title: "Day 3",
      lines: [{ movementId: squat, name: "Back squat", sets: 8, reps: 4, percent: 80 }],
      ticked: [],
    },
  ],
});

const set = (performedOn: string): LiftSet => ({
  id: LiftSetId.make(`set-${performedOn}`),
  movementId: squat,
  performedOn,
  reps: 6,
  loadKg: 105,
  notes: "",
  place: THE_BOX,
  createdAt: `${performedOn}T07:00:00Z`,
});

describe("calendarDays", () => {
  const week = weekOf("2026-11-01");
  const days = calendarDays({
    from: week[0] ?? "",
    to: week[6] ?? "",
    blocks: [block("scheduled")],
    workouts: [],
    plans: [],
    liftSets: [set("2026-10-27")],
    rest: new Map(),
  });

  it("lays a Monday-first week out by day", () => {
    expect(week).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
    expect(days.map((day) => day.sessions.length)).toEqual([0, 1, 0, 1, 1, 0, 0]);
  });

  it("counts a lift done from the log, other lines only when ticked", () => {
    const [dayOne] = days[1]?.sessions ?? [];
    expect(dayOne?.done).toEqual([true, false]);
    expect(dayOne?.logged).toEqual([true, false]);
    expect(dayOne && sessionState(dayOne, "2026-11-01")).toBe("partial");
    const [dayTwo] = days[3]?.sessions ?? [];
    expect(dayTwo && sessionState(dayTwo, "2026-11-01")).toBe("done");
    const [dayThree] = days[4]?.sessions ?? [];
    expect(dayThree && sessionState(dayThree, "2026-11-01")).toBe("missed");
    expect(dayThree && sessionState(dayThree, "2026-10-30")).toBe("open");
  });

  it("tallies the week from scheduled blocks only", () => {
    expect(weekTally(days, "2026-11-01")).toEqual({
      programmed: 3,
      done: 1,
      missed: 1,
      boxSessions: 0,
    });
    const drafts = calendarDays({
      from: "2026-10-26",
      to: "2026-11-01",
      blocks: [block("draft")],
      workouts: [],
      plans: [],
      liftSets: [],
      rest: new Map(),
    });
    expect(weekTally(drafts, "2026-11-01").programmed).toBe(0);
  });
});

describe("shortBlockName", () => {
  it("keeps the head of a name, or its first word when the head runs long", () => {
    expect(shortBlockName("Smolov Jr · back squat")).toBe("Smolov Jr");
    expect(shortBlockName("Shoulder prehab")).toBe("Shoulder");
    expect(shortBlockName("Hip and ankle mobility")).toBe("Hip");
    expect(shortBlockName("5/3/1")).toBe("5/3/1");
  });
});
