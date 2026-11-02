import type { CatalogMovement, MovementMeasure } from "@chalk/contracts";
import { useAtomSet } from "@effect/atom-react";
import { Link } from "@tanstack/react-router";
import * as Exit from "effect/Exit";
import { useId, useState } from "react";

import { setMeasureAtom } from "../../state/imports.ts";
import { CATALOG_REACTIVITY_KEY } from "../../state/strength.ts";
import { SectionHead, MoreLink } from "../today/SectionHead.tsx";

const MEASURES: ReadonlyArray<{
  readonly value: MovementMeasure;
  readonly text: string;
  readonly unit: string;
}> = [
  { value: "reps", text: "Reps", unit: "reps" },
  { value: "distance_m", text: "Metres", unit: "metres" },
  { value: "calories", text: "Calories", unit: "calories" },
  { value: "seconds", text: "Seconds", unit: "seconds" },
];

/**
 * What one unit of the movement is, so the volume grid reads its weeks in it. Saved to the
 * catalog right away; a count written in another unit still counts, beside it.
 */
export function MovementMeasureField({ movement }: { readonly movement: CatalogMovement }) {
  const id = useId();
  const [error, setError] = useState<string | undefined>();
  const setMeasure = useAtomSet(setMeasureAtom, { mode: "promiseExit" });
  const current = movement.measure ?? "reps";
  const unit = MEASURES.find((measure) => measure.value === current)!.unit;

  async function save(measure: MovementMeasure) {
    setError(undefined);
    const exit = await setMeasure({
      params: { id: movement.id },
      payload: { measure },
      reactivityKeys: [CATALOG_REACTIVITY_KEY],
    });
    if (Exit.isFailure(exit)) setError("Could not save how it is counted. Try again.");
  }

  return (
    <section aria-labelledby={`${id}-title`} className="grid gap-3">
      <SectionHead
        id={`${id}-title`}
        title="Counted in"
        meta={
          <Link to="/volume" className="hover:text-foreground">
            <MoreLink>Volume</MoreLink>
          </Link>
        }
      />
      <div role="radiogroup" aria-labelledby={`${id}-title`} data-scale="" className="max-w-md">
        {MEASURES.map((measure) => (
          <label key={measure.value} data-scale-option>
            <input
              type="radio"
              name={`${id}-measure`}
              className="sr-only"
              value={measure.value}
              checked={current === measure.value}
              onChange={() => void save(measure.value)}
            />
            {measure.text}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        The volume grid reads {movement.name}'s weeks in {unit}. A line written in another unit
        still counts, beside it.
      </p>
      {error === undefined ? null : <p className="text-xs text-destructive">{error}</p>}
    </section>
  );
}
