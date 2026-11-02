import { useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useState } from "react";

import { VolumeLedger } from "../components/volume/VolumeLedger.tsx";
import { catalogAtom } from "../state/imports.ts";
import { volumeWeeksAtom } from "../state/volume.ts";

export const Route = createFileRoute("/volume")({ component: VolumePage });

/** Reps, metres, calories and seconds per movement per ISO week, and tonnage. */
function VolumePage() {
  const catalog = AsyncResult.getOrElse(useAtomValue(catalogAtom), () => []);
  // Fixed at mount, like the other pages' "today".
  const [today] = useState(() => new Date());
  return AsyncResult.match(useAtomValue(volumeWeeksAtom), {
    onInitial: () => (
      <main className="px-8 pt-8" aria-busy="true">
        <p className="text-sm text-muted-foreground">Counting your weeks...</p>
      </main>
    ),
    onFailure: () => (
      <main className="mx-auto w-full max-w-2xl px-4 pt-8">
        <p className="border border-destructive bg-card px-4 py-3 text-sm text-destructive">
          Could not count your volume. Is the server running?
        </p>
      </main>
    ),
    onSuccess: ({ value }) => <VolumeLedger weeks={value} catalog={catalog} today={today} />,
  });
}
