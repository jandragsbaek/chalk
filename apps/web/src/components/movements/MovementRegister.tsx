import {
  levelFamily,
  MovementCategory,
  type CatalogMovement,
  type MovementId,
} from "@chalk/contracts";
import { Input } from "@chalk/ui/components/field.tsx";
import { Link } from "@tanstack/react-router";
import type * as React from "react";

import { MOVEMENT_CATEGORY_LABELS } from "../../lib/strength.ts";
import type { MovementFilter } from "../../lib/movements.ts";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "Variation of Pull-up · Pull-ups", "4 variations · Pull-ups", "Not graded". */
export const describeMovement = (
  movement: CatalogMovement,
  catalog: ReadonlyArray<CatalogMovement>,
) => {
  const core =
    movement.variationOf === undefined
      ? undefined
      : catalog.find((other) => other.id === movement.variationOf);
  const variations = catalog.filter((other) => other.variationOf === movement.id).length;
  const family = movement.levelFamily === undefined ? undefined : levelFamily(movement.levelFamily);
  return [
    core === undefined ? undefined : `Variation of ${core.name}`,
    variations === 0 ? undefined : plural(variations, "variation", "variations"),
    movement.accessory ? "Accessory" : undefined,
    family === undefined ? "Not graded" : family.name,
  ]
    .filter((part) => part !== undefined)
    .join(" · ");
};

/** Rows shown before "+n", so a row stays one line. */
const SHOWN_SCALINGS = 2;

function Row({
  movement,
  catalog,
  selected,
  nameOf,
}: {
  readonly movement: CatalogMovement;
  readonly catalog: ReadonlyArray<CatalogMovement>;
  readonly selected: boolean;
  readonly nameOf: (id: MovementId) => string;
}) {
  const scalings = movement.scalings ?? [];
  return (
    <li>
      <Link
        to="/movements"
        search={(previous) => ({ ...previous, movement: movement.id })}
        replace
        data-movement-row={movement.id}
        aria-current={selected ? "true" : undefined}
        className={
          selected
            ? "grid min-h-12 scroll-mt-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b bg-muted px-4 py-1.5 outline-3 outline-double -outline-offset-4 outline-foreground"
            : "grid min-h-12 scroll-mt-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b px-4 py-1.5 transition-colors duration-150 hover:bg-muted"
        }
      >
        <span className="grid min-w-0">
          <span className="truncate font-semibold">{movement.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {describeMovement(movement, catalog)}
          </span>
        </span>
        <span className="flex max-w-52 items-center justify-end gap-1">
          {scalings.length === 0 ? (
            <span data-empty aria-label="No scalings" />
          ) : (
            <>
              {scalings.slice(0, SHOWN_SCALINGS).map((id) => (
                <span
                  key={id}
                  data-tag="movement"
                  data-chip
                  className="truncate px-1.5 text-xs font-semibold leading-5"
                >
                  {nameOf(id)}
                </span>
              ))}
              {scalings.length > SHOWN_SCALINGS ? (
                <span className="form-label shrink-0 text-muted-foreground">
                  +{scalings.length - SHOWN_SCALINGS}
                </span>
              ) : null}
            </>
          )}
        </span>
      </Link>
    </li>
  );
}

/**
 * The register: every movement under its filters, by name, under sticky category heads, with
 * its own scalings at a glance. Rows open the movement in the sheet beside it.
 */
export function MovementRegister({
  movements,
  catalog,
  filter,
  selectedId,
  scrollRef,
  onFilter,
}: {
  readonly movements: ReadonlyArray<CatalogMovement>;
  readonly catalog: ReadonlyArray<CatalogMovement>;
  readonly filter: MovementFilter;
  readonly selectedId: MovementId | undefined;
  readonly scrollRef: React.Ref<HTMLDivElement>;
  readonly onFilter: (next: Partial<MovementFilter>) => void;
}) {
  const names = new Map(catalog.map((movement) => [movement.id, movement.name]));
  const nameOf = (id: MovementId) => names.get(id) ?? id;
  const groups = MovementCategory.literals
    .map((category) => ({
      category,
      movements: movements.filter((movement) => movement.category === category),
    }))
    .filter((group) => group.movements.length > 0);
  const filtered =
    filter.query !== "" || filter.category !== undefined || filter.scalings !== undefined;

  return (
    <section aria-label="Movements" className="flex min-h-0 flex-col border-r bg-card">
      <div className="grid gap-2 border-b bg-background px-4 pb-3 pt-5">
        <div className="flex items-end justify-between gap-3 border-b-2 border-foreground pb-2">
          <h1 className="protocol-title text-4xl">Movements</h1>
          <span className="form-label text-muted-foreground">
            {filtered
              ? `${movements.length} of ${catalog.length}`
              : plural(catalog.length, "movement", "movements")}
          </span>
        </div>
        <Input
          type="search"
          value={filter.query}
          placeholder="Name or whiteboard alias"
          aria-label="Search movements"
          className="mt-1"
          onChange={(event) => onFilter({ query: event.target.value })}
        />
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No movement matches. Clear the search or pick another category.
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.category} aria-label={MOVEMENT_CATEGORY_LABELS[group.category]}>
              <h2 className="protocol-title sticky top-0 z-10 flex items-end justify-between border-b-2 border-foreground bg-card px-4 pb-1.5 pt-4 text-lg">
                {MOVEMENT_CATEGORY_LABELS[group.category]}
                <span className="form-label text-muted-foreground">{group.movements.length}</span>
              </h2>
              <ul>
                {group.movements.map((movement) => (
                  <Row
                    key={movement.id}
                    movement={movement}
                    catalog={catalog}
                    selected={movement.id === selectedId}
                    nameOf={nameOf}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </section>
  );
}
