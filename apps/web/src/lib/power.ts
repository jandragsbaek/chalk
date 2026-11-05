import { type AthleteProfile, type Body, type LeftOut, type MovementId } from "@chalk/contracts";
import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";

import { profileAtom } from "../state/profile.ts";

const kjFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** 52345 J → "52.3 kJ". */
export const formatKj = (joules: number) => `${kjFormat.format(joules / 1000)} kJ`;

/** Whole watts; a decimal would be false precision. */
export const formatWatts = (watts: number) => `${Math.round(watts)} W`;

/** 905 → "15:05". */
export const formatClock = (seconds: number) => {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/** Movements left out, one line per reason: "Farmers carry, Swim: no work model yet." */
export const leftOutLines = (
  leftOut: ReadonlyArray<LeftOut>,
  nameOf: (id: MovementId) => string,
): ReadonlyArray<string> => {
  const byReason = new Map<string, Set<string>>();
  for (const left of leftOut) {
    const name = left.movementId === undefined ? left.text : nameOf(left.movementId);
    const names = byReason.get(left.reason) ?? new Set<string>();
    names.add(name);
    byReason.set(left.reason, names);
  }
  return Array.from(byReason, ([reason, names]) => `${[...names].join(", ")}: ${reason}`);
};

/** "180 cm · 85 kg". */
export const describeBody = (body: Body) =>
  `${Math.round(body.heightM * 100)} cm · ${kjFormat.format(body.massKg)} kg`;

/** The profile, or `undefined` while it loads or fails: estimates then ask for Settings. */
export function useProfile(): AthleteProfile | undefined {
  return AsyncResult.getOrElse(useAtomValue(profileAtom), () => undefined);
}

/** "1 strength block", "2 strength blocks". */
export const strengthBlocksLabel = (count: number) =>
  `${count} strength block${count === 1 ? "" : "s"}`;

/** The median of each value and the `window - 1` before it: a trend one hard day cannot move. */
export const rollingMedian = (values: ReadonlyArray<number>, window: number): number[] =>
  values.map((_, index) => {
    const slice = values
      .slice(Math.max(0, index - window + 1), index + 1)
      .toSorted((a, b) => a - b);
    const middle = Math.floor(slice.length / 2);
    return slice.length % 2 === 1 ? slice[middle]! : (slice[middle - 1]! + slice[middle]!) / 2;
  });
