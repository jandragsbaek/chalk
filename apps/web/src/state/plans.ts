import type { PlanId } from "@chalk/contracts";
import * as Atom from "effect/reactivity/Atom";

import { AdminClient } from "../api/client.ts";

/** Plan reads register this key; saving, deleting or logging a plan refetches them. */
export const PLANS_REACTIVITY_KEY = "plans";

export const plansAtom = AdminClient.query("plans", "list", {
  reactivityKeys: [PLANS_REACTIVITY_KEY],
});

/** One plan, for re-opening it to edit or to log what was done. */
export const planAtom = Atom.family((id: PlanId) =>
  AdminClient.query("plans", "get", { params: { id }, reactivityKeys: [PLANS_REACTIVITY_KEY] }),
);

export const savePlanAtom = AdminClient.mutation("plans", "save");

export const removePlanAtom = AdminClient.mutation("plans", "remove");
