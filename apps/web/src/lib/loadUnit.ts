import { kgToPounds, poundsToKg } from "@chalk/contracts";

import { readNumber } from "./amount.ts";

/**
 * The unit loads are typed in. Chalk keeps kilograms; a session listed in pounds is typed in
 * pounds and converted, to the quarter kilo, as it is read.
 */
export type LoadUnit = "kg" | "lb";

/** A typed number in `unit` as kilograms; a step may be negative, a load may not. */
export const readKg = (raw: string, unit: LoadUnit, signed = false): number | undefined => {
  const value = readNumber(raw);
  if (value === undefined || (!signed && value < 0)) return undefined;
  return unit === "lb" ? poundsToKg(value) : value;
};

/** Kilograms as typed in `unit`; blank for none. */
export const showLoad = (kg: number | undefined, unit: LoadUnit): string =>
  kg === undefined ? "" : String(unit === "lb" ? kgToPounds(kg) : kg);

/** What is typed in one unit, in the other; a half-typed number is left as it is. */
export const convertTyped = (raw: string, from: LoadUnit, to: LoadUnit, signed = false): string => {
  if (from === to) return raw;
  const kg = readKg(raw, from, signed);
  return kg === undefined ? raw : showLoad(kg, to);
};
