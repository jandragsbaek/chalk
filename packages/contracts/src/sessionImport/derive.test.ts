import { describe, expect, it } from "@effect/vitest";

import { MovementId } from "../baseSchemas.ts";
import type { Performance } from "../levels.ts";
import type { ImportDocument, LiftResult, Span } from "../sessionImport.ts";
import {
  blockingIssues,
  deriveSession,
  formatPerformed,
  formatQuantity,
  performedSets,
  type DerivedItem,
} from "./derive.ts";
import {
  BENCH_MAX_OUT,
  CATALOG,
  SESSION_160,
  SESSION_166,
  SESSION_167,
} from "./fixtures/sessions.ts";
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

  it("hangs intent on the block it sits in, with the intensity it names", () => {
    const session = deriveSession(documentOf(SESSION_167), nameOf);
    const [every, emom] = session.parts[0]?.blocks ?? [];
    expect(every?.intents.map((intent) => intent.text)).toEqual([
      "Byg til en udfordrende vægt over de 5 sæt.",
    ]);
    expect(emom?.intents).toEqual([
      {
        spanId: expect.any(String),
        text: "70-80% af ovenstående.",
        quantities: [{ measure: "percent_1rm", amount: { min: 70, max: 80 } }],
      },
    ]);
  });

  it("keeps intent written between a movement and its format line, and drops it in the notes", () => {
    const text = "- Back squat\n- Build to RPE 9\n- Max out!\n- 3 reps\n*** Notes\n- Felt RPE 10";
    const at = (phrase: string) => ({
      start: text.indexOf(phrase),
      end: text.indexOf(phrase) + phrase.length,
    });
    const spans: ReadonlyArray<Span> = [
      { _tag: "movement", id: "m", ...at("Back squat"), movementId: MovementId.make("back-squat") },
      { _tag: "intent", id: "i1", ...at("Build to RPE 9") },
      { _tag: "block", id: "b", ...at("Max out!"), format: "strength", params: {} },
      { _tag: "notes", id: "n", ...at("Notes") },
      { _tag: "intent", id: "i2", ...at("Felt RPE 10") },
    ];
    const session = deriveSession({ text, spans, performedOn: "2026-01-02" }, nameOf);
    expect(session.parts[0]?.blocks).toMatchObject([
      {
        format: "strength",
        items: [{ movementId: "back-squat" }],
        intents: [{ text: "Build to RPE 9", quantities: [{ measure: "rpe" }] }],
      },
    ]);
    expect(session.issues.map((issue) => issue.message)).toEqual([
      'Intent "Felt RPE 10" is in the notes and is left out.',
    ]);
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

const SNATCH_EVERY = `** Session 170 <2026-10-30 to>
*** Workout
- Every 90 sec x 6
- 2 Snatch + 1 Overhead squat
*** Notes
- Snatch 1RM 80 kg`;

/** The suggested document with `results` on the programmed movements they name. */
const withResults = (
  text: string,
  results: Partial<Record<string, LiftResult>>,
): ImportDocument => {
  const document = documentOf(text);
  const notesAt = text.indexOf("*** Notes");
  return {
    ...document,
    spans: document.spans.map((span) => {
      if (span._tag !== "movement" || span.movementId === undefined || span.start > notesAt)
        return span;
      const result = results[span.movementId];
      return result === undefined ? span : { ...span, result };
    }),
  };
};

describe("lift results", () => {
  it("expands fixed, ramp and set-by-set results into sets", () => {
    expect(performedSets({ _tag: "fixed", sets: 3, reps: 2, loadKg: 60 })).toEqual([
      { reps: 2, loadKg: 60 },
      { reps: 2, loadKg: 60 },
      { reps: 2, loadKg: 60 },
    ]);
    const ramp = performedSets({ _tag: "ramp", sets: 6, reps: 2, startKg: 50, stepKg: 2.5 });
    expect(ramp.map((set) => set.loadKg)).toEqual([50, 52.5, 55, 57.5, 60, 62.5]);
    expect(formatPerformed(ramp)).toBe("2 reps @ 50 · 52.5 · 55 · 57.5 · 60 · 62.5 kg");
    expect(formatPerformed(performedSets({ _tag: "fixed", sets: 6, reps: 2, loadKg: 60 }))).toBe(
      "6 × 2 @ 60 kg",
    );
    expect(
      formatPerformed([
        { reps: 5, loadKg: 40 },
        { reps: 3, loadKg: 55 },
      ]),
    ).toBe("5 @ 40 kg · 3 @ 55 kg");
    // A typo of 10 000 sets does not expand forever.
    expect(performedSets({ _tag: "fixed", sets: 10_000, reps: 1, loadKg: 20 })).toHaveLength(100);
  });

  it("sums what was lifted per block and per session, notes included", () => {
    const session = deriveSession(
      withResults(SNATCH_EVERY, {
        snatch: { _tag: "ramp", sets: 6, reps: 2, startKg: 50, stepKg: 2.5 },
        "overhead-squat": { _tag: "fixed", sets: 6, reps: 1, loadKg: 50 },
      }),
      nameOf,
    );
    const [block] = session.parts[0]?.blocks ?? [];
    expect(block?.items.map((item) => item.performed.length)).toEqual([6, 6]);
    // Snatch: 2 × (50 + 52.5 + 55 + 57.5 + 60 + 62.5) = 675; overhead squat: 6 × 50 = 300.
    expect(block?.tonnageKg).toBe(975);
    expect(session.tonnageKg).toBe(975 + 80);
    expect(blockingIssues(session)).toEqual([]);
    expect(session.issues.map((issue) => issue.message)).toContain(
      "Snatch has a result and lift sets in the notes; both are counted.",
    );
  });

  it("refuses a result it cannot count, and counts nothing from it", () => {
    const messages = (result: LiftResult) => {
      const session = deriveSession(withResults(SNATCH_EVERY, { snatch: result }), nameOf);
      expect(session.parts[0]?.blocks[0]?.tonnageKg).toBe(0);
      return blockingIssues(session).map((issue) => [issue.check, issue.message]);
    };
    expect(messages({ _tag: "fixed", sets: 0, reps: 2, loadKg: 60 })).toEqual([
      ["numbers", "Snatch: a result needs 1 to 100 sets."],
    ]);
    expect(messages({ _tag: "each", sets: [] })).toEqual([
      ["numbers", "Snatch: a result needs 1 to 100 sets."],
    ]);
    expect(messages({ _tag: "fixed", sets: 6, reps: 0, loadKg: 60 })).toEqual([
      ["numbers", "Snatch: reps must be 1 to 100."],
    ]);
    expect(messages({ _tag: "ramp", sets: 6, reps: 2, startKg: 10, stepKg: -5 })).toEqual([
      ["numbers", "Snatch: every load must be above 0 and at most 1000 kg."],
    ]);
  });
});

describe("performance", () => {
  const withPerformance = (movementId: string, performance: Performance): ImportDocument => {
    const document = documentOf(SESSION_166);
    return {
      ...document,
      spans: document.spans.map((span) =>
        span._tag === "movement" && span.movementId === movementId
          ? { ...span, performance }
          : span,
      ),
    };
  };
  const pullUps = (session: ReturnType<typeof deriveSession>) =>
    session.parts
      .flatMap((part) => part.blocks.flatMap((block) => block.items))
      .flatMap((item) => [item, ...item.alternatives])
      .find((item) => item.movementId === "pull-up");

  it("carries how a movement was done onto its item", () => {
    const performance: Performance = {
      variants: [{ movementId: MovementId.make("pull-up"), reps: 6 }],
      unbroken: 2,
    };
    const session = deriveSession(withPerformance("pull-up", performance), nameOf);
    expect(pullUps(session)?.performance).toEqual(performance);
    expect(blockingIssues(session)).toEqual([]);
  });

  it("refuses a variation outside the catalog or an impossible number", () => {
    const messages = (performance: Performance) =>
      blockingIssues(deriveSession(withPerformance("pull-up", performance), nameOf)).map(
        (issue) => issue.message,
      );
    expect(messages({ variants: [{ movementId: MovementId.make("nope"), reps: 4 }] })).toEqual([
      'Pull-up: "nope" is not in the catalog.',
    ]);
    expect(messages({ loadKg: 2000 })).toEqual(["Pull-up: the load must be at most 1000 kg."]);
    expect(messages({ unbroken: 5000 })).toEqual([
      "Pull-up: the biggest unbroken set must be 0 to 1000.",
    ]);
    expect(messages({ perRound: { min: 8, max: 7 } })).toEqual([
      "Pull-up: the count each round must run from low to high.",
    ]);
    expect(
      pullUps(deriveSession(withPerformance("pull-up", { loadKg: 2000 }), nameOf))?.performance,
    ).toBeUndefined();
  });

  it("carries the planned scaling separately, checked the same way", () => {
    const document = withPerformance("pull-up", { unbroken: 3 });
    const plan: Performance = { variants: [{ movementId: MovementId.make("pull-up"), reps: 4 }] };
    const planned = (next: Performance): ImportDocument => ({
      ...document,
      spans: document.spans.map((span) =>
        span._tag === "movement" && span.movementId === "pull-up" ? { ...span, plan: next } : span,
      ),
    });
    const session = deriveSession(planned(plan), nameOf);
    expect(pullUps(session)).toMatchObject({ plan, performance: { unbroken: 3 } });
    expect(
      blockingIssues(deriveSession(planned({ loadKg: 2000 }), nameOf)).map(
        (issue) => issue.message,
      ),
    ).toEqual(["Pull-up (plan): the load must be at most 1000 kg."]);
  });
});
