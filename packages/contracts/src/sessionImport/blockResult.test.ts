import { describe, expect, it } from "@effect/vitest";

import { MovementId } from "../baseSchemas.ts";
import { bodyOf } from "../power/body.ts";
import { estimateBlockWork, workModelsFor } from "../power/estimate.ts";
import type { BlockResult, ImportDocument, SpanOf } from "../sessionImport.ts";
import { cappedTotal, formatBlockResult, parseClock } from "./blockResult.ts";
import { blockingIssues, deriveSession, type DerivedBlock } from "./derive.ts";
import { CAPPED_FOR_TIME, CATALOG } from "./fixtures/sessions.ts";
import { makeMovementMatcher } from "./movementMatcher.ts";
import { parseTimeCap } from "./parse.ts";
import { suggestSpans } from "./suggest.ts";

const matcher = makeMovementMatcher(CATALOG);
const nameOf = (id: MovementId) => CATALOG.find((movement) => movement.id === id)?.name;

const suggested = (text: string): ImportDocument => {
  let next = 0;
  return {
    text,
    performedOn: "2025-08-25",
    spans: suggestSpans(text, matcher, () => `s${++next}`),
  };
};

/** The document with `result` entered on its first block. */
const withResult = (document: ImportDocument, result: BlockResult): ImportDocument => ({
  ...document,
  spans: document.spans.map((span) => (span._tag === "block" ? { ...span, result } : span)),
});

const firstBlock = (document: ImportDocument): DerivedBlock =>
  deriveSession(document, nameOf).parts[0]!.blocks[0]!;

const movements = (document: ImportDocument) =>
  document.spans.filter((span): span is SpanOf<"movement"> => span._tag === "movement");

describe("parseClock", () => {
  it("reads a time as typed, and whole minutes", () => {
    expect(parseClock("12:34")).toBe(754);
    expect(parseClock(" 1:02:05 ")).toBe(3725);
    expect(parseClock("12.34")).toBe(754);
    expect(parseClock("12")).toBe(720);
  });

  it("refuses what is not a time", () => {
    expect(parseClock("12:75")).toBeUndefined();
    expect(parseClock("12 min")).toBeUndefined();
    expect(parseClock("")).toBeUndefined();
  });
});

describe("formatBlockResult", () => {
  it("writes each result the way the board does", () => {
    expect(formatBlockResult({ _tag: "time", seconds: 754 })).toBe("12:34");
    expect(formatBlockResult({ _tag: "capped", round: 1, at: "x", reps: 23, total: 113 })).toBe(
      "Capped · 113 reps",
    );
    expect(formatBlockResult({ _tag: "rounds_reps", rounds: 5, reps: 12 })).toBe("5+12");
    expect(formatBlockResult({ _tag: "reps", reps: 1 })).toBe("1 rep");
  });
});

describe("parseTimeCap", () => {
  it("reads a cap written before or after its minutes", () => {
    expect(parseTimeCap("Cap = 15 Minutes")).toBe(900);
    expect(parseTimeCap("Time cap: 12 min")).toBe(720);
    expect(parseTimeCap("(TC 20)")).toBe(1200);
    expect(parseTimeCap("15 min cap")).toBe(900);
    expect(parseTimeCap("Goal = <12 Minutes")).toBeUndefined();
  });

  it("caps the for-time block above the line, past the Rx+ options", () => {
    const block = firstBlock(suggested(CAPPED_FOR_TIME));
    expect(block.params.timeCapSeconds).toBe(900);
  });

  it("caps a for-time block written on its format line", () => {
    const block = firstBlock(suggested("For time (15 min cap)\n30 Burpees\n30 Pull-ups"));
    expect(block.params.timeCapSeconds).toBe(900);
    expect(block.items).toHaveLength(2);
  });
});

