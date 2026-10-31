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
    <main className="mx-auto grid w-full max-w-6xl content-start gap-5 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-foreground pb-3">
        <h1 className="protocol-title text-4xl">Workouts</h1>
        <WorkoutSearch key={q} query={q} />
      </div>
      <WorkoutStatsStrip />
      <WorkoutTable query={q.trim()} />
    </main>
  );
}
