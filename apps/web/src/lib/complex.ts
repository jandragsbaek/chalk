import type { LiftResult, Span, SpanOf } from "@chalk/contracts";

/**
 * The other movements of a complex: movement spans on the same line as `span` ("1 Snatch pull +
 * 1 snatch + 2 overhead squat"). One bar, so they share sets and load. Alternatives ("60 DU or
 * 90 SU") are choices, not a complex, and are left out.
 */
export const complexPartners = (
  text: string,
  spans: ReadonlyArray<Span>,
  span: SpanOf<"movement">,
): ReadonlyArray<SpanOf<"movement">> => {
  const lineStart = text.lastIndexOf("\n", span.start - 1) + 1;
  const newline = text.indexOf("\n", span.end);
  const lineEnd = newline === -1 ? text.length : newline;
  const alternatives = new Set(
    spans.flatMap((candidate) =>
      candidate._tag === "movement" && candidate.alternativeOf !== undefined
        ? [candidate.id, candidate.alternativeOf]
        : [],
    ),
  );
  if (alternatives.has(span.id)) return [];
  return spans.filter(
    (candidate): candidate is SpanOf<"movement"> =>
      candidate._tag === "movement" &&
      candidate.id !== span.id &&
      candidate.start >= lineStart &&
      candidate.end <= lineEnd &&
      !alternatives.has(candidate.id),
  );
};

/** `result`'s sets and loads at another movement's own reps; its reps when that has none. */
export const resultAtReps = (result: LiftResult, reps: number | undefined): LiftResult => {
  if (reps === undefined) return result;
  switch (result._tag) {
    case "fixed":
    case "ramp":
      return { ...result, reps };
    case "each":
      return { ...result, sets: result.sets.map((set) => ({ ...set, reps })) };
  }
};