describe("a capped for-time", () => {
  const document = suggested(CAPPED_FOR_TIME);
  const lastBurpees = firstBlock(document).items.at(-1)!;

  it("adds up the stations before where the cap came, then the reps of that one", () => {
    // 30 + 15 + 30 + 15, then 23 of the last 30 burpees.
    expect(
      cappedTotal(firstBlock(document), { round: 1, at: lastBurpees.spanId, reps: 23 }, "m"),
    ).toBe(113);
  });

  it("counts full rounds and each round of a scheme", () => {
    const scheme = suggested("Metcon\n21-15-9 for time\nThrusters\nPull-ups");
    const [thrusters, pullUps] = movements(scheme);
    // 21 + 21, 15 + 15, then 4 thrusters into the round of 9; or 21 + 21, 15, then 10 pull-ups.
    expect(cappedTotal(firstBlock(scheme), { round: 3, at: thrusters!.id, reps: 4 }, "m")).toBe(76);
    expect(cappedTotal(firstBlock(scheme), { round: 2, at: pullUps!.id, reps: 10 }, "m")).toBe(67);
  });

  it("scores the block with the entered result first", () => {
    const block = firstBlock(
      withResult(document, {
        _tag: "capped",
        round: 1,
        at: lastBurpees.spanId,
        reps: 23,
        total: 113,
      }),
    );
    expect(block.result?._tag).toBe("capped");
    expect(block.resultSpanId).toBe(document.spans.find((span) => span._tag === "block")!.id);
    expect(block.scores).toEqual(["Capped · 113 reps"]);
  });

  it("blocks saving a result that stops at a movement no longer in the block", () => {
    const session = deriveSession(
      withResult(document, { _tag: "capped", round: 1, at: "gone", reps: 23, total: 113 }),
      nameOf,
    );
    expect(session.parts[0]!.blocks[0]!.result).toBeUndefined();
    expect(blockingIssues(session).map((issue) => issue.message)).toEqual([
      "For time: the capped result stops at a movement no longer in the block; pick where you stopped again.",
    ]);
  });

  it("blocks saving a total the block no longer adds up to, or reps past the station", () => {
    const messages = (result: BlockResult) =>
      blockingIssues(deriveSession(withResult(document, result), nameOf)).map(
        (issue) => issue.message,
      );
    const stop = { _tag: "capped", round: 1, at: lastBurpees.spanId } as const;
    expect(messages({ ...stop, reps: 23, total: 103 })).toEqual([
      "For time: the capped result says 103 reps, but the block now adds up to 113; enter it again.",
    ]);
    expect(messages({ ...stop, reps: 31, total: 121 })).toEqual([
      "For time: the capped result has 31 reps of a station of 30.",
    ]);
  });

  it("holds the reps and the total to the same side of an M/F split", () => {
    const split = suggested("Metcon\nFor time\n12/10 cal Row\n30/20 Burpees");
    const [, burpees] = firstBlock(split).items;
    // 25 burpees pass the male station of 30; 35 is only the female total (10 + 25).
    const issues = blockingIssues(
      deriveSession(
        withResult(split, { _tag: "capped", round: 1, at: burpees!.spanId, reps: 25, total: 35 }),
        nameOf,
      ),
    );
    expect(issues.map((issue) => issue.message)).toEqual([
      "For time: the capped result says 35 reps, but the block now adds up to 37; enter it again.",
    ]);
  });

  it("warns when there is no cap to time it by", () => {
    const uncapped = suggested("For time:\n30 Burpees\n30 Pull-ups");
    const [, pullUps] = movements(uncapped);
    const session = deriveSession(
      withResult(uncapped, { _tag: "capped", round: 1, at: pullUps!.id, reps: 5, total: 35 }),
      nameOf,
    );
    expect(session.issues.map((issue) => `${issue.severity}: ${issue.message}`)).toEqual([
      "warning: For time: capped, but the block has no time cap, so its time is unknown.",
    ]);
  });

  it("is worked over its cap, up to where it stopped", () => {
    const jan = bodyOf({ sex: "m", heightCm: 180, bodyweightKg: 85 });
    const modelOf = workModelsFor([]);
    const finished = estimateBlockWork(
      firstBlock(withResult(document, { _tag: "time", seconds: 900 })),
      jan,
      modelOf,
    );
    const capped = estimateBlockWork(
      firstBlock(
        withResult(document, {
          _tag: "capped",
          round: 1,
          at: lastBurpees.spanId,
          reps: 23,
          total: 113,
        }),
      ),
      jan,
      modelOf,
    );
    expect(capped.seconds).toBe(900);
    const burpees = (work: typeof capped) =>
      work.items
        .filter((item) => item.movementId === "bar-facing-burpee")
        .reduce((total, item) => total + item.amount, 0);
    expect(burpees(finished)).toBe(60);
    expect(burpees(capped)).toBe(53);
    expect(capped.joules).toBeLessThan(finished.joules);
  });
});

