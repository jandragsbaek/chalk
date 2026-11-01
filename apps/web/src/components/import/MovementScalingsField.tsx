import {
  scalingOptions,
  type CatalogMovement,
  type MovementId,
  type ScalingUsage,
} from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { NativeSelect } from "@chalk/ui/components/field.tsx";
import { useAtomSet } from "@effect/atom-react";
import * as Exit from "effect/Exit";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useState } from "react";

import { setScalingsAtom } from "../../state/imports.ts";
import { CATALOG_REACTIVITY_KEY } from "../../state/strength.ts";

/**
 * What the movement is done as instead when scaled (ring rows for pull-ups), first offered
 * first, and what the importer offers on top of that from its core and the level sheet.
 * Saved to the catalog right away, so every session offers the same.
 */
export function MovementScalingsField({
  movement,
  catalog,
  usage,
  heading = true,
}: {
  readonly movement: CatalogMovement;
  readonly catalog: ReadonlyArray<CatalogMovement>;
  /** How often each scaling stood in, when known. */
  readonly usage?: ScalingUsage | undefined;
  /** The printed "Scales to" label; off where the page heads the section itself. */
  readonly heading?: boolean;
}) {
  const [error, setError] = useState<string | undefined>();
  const setScalings = useAtomSet(setScalingsAtom, { mode: "promiseExit" });
  const current = movement.scalings ?? [];
  const nameOf = (id: MovementId) => catalog.find((other) => other.id === id)?.name ?? id;
  const offered = scalingOptions(movement.id, catalog).filter(
    (option) => !current.includes(option.id),
  );
  const addable = catalog
    .filter((other) => other.id !== movement.id && !current.includes(other.id))
    .toSorted((left, right) => left.name.localeCompare(right.name));

  async function save(scalings: ReadonlyArray<MovementId>) {
    setError(undefined);
    const exit = await setScalings({
      params: { id: movement.id },
      payload: { scalings },
      reactivityKeys: [CATALOG_REACTIVITY_KEY],
    });
    if (Exit.isFailure(exit)) setError("Could not save the scalings. Try again.");
  }

  const move = (from: number, to: number) => {
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    void save(next);
  };

  return (
    <div className={heading ? "grid gap-1.5 border-t pt-3" : "grid gap-1.5"}>
      {heading ? <span className="form-label text-muted-foreground">Scales to</span> : null}
      {current.length > 0 ? (
        <ol className="grid border-t">
          {current.map((id, index) => {
            const times = usage?.swaps.find((swap) => swap.movementId === id)?.sessions;
            return (
              <li
                key={id}
                className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2 border-b py-1"
              >
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <span className="flex min-w-0 items-baseline gap-2">
                  <span
                    data-tag="movement"
                    data-chip
                    className="truncate px-1.5 text-sm font-semibold"
                  >
                    {nameOf(id)}
                  </span>
                  {times === undefined ? null : (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      used {times}×
                    </span>
                  )}
                </span>
                <span className="flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Offer ${nameOf(id)} earlier`}
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Offer ${nameOf(id)} later`}
                    disabled={index === current.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost-destructive"
                    size="icon"
                    aria-label={`Remove ${nameOf(id)}`}
                    onClick={() => void save(current.filter((entry) => entry !== id))}
                  >
                    <X />
                  </Button>
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">
          None of its own yet. Add the movements you do instead when you scale it.
        </p>
      )}
      <NativeSelect
        aria-label={`Add a scaling of ${movement.name}`}
        value=""
        onChange={(event) => {
          if (event.target.value !== "") void save([...current, event.target.value as MovementId]);
        }}
      >
        <option value="">Add a movement it scales to...</option>
        {addable.map((other) => (
          <option key={other.id} value={other.id}>
            {other.name}
          </option>
        ))}
      </NativeSelect>
      {offered.length > 0 ? (
        <div className="grid gap-1 pt-1">
          <span className="text-xs text-muted-foreground">
            Also offered, from its core movement and level sheet row:
          </span>
          <ul className="flex flex-wrap gap-1">
            {offered.map((option) => (
              <li
                key={option.id}
                data-tag="movement"
                data-chip
                data-derived
                className="px-1.5 text-sm font-semibold"
              >
                {option.name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
