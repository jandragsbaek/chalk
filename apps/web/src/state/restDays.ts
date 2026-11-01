import { RPC_METHODS } from "@chalk/contracts";

import { ChalkClient } from "../rpc/client.ts";

/** Rest-day reads register this key; marking or clearing a day, or a coach reply, refetches them. */
export const REST_DAYS_REACTIVITY_KEY = "rest-days";

/** Every day marked as rest, oldest first. */
export const restDaysAtom = ChalkClient.query(RPC_METHODS.restDaysList, undefined, {
  reactivityKeys: [REST_DAYS_REACTIVITY_KEY],
});

export const markRestDayAtom = ChalkClient.mutation(RPC_METHODS.restDaysMark);

export const clearRestDayAtom = ChalkClient.mutation(RPC_METHODS.restDaysClear);
