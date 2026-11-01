import {
  Complement,
  COMPLEMENT_NAMES,
  LEVEL_FAMILIES,
  LEVEL_GROUP_NAMES,
  LevelGroup,
  type CatalogMovement,
  type LevelFamilyId,
  type SetMovementLevelsInput,
} from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { NativeSelect } from "@chalk/ui/components/field.tsx";
import { useAtomSet } from "@effect/atom-react";
import * as Exit from "effect/Exit";
import { Check, X } from "lucide-react";
import { useState } from "react";

import { setLevelsAtom } from "../../state/imports.ts";
import { CATALOG_REACTIVITY_KEY } from "../../state/strength.ts";

const familyName = (id: LevelFamilyId) =>
  LEVEL_FAMILIES.find((family) => family.id === id)?.name ?? id;

function FamilyOptions({ exclude }: { readonly exclude?: ReadonlyArray<LevelFamilyId> }) {
  return LevelGroup.literals.map((group) => (
    <optgroup key={group} label={LEVEL_GROUP_NAMES[group]}>
      {LEVEL_FAMILIES.filter(
        (family) => family.group === group && !(exclude ?? []).includes(family.id),
      ).map((family) => (
        <option key={family.id} value={family.id}>
          {family.name}
        </option>
      ))}
    </optgroup>
  ));
}

/**
 * The movement's row on the level sheet, and for an accessory, what it complements and which
 * rows it builds toward. Saved to the catalog right away, so every session grades the same.
 */
export function MovementLevelsField({ movement }: { readonly movement: CatalogMovement }) {
  const [error, setError] = useState<string | undefined>();
  const setLevels = useAtomSet(setLevelsAtom, { mode: "promiseExit" });
  const current: SetMovementLevelsInput = {
    levelFamily: movement.levelFamily ?? null,
    accessory: movement.accessory === true,
    complements: movement.complements ?? [],
    supports: movement.supports ?? [],
  };

  async function save(next: Partial<SetMovementLevelsInput>) {
    setError(undefined);
    const exit = await setLevels({
      params: { id: movement.id },
      payload: { ...current, ...next },
      reactivityKeys: [CATALOG_REACTIVITY_KEY],
    });
    if (Exit.isFailure(exit)) setError("Could not save the levels.");
  }

  const toggleComplement = (complement: Complement) =>
    void save({
      complements: current.complements.includes(complement)
        ? current.complements.filter((entry) => entry !== complement)
        : Complement.literals.filter(
            (entry) => entry === complement || current.complements.includes(entry),
          ),
    });

  return (
    <div className="grid gap-2 border-t pt-3">
      <span className="form-label text-muted-foreground">Levels</span>
      <NativeSelect
        aria-label={`Level sheet row of ${movement.name}`}
        value={movement.levelFamily ?? ""}
        onChange={(event) =>
          void save({
            levelFamily: event.target.value === "" ? null : (event.target.value as LevelFamilyId),
          })
        }
      >
        <option value="">Not on the level sheet</option>
        <FamilyOptions />
      </NativeSelect>

      <label data-check className="-mx-1.5">
        <input
          type="checkbox"
          className="sr-only"
          checked={current.accessory}
          onChange={(event) => void save({ accessory: event.target.checked })}
        />
        <span data-check-box aria-hidden>
          <Check />
        </span>
        <span className="grid leading-5">
          <span className="text-sm font-medium">Accessory</span>
          <span className="text-xs text-muted-foreground">
            Programmed to support the main movements
          </span>
        </span>
      </label>

      {current.accessory ? (
        <div className="grid gap-2">
          <fieldset className="grid gap-1">
            <legend className="form-label pb-1 text-muted-foreground">Complements</legend>
            <div className="flex flex-wrap gap-1">
              {Complement.literals.map((complement) => {
                const on = current.complements.includes(complement);
                return (
                  <Button
                    key={complement}
                    variant={on ? "default" : "outline"}
                    size="sm"
                    aria-pressed={on}
                    onClick={() => toggleComplement(complement)}
                  >
                    {COMPLEMENT_NAMES[complement]}
                  </Button>
                );
              })}
            </div>
          </fieldset>
          <div className="grid gap-1">
            <span className="form-label text-muted-foreground">Builds toward</span>
            {current.supports.length > 0 ? (
              <ul className="flex flex-wrap gap-1">
                {current.supports.map((id) => (
                  <li
                    key={id}
                    data-chip
                    className="flex items-center gap-1 pl-1.5 text-sm font-medium leading-6"
                  >
                    {familyName(id)}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${familyName(id)}`}
                      onClick={() =>
                        void save({ supports: current.supports.filter((entry) => entry !== id) })
                      }
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <NativeSelect
              aria-label="Add a row it builds toward"
              value=""
              onChange={(event) => {
                if (event.target.value !== "")
                  void save({
                    supports: [...current.supports, event.target.value as LevelFamilyId],
                  });
              }}
            >
              <option value="">Add a row of the sheet...</option>
              <FamilyOptions exclude={current.supports} />
            </NativeSelect>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
