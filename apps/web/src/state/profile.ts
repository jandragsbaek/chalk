import { RPC_METHODS } from "@chalk/contracts";

import { ChalkClient } from "../rpc/client.ts";

/** Profile reads register this key; saving the body or a weigh-in refetches the profile. */
export const PROFILE_REACTIVITY_KEY = "profile";

/** The whole athlete profile: sex, height, limbs and every weigh-in. */
export const profileAtom = ChalkClient.query(RPC_METHODS.profileGet, undefined, {
  reactivityKeys: [PROFILE_REACTIVITY_KEY],
});

export const updateProfileAtom = ChalkClient.mutation(RPC_METHODS.profileUpdate);

export const logBodyweightAtom = ChalkClient.mutation(RPC_METHODS.bodyweightsLog);

export const deleteBodyweightAtom = ChalkClient.mutation(RPC_METHODS.bodyweightsDelete);
