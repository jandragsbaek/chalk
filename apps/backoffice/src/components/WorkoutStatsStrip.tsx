import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";

import { WORKOUT_KIND_LABELS } from "../lib/workoutKinds.ts";
import { workoutStatsAtom } from "../state/workouts.ts";

function Stat({ label, value }: { readonly label: string; readonly value: string | number }) {
  return (
    <div className="grid gap-1 rounded-lg border bg-card p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function WorkoutStatsStrip() {
  const result = useAtomValue(workoutStatsAtom);

  return AsyncResult.match(result, {
    onInitial: () => <div className="h-22 rounded-lg border border-dashed" />,
    onFailure: () => (
      <p className="text-sm text-destructive">Could not load stats. Is the admin server running?</p>
    ),
    onSuccess: ({ value: stats }) => (
      <section aria-label="Workout stats" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Workouts" value={stats.total} />
        <Stat
          label="Rx"
          value={stats.total === 0 ? "-" : `${Math.round((stats.rxCount / stats.total) * 100)}%`}
        />
        {stats.byKind.slice(0, 2).map(({ kind, count }) => (
          <Stat key={kind} label={WORKOUT_KIND_LABELS[kind]} value={count} />
        ))}
      </section>
    ),
  });
}
