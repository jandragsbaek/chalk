import { RPC_METHODS } from "@chalk/contracts";

import { ChalkClient } from "../rpc/client.ts";
import { WORKOUTS_REACTIVITY_KEY } from "./workouts.ts";

/** Every attempt at a benchmark; refetched whenever a workout is logged or deleted. */
export const benchmarkResultsAtom = ChalkClient.query(RPC_METHODS.benchmarksResults, undefined, {
  reactivityKeys: [WORKOUTS_REACTIVITY_KEY],
});
