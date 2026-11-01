import { useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";

import { AthleteForm } from "../components/settings/AthleteForm.tsx";
import { BodyweightLog } from "../components/settings/BodyweightLog.tsx";
import { profileAtom } from "../state/profile.ts";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

/** The athlete's profile: who is training (sex, height, limbs) and bodyweight over time. */
function SettingsPage() {
  return (
    <main className="mx-auto grid w-full max-w-6xl content-start gap-8 px-6 pt-8 pb-16">
      <h1 className="protocol-title justify-self-start border-b-2 border-foreground pb-1.5 text-4xl">
        Settings
      </h1>
      <ProfileSections />
    </main>
  );
}

function ProfileSections() {
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
