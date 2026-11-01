import {
  levelFamily,
  type CatalogMovement,
  type MovementId,
  type ScalingUsage,
} from "@chalk/contracts";
import { Button } from "@chalk/ui/components/button.tsx";
import { Input } from "@chalk/ui/components/field.tsx";
import { useAtomSet } from "@effect/atom-react";
import { Link } from "@tanstack/react-router";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { Plus } from "lucide-react";
import { useState } from "react";

import { scaledFrom } from "../../lib/movements.ts";
import { MOVEMENT_CATEGORY_LABELS } from "../../lib/strength.ts";
import { addAliasAtom } from "../../state/imports.ts";
import { CATALOG_REACTIVITY_KEY } from "../../state/strength.ts";
import { FieldBox } from "../FieldBox.tsx";
import { CoreMovementField } from "../import/CoreMovementField.tsx";
import { MovementLevelsField } from "../import/MovementLevelsField.tsx";
import { MovementScalingsField } from "../import/MovementScalingsField.tsx";
import { SectionHead } from "../today/SectionHead.tsx";

/** Teaches the importer another whiteboard phrase for the movement. */
function AliasForm({
  movement,
  catalog,
}: {
  readonly movement: CatalogMovement;
  readonly catalog: ReadonlyArray<CatalogMovement>;
}) {
  const [alias, setAlias] = useState("");
  const [error, setError] = useState<string | undefined>();
  const addAlias = useAtomSet(addAliasAtom, { mode: "promiseExit" });

  async function submit() {
    const phrase = alias.trim();
    if (phrase === "") return;
    setError(undefined);
    const exit = await addAlias({
      params: { id: movement.id },
      payload: { alias: phrase },
      reactivityKeys: [CATALOG_REACTIVITY_KEY],
    });
    if (Exit.isSuccess(exit)) {
      setAlias("");
      return;
    }
    const failure = Cause.findErrorOption(exit.cause);
    const reason = Option.isSome(failure) ? failure.value : undefined;
    const taken =
      reason?._tag === "AliasTakenError"
        ? catalog.find((other) => other.id === reason.movementId)?.name
        : undefined;
    setError(
      taken === undefined
        ? "Could not save the alias. Try again."
        : `"${phrase}" already means ${taken}.`,
    );
  }

  return (
    <form
      className="grid gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="flex gap-2">
        <Input
          value={alias}
          placeholder="Another phrase for it, like the board writes it"
          aria-label={`New alias for ${movement.name}`}
          onChange={(event) => setAlias(event.target.value)}
        />
        <Button type="submit" variant="outline" disabled={alias.trim() === ""}>
          <Plus />
          Add alias
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </form>
  );
}

/**
 * One catalog movement read as a sheet: what it is, how often it was programmed and scaled, what
 * it scales to and from, the phrases the importer knows it by, and its core and level row.
 */
export function MovementSheet({
  movement,
  catalog,
  usage,
}: {
  readonly movement: CatalogMovement;
  readonly catalog: ReadonlyArray<CatalogMovement>;
  readonly usage: ScalingUsage;
}) {
  const nameOf = (id: MovementId) => catalog.find((other) => other.id === id)?.name ?? id;
  const core = movement.variationOf === undefined ? undefined : nameOf(movement.variationOf);
  const variations = catalog.filter((other) => other.variationOf === movement.id).length;
  const from = scaledFrom(movement.id, catalog);

  return (
    <article aria-label={movement.name} className="flex min-h-0 flex-col bg-card">
      <header className="border-b">
        <div className="grid gap-1 border-b px-5 py-3">
          <h2 className="protocol-title truncate text-3xl">{movement.name}</h2>
          <p className="text-xs text-muted-foreground">
            {MOVEMENT_CATEGORY_LABELS[movement.category]}
            {movement.accessory ? " · Accessory" : ""}
          </p>
        </div>
        <dl className="flex divide-x">
          <FieldBox label="Core">
            {core !== undefined
              ? `Variation of ${core}`
              : variations > 0
                ? `${variations} ${variations === 1 ? "variation" : "variations"}`
                : "Core movement"}
          </FieldBox>
          <FieldBox label="Sheet row">
            {movement.levelFamily === undefined ? (
              <span data-empty aria-label="Not graded" />
            ) : (
              levelFamily(movement.levelFamily).name
            )}
          </FieldBox>
          <FieldBox label="In sessions">{usage.sessions}</FieldBox>
          <FieldBox label="Done scaled">
            {usage.sessions === 0 ? (
              <span data-empty aria-label="Never programmed" />
            ) : (
              `${usage.scaled} of ${usage.sessions}`
            )}
          </FieldBox>
          <div aria-hidden className="flex-1" />
        </dl>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-12">
        <div className="grid max-w-2xl gap-10 pt-6">
          <section aria-labelledby="movement-scales-to" className="grid gap-3">
            <SectionHead id="movement-scales-to" title="Scales to" meta="First offered first" />
            <MovementScalingsField
              movement={movement}
              catalog={catalog}
              usage={usage}
              heading={false}
            />
          </section>

          <section aria-labelledby="movement-scaled-from" className="grid gap-3">
            <SectionHead
              id="movement-scaled-from"
              title="Scaled from"
              meta={`Offer ${movement.name}`}
            />
            {from.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No movement lists {movement.name} as its scaling.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1">
                {from.map((other) => (
                  <li key={other.id}>
                    <Link
                      to="/movements"
                      search={(previous) => ({ ...previous, movement: other.id })}
                      replace
                      data-tag="movement"
                      data-chip
                      className="block px-1.5 text-sm font-semibold hover:underline"
                    >
                      {other.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="movement-aliases" className="grid gap-3">
            <SectionHead id="movement-aliases" title="Aliases" meta="Whiteboard phrases" />
            {movement.aliases.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Only its name. The importer learns a phrase when you pick this movement for it.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {movement.aliases.map((alias) => (
                  <li
                    key={alias}
                    className="font-mono font-bold underline decoration-muted-foreground decoration-dotted decoration-2 underline-offset-4"
                  >
                    {alias}
                  </li>
                ))}
              </ul>
            )}
            <AliasForm movement={movement} catalog={catalog} />
          </section>

          <section aria-labelledby="movement-catalog" className="grid gap-3">
            <SectionHead id="movement-catalog" title="Core and levels" />
            <div className="grid grid-cols-2 gap-6">
              <CoreMovementField movement={movement} catalog={catalog} />
              <MovementLevelsField movement={movement} />
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}
