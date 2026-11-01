import {
  lineNumberOf,
  resultSets,
  splitLines,
  type CatalogMovement,
  type DerivedSession,
  type LiftResult,
  type MovementId,
  type PerformedSet,
  type Span,
  type SpanId,
  type SpanOf,
} from "@chalk/contracts";

import { draftFromResults, resultsFromDraft, type ResultDefaults } from "./resultDraft.ts";

/**
 * Barbell movements written on one line of a block ("1 power clean + 2 hang power clean"): a
 * complex, done on one bar, so its loads are entered once. Read from the text like everything
 * else; each movement still keeps its own result, so rep maxes and tonnage stay per movement.
 */
export interface Complex {
  /** Its movement spans in the order written; the first leads. */
  readonly members: ReadonlyArray<SpanId>;
  /** One bar: loads entered once. `false` once a movement was given a load of its own. */
  readonly shared: boolean;
}

/** Every movement span that is part of a complex, with its complex. */
export function findComplexes(
  session: DerivedSession,
  document: { readonly text: string; readonly spans: ReadonlyArray<Span> },
  categoryOf: (id: MovementId) => CatalogMovement["category"] | undefined,
): ReadonlyMap<SpanId, Complex> {
  const lines = splitLines(document.text);
  const spans = new Map(
    document.spans.flatMap((span) => (span._tag === "movement" ? [[span.id, span] as const] : [])),
  );
  const complexes = new Map<SpanId, Complex>();
  for (const block of session.parts.flatMap((part) => part.blocks)) {
    const byLine = new Map<number, Array<SpanOf<"movement">>>();
    for (const item of block.items) {
      const span = spans.get(item.spanId);
      // A movement with an alternative ("or 3 deadlifts") is a choice, not part of a bar.
      if (span === undefined || item.alternatives.length > 0) continue;
      const line = lineNumberOf(lines, span.start);
      byLine.set(line, [...(byLine.get(line) ?? []), span]);
    }
    for (const members of byLine.values()) {
      if (members.length < 2) continue;
      if (
        !members.every(
          (span) => span.movementId !== undefined && categoryOf(span.movementId) === "barbell",
        )
      )
        continue;
      const complex: Complex = {
        members: members.map((span) => span.id),
        shared: !members.some((span) => span.separateLoad === true),
      };
      for (const span of members) complexes.set(span.id, complex);
    }
  }
  return complexes;
}

const kg = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

/**
 * What a complex lifted, set by set, from the sets each movement's result lists (missed ones
 * included), in order: "6 × (1 + 2) @ 60 kg", "1 + 2 @ 60 · 65 · 70 kg", and a missed rep as
 * its own run, "… · 1 + 1 @ 77.5 kg".
 */
export function formatComplex(lists: ReadonlyArray<ReadonlyArray<PerformedSet>>): string {
  const [lead] = lists;
  if (lead === undefined || lead.length === 0) return "";
  const sets = lead.map((set, at) => ({
    reps: lists.map((list) => list[at]?.reps ?? 0).join(" + "),
    loadKg: set.loadKg,
  }));
  const runs: Array<{ reps: string; loads: Array<number> }> = [];
  for (const set of sets) {
    const last = runs.at(-1);
    if (last?.reps === set.reps) last.loads.push(set.loadKg);
    else runs.push({ reps: set.reps, loads: [set.loadKg] });
  }
  const [only] = runs;
  if (runs.length === 1 && only && only.loads.every((load) => load === only.loads[0]))
    return `${only.loads.length} × (${only.reps}) @ ${kg.format(only.loads[0] ?? 0)} kg`;
  return runs
    .map((run) => `${run.reps} @ ${run.loads.map((load) => kg.format(load)).join(" · ")} kg`)
    .join(" · ");
}

const withField = <K extends "result" | "performance" | "plan">(
  span: SpanOf<"movement">,
  key: K,
  value: SpanOf<"movement">[K],
): SpanOf<"movement"> => {
  const { [key]: _old, ...rest } = span;
  return (value === undefined ? rest : { ...rest, [key]: value }) as SpanOf<"movement">;
};

/** The complex's movements with these results, one per movement in order. */
export const withResults = (
  members: ReadonlyArray<SpanOf<"movement">>,
  results: ReadonlyArray<LiftResult | undefined>,
): ReadonlyArray<SpanOf<"movement">> =>
  members.map((span, at) => withField(span, "result", results[at]));

/** The complex's movements, all planned or done the same way: one bar, one load. */
export const withShared = (
  members: ReadonlyArray<SpanOf<"movement">>,
  key: "performance" | "plan",
  value: SpanOf<"movement">["performance"],
): ReadonlyArray<SpanOf<"movement">> => members.map((span) => withField(span, key, value));

/** Every movement at its own load again, keeping what each has. */
export const separateLoads = (
  members: ReadonlyArray<SpanOf<"movement">>,
): ReadonlyArray<SpanOf<"movement">> => members.map((span) => ({ ...span, separateLoad: true }));

/**
 * One bar again: the lead's plan, how it was done and its loads for every movement, each keeping
 * its own reps.
 */
export function shareLoads(
  members: ReadonlyArray<SpanOf<"movement">>,
  defaults: ReadonlyArray<ResultDefaults>,
): ReadonlyArray<SpanOf<"movement">> {
  const [lead] = members;
  if (lead === undefined) return members;
  // Mixed modes (a fixed lead, a movement set by set) rejoin set by set, so a missed rep stays.
  const own = members.map((span) => span.result);
  const mixed = own.some((result) => result !== undefined && result._tag !== lead.result?._tag);
  const results = resultsFromDraft(
    draftFromResults(
      mixed
        ? own.map((result) => result && { _tag: "each" as const, sets: resultSets(result) })
        : own,
      defaults,
    ),
    members.length,
  );
  return members.map((span, at) => {
    const { separateLoad: _old, ...rest } = span;
    return withField(
      withField(withField(rest, "plan", lead.plan), "performance", lead.performance),
      "result",
      lead.result === undefined ? undefined : results[at],
    );
  });
}
