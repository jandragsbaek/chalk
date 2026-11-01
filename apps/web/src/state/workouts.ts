import { RPC_METHODS } from "@chalk/contracts";

import { ChalkClient } from "../rpc/client.ts";

/** Every workout read (RPC or admin API) registers this key; writes pass it so all of them refetch. */
export const WORKOUTS_REACTIVITY_KEY = "workouts";

export const workoutsAtom = ChalkClient.query(RPC_METHODS.workoutsList, undefined, {
  reactivityKeys: [WORKOUTS_REACTIVITY_KEY],
});

export const logWorkoutAtom = ChalkClient.mutation(RPC_METHODS.workoutsLog);

export const deleteWorkoutAtom = ChalkClient.mutation(RPC_METHODS.workoutsDelete);
