import {
  deriveSession,
  makeMovementMatcher,
  MovementId,
  suggestSpans,
  type CatalogMovement,
  type ImportDocument,
  resultSets,
  type LiftResult,
  type SpanOf,
} from "@chalk/contracts";
import { describe, expect, it } from "vite-plus/test";

import { findComplexes, formatComplex, separateLoads, shareLoads } from "./complexes.ts";
import { draftFromResults, resultsFromDraft, switchMode } from "./resultDraft.ts";

const movement = (id: string, name: string, category: CatalogMovement["category"]) => ({
  id: MovementId.make(id),
  name,
  category,
  aliases: [],
});
const CATALOG: ReadonlyArray<CatalogMovement> = [
  movement("power-clean", "Power clean", "barbell"),
  movement("hang-power-clean", "Hang power clean", "barbell"),
  movement("wall-ball", "Wall ball", "other"),
  movement("burpee", "Burpee", "gymnastics"),
];
const nameOf = (id: string) => CATALOG.find((entry) => entry.id === id)?.name;
const categoryOf = (id: string) => CATALOG.find((entry) => entry.id === id)?.category;

const TEXT = `- Every 90 sec x 6
- 1 Power clean + 2 hang power clean
- AMRAP 10
- 10 Wall ball + 10 Burpee
- 5 Power clean`;

const documentOf = (text: string): ImportDocument => {
  let next = 0;
  return { text, spans: suggestSpans(text, makeMovementMatcher(CATALOG), () => `s${++next}`) };
};
const movements = (document: ImportDocument) =>
  document.spans.filter((span): span is SpanOf<"movement"> => span._tag === "movement");

describe("findComplexes", () => {
  it("joins barbell movements written on one line, and nothing else", () => {
    const document = documentOf(TEXT);
    const complexes = findComplexes(deriveSession(document, nameOf), document, categoryOf);
    const [clean, hang, wallBall, burpee, single] = movements(document);
    const complex = complexes.get(clean!.id);
    expect(complex).toEqual({ members: [clean!.id, hang!.id], shared: true });
    expect(complexes.get(hang!.id)).toBe(complex);
    // A wall ball and a burpee on one line are two things, not one bar.
    expect(complexes.has(wallBall!.id)).toBe(false);
    expect(complexes.has(burpee!.id)).toBe(false);
    expect(complexes.has(single!.id)).toBe(false);
  });

  it("stops sharing once a movement has a load of its own", () => {
    const document = documentOf(TEXT);
    const [clean, hang] = movements(document);
    const separated = separateLoads([clean!, hang!]);
    const spans = document.spans.map(
      (span) => separated.find((candidate) => candidate.id === span.id) ?? span,
    );
    const complexes = findComplexes(
      deriveSession({ ...document, spans }, nameOf),
      { text: TEXT, spans },
      categoryOf,
    );
    expect(complexes.get(clean!.id)?.shared).toBe(false);
  });
});

const NONE = { sets: 6, reps: undefined, loadKg: undefined, rows: undefined };

describe("a complex's result", () => {
  it("types the loads once and the reps as written, a missed rep included", () => {
    const draft = draftFromResults(
      [undefined, undefined],
      [
        { ...NONE, reps: 1 },
        { ...NONE, reps: 2 },
      ],
    );
    expect(draft.reps).toBe("1 + 2");
    const each = switchMode({ ...draft, mode: "ramp", load: "60", step: "5" }, "each", 2);
    expect(each.rows.map((row) => row.reps)).toEqual(Array.from({ length: 6 }, () => "1 + 2"));
    const missed = {
      ...each,
      rows: each.rows.map((row, at) => (at === 5 ? { ...row, reps: "1 + 1" } : row)),
    };
    const [clean, hang] = resultsFromDraft(missed, 2);
    expect(clean).toEqual({
      _tag: "each",
      sets: [60, 65, 70, 75, 80, 85].map((loadKg) => ({ reps: 1, loadKg })),
    });
    expect(hang).toEqual({
      _tag: "each",
      sets: [60, 65, 70, 75, 80, 85].map((loadKg, at) => ({ reps: at === 5 ? 1 : 2, loadKg })),
    });
    // Read back, the draft is what was typed.
    expect(draftFromResults([clean, hang], [NONE, NONE]).rows[5]).toEqual({
      reps: "1 + 1",
      load: "85",
    });
    expect(formatComplex([resultSets(clean!), resultSets(hang!)])).toBe(
      "1 + 2 @ 60 · 65 · 70 · 75 · 80 kg · 1 + 1 @ 85 kg",
    );
  });

  it("needs one count per movement", () => {
    const draft = {
      ...draftFromResults([undefined, undefined], [NONE, NONE]),
      mode: "fixed" as const,
    };
    expect(resultsFromDraft({ ...draft, reps: "1 + 2", load: "60" }, 2)).toEqual([
      { _tag: "fixed", sets: 6, reps: 1, loadKg: 60 },
      { _tag: "fixed", sets: 6, reps: 2, loadKg: 60 },
    ]);
    expect(resultsFromDraft({ ...draft, reps: "3", load: "60" }, 2)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it("formats one load as sets of the complex", () => {
    const fixed = (reps: number): LiftResult => ({ _tag: "fixed", sets: 5, reps, loadKg: 70 });
    expect(formatComplex([resultSets(fixed(1)), resultSets(fixed(2))])).toBe("5 × (1 + 2) @ 70 kg");
  });

  it("shares the lead's loads again, each movement keeping its reps", () => {
    const document = documentOf(TEXT);
    const [clean, hang] = movements(document);
    const shared = shareLoads(
      separateLoads([
        {
          ...clean!,
          plan: { loadKg: 70 },
          result: { _tag: "fixed", sets: 6, reps: 1, loadKg: 70 },
        },
        { ...hang!, result: { _tag: "fixed", sets: 6, reps: 2, loadKg: 50 } },
      ]),
      [NONE, NONE],
    );
    expect(shared.map((span) => [span.separateLoad, span.plan, span.result])).toEqual([
      [undefined, { loadKg: 70 }, { _tag: "fixed", sets: 6, reps: 1, loadKg: 70 }],
      [undefined, { loadKg: 70 }, { _tag: "fixed", sets: 6, reps: 2, loadKg: 70 }],
    ]);
  });

  it("keeps a missed rep when one bar rejoins movements entered in different modes", () => {
    const document = documentOf(TEXT);
    const [clean, hang] = movements(document);
    const shared = shareLoads(
      separateLoads([
        { ...clean!, result: { _tag: "fixed", sets: 2, reps: 1, loadKg: 70 } },
        {
          ...hang!,
          result: {
            _tag: "each",
            sets: [
              { reps: 2, loadKg: 50 },
              { reps: 0, loadKg: 50 },
            ],
          },
        },
      ]),
      [NONE, NONE],
    );
    expect(shared.map((span) => span.result)).toEqual([
      {
        _tag: "each",
        sets: [
          { reps: 1, loadKg: 70 },
          { reps: 1, loadKg: 70 },
        ],
      },
      {
        _tag: "each",
        sets: [
          { reps: 2, loadKg: 70 },
          { reps: 0, loadKg: 70 },
        ],
      },
    ]);
  });
});
