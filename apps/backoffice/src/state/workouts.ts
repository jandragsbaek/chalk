import * as Atom from "effect/reactivity/Atom";

import { AdminClient } from "../api/client.ts";

/** Every workout read registers this key; mutations pass it so reads refetch after a write. */
export const WORKOUTS_REACTIVITY_KEY = "workouts";

/** One cached query atom per search term; an empty term lists everything. */
export const workoutSearchAtom = Atom.family((q: string) =>
  AdminClient.query("workouts", "search", {
    query: q === "" ? {} : { q },
    reactivityKeys: [WORKOUTS_REACTIVITY_KEY],
  }),
);

export const workoutStatsAtom = AdminClient.query("workouts", "stats", {
  reactivityKeys: [WORKOUTS_REACTIVITY_KEY],
});

export const removeWorkoutAtom = AdminClient.mutation("workouts", "remove");
