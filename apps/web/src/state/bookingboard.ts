import { RPC_METHODS } from "@chalk/contracts";

import { ChalkClient } from "../rpc/client.ts";

/** The connection read registers this key; connecting or disconnecting refetches it. */
export const BOOKINGBOARD_REACTIVITY_KEY = "bookingboard";

/** Whether bookingboard is connected, and until when; never the token. */
export const bookingboardStatusAtom = ChalkClient.query(RPC_METHODS.bookingboardStatus, undefined, {
  reactivityKeys: [BOOKINGBOARD_REACTIVITY_KEY],
});

export const connectBookingboardAtom = ChalkClient.mutation(RPC_METHODS.bookingboardConnect);

export const disconnectBookingboardAtom = ChalkClient.mutation(RPC_METHODS.bookingboardDisconnect);

/** A day's class programs; run on demand from the plan and import pages. */
export const bookingboardDayAtom = ChalkClient.mutation(RPC_METHODS.bookingboardDay);
