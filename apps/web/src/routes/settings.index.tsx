import { useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";

import { AthleteForm } from "../components/settings/AthleteForm.tsx";
import { BodyweightLog } from "../components/settings/BodyweightLog.tsx";
import { profileAtom } from "../state/profile.ts";

export const Route = createFileRoute("/settings/")({ component: ProfilePage });

/** Who is training (sex, height, limbs) and bodyweight over time. */
function ProfilePage() {
  return AsyncResult.match(useAtomValue(profileAtom), {
    onInitial: () => <p className="text-sm text-muted-foreground">Loading your profile...</p>,
    onFailure: () => (
      <p className="text-sm text-destructive">
        Could not load your profile. Is the server running?
      </p>
    ),
    onSuccess: ({ value }) => (
      <div className="grid grid-cols-[minmax(0,24rem)_minmax(0,1fr)] items-start gap-10">
        <AthleteForm profile={value} />
        <BodyweightLog entries={value.bodyweights} />
      </div>
    ),
  });
}
