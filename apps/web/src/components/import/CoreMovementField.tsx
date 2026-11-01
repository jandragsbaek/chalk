import type { CatalogMovement, MovementId } from "@chalk/contracts";
import { NativeSelect } from "@chalk/ui/components/field.tsx";
import { useAtomSet } from "@effect/atom-react";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { useState } from "react";

import { setVariationOfAtom } from "../../state/imports.ts";
import { CATALOG_REACTIVITY_KEY } from "../../state/strength.ts";
import { coreMovements } from "./MovementPicker.tsx";

/**
 * Which core movement the picked movement is a variation of. Saved to the catalog right away,
 * so every session sees the same family.
 */
export function CoreMovementField({
  movement,
  catalog,
}: {
  readonly movement: CatalogMovement;
  readonly catalog: ReadonlyArray<CatalogMovement>;
}) {
  const [error, setError] = useState<string | undefined>();
  const setVariationOf = useAtomSet(setVariationOfAtom, { mode: "promiseExit" });
  const variations = catalog.filter((other) => other.variationOf === movement.id);

  async function handleChange(variationOf: MovementId | null) {
    setError(undefined);
    const exit = await setVariationOf({
      params: { id: movement.id },
      payload: { variationOf },
      reactivityKeys: [CATALOG_REACTIVITY_KEY],
    });
    if (Exit.isSuccess(exit)) return;
    const failure = Cause.findErrorOption(exit.cause);
    setError(
      Option.isSome(failure) && failure.value._tag === "VariationInvalidError"
        ? failure.value.message
        : "Could not save the core movement.",
    );
  }

  return (
    <div className="grid gap-1.5 border-t pt-3">
      <span className="form-label text-muted-foreground">Core movement</span>
      {variations.length > 0 ? (
        <p className="text-sm">
          <span className="font-semibold">{movement.name}</span> is a core movement with{" "}
          {variations.length === 1 ? "1 variation" : `${variations.length} variations`}:{" "}
          <span className="text-muted-foreground">
            {variations.map((variation) => variation.name).join(", ")}
          </span>
        </p>
      ) : (
        <NativeSelect
          aria-label={`Core movement of ${movement.name}`}
          value={movement.variationOf ?? ""}
          onChange={(event) =>
            void handleChange(event.target.value === "" ? null : (event.target.value as MovementId))
          }
        >
          <option value="">None: {movement.name} is a core movement</option>
          {coreMovements(catalog)
            .filter((core) => core.id !== movement.id)
            .map((core) => (
              <option key={core.id} value={core.id}>
                Variation of {core.name}
              </option>
            ))}
        </NativeSelect>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
