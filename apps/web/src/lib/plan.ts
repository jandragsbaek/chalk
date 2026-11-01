import {
  formatAmount,
  LEVEL_NAMES,
  reachOfTiers,
  type Amount,
  type DerivedBlock,
  type DerivedItem,
  type DerivedSession,
  type Measure,
  type MovementId,
  type Performance,
  type Quantity,
  type SpanId,
  type SpanOf,
} from "@chalk/contracts";

import { resultDefaults, type ResultDefaults } from "./resultDraft.ts";
import { chosenOption } from "./station.ts";
import { WORKOUT_KIND_LABELS } from "./workoutKinds.ts";

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
export function describeReach(perRound: Amount, target: Quantity | undefined): string | undefined {
  if (target?.tiers === undefined || target.tiers.length === 0) return undefined;
  const reach = reachOfTiers(target.tiers, perRound);
  if (reach.met !== undefined) return LEVEL_NAMES[reach.met];
  return reach.next === undefined
    ? undefined
    : `under ${LEVEL_NAMES[reach.next.level]} (${reach.next.target})`;
}

/** "7-8 cal each round, under RX (15)". */
export function describePerRound(perRound: Amount, target: Quantity | undefined): string {
  const unit = target === undefined ? undefined : ROUND_UNITS[target.measure];
  const reach = describeReach(perRound, target);
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
  item?: DerivedItem,
): string {
  const parts: Array<string> = [];
  if (plan.perRound !== undefined)
    parts.push(describePerRound(plan.perRound, item === undefined ? undefined : roundTarget(item)));
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
): ReadonlyArray<PlannedMovement> {
  const row = (item: DerivedItem): PlannedMovement => ({
    spanId: item.spanId,
    name: (item.movementId === undefined ? undefined : nameOf(item.movementId)) ?? item.text,
    plan: item.plan === undefined ? undefined : describePlan(item.plan, nameOf, item),
  });
  return session.parts.flatMap((part) =>
    part.blocks.flatMap((block) =>
      block.items.map((item) => row(chosenOption(item, "planned") ?? item)),
    ),
  );
}

/**
 * What to call a plan: the session's own name when the paste numbered it, else the kind and the
 * first movements ("For time · Double-under, Wall ball +5"), since a posted board rarely has a
 * heading and "Session 2026-11-01" next to its own date says nothing.
 */
export function planTitle(
  session: DerivedSession,
  nameOf: (id: MovementId) => string | undefined,
): string {
  if (session.sessionNumber !== undefined) return session.name;
  const names = [
    ...new Set(
      session.parts.flatMap((part) =>
        part.blocks.flatMap((block) =>
          block.items.map(
            (item) =>
              (item.movementId === undefined ? undefined : nameOf(item.movementId)) ?? item.text,
          ),
        ),
      ),
    ),
  ];
  if (names.length === 0) return session.name;
  const more = names.length > 2 ? ` +${names.length - 2}` : "";
  return `${WORKOUT_KIND_LABELS[session.kind]} · ${names.slice(0, 2).join(", ")}${more}`;
}

/**
 * The movement span with its plan taken as done. The planned load (or the board's, for a plan
 * as written) also becomes the lift result when the board gives sets × reps ("5 x 3"), so the
 * planned lift reaches rep maxes.
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
