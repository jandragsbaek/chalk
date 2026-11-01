import { RPC_METHODS, type CoachSendInput, type CoachThreadId } from "@chalk/contracts";
import * as Effect from "effect/Effect";
import * as Atom from "effect/reactivity/Atom";
import * as Stream from "effect/Stream";

import { applyCoachEvent, EMPTY_REPLY } from "../lib/coach.ts";
import { ChalkClient } from "../rpc/client.ts";
import { REST_DAYS_REACTIVITY_KEY } from "./restDays.ts";

/** Coach reads register this key; a finished (or broken) send refetches them. */
export const COACH_REACTIVITY_KEY = "coach";

export const coachStatusAtom = ChalkClient.query(RPC_METHODS.coachStatus, undefined);

export const coachThreadsAtom = ChalkClient.query(RPC_METHODS.coachThreads, undefined, {
  reactivityKeys: [COACH_REACTIVITY_KEY],
});

export const coachThreadAtom = Atom.family((id: CoachThreadId) =>
  ChalkClient.query(RPC_METHODS.coachThread, { id }, { reactivityKeys: [COACH_REACTIVITY_KEY] }),
);

/**
 * Sends a message and folds the streamed events into the reply in progress: the saved athlete
 * turn, each read as it starts and lands, then the saved coach turn. The coach may put a rest
 * day in the calendar, so a finished send refetches rest days too.
 */
export const coachSendAtom = ChalkClient.runtime.fn<CoachSendInput>()(
  (input) =>
    Stream.unwrap(
      ChalkClient.use((client) => Effect.succeed(client(RPC_METHODS.coachSend, input))),
    ).pipe(Stream.scan(() => EMPTY_REPLY, applyCoachEvent)),
  { reactivityKeys: [COACH_REACTIVITY_KEY, REST_DAYS_REACTIVITY_KEY] },
);
