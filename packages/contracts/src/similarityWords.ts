import type { MovementId } from "./baseSchemas.ts";
import { describeBlock } from "./blockLabels.ts";
import type { Quantity } from "./sessionImport.ts";
import { formatQuantity } from "./sessionImport/derive.ts";
import type { PartDifference, PartRef } from "./similarity.ts";

/** "Workout #2 · AMRAP 15 min", or the part's title when no block has a format. */
export const partLabel = (part: PartRef): string =>
  part.headline === null || part.headline.format === null
    ? part.title
    : `${part.title} · ${describeBlock(part.headline.format, part.headline.params)}`;

const setsText = (sets: ReadonlyArray<ReadonlyArray<Quantity>>) =>
  sets.map((set) => set.map(formatQuantity).join(" ")).join(" · ") || "no numbers";

/**
 * One difference as a short line, read from this session toward the other one: `when` is
 * "then" for an earlier session, "later" for a later one.
 */
export function describeDifference(
  difference: PartDifference,
  nameOf: (id: MovementId) => string,
  when: "then" | "later",
): string {
  switch (difference._tag) {
    case "format":
      return `${describeBlock(difference.there.format ?? undefined, difference.there.params)} ${when}`;
    case "swapped":
      return `${nameOf(difference.there)} ${when}, ${nameOf(difference.here).toLowerCase()} here`;
    case "extra":
      return `${nameOf(difference.movementId)} only here`;
    case "missing":
      return `${nameOf(difference.movementId)} only ${when}`;
    case "numbers":
      return `${nameOf(difference.movementId)} ${setsText(difference.there)} ${when}`;
  }
}
