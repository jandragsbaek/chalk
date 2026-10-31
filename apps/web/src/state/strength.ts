import { RPC_METHODS } from "@chalk/contracts";

import { ChalkClient } from "../rpc/client.ts";

/** Lift mutations pass this key so the set list and the rep maxes refetch after they succeed. */
export const LIFTS_REACTIVITY_KEY = "lifts";

export const movementsAtom = ChalkClient.query(RPC_METHODS.movementsList, undefined);

export const liftSetsAtom = ChalkClient.query(RPC_METHODS.liftsList, undefined, {
  reactivityKeys: [LIFTS_REACTIVITY_KEY],
});

export const liftRecordsAtom = ChalkClient.query(RPC_METHODS.liftsRecords, undefined, {
  reactivityKeys: [LIFTS_REACTIVITY_KEY],
});

export const logLiftSetAtom = ChalkClient.mutation(RPC_METHODS.liftsLog);

export const deleteLiftSetAtom = ChalkClient.mutation(RPC_METHODS.liftsDelete);
