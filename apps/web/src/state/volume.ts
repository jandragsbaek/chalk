import { RPC_METHODS } from "@chalk/contracts";

import { ChalkClient } from "../rpc/client.ts";
import { IMPORTS_REACTIVITY_KEY } from "./imports.ts";
import { PROFILE_REACTIVITY_KEY } from "./profile.ts";
import { CATALOG_REACTIVITY_KEY, LIFTS_REACTIVITY_KEY } from "./strength.ts";
import { WORKOUTS_REACTIVITY_KEY } from "./workouts.ts";

/**
 * Every week with something done. A save, a logged workout or set, a new movement, or switching
 * the athlete's sex (which side of an M/F split counts) refetches it.
 */
export const volumeWeeksAtom = ChalkClient.query(RPC_METHODS.volumeWeeks, undefined, {
  reactivityKeys: [
    WORKOUTS_REACTIVITY_KEY,
    IMPORTS_REACTIVITY_KEY,
    LIFTS_REACTIVITY_KEY,
    CATALOG_REACTIVITY_KEY,
    PROFILE_REACTIVITY_KEY,
  ],
});
