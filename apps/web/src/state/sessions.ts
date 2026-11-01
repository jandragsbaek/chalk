import { AdminClient } from "../api/client.ts";
import { LIFTS_REACTIVITY_KEY } from "./strength.ts";
import { WORKOUTS_REACTIVITY_KEY } from "./workouts.ts";

/** The session register: refetched when a workout or a lift set is logged, imported or deleted. */
export const sessionsAtom = AdminClient.query("workouts", "sessions", {
  reactivityKeys: [WORKOUTS_REACTIVITY_KEY, LIFTS_REACTIVITY_KEY],
});

export const removeWorkoutAtom = AdminClient.mutation("workouts", "remove");
