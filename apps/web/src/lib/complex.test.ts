import type { Span, SpanOf } from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import { complexPartners, resultAtReps } from "./complex.ts";

const TEXT = `- Every 90 sec x 8
- 1 Snatch pull + 1 snatch + 2 overhead squat
- 60 double-unders or 90 single-unders
- 5 back squat`;

/** The span over `phrase`, at the first place `context` (which starts with it) is written. */
const movement = (
  id: string,
  phrase: string,
  extra: Partial<SpanOf<"movement">> = {},
  context = phrase,
) => {
  const start = TEXT.indexOf(context);
  return { _tag: "movement", id, start, end: start + phrase.length, ...extra } as const;
};

const pull = movement("pull", "Snatch pull");
const snatch = movement("snatch", "snatch", {}, "snatch +");
const ohs = movement("ohs", "overhead squat");
const du = movement("du", "double-unders");
const su = movement("su", "single-unders", { alternativeOf: "du" });
const squat = movement("squat", "back squat");
const SPANS: ReadonlyArray<Span> = [pull, snatch, ohs, du, su, squat];

describe("complexPartners", () => {
  it("finds the other movements on the line", () => {
    expect(complexPartners(TEXT, SPANS, snatch).map((span) => span.id)).toEqual(["pull", "ohs"]);
  });

  it("leaves out alternatives and lone movements", () => {
    expect(complexPartners(TEXT, SPANS, du)).toEqual([]);
    expect(complexPartners(TEXT, SPANS, su)).toEqual([]);
    expect(complexPartners(TEXT, SPANS, squat)).toEqual([]);
  });
});

describe("resultAtReps", () => {
  it("keeps the sets and loads and takes the movement's own reps", () => {
    expect(resultAtReps({ _tag: "fixed", sets: 8, reps: 1, loadKg: 60 }, 2)).toEqual({
      _tag: "fixed",
      sets: 8,
      reps: 2,
      loadKg: 60,
    });
    expect(
      resultAtReps(
        {
          _tag: "each",
          sets: [
            { reps: 1, loadKg: 60 },
            { reps: 1, loadKg: 65 },
          ],
        },
        2,
      ),
    ).toEqual({
      _tag: "each",
      sets: [
        { reps: 2, loadKg: 60 },
        { reps: 2, loadKg: 65 },
      ],
    });
    const ramp = { _tag: "ramp", sets: 6, reps: 1, startKg: 50, stepKg: 2.5 } as const;
    expect(resultAtReps(ramp, undefined)).toBe(ramp);
  });
});
