import type { MovementId } from "../baseSchemas.ts";
import { LEVELS, levelFamily, levelIndex, type Performance } from "../levels.ts";
import type { CatalogMovement } from "../sessionImport.ts";

/**
 * What a movement can be scaled to, first offered first: its own scalings (ring rows for
 * pull-ups, walk-outs for wall walks), then its core movement's, then for a movement on a
 * variant row of the level sheet the easier variations of that row, closest first, and the
 * row's scalings under the sheet. Only movements in the catalog, never the movement itself.
 */
export const scalingOptions = (
  movementId: MovementId,
  catalog: ReadonlyArray<CatalogMovement>,
): ReadonlyArray<CatalogMovement> => {
  const byId = new Map(catalog.map((movement) => [movement.id, movement]));
  const movement = byId.get(movementId);
  if (movement === undefined) return [];
  const core = movement.variationOf === undefined ? undefined : byId.get(movement.variationOf);
  const family = movement.levelFamily === undefined ? undefined : levelFamily(movement.levelFamily);
  const easier: Array<string> = [];
  if (family?.kind === "variant") {
    const entry = LEVELS.findIndex((level) => family.rungs[level]?.introduces.includes(movementId));
    if (entry >= 0) {
      for (const level of LEVELS.toReversed())
        if (levelIndex(level) < entry) easier.push(...(family.rungs[level]?.introduces ?? []));
      easier.push(...family.below);
    }
  }
  const ids = [...(movement.scalings ?? []), ...(core?.scalings ?? []), ...easier];
  return [...new Set(ids)].flatMap((id) => {
    const option = id === movementId ? undefined : byId.get(id as MovementId);
    return option === undefined ? [] : [option];
  });
};

/** One programmed movement as saved: its session, day and how it was done. */
export interface ScalableItem {
  readonly workoutId: string;
  readonly performedOn: string;
  readonly movementId: MovementId;
  readonly performance?: Performance | undefined;
}

/** Another movement that stood in for a programmed one. */
export interface ScalingSwap {
  readonly movementId: MovementId;
  /** Sessions it stood in. */
  readonly sessions: number;
  readonly reps: number;
}

/** How often a movement was programmed, and how often it was done as something else. */
export interface ScalingUsage {
  /** Sessions it was programmed in. */
  readonly sessions: number;
  /** Sessions where some of its reps were done as another movement. */
  readonly scaled: number;
  /** Most sessions first. */
  readonly swaps: ReadonlyArray<ScalingSwap>;
  /** The latest day it was done scaled. */
  readonly lastScaledOn?: string;
}

/**
 * Usage per programmed movement, each session counted once: ring rows stood in for pull-ups in
 * 3 of 7 sessions, 90 reps. A variation of the reps that names the movement itself is not a swap.
 */
export const scalingUsage = (
  items: ReadonlyArray<ScalableItem>,
): ReadonlyMap<MovementId, ScalingUsage> => {
  interface Tally {
    readonly sessions: Set<string>;
    readonly scaled: Set<string>;
    readonly swaps: Map<MovementId, { sessions: Set<string>; reps: number }>;
    lastScaledOn: string | undefined;
  }
  const tallies = new Map<MovementId, Tally>();
  for (const item of items) {
    const tally = tallies.get(item.movementId) ?? {
      sessions: new Set<string>(),
      scaled: new Set<string>(),
      swaps: new Map(),
      lastScaledOn: undefined,
    };
    tallies.set(item.movementId, tally);
    tally.sessions.add(item.workoutId);
    const others = (item.performance?.variants ?? []).filter(
      (variant) => variant.reps > 0 && variant.movementId !== item.movementId,
    );
    if (others.length === 0) continue;
    tally.scaled.add(item.workoutId);
    if (tally.lastScaledOn === undefined || item.performedOn > tally.lastScaledOn)
      tally.lastScaledOn = item.performedOn;
    for (const variant of others) {
      const swap = tally.swaps.get(variant.movementId) ?? { sessions: new Set<string>(), reps: 0 };
      swap.sessions.add(item.workoutId);
      swap.reps += variant.reps;
      tally.swaps.set(variant.movementId, swap);
    }
  }
  return new Map(
    [...tallies].map(([id, tally]) => [
      id,
      {
        sessions: tally.sessions.size,
        scaled: tally.scaled.size,
        swaps: [...tally.swaps]
          .map(([movementId, swap]) => ({
            movementId,
            sessions: swap.sessions.size,
            reps: swap.reps,
          }))
          .toSorted((left, right) => right.sessions - left.sessions),
        ...(tally.lastScaledOn === undefined ? {} : { lastScaledOn: tally.lastScaledOn }),
      },
    ]),
  );
};
