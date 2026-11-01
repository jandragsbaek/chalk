import {
  CoachThreadId,
  LiftSetId,
  MovementId,
  WorkoutId,
  type CoachEvent,
  type CoachReceipt,
  type CoachThread,
  type CoachTurn,
} from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  applyCoachEvent,
  citeSegments,
  EMPTY_REPLY,
  paragraphs,
  starterPrompts,
  threadTurns,
} from "./coach.ts";

const thread: CoachThread = {
  id: CoachThreadId.make("t1"),
  title: "How is my squat?",
  model: "test/model",
  turns: 1,
  reads: 0,
  unanswered: false,
  createdAt: "2026-10-30T19:00:00Z",
  updatedAt: "2026-10-30T19:00:00Z",
};

const turn = (seq: number, role: CoachTurn["role"], text: string): CoachTurn => ({
  seq,
  role,
  text,
  receipts: [],
  createdAt: "2026-10-30T19:00:00Z",
});

const receipt: CoachReceipt = {
  number: 3,
  tool: "get_rep_maxes",
  request: [{ tag: "movement", text: "Back squat" }],
  summary: "e1RM 134.2 kg",
  status: "ok",
  columns: ["Movement", "RM", "Load", "Date"],
  rows: [["Back squat", "5RM", "115 kg", "2026-09-12"]],
  truncated: 0,
};

const fold = (events: ReadonlyArray<CoachEvent>) => events.reduce(applyCoachEvent, EMPTY_REPLY);

describe("a reply in progress", () => {
  it("prints the saved turns, then the new athlete turn with the coach's reads so far", () => {
    const saved = [turn(1, "athlete", "Hi"), turn(2, "coach", "Hello")];
    const live = fold([
      { _tag: "AthleteTurn", thread, turn: turn(3, "athlete", "How is my squat?") },
      {
        _tag: "ReadStarted",
        number: 3,
        tool: "get_rep_maxes",
        request: [{ tag: "movement", text: "Back squat" }],
      },
      {
        _tag: "ReadStarted",
        number: 4,
        tool: "list_lift_sets",
        request: [{ tag: "movement", text: "Back squat" }],
      },
      { _tag: "ReadFinished", receipt },
    ]);
    const { turns, reading } = threadTurns(saved, live);
    expect(turns.map((each) => each.seq)).toEqual([1, 2, 3]);
    expect(reading?.map((read) => [read.number, read.receipt?.summary])).toEqual([
      [3, "e1RM 134.2 kg"],
      [4, undefined],
    ]);
  });

  it("stops reading once the reply is saved, and never prints a turn twice after a refetch", () => {
    const live = fold([
      { _tag: "AthleteTurn", thread, turn: turn(3, "athlete", "How is my squat?") },
      { _tag: "CoachTurn", thread, turn: turn(4, "coach", "Flat (R3).") },
    ]);
    const before = threadTurns([turn(1, "athlete", "Hi"), turn(2, "coach", "Hello")], live);
    expect(before.turns.map((each) => each.seq)).toEqual([1, 2, 3, 4]);
    expect(before.reading).toBeNull();

    const refetched = [1, 2, 3, 4].map((seq) => turn(seq, seq % 2 ? "athlete" : "coach", ""));
    expect(threadTurns(refetched, live).turns.map((each) => each.seq)).toEqual([1, 2, 3, 4]);
  });
});

/** The paragraph as printed, with each citation link shown as [n]. */
const printed = (paragraph: string) =>
  citeSegments(paragraph)
    .map((segment) => (segment.kind === "cite" ? `[${segment.number}]` : segment.text))
    .join("");

describe("citeSegments", () => {
  it("links each receipt number and keeps the parentheses and commas as text", () => {
    expect(printed("Flat since September (R2), but volume is up (R1, R3).")).toBe(
      "Flat since September ([2]), but volume is up ([1], [3]).",
    );
  });

  it("leaves a bare R and a number alone", () => {
    expect(printed("Row 2 on the R2 rower.")).toBe("Row 2 on the R2 rower.");
  });
});

describe("paragraphs", () => {
  it("splits on blank lines and keeps single line breaks inside a paragraph", () => {
    expect(paragraphs("One\nstill one\n\n\nTwo").map((each) => each.text)).toEqual([
      "One\nstill one",
      "Two",
    ]);
  });
});

describe("starterPrompts", () => {
  it("asks about the lift trained most lately and the latest session", () => {
    const squat = MovementId.make("back-squat");
    const deadlift = MovementId.make("deadlift");
    const set = (movementId: MovementId, performedOn: string) => ({
      id: LiftSetId.make(`${movementId}-${performedOn}`),
      movementId,
      performedOn,
      reps: 5,
      loadKg: 100,
      notes: "",
      createdAt: `${performedOn}T18:00:00Z`,
    });
    const workout = (name: string, performedOn: string) => ({
      id: WorkoutId.make(name),
      performedOn,
      name,
      kind: "for_time" as const,
      score: "6:48",
      rx: true,
      notes: "",
      createdAt: `${performedOn}T18:00:00Z`,
    });
    expect(
      starterPrompts({
        today: "2026-11-01",
        movements: [
          { id: squat, name: "Back squat", category: "barbell" },
          { id: deadlift, name: "Deadlift", category: "barbell" },
        ],
        // Deadlift has more sets in all, but squat more in the last twelve weeks.
        liftSets: [
          set(squat, "2026-10-30"),
          set(squat, "2026-10-23"),
          set(deadlift, "2026-10-28"),
          set(deadlift, "2026-03-01"),
          set(deadlift, "2026-03-08"),
        ],
        workouts: [workout("Fran", "2026-10-30"), workout("Murph", "2026-11-01")],
      }),
    ).toEqual([
      "Is my back squat still going up?",
      "What stands out in Murph on 1 Nov?",
      "Where should the next four weeks of training go?",
    ]);
  });

  it("still offers the block ahead with an empty log", () => {
    expect(
      starterPrompts({ today: "2026-11-01", movements: [], liftSets: [], workouts: [] }),
    ).toEqual(["Where should the next four weeks of training go?"]);
  });
});
