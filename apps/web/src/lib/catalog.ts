import type { CatalogMovement, GradableMovement, MovementId } from "@chalk/contracts";

/** "chest-to-bar-pull-up" → "Chest to bar pull up", until the catalog has loaded. */
const fromSlug = (id: string) => {
  const words = id.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export interface CatalogLookup {
  readonly nameOf: (id: MovementId) => string;
  readonly gradable: ReadonlyMap<MovementId, GradableMovement>;
}

export const catalogLookup = (movements: ReadonlyArray<CatalogMovement>): CatalogLookup => {
  const byId = new Map(movements.map((movement) => [movement.id, movement]));
  return {
    nameOf: (id) => byId.get(id)?.name ?? fromSlug(id),
    gradable: byId,
  };
};
