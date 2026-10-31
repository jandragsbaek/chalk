import type { WorkoutId } from "@chalk/contracts";
import * as Atom from "effect/reactivity/Atom";

import { AdminClient } from "../api/client.ts";
import { WORKOUTS_REACTIVITY_KEY } from "./workouts.ts";

/** Catalog reads register this key; creating a movement or alias refetches them. */
export const CATALOG_REACTIVITY_KEY = "catalog";
/** Import reads register this key; a save refetches the imported list. */
export const IMPORTS_REACTIVITY_KEY = "imports";

/** Keys a successful save invalidates: imports and the workout list. */
export const SAVE_REACTIVITY_KEYS = [IMPORTS_REACTIVITY_KEY, WORKOUTS_REACTIVITY_KEY];

export const catalogAtom = AdminClient.query("movements", "list", {
  reactivityKeys: [CATALOG_REACTIVITY_KEY],
});

export const createMovementAtom = AdminClient.mutation("movements", "create");

export const addAliasAtom = AdminClient.mutation("movements", "addAlias");

export const setVariationOfAtom = AdminClient.mutation("movements", "setVariationOf");

export const setLevelsAtom = AdminClient.mutation("movements", "setLevels");

export const importsAtom = AdminClient.query("imports", "list", {
  reactivityKeys: [IMPORTS_REACTIVITY_KEY],
});

/** One stored import, for re-opening it in the editor. */
export const storedImportAtom = Atom.family((workoutId: WorkoutId) =>
  AdminClient.query("imports", "get", {
    params: { workoutId },
    reactivityKeys: [IMPORTS_REACTIVITY_KEY],
  }),
);

export const saveImportAtom = AdminClient.mutation("imports", "save");
