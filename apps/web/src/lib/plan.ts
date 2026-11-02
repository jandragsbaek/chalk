import {
  formatAmount,
  LEVEL_NAMES,
  reachOfTiers,
  scoresMovements,
  type Amount,
  type DerivedBlock,
  type DerivedItem,
  type DerivedSession,
  type Measure,
  type MovementId,
  type Performance,
  type Quantity,
  type SpanId,
  type Sex,
  type SpanOf,
} from "@chalk/contracts";

import { resultDefaults, type ResultDefaults } from "./resultDraft.ts";
import { chosenOption } from "./station.ts";

const kgFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

const ROUND_UNITS: Partial<Record<Measure, string>> = {
  reps: "reps",
  calories: "cal",
  distance_m: "m",
};

/**
 * What a round asks of the item, when it is counted: its targets by level ("18-15/15-12 cal"),
 * else its one count ("12 burpees"). A lift written as sets × reps has no rounds to count.
 */
export function roundTarget(item: DerivedItem): Quantity | undefined {
  const quantities = item.sets.flatMap((set) => set.quantities);
  if (quantities.some((quantity) => quantity.measure === "sets")) return undefined;
  return (
    quantities.find((quantity) => quantity.tiers !== undefined && quantity.tiers.length > 0) ??
    quantities.find((quantity) => ROUND_UNITS[quantity.measure] !== undefined)
  );
}

/** Where a count each round sits on the board's levels: "RX", "under RX (15)". */
export function describeReach(
  perRound: Amount,
  target: Quantity | undefined,
  sex: Sex,
): string | undefined {
  if (target?.tiers === undefined || target.tiers.length === 0) return undefined;
  const reach = reachOfTiers(target.tiers, perRound, sex);
  if (reach.met !== undefined) return LEVEL_NAMES[reach.met];
  return reach.next === undefined
    ? undefined
    : `under ${LEVEL_NAMES[reach.next.level]} (${reach.next.target})`;
}

/** "7-8 cal each round, under RX (15)". */
export function describePerRound(perRound: Amount, target: Quantity | undefined, sex: Sex): string {
  const unit = target === undefined ? undefined : ROUND_UNITS[target.measure];
  const reach = describeReach(perRound, target, sex);
  return `${formatAmount(perRound)}${unit === undefined ? "" : ` ${unit}`} each round${reach === undefined ? "" : `, ${reach}`}`;
}

/**
 * A planned (or done) scaling in a few words: "As written", "2 × 22.5 kg", "25 Jumping pull-up
 * + 20 Pull-up", "7-8 cal each round, under RX (15)". The unbroken set is left out; it is a
 * result, not a plan. `item` gives a count each round its unit and the board's levels.
 */
export function describePlan(
  plan: Performance,
  nameOf: (id: MovementId) => string | undefined,
  sex: Sex,
  item?: DerivedItem,
): string {
  const parts: Array<string> = [];
  if (plan.perRound !== undefined)
    parts.push(
      describePerRound(plan.perRound, item === undefined ? undefined : roundTarget(item), sex),
    );
  if (plan.loadKg !== undefined)
    parts.push(
      plan.implements === 2
        ? `2 × ${kgFormat.format(plan.loadKg)} kg`
        : `${kgFormat.format(plan.loadKg)} kg`,
    );
  else if (plan.implements === 2) parts.push("dual");
  if (plan.variants !== undefined && plan.variants.length > 0)
    parts.push(
      plan.variants
        .map((entry) => `${entry.reps} ${nameOf(entry.movementId) ?? entry.movementId}`)
        .join(" + "),
    );
  return parts.length === 0 ? "As written" : parts.join(", ");
}

export interface PlannedMovement {
  readonly spanId: SpanId;
  readonly name: string;
  /** The planned scaling in words; `undefined` when none was planned. */
  readonly plan: string | undefined;
}

/**
 * The plan at a glance: every station in order with its planned scaling. An alternative ("or 90
 * single-unders") stands in for its item when the plan picks it.
 */
export function plannedMovements(
  session: DerivedSession,
  nameOf: (id: MovementId) => string | undefined,
  sex: Sex,
): ReadonlyArray<PlannedMovement> {
  const row = (item: DerivedItem): PlannedMovement => ({
    spanId: item.spanId,
    name: (item.movementId === undefined ? undefined : nameOf(item.movementId)) ?? item.text,
    plan: item.plan === undefined ? undefined : describePlan(item.plan, nameOf, sex, item),
  });
  return session.parts.flatMap((part) =>
    part.blocks.flatMap((block) =>
      block.items.map((item) => row(chosenOption(item, "planned") ?? item)),
    ),
  );
}

/**
 * The movement span with its plan taken as done. The planned load (or the board's, for a plan
 * as written) also becomes the lift result when the board gives sets × reps ("5 x 3"), so the
 * planned lift reaches rep maxes. Not in a block scored as a whole: its score says what was lifted.
 */
export const asPlanned = (
  span: SpanOf<"movement">,
  found: { readonly item: DerivedItem; readonly block: DerivedBlock } | undefined,
): SpanOf<"movement"> => {
  if (span.plan === undefined) return span;
  const defaults = found === undefined ? undefined : resultDefaults(found.item, found.block);
  // "As written" plans no load of their own: the board's load is the one lifted.
  const loadKg = span.plan.loadKg ?? defaults?.loadKg;
  const result =
    span.result === undefined &&
    !scoresMovements(found?.block.format) &&
    loadKg !== undefined &&
    loadKg > 0 &&
    defaults?.sets !== undefined &&
    defaults.reps !== undefined
      ? { _tag: "fixed" as const, sets: defaults.sets, reps: defaults.reps, loadKg }
      : span.result;
  return { ...span, performance: span.plan, ...(result === undefined ? {} : { result }) };
};

/** The result form's defaults, with the planned load where the board writes none. */
export const withPlannedLoad = (
  defaults: ResultDefaults,
  plan: Performance | undefined,
): ResultDefaults =>
  defaults.loadKg !== undefined || plan?.loadKg === undefined
    ? defaults
    : { ...defaults, loadKg: plan.loadKg };
