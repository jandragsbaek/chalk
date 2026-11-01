import { RPC_METHODS } from "@chalk/contracts";

import { ChalkClient } from "../rpc/client.ts";
import { IMPORTS_REACTIVITY_KEY } from "./imports.ts";
import { WORKOUTS_REACTIVITY_KEY } from "./workouts.ts";

/** Every saved session work can be estimated for; a save or a logged workout refetches it. */
export const powerSessionsAtom = ChalkClient.query(RPC_METHODS.powerSessions, undefined, {
  reactivityKeys: [WORKOUTS_REACTIVITY_KEY, IMPORTS_REACTIVITY_KEY],
});
