import type { DerivedItem, SpanId, SpanOf } from "@chalk/contracts";

/**
 * A station of the board and the ways it may be done: "60 Double unders or 90 Single unders" is
 * one station with two options, the item and its alternatives, done one way.
 */
export const stationOptions = (item: DerivedItem): ReadonlyArray<DerivedItem> => [
  item,
  ...item.alternatives,
];

/** Which record picks an option: the plan while planning, else how it was done. */
export type StationSide = "planned" | "done";

/**
 * The option the athlete picked, when they picked one. Planning: the first with a plan. Done:
 * the first done (a scaling or a lift result), else the first planned.
 */
export const chosenOption = (item: DerivedItem, side: StationSide): DerivedItem | undefined => {
  const options = stationOptions(item);
  const planned = options.find((option) => option.plan !== undefined);
  if (side === "planned") return planned;
  return (
    options.find((option) => option.performance !== undefined || option.performed.length > 0) ??
    planned
  );
};

/**
 * The option spans after choosing `chosen`: it keeps its record (or takes "as written"), the
 * other options drop theirs, so the station is graded on the one way it is done.
 */
export const chooseOption = (
  options: ReadonlyArray<SpanOf<"movement">>,
  chosen: SpanId,
  record: "plan" | "performance",
): ReadonlyArray<SpanOf<"movement">> =>
  options.map((span) => {
    if (span.id === chosen) return { ...span, [record]: span[record] ?? {} };
    const { [record]: _dropped, ...rest } = span;
    return rest;
  });