describe("movements of a block scored as a whole", () => {
  /** The document with `loadKg` as how its movements `at` were done. */
  const doneAt = (document: ImportDocument, at: ReadonlyArray<number>, loadKg: number) => {
    const ids = new Set(at.map((index) => movements(document)[index]!.id));
    return {
      ...document,
      spans: document.spans.map((span) =>
        span._tag === "movement" && ids.has(span.id) ? { ...span, performance: { loadKg } } : span,
      ),
    };
  };
  const lifted = (block: DerivedBlock) =>
    block.items.map((item) => item.performed.map((set) => `${set.reps}@${set.loadKg}`).join(" "));

  // 30 burpees, 15 hang power cleans, 30 pull-ups, 15 hang power cleans, 30 burpees.
  const cleans = doneAt(suggested(CAPPED_FOR_TIME), [1, 3], 35);

  it("lift the load they were done at, once per round, before a score is entered", () => {
    const session = deriveSession(cleans, nameOf);
    expect(lifted(session.parts[0]!.blocks[0]!)).toEqual(["", "15@35", "", "15@35", ""]);
    expect(session.tonnageKg).toBe(1050);
  });

  it("lift only what came before the cap", () => {
    const pullUps = movements(cleans)[2]!;
    const block = firstBlock(
      withResult(cleans, { _tag: "capped", round: 1, at: pullUps.id, reps: 10, total: 55 }),
    );
    expect(lifted(block)).toEqual(["", "15@35", "", "", ""]);
    expect(block.tonnageKg).toBe(525);
  });

  it("lift both bells of a pair", () => {
    const pair = {
      ...cleans,
      spans: cleans.spans.map((span) =>
        span._tag === "movement" && span.performance !== undefined
          ? { ...span, performance: { loadKg: 22.5, implements: 2 as const } }
          : span,
      ),
    };
    expect(lifted(firstBlock(pair))).toEqual(["", "15@45", "", "15@45", ""]);
  });

  it("lift an AMRAP's full rounds and the reps into the next", () => {
    const amrap = doneAt(suggested("Metcon\nAMRAP 10 min\n5 Deadlifts\n10 Burpees"), [0], 100);
    // 3 rounds, then 7 reps: 5 deadlifts and 2 burpees.
    const block = firstBlock(withResult(amrap, { _tag: "rounds_reps", rounds: 3, reps: 7 }));
    expect(lifted(block)).toEqual(["5@100 5@100 5@100 5@100", ""]);
    expect(lifted(firstBlock(amrap))).toEqual(["", ""]);
  });

  it("leave reps split by variation, or by sex, to a result of their own", () => {
    const split = doneAt(suggested("Metcon\nFor time\n21/15 Deadlifts\n30 Burpees"), [0], 100);
    expect(lifted(firstBlock(split))).toEqual(["", ""]);
    // Unless the athlete says how many they did.
    const counted = {
      ...split,
      spans: split.spans.map((span) =>
        span._tag === "movement" && span.performance !== undefined
          ? { ...span, performance: { loadKg: 100, perRound: { min: 15, max: 15 } } }
          : span,
      ),
    };
    expect(lifted(firstBlock(counted))).toEqual(["15@100", ""]);
    const variants = {
      ...cleans,
      spans: cleans.spans.map((span) =>
        span._tag === "movement" && span.performance !== undefined
          ? {
              ...span,
              performance: { loadKg: 35, variants: [{ movementId: span.movementId!, reps: 15 }] },
            }
          : span,
      ),
    };
    expect(lifted(firstBlock(variants))).toEqual(["", "", "", "", ""]);
  });
});

describe("a movement done as prescribed in a block scored as a whole", () => {
  it("lifts the load as written, when it is one for everybody", () => {
    const prescribed = (text: string) => {
      const document = suggested(text);
      return firstBlock({
        ...document,
        spans: document.spans.map((span) =>
          span._tag === "movement" ? { ...span, performance: {} } : span,
        ),
      }).items.map((item) => item.performed.map((set) => `${set.reps}@${set.loadKg}`).join(" "));
    };
    expect(prescribed("Metcon\nFor time\n15 Hang Power Cleans 50 kg\n30 Burpees")).toEqual([
      "15@50",
      "",
    ]);
    expect(prescribed(CAPPED_FOR_TIME)).toEqual(["", "", "", "", ""]);
  });
});
