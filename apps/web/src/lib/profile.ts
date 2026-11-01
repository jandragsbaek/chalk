import { DEFAULT_SEX, type Sex } from "@chalk/contracts";
import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";

import { profileAtom } from "../state/profile.ts";

/**
 * The athlete's side of every M/F load, from Settings. Male while the profile loads or fails,
 * the same default the server reads before anything is saved.
 */
export function useAthleteSex(): Sex {
  const profile = AsyncResult.getOrElse(useAtomValue(profileAtom), () => undefined);
  return profile?.sex ?? DEFAULT_SEX;
}
