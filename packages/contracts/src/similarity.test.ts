import { describe, expect, it } from "@effect/vitest";

import { BenchmarkId, MovementId } from "./baseSchemas.ts";
import { findSimilarParts, type PartShape } from "./similarity.ts";
import { deriveSession } from "./sessionImport/derive.ts";
import {
  BENCH_MAX_OUT,
  CATALOG,
  SESSION_160,
  SESSION_166,
  SESSION_167,
} from "./sessionImport/fixtures/sessions.ts";
import { makeMovementMatcher } from "./sessionImport/movementMatcher.ts";
import { suggestSpans } from "./sessionImport/suggest.ts";

const matcher = makeMovementMatcher(CATALOG);
const nameOf = (id: MovementId) => CATALOG.find((movement) => movement.id === id)?.name;
const CORES: Record<string, string> = { "power-clean": "clean", "hang-power-clean": "clean" };
const coreOf = (id: MovementId) => MovementId.make(CORES[id] ?? id);

/** The parts a saved import of `text` would have, as the server reads them back. */
function partsOf(workoutId: string, performedOn: string, text: string): Array<PartShape> {
  let next = 0;
  const session = deriveSession(
    { text, spans: suggestSpans(text, matcher, () => `s${++next}`), performedOn },
    nameOf,
  );
  return session.parts.map((part, position) => ({
    id: `${workoutId}/${position}`,
    workoutId,
    performedOn,
    benchmarkId: part.benchmarkId,
    blocks: part.blocks.map((block) => ({
      format: block.format,
      params: block.params,
      items: block.items.flatMap((item) =>
        item.movementId === undefined
          ? []
          : [{ movementId: item.movementId, sets: item.sets.map((set) => set.quantities) }],
      ),
    })),
  }));
}

const AMRAP_RETEST = `**** Workout #1
- Amrap 12
- 60 Double under or 90 Single unders
- 15 Thrusters @40/25
- 10 Burpee over barbell`;

describe("findSimilarParts", () => {
  it("calls the same workout on another day a repeat, both ways", () => {
    const echoes = findSimilarParts(
      [...partsOf("a", "2026-10-28", SESSION_167), ...partsOf("b", "2027-02-03", SESSION_167)],
      coreOf,
    );
    expect(
      echoes.map((echo) => [echo.part, echo.matches.map((match) => [match.other, match.kind])]),
    ).toEqual([
      ["a/0", [["b/0", "repeat"]]],
      ["a/1", [["b/1", "repeat"]]],
      ["b/0", [["a/0", "repeat"]]],
      ["b/1", [["a/1", "repeat"]]],
    ]);
  });

  it("finds a close variant and says what differs, read from the part toward the other", () => {
    const echoes = findSimilarParts(
      [...partsOf("old", "2026-10-28", SESSION_167), ...partsOf("new", "2026-12-01", AMRAP_RETEST)],
      coreOf,
    );
    const retest = echoes.find((echo) => echo.part === "new/0");
    expect(retest?.matches).toEqual([
      {
        other: "old/1",
        kind: "similar",
        score: 0.84,
        differences: [
          {
            _tag: "format",
            here: { format: "amrap", params: { durationSeconds: 720 } },
            there: { format: "amrap", params: { durationSeconds: 900 } },
          },
          {
            _tag: "numbers",
            movementId: "thruster",
            here: [
              [
                { measure: "reps", amount: { min: 15, max: 15 } },
                { measure: "load_kg", amount: { min: 40, max: 40 }, female: { min: 25, max: 25 } },
              ],
            ],
            there: [
              [
                { measure: "reps", amount: { min: 12, max: 12 } },
                { measure: "load_kg", amount: { min: 40, max: 40 }, female: { min: 25, max: 25 } },
              ],
            ],
          },
        ],
      },
    ]);
  });

  it("leaves unrelated parts and the session's own parts alone", () => {
    const echoes = findSimilarParts(
      [...partsOf("a", "2026-10-26", SESSION_166), ...partsOf("b", "2026-10-28", SESSION_167)],
      coreOf,
    );
    // Both sessions row and burpee in a metcon, but formats, the rest and the numbers differ.
    expect(echoes).toEqual([]);
  });

  it("reports a single lift only when it repeats: its look-alikes are the lift's history", () => {
    const squat = (load: number) => `**** Workout #1\n- Back squat 5x5 @${load}kg`;
    const echoes = findSimilarParts(
      [
        ...partsOf("a", "2026-09-01", squat(100)),
        ...partsOf("b", "2026-10-01", squat(100)),
        ...partsOf("c", "2026-11-01", squat(105)),
        // The same max-out ladder on another lift is another workout.
        ...partsOf("d", "2026-10-13", SESSION_160).slice(0, 1),
        ...partsOf("e", "2026-10-20", BENCH_MAX_OUT).slice(0, 1),
      ],
      coreOf,
    );
    expect(echoes.map((echo) => [echo.part, echo.matches.map((match) => match.other)])).toEqual([
      ["a/0", ["b/0"]],
      ["b/0", ["a/0"]],
    ]);
  });

  it("calls two parts naming the same benchmark a repeat, however they were written", () => {
    const fran = (id: string, performedOn: string): PartShape => ({
      id,
      workoutId: id,
      performedOn,
      benchmarkId: BenchmarkId.make("fran"),
      blocks: [],
    });
    const echoes = findSimilarParts([fran("a", "2026-01-01"), fran("b", "2026-06-01")], coreOf);
    expect(echoes.map((echo) => echo.matches[0]?.kind)).toEqual(["repeat", "repeat"]);
  });
});
