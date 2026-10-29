import { RPC_METHODS } from "@chalk/contracts";

import { ChalkClient } from "../rpc/client.ts";

/** Mutations pass this key so the workout list refetches after they succeed. */
export const WORKOUTS_REACTIVITY_KEY = "workouts";

export const workoutsAtom = ChalkClient.query(RPC_METHODS.workoutsList, undefined, {
  reactivityKeys: [WORKOUTS_REACTIVITY_KEY],
});

export const logWorkoutAtom = ChalkClient.mutation(RPC_METHODS.workoutsLog);

export const deleteWorkoutAtom = ChalkClient.mutation(RPC_METHODS.workoutsDelete);
