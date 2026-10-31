import { describe, expect, it } from "@effect/vitest";

import type { MovementId } from "../baseSchemas.ts";
import type { ImportDocument } from "../sessionImport.ts";
import { blockingIssues, deriveSession, formatQuantity, type DerivedItem } from "./derive.ts";
import { CATALOG } from "./fixtures/sessions.ts";
import { makeMovementMatcher } from "./movementMatcher.ts";
import { suggestSpans } from "./suggest.ts";

const matcher = makeMovementMatcher(CATALOG);
const nameOf = (id: MovementId) => CATALOG.find((movement) => movement.id === id)?.name;

const documentOf = (text: string): ImportDocument => {
  let next = 0;
  return { text, spans: suggestSpans(text, matcher, () => `s${++next}`) };
};

const itemRow = (item: DerivedItem) =>
  `${item.movementId}[${item.sets.flatMap((set) => set.quantities.map(formatQuantity)).join(" ")}]`;

const FRAN_DAY = `** Session 170 <2026-10-30 to>
*** Workout
**** Workout #1
- Back squat 5x5 @100kg
**** Workout #2
- "Fran" (benchmark)
- *Go unbroken on the thrusters.
*** Notes
- Fran: 4:32`;

describe("benchmarks in a pasted session", () => {
  it("are suggested from a line that names one, with its score from the notes", () => {
    const document = documentOf(FRAN_DAY);
    const benchmark = document.spans.find((span) => span._tag === "benchmark");
    expect(benchmark).toMatchObject({ benchmarkId: "fran" });
    expect(FRAN_DAY.slice(benchmark!.start, benchmark!.end)).toBe("Fran");
    const score = document.spans.find((span) => span._tag === "score");
    expect(score).toMatchObject({ attachedTo: benchmark!.id });
    expect(FRAN_DAY.slice(score!.start, score!.end)).toBe("4:32");
  });

  it("give a part with only the name the benchmark's blocks and movements", () => {
    const session = deriveSession(documentOf(FRAN_DAY), nameOf);
    expect(blockingIssues(session)).toEqual([]);
    const fran = session.parts[1]!;
    expect(fran).toMatchObject({ title: "Workout #2", benchmarkId: "fran" });
    expect(
      fran.blocks.map((block) => `${block.title}: ${block.items.map(itemRow).join(", ")}`),
    ).toEqual(["21-15-9 reps for time: thruster[43/29 kg], pull-up[]"]);
    expect(fran.blocks[0]!.intents.map((intent) => intent.text)).toEqual([
      "Go unbroken on the thrusters.",
    ]);
    expect(fran.blocks[0]!.scores).toEqual(["4:32"]);
    expect(session.parts[0]!.benchmarkId).toBeUndefined();
    expect(session).toMatchObject({ kind: "for_time", score: "4:32" });
  });

  it("keep the movements the board wrote out, and only link the part", () => {
    const text = `**** Fran
- 21-15-9
- Thrusters @40/25
- Pull-ups`;
    const session = deriveSession(documentOf(text), nameOf);
    expect(session.parts).toHaveLength(1);
    expect(session.parts[0]).toMatchObject({ title: "Fran", benchmarkId: "fran" });
    expect(session.parts[0]!.blocks.flatMap((block) => block.items.map(itemRow))).toEqual([
      "thruster[40/25 kg]",
      "pull-up[]",
    ]);
  });

  it("start a part of their own after movements, and need the catalog's movements", () => {
    const text = `- Row 500m
- Murph`;
    const session = deriveSession(documentOf(text), nameOf);
    expect(session.parts.map((part) => [part.title, part.benchmarkId])).toEqual([
      ["Workout", undefined],
      ["Murph", "murph"],
    ]);
    // The fixture catalog has no runs, push-ups or squats.
    expect(blockingIssues(session).map((issue) => issue.message)).toContain(
      'Murph uses "run", which is not in the catalog.',
    );
  });

  it("are not suggested for near misses or numbers on the line", () => {
    const text = `- Franny
- Fran 21-15-9
- Cindy-ish`;
    expect(documentOf(text).spans.filter((span) => span._tag === "benchmark")).toEqual([]);
  });
});
