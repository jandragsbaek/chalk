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

/** Attendance reads register this key; a check, a skip or a pulled class refetches them. */
export const ATTENDANCE_REACTIVITY_KEY = "bookingboard-attendance";

/**
 * The classes the athlete attended, from the server's copy of their bookings. The server reads
 * bookingboard for it only when the copy is half an hour old, so opening the page is cheap.
 */
export const attendanceAtom = ChalkClient.query(
  RPC_METHODS.bookingboardAttendance,
  { check: "ifStale" },
  { reactivityKeys: [ATTENDANCE_REACTIVITY_KEY, BOOKINGBOARD_REACTIVITY_KEY] },
);

/** "Check now" and "Reach back": the same read, asked for; pass the attendance key to refetch. */
export const checkAttendanceAtom = ChalkClient.mutation(RPC_METHODS.bookingboardAttendance);

export const skipDayAtom = ChalkClient.mutation(RPC_METHODS.bookingboardSkipDay);
