import { useAtomValue } from "@effect/atom-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useId } from "react";

import { AthleteForm } from "../components/settings/AthleteForm.tsx";
import { MoreLink, SectionHead } from "../components/today/SectionHead.tsx";
import { profileAtom } from "../state/profile.ts";

export const Route = createFileRoute("/settings/")({ component: ProfilePage });

/** Where bodyweight went: the Body page, beside body fat and muscle mass. */
function BodyPointer() {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-title`} className="grid content-start">
      <SectionHead
        id={`${id}-title`}
        title="Bodyweight"
        meta={
          <Link to="/body">
            <MoreLink>Body</MoreLink>
          </Link>
        }
      />
      <p className="border-b bg-card px-4 py-4 text-sm text-muted-foreground">
        Weigh-ins, body fat and muscle mass are on{" "}
        <Link to="/body" className="underline hover:text-foreground">
          Body
        </Link>
        . Work and power read the latest weigh-in on or before each session.
      </p>
    </section>
  );
}

/** Who is training (sex, height, limbs); bodyweight over time lives on Body. */
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
        <BodyPointer />
      </div>
    ),
  });
}
