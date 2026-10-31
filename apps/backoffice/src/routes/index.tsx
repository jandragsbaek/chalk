import { createFileRoute } from "@tanstack/react-router";
import * as Schema from "effect/Schema";

import { WorkoutSearch } from "../components/WorkoutSearch.tsx";
import { WorkoutStatsStrip } from "../components/WorkoutStatsStrip.tsx";
import { WorkoutTable } from "../components/WorkoutTable.tsx";

/** The search term lives in the URL, so a result list can be linked and survives reload. */
const WorkoutsSearch = Schema.Struct({ q: Schema.optional(Schema.String) });

export const Route = createFileRoute("/")({
  validateSearch: Schema.toStandardSchemaV1(WorkoutsSearch),
  component: WorkoutsPage,
});

function WorkoutsPage() {
  const { q = "" } = Route.useSearch();
  return (
    <main className="grid gap-6 py-6">
      <WorkoutStatsStrip />
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold">Workouts</h1>
          <WorkoutSearch key={q} query={q} />
        </div>
        <WorkoutTable query={q.trim()} />
      </section>
    </main>
  );
}
