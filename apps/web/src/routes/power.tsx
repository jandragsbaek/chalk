import type { AthleteProfile, CatalogMovement } from "@chalk/contracts";
import { useAtomValue } from "@effect/atom-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useState } from "react";

import { PowerTrend } from "../components/PowerTrend.tsx";
import { bodyOn, describeBody, sessionPowerRows, useProfile } from "../lib/power.ts";
import { localIsoDate } from "../lib/utils.ts";
import { catalogAtom } from "../state/imports.ts";
import { powerSessionsAtom } from "../state/power.ts";

export const Route = createFileRoute("/power")({ component: PowerPage });

function PowerSessions({
  profile,
  catalog,
}: {
  readonly profile: AthleteProfile | undefined;
  readonly catalog: ReadonlyArray<CatalogMovement>;
}) {
  return AsyncResult.match(useAtomValue(powerSessionsAtom), {
    onInitial: () => <p className="text-sm text-muted-foreground">Loading sessions...</p>,
    onFailure: () => (
      <p className="text-sm text-destructive">
        Could not load your sessions. Is the server running?
      </p>
    ),
    onSuccess: ({ value }) => <PowerTrend rows={sessionPowerRows(value, profile, catalog)} />,
  });
}

/** Estimated work and power per session, from the athlete's body and what each session asked. */
function PowerPage() {
  const catalog = AsyncResult.getOrElse(useAtomValue(catalogAtom), () => []);
  const profile = useProfile();
  // Fixed at mount, like the other pages' "today".
  const [today] = useState(() => localIsoDate(new Date()));
  const body = bodyOn(profile, today);

  return (
    <main className="grid gap-8">
      <section className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Power over time</h2>
          {body ? (
            <span className="text-sm text-muted-foreground">
              Estimated for {describeBody(body)} today, and your weigh-in on each session's day
            </span>
          ) : null}
        </div>
        {body === undefined ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Set your height and log a bodyweight in{" "}
            <Link to="/settings" className="underline underline-offset-2 hover:text-foreground">
              Settings
            </Link>{" "}
            and every session's work and power shows up here.
          </p>
        ) : (
          <PowerSessions profile={profile} catalog={catalog} />
        )}
      </section>
      <section className="grid max-w-prose gap-2 text-sm text-muted-foreground">
        <h2 className="text-lg font-semibold text-foreground">How it is estimated</h2>
        <p>
          Work is force times distance. Each rep raises your body and the load by distances read off
          your height and limbs: a pull-up lifts you by your arm's length, a squat by your thigh's,
          a thruster adds the bar from shoulders to overhead. Rower, ski and bike calories and
          metres, and runs, convert to joules. Power is that work over the block's time: a for-time
          score, an AMRAP's or EMOM's length.
        </p>
        <p>
          The watts are estimates, so compare a session with your own earlier ones, not with someone
          else's. Carries and holds move nothing upward and count as zero; each session lists what
          it could not count.
        </p>
      </section>
    </main>
  );
}
