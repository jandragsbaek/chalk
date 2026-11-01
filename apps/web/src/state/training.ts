import { RPC_METHODS } from "@chalk/contracts";

import { ChalkClient } from "../rpc/client.ts";

/** Block reads register this key; every block and session write passes it so the list refetches. */
export const BLOCKS_REACTIVITY_KEY = "blocks";

/** Every training block, drafts included, each with its sessions by day. */
export const blocksAtom = ChalkClient.query(RPC_METHODS.blocksList, undefined, {
  reactivityKeys: [BLOCKS_REACTIVITY_KEY],
});

export const scheduleBlockAtom = ChalkClient.mutation(RPC_METHODS.blocksSchedule);

export const removeBlockAtom = ChalkClient.mutation(RPC_METHODS.blocksRemove);

export const setTrainingMaxAtom = ChalkClient.mutation(RPC_METHODS.blocksSetTrainingMax);

export const moveSessionAtom = ChalkClient.mutation(RPC_METHODS.sessionsMove);

export const tickLineAtom = ChalkClient.mutation(RPC_METHODS.sessionsTick);

export const removeSessionAtom = ChalkClient.mutation(RPC_METHODS.sessionsRemove);
