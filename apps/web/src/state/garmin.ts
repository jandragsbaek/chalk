import { RPC_METHODS } from "@chalk/contracts";

import { ChalkClient } from "../rpc/client.ts";

/** The connection read registers this key; connecting, syncing or disconnecting refetches it. */
export const GARMIN_REACTIVITY_KEY = "garmin";

/** Whether Garmin is connected and how its last read went; never a token. */
export const garminStatusAtom = ChalkClient.query(RPC_METHODS.garminStatus, undefined, {
  reactivityKeys: [GARMIN_REACTIVITY_KEY],
});

export const connectGarminAtom = ChalkClient.mutation(RPC_METHODS.garminConnect);

export const syncGarminAtom = ChalkClient.mutation(RPC_METHODS.garminSync);

export const disconnectGarminAtom = ChalkClient.mutation(RPC_METHODS.garminDisconnect);
