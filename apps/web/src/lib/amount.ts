import type { Amount } from "@chalk/contracts";

/** A typed number, "," as decimal point; `undefined` when blank or not a number. */
export const readNumber = (raw: string): number | undefined => {
  const value = Number(raw.trim().replace(",", "."));
  return raw.trim() === "" || !Number.isFinite(value) ? undefined : value;
};

/** A typed number ("12", "2,5"); blank, negative or not a number is none. */
export const toNumber = (raw: string): number | undefined => {
  const value = Number(raw.replace(",", "."));
  return raw.trim() === "" || !Number.isFinite(value) || value < 0 ? undefined : value;
};

/** "8-10" or "12" into an amount; anything else is no amount. */
export const parseAmount = (raw: string): Amount | undefined => {
  const parts = raw.split("-").map((part) => toNumber(part));
  if (parts.length === 0 || parts.length > 2 || parts.some((part) => part === undefined))
    return undefined;
  const [min = 0, max = min] = parts as Array<number>;
  return { min: Math.min(min, max), max: Math.max(min, max) };
};
