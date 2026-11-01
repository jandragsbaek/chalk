import type { SimilarToPlanInput } from "@chalk/contracts";
import * as Atom from "effect/reactivity/Atom";

import { AdminClient } from "../api/client.ts";
import { CATALOG_REACTIVITY_KEY, LIFTS_REACTIVITY_KEY } from "./strength.ts";
import { WORKOUTS_REACTIVITY_KEY } from "./workouts.ts";

/** The session register: refetched when a workout or a lift set is logged, imported or deleted. */
export const sessionsAtom = AdminClient.query("workouts", "sessions", {
  reactivityKeys: [WORKOUTS_REACTIVITY_KEY, LIFTS_REACTIVITY_KEY],
});

/** Each saved part's repeats and look-alikes; a variation edit in the catalog changes them too. */
export const similarAtom = AdminClient.query("workouts", "similar", {
  reactivityKeys: [WORKOUTS_REACTIVITY_KEY, LIFTS_REACTIVITY_KEY, CATALOG_REACTIVITY_KEY],
});

/**
 * A plan's parts against the saved ones, keyed by the request as JSON: a plan whose parts did
 * not change (only its scaling did) is not asked again.
 */
export const similarToPlanAtom = Atom.family((request: string) =>
  AdminClient.query("workouts", "similarToPlan", {
    payload: JSON.parse(request) as SimilarToPlanInput,
    reactivityKeys: [WORKOUTS_REACTIVITY_KEY, LIFTS_REACTIVITY_KEY, CATALOG_REACTIVITY_KEY],
  }),
);

export const removeWorkoutAtom = AdminClient.mutation("workouts", "remove");
