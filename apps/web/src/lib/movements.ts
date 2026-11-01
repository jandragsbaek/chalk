import {
  scalingUsage,
  type CatalogMovement,
  type LevelItem,
  type MovementCategory,
  type MovementId,
  type ScalingUsage,
} from "@chalk/contracts";

const NO_USAGE: ScalingUsage = { sessions: 0, scaled: 0, swaps: [] };

/** Usage per programmed movement, counted once per session. */
export const movementUsage = (
  items: ReadonlyArray<LevelItem>,
): ((id: MovementId) => ScalingUsage) => {
  const usage = scalingUsage(items);
  return (id) => usage.get(id) ?? NO_USAGE;
};

export type ScalingFilter = "with" | "without";

export interface MovementFilter {
  readonly query: string;
  readonly category: MovementCategory | undefined;
  readonly scalings: ScalingFilter | undefined;
}

/** Name or alias contains the query, case and punctuation aside. */
const matches = (movement: CatalogMovement, query: string) => {
  const plain = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\p{L}\d]+/gu, " ")
      .trim();
  const wanted = plain(query);
  return (
    wanted === "" ||
    [movement.name, ...movement.aliases].some((text) => plain(text).includes(wanted))
  );
};

/** The register's movements under its filters, by name. */
export const filterMovements = (
  catalog: ReadonlyArray<CatalogMovement>,
  filter: MovementFilter,
): ReadonlyArray<CatalogMovement> =>
  catalog
    .filter(
      (movement) =>
        (filter.category === undefined || movement.category === filter.category) &&
        (filter.scalings === undefined ||
          (movement.scalings ?? []).length > 0 === (filter.scalings === "with")) &&
        matches(movement, filter.query),
    )
    .toSorted((left, right) => left.name.localeCompare(right.name));

/** Movements that list `id` among their own scalings. */
export const scaledFrom = (
  id: MovementId,
  catalog: ReadonlyArray<CatalogMovement>,
): ReadonlyArray<CatalogMovement> =>
  catalog
    .filter((movement) => (movement.scalings ?? []).includes(id))
    .toSorted((left, right) => left.name.localeCompare(right.name));
