import { describe, expect, it } from "@effect/vitest";

import { MovementId } from "../baseSchemas.ts";
import type { ImportDocument, Span } from "../sessionImport.ts";
import { blockingIssues, deriveSession, formatQuantity, type DerivedItem } from "./derive.ts";
import { BENCH_MAX_OUT, CATALOG, SESSION_160, SESSION_166 } from "./fixtures/sessions.ts";
import { makeMovementMatcher } from "./movementMatcher.ts";
import { suggestSpans } from "./suggest.ts";

const matcher = makeMovementMatcher(CATALOG);
const nameOf = (id: MovementId) => CATALOG.find((movement) => movement.id === id)?.name;

const documentOf = (text: string): ImportDocument => {
  let next = 0;
  return { text, spans: suggestSpans(text, matcher, () => `s${++next}`) };
};

const itemRow = (item: DerivedItem): string => {
  const sets = item.sets.map((set) => set.quantities.map(formatQuantity).join(" "));
  const alternatives = item.alternatives.map((alternative) => ` | ${itemRow(alternative)}`);
  return `${item.movementId}[${sets.join("; ")}]${alternatives.join("")}`;
};

describe("deriveSession", () => {
  it("builds parts, blocks and items from the spans", () => {
    const session = deriveSession(documentOf(SESSION_166), nameOf);
    expect(session).toMatchObject({
      performedOn: "2026-10-26",
      sessionNumber: 166,
      name: "Session 166",
      kind: "amrap",
    });
    expect(
      session.parts.map((part) => ({
        title: part.title,
        blocks: part.blocks.map(
          (block) => `${block.title}: ${block.items.map(itemRow).join(", ")}`,
        ),
      })),
    ).toEqual([
      {
        title: "Workout #1",
        blocks: ["Every 3 min x 5: front-squat[5 reps 70-80 %]"],
      },
      {
        title: "Workout #2",
        blocks: [
          "Amrap 7: row[12/10 cal], burpee[10 reps], double-under[40 reps]",
          "Rest 2 min: ",
          "Amrap 7: rope-climb[2 reps] | pull-up[8 reps], wall-ball[15 reps]",
        ],
      },
    ]);
    expect(session.parts[0]?.rawText).toBe(
      "- Every 3 min x 5\n- 5 Front squats @70-80% of 1 RM\n- Direkte ind i\n- 20m Dual KB front rack carry (heavy)",
    );
    expect(session.issues.map((issue) => issue.message)).toEqual([
      '"20m" is not attached to a movement and is left out.',
      '"60" is not attached to a movement and is left out.',
    ]);
  });

  it("puts a movement named above its format line into that block, one set per ramp line", () => {
    const session = deriveSession(documentOf(SESSION_160), nameOf);
    const [strength] = session.parts[0]?.blocks ?? [];
    expect(strength?.format).toBe("strength");
    expect(strength?.items.map(itemRow)).toEqual([
      "back-squat[10 reps 20-30 %; 5 reps 40 %; 3 reps 55 %; 2 reps 65 %; 1 rep 75 %; 1 rep 85 %; 1 rep 92-95 %]",
    ]);
    expect(session.kind).toBe("strength");
  });

  it("logs results from the notes as lift sets and keeps the notes text", () => {
    const session = deriveSession(documentOf(SESSION_160), nameOf);
    expect(session.liftSets).toEqual([
      {
        movementSpanId: expect.any(String),
        movementId: "back-squat",
        reps: 1,
        loadKg: 150,
        count: 1,
      },
    ]);
    expect(session.notes.split("\n")[1]).toBe(
      "Back squat 1RM: 150 kg. Failed 155 kg. Feels close to true max.",
    );
    expect(blockingIssues(session)).toEqual([]);
  });

  it("needs a date, a resolved movement, and reps on every result", () => {
    const text = "- Deadlift\n*** Notes\n- Deadlift 180 kg\n- Deadlift 3x5 @ 140 kg";
    const spans: ReadonlyArray<Span> = [
      { _tag: "movement", id: "a", start: 2, end: 10 },
      { _tag: "notes", id: "n", start: 15, end: 20 },
      { _tag: "movement", id: "b", start: 23, end: 31, movementId: MovementId.make("deadlift") },
      {
        _tag: "quantity",
        id: "q1",
        start: 32,
        end: 38,
        measure: "load_kg",
        amount: { min: 180, max: 180 },
        attachedTo: "b",
      },
      { _tag: "movement", id: "c", start: 41, end: 49, movementId: MovementId.make("deadlift") },
      {
        _tag: "quantity",
        id: "q2",
        start: 50,
        end: 52,
        measure: "sets",
        amount: { min: 3, max: 3 },
        attachedTo: "c",
      },
      {
        _tag: "quantity",
        id: "q3",
        start: 52,
        end: 53,
        measure: "reps",
        amount: { min: 5, max: 5 },
        attachedTo: "c",
      },
      {
        _tag: "quantity",
        id: "q4",
        start: 54,
        end: 62,
        measure: "load_kg",
        amount: { min: 140, max: 140 },
        attachedTo: "c",
      },
    ];
    const session = deriveSession({ text, spans }, nameOf);
    expect(blockingIssues(session).map((issue) => issue.message)).toEqual([
      "No date. Highlight it in the text or set it.",
      'Pick a movement for "Deadlift".',
      "Deadlift 180 kg needs reps.",
    ]);
    expect(session.liftSets).toEqual([
      { movementSpanId: "c", movementId: "deadlift", reps: 5, loadKg: 140, count: 3 },
    ]);

    const dated = deriveSession({ text, spans, performedOn: "2026-01-02" }, nameOf);
    expect(dated.performedOn).toBe("2026-01-02");
    expect(dated.name).toBe("Session 2026-01-02");
  });

  it("flags overlapping highlights and movements outside the catalog", () => {
    const { text } = documentOf(BENCH_MAX_OUT);
    const spans: ReadonlyArray<Span> = [
      {
        _tag: "movement",
        id: "a",
        start: 30,
        end: 41,
        movementId: MovementId.make("zercher-squat"),
      },
      {
        _tag: "quantity",
        id: "b",
        start: 35,
        end: 45,
        measure: "reps",
        amount: { min: 1, max: 1 },
      },
    ];
    const messages = deriveSession({ text, spans, performedOn: "2026-01-02" }, nameOf).issues.map(
      (issue) => issue.message,
    );
    expect(messages).toContain("Two highlights overlap.");
    expect(messages).toContain('"zercher-squat" is not in the catalog.');
  });
});
