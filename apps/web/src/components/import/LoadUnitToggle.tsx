import { Button } from "@chalk/ui/components/button.tsx";
import { createContext, use } from "react";

import type { LoadUnit } from "../../lib/loadUnit.ts";

interface LoadUnitChoice {
  readonly unit: LoadUnit;
  /** `undefined` where the unit is fixed: kilograms, no toggle. */
  readonly setUnit: ((unit: LoadUnit) => void) | undefined;
}

/**
 * The unit the session's loads are typed in, shared by every load field of the import: pounds
 * when the pasted text lists its loads in pounds, until the athlete flips it.
 */
export const LoadUnitContext = createContext<LoadUnitChoice>({ unit: "kg", setUnit: undefined });

export const useLoadUnit = () => use(LoadUnitContext);

const UNITS: ReadonlyArray<LoadUnit> = ["kg", "lb"];

/** Kilograms or pounds for the loads typed; flipping it converts what is already typed. */
export function LoadUnitToggle() {
  const { unit, setUnit } = useLoadUnit();
  if (setUnit === undefined) return null;
  return (
    <div role="radiogroup" aria-label="Load unit" className="flex gap-1">
      {UNITS.map((option) => (
        <Button
          key={option}
          role="radio"
          aria-checked={unit === option}
          variant={unit === option ? "default" : "outline"}
          size="sm"
          onClick={() => setUnit(option)}
        >
          {option}
        </Button>
      ))}
    </div>
  );
}
